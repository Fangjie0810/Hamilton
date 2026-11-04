"""Six bounded Ark Pro still-image requests. Default is dry-run; never submits video."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import argparse
import base64
import hashlib
import json
import os
import subprocess
import sys
import time

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE.parents[1]
sys.path.insert(0, str(BASE.parent / "cg-ark-firstframes-v4" / "api"))
from seedream_group import Client, read_key, private_json, stamp, image_info

ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations"


def announce(sid, status, **details):
    print(json.dumps({"shot": sid, "status": status, **details}), flush=True)


def download_existing(shot, run):
    state_file = run / "state.json"
    state = json.loads(state_file.read_text())
    response_file = run / "response.json"
    if not response_file.exists():
        announce(shot["id"], "no_saved_response_do_not_resubmit")
        return False
    response = json.loads(response_file.read_text())
    items = response.get("data", [])
    if len(items) != 1 or not isinstance(items[0].get("url"), str):
        state.update(status="no_image_result", has_error=bool(response.get("error")))
        private_json(state_file, state)
        announce(shot["id"], state["status"])
        return False
    original = run / "original.png"
    try:
        info = image_info(original) if original.exists() else Client().download(items[0]["url"], original)
        state.update(status="complete", image=info, usage=response.get("usage"), completed_at=stamp())
        private_json(state_file, state)
        announce(shot["id"], "original_saved", width=info["width"], height=info["height"], usage=state["usage"])
        return True
    except Exception as error:
        state.update(status="download_failed", exception_type=type(error).__name__)
        private_json(state_file, state)
        announce(shot["id"], "download_failed_url_preserved")
        return False


def generate_one(shot, plan, key):
    sid = shot["id"]
    run = BASE / "runs" / shot.get("run_id", sid)
    if run.exists():
        announce(sid, "existing_run_preserved_no_post")
        return False
    run.mkdir(parents=True, mode=0o700, exist_ok=False)
    payload = {"model": plan["model"], "prompt": (BASE / shot["image_prompt"]).read_text(),
               "size": plan["size"], "output_format": "png", "response_format": "url", "watermark": False}
    if shot.get("edit_source"):
        source = BASE / shot["edit_source"]
        info = image_info(source)
        if info["bytes"] > 30 * 1024 * 1024:
            raise ValueError("Input image exceeds the verified image limit.")
        payload["image"] = "data:image/png;base64," + base64.b64encode(source.read_bytes()).decode("ascii")
    data = json.dumps(payload, ensure_ascii=False).encode()
    request_file = run / "request.json"
    fd = os.open(request_file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())
    state = {"version": 1, "shot": sid, "status": "intent", "created_at": stamp(),
             "model": plan["model"], "expected_images": 1, "automatic_retries": 0,
             "payload_sha256": hashlib.sha256(data).hexdigest()}
    private_json(run / "state.json", state)
    for name in ("http-headers.txt", "response-body.json", "transport-error.txt"):
        fd = os.open(run / name, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        os.close(fd)
    config = 'url = "' + ENDPOINT + '"\n'
    config += 'header = "Content-Type: application/json"\nheader = "Accept: application/json"\n'
    config += 'header = "Authorization: Bearer ' + key + '"\n'
    command = ["/usr/bin/curl", "--config", "-", "--silent", "--show-error", "--proto", "=https",
               "--connect-timeout", "30", "--max-time", "600", "--request", "POST",
               "--data-binary", "@" + str(request_file), "--dump-header", str(run / "http-headers.txt"),
               "--output", str(run / "response-body.json"), "--write-out", "%{http_code}"]
    announce(sid, "submitting_one_image")
    start = time.monotonic()
    with (run / "transport-error.txt").open("wb") as error_file:
        result = subprocess.run(command, input=config.encode(), stdout=subprocess.PIPE, stderr=error_file)
    code = result.stdout.decode(errors="replace").strip()
    state.update(curl_exit_code=result.returncode, http_status=int(code) if code.isdigit() else None,
                 elapsed_seconds=round(time.monotonic() - start, 3))
    raw = (run / "response-body.json").read_bytes()
    if key.encode() in raw:
        state.update(status="response_suppressed_credential_echo")
        (run / "response-body.json").write_bytes(b"")
        private_json(run / "state.json", state)
        announce(sid, state["status"])
        return False
    try:
        response = json.loads(raw)
        if not isinstance(response, dict):
            raise ValueError()
        private_json(run / "response.json", response)
    except (ValueError, UnicodeError):
        state.update(status="unknown", response_bytes=len(raw))
        private_json(run / "state.json", state)
        announce(sid, "unknown_no_automatic_retry", http_status=state["http_status"])
        return False
    state["status"] = "response_saved"
    private_json(run / "state.json", state)
    return download_existing(shot, run)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--resume-downloads", action="store_true")
    parser.add_argument("--repair-e03", action="store_true", help="One image edit of the observed modern scrap; never reruns the other five")
    args = parser.parse_args()
    plan = json.loads((BASE / "environment-plan.json").read_text())
    assert plan["model"] == "doubao-seedream-5-0-pro-260628"
    assert len(plan["shots"]) == 6 and {s["id"] for s in plan["shots"]} == {"E%02d" % i for i in range(1, 7)}
    if args.repair_e03:
        shot = {"id": "E03", "run_id": "E03-repair-01", "image_prompt": "prompts/images/E03-repair.txt", "edit_source": "runs/E03/original.png"}
        if not args.execute:
            print("DRY RUN: one localized E03 edit, estimated normal price CNY 0.60. No key read or network.")
            return 0
        if args.resume_downloads:
            return 0 if download_existing(shot, BASE / "runs" / shot["run_id"]) else 2
        return 0 if generate_one(shot, plan, read_key(ROOT / ".env.ark.local")) else 2
    if not args.execute:
        print("DRY RUN: 6 distinct 2560x1440 Pro stills, estimated normal price CNY 3.60. No key read or network.")
        return 0
    if args.resume_downloads:
        results = [download_existing(s, BASE / "runs" / s["id"]) for s in plan["shots"]]
    else:
        key = read_key(ROOT / ".env.ark.local")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda shot: generate_one(shot, plan, key), plan["shots"]))
    print(json.dumps({"saved_images": sum(results), "expected": 6, "video_requests": 0}), flush=True)
    return 0 if all(results) else 2


if __name__ == "__main__":
    raise SystemExit(main())
