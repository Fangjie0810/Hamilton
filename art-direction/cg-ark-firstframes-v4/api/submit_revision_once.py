"""One bounded, image-only revision request. Re-running is refused by the run folder."""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import os
import re
import subprocess

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE.parents[1]


def private(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as stream:
        stream.write(data)
        stream.flush()
        os.fsync(stream.fileno())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--part", choices=["young-man", "childhood", "reader", "departure", "departure-pro"], default="young-man")
    args = parser.parse_args()
    if args.part == "departure-pro":
        RUN = BASE / "runs" / "group-07-departure-pro"
        prompt_name, count, order = "S07-单包登船-pro.txt", 1, ["S07"]
        reason = "Correct duplicated luggage using one pro text-to-image still."
    elif args.part == "reader":
        RUN = BASE / "runs" / "group-05-reader"
        prompt_name, count, order = "S06-读者独立首帧.txt", 1, ["S06"]
        reason = "Correct wrong protagonist substitution in the supporting-reader scene."
    elif args.part == "departure":
        RUN = BASE / "runs" / "group-06-departure"
        prompt_name, count, order = "S07-登船独立首帧.txt", 1, ["S07"]
        reason = "Remove modern rubber tyres and motorboat structure while preserving usable boarding geometry."
    elif args.part == "childhood":
        RUN = BASE / "runs" / "group-04-childhood"
        prompt_name, count = "童年段修正组图提示词.txt", 2
        order = ["S01", "S02"]
        reason = "Retain paired composition while correcting modern haircut, trousers and overly healthy mother."
    else:
        RUN = BASE / "runs" / "group-03-young-man"
        prompt_name, count = "少年段修正组图提示词.txt", 5
        order = ["S05", "S04", "S03", "S06", "S07"]
        reason = "Correct child age leakage, modern objects and physical action starts after visual review."
    lines = [line.split("=", 1)[1].strip().strip('"').strip("'")
             for line in (ROOT / ".env.ark.local").read_text().splitlines()
             if line.strip().startswith("ARK_API_KEY=")]
    if len(lines) != 1 or not re.fullmatch(r"[A-Za-z0-9._~+/-]{8,4096}={0,2}", lines[0]):
        raise SystemExit("Invalid local credential format; no request made.")
    payload = {"model": "doubao-seedream-5-0-260128",
               "prompt": (BASE / prompt_name).read_text(),
               "size": "2560x1440", "sequential_image_generation": "auto",
               "sequential_image_generation_options": {"max_images": count},
               "stream": True, "output_format": "png", "response_format": "url", "watermark": False}
    synchronous = args.part == "departure-pro"
    if synchronous:
        payload["model"] = "doubao-seedream-5-0-pro-260628"
        for field in ("stream", "sequential_image_generation", "sequential_image_generation_options"):
            payload.pop(field)
    output_name = "response-body.json" if synchronous else "events.sse"
    data = json.dumps(payload, ensure_ascii=False).encode()
    RUN.mkdir(parents=True, mode=0o700, exist_ok=False)
    private(RUN / "request.json", data)
    private(RUN / "intent.json", json.dumps({
        "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "model": payload["model"], "max_images": count, "stream": not synchronous,
        "request_sha256": hashlib.sha256(data).hexdigest(), "automatic_retries": 0,
        "reason": reason, "shot_order": order,
    }).encode())
    for name in ("http-headers.txt", output_name, "transport-error.txt"):
        private(RUN / name, b"")
    config = 'url = "https://ark.cn-beijing.volces.com/api/v3/images/generations"\n'
    config += 'header = "Content-Type: application/json"\n'
    config += 'header = "Accept: ' + ("application/json" if synchronous else "text/event-stream") + '"\n'
    config += 'header = "Authorization: Bearer ' + lines[0] + '"\n'
    print("Submitting one %d-image correction group; no video request." % count, flush=True)
    args = ["/usr/bin/curl", "--config", "-", "--silent", "--show-error", "--no-buffer", "--proto", "=https",
            "--connect-timeout", "30", "--max-time", "900", "--request", "POST",
            "--data-binary", "@" + str(RUN / "request.json"), "--dump-header", str(RUN / "http-headers.txt"),
            "--output", str(RUN / output_name)]
    with (RUN / "transport-error.txt").open("wb") as error:
        result = subprocess.run(args, input=config.encode(), stdout=subprocess.DEVNULL, stderr=error)
    private(RUN / "transport-result.json", json.dumps({
        "curl_exit_code": result.returncode, "response_bytes": (RUN / output_name).stat().st_size,
        "finished_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }).encode())
    print("Image correction transport finished; exit=%d. No retry." % result.returncode, flush=True)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
