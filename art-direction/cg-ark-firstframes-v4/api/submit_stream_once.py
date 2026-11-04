"""One explicit, non-retrying SSE image request; credentials travel only via stdin."""
from pathlib import Path
import datetime
import hashlib
import json
import os
import re
import subprocess

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE.parents[1]
RUN = BASE / "runs" / "group-02-stream"


def write_private(path, data):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "wb") as f:
        f.write(data)
        f.flush()
        os.fsync(f.fileno())


def main():
    key_lines = [line.split("=", 1)[1].strip().strip('"').strip("'")
                 for line in (ROOT / ".env.ark.local").read_text().splitlines()
                 if line.strip().startswith("ARK_API_KEY=")]
    if len(key_lines) != 1 or not re.fullmatch(r"[A-Za-z0-9._~+/-]{8,4096}={0,2}", key_lines[0]):
        raise SystemExit("Local credential format is invalid; no request made.")
    key = key_lines[0]
    payload = {
        "model": "doubao-seedream-5-0-260128",
        "prompt": (BASE / "七镜组图提示词.txt").read_text(),
        "size": "2560x1440", "sequential_image_generation": "auto",
        "sequential_image_generation_options": {"max_images": 7},
        "stream": True, "output_format": "png", "response_format": "url", "watermark": False,
    }
    request_bytes = json.dumps(payload, ensure_ascii=False).encode()
    RUN.mkdir(parents=True, mode=0o700, exist_ok=False)
    os.chmod(RUN, 0o700)
    write_private(RUN / "request.json", request_bytes)
    write_private(RUN / "intent.json", json.dumps({
        "started_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "intent", "model": payload["model"], "stream": True, "max_images": 7,
        "request_sha256": hashlib.sha256(request_bytes).hexdigest(),
        "prior_run": "group-01", "prior_outcome": "unknown", "automatic_retries": 0,
    }).encode())
    for name in ("http-headers.txt", "events.sse", "transport-error.txt"):
        write_private(RUN / name, b"")
    config = 'url = "https://ark.cn-beijing.volces.com/api/v3/images/generations"\n'
    config += 'header = "Content-Type: application/json"\n'
    config += 'header = "Accept: text/event-stream"\n'
    config += 'header = "Authorization: Bearer ' + key + '"\n'
    print("Submitting one streaming image group; original events are saved as they arrive.", flush=True)
    args = ["curl", "--config", "-", "--silent", "--show-error", "--no-buffer", "--proto", "=https",
            "--connect-timeout", "30", "--max-time", "900", "--request", "POST",
            "--data-binary", "@" + str(RUN / "request.json"), "--dump-header", str(RUN / "http-headers.txt"),
            "--output", str(RUN / "events.sse")]
    with (RUN / "transport-error.txt").open("wb") as err:
        result = subprocess.run(args, input=config.encode(), stdout=subprocess.DEVNULL, stderr=err)
    write_private(RUN / "transport-result.json", json.dumps({
        "curl_exit_code": result.returncode, "event_bytes": (RUN / "events.sse").stat().st_size,
        "finished_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "note": "Inspect retained SSE events; transport success alone is not seven-image success.",
    }).encode())
    print("Transport finished; exit=%d, retained_event_bytes=%d. No retry was made."
          % (result.returncode, (RUN / "events.sse").stat().st_size), flush=True)
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())
