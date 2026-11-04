#!/usr/bin/env python3
"""Conservative Ark Seedance 2.5 runner; network requires --execute."""

import argparse
import base64
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import struct
import sys
import tempfile
import time
from datetime import datetime, timezone
import urllib.error
import urllib.parse
import urllib.request


BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
DEFAULT_MODEL = "doubao-seedance-2-5-260628"
DEFAULT_MANIFEST = Path(__file__).resolve().parent.parent / "manifest.json"
TERMINAL = {"succeeded", "failed", "cancelled", "expired"}
ACTIVE = {"submitted", "queued", "running"}
MAX_BODY = 64 * 1024 * 1024
MAX_ERROR_BODY = 64 * 1024


def safe_error_code(value, secret=None):
    """Keep only a short ASCII identifier, never a known credential echo."""
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]{0,127}", value):
        return None
    if secret and secret in value:
        return None
    return value


def response_error_code(response, secret=None):
    detail = response.get("error") if isinstance(response, dict) else None
    return safe_error_code(detail.get("code"), secret) if isinstance(detail, dict) else None


def error_code_hint(code):
    return " Check error_code " + code + " in the official error documentation." if code else ""


class BatchError(Exception):
    pass


class HTTPFailure(Exception):
    def __init__(self, status, error_code=None):
        self.status = status
        self.error_code = safe_error_code(error_code)
        super().__init__("HTTP %s" % status)


class UnknownOutcome(BatchError):
    pass


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True).encode("utf-8")


def save_run(path, run):
    """Atomically replace a private run file after flushing intent/task IDs."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    run["updated_at"] = now()
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent,
                                         prefix=".ark-run-", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(json_bytes(run))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        temporary = None
        if hasattr(os, "O_DIRECTORY"):
            directory = os.open(str(path.parent), os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


@contextlib.contextmanager
def run_lock(path):
    """A stale lock intentionally requires human review after a process crash."""
    lock = Path(str(path) + ".lock")
    lock.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise BatchError("Run is locked; check for a live process before removing its .lock file.")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(str(os.getpid()))
        yield
    finally:
        lock.unlink(missing_ok=True)


def load_run(path):
    try:
        run = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise BatchError("Cannot read run JSON.")
    if not isinstance(run, dict) or run.get("version") != 1 or not isinstance(run.get("shots"), dict):
        raise BatchError("Unsupported run file.")
    for sid, job in run["shots"].items():
        if not re.fullmatch(r"S\d{2}", sid) or not isinstance(job, dict):
            raise BatchError("Run contains an invalid shot record.")
        if job.get("status") not in TERMINAL | ACTIVE | {"intent", "unknown"}:
            raise BatchError("Run contains an invalid status.")
        task_id = job.get("task_id")
        if task_id is not None and (not isinstance(task_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", task_id)):
            raise BatchError("Run contains an invalid task ID.")
        if job.get("status") == "succeeded" and not task_id:
            raise BatchError("A succeeded run record needs its task ID.")
    return run


def relative_file(root, value, label):
    root = Path(root).resolve()
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise BatchError(label + " must be a relative file path.")
    path = (root / value).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        raise BatchError(label + " must stay inside the manifest directory.")
    if not path.is_file():
        raise BatchError(label + " file is missing.")
    return path


def png_info(path):
    data = path.read_bytes()
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise BatchError("First frame must be a PNG with an IHDR header.")
    width, height = struct.unpack(">II", data[16:24])
    if not (300 <= width <= 6000 and 300 <= height <= 6000):
        raise BatchError("First frame dimensions must each be 300..6000 pixels.")
    if not 0.4 <= width / height <= 2.5 or len(data) >= 30 * 1024 * 1024:
        raise BatchError("First frame exceeds Ark image ratio/size limits.")
    return data, width, height


def load_manifest(path):
    path = Path(path).resolve()
    try:
        manifest = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise BatchError("Cannot read manifest JSON.")
    if not isinstance(manifest, dict) or manifest.get("version") != 3:
        raise BatchError("Manifest version must be 3.")
    defaults = manifest.get("defaults")
    allowed = {"model", "resolution", "ratio", "generate_audio", "output_format"}
    if not isinstance(defaults, dict) or set(defaults) != allowed:
        raise BatchError("Defaults must contain exactly model, resolution, ratio, generate_audio, output_format.")
    if defaults["model"] != DEFAULT_MODEL:
        raise BatchError("Manifest must name the verified Seedance 2.5 model; use ARK_MODEL_ID for an endpoint override.")
    if defaults["resolution"] not in {"720p", "1080p"}:
        raise BatchError("This production runner accepts 720p or 1080p.")
    if defaults["ratio"] != "adaptive" or defaults["generate_audio"] is not False or defaults["output_format"] != "mp4":
        raise BatchError("First-frame production requires adaptive, generate_audio=false, output_format=mp4.")
    shots = manifest.get("shots")
    if not isinstance(shots, list) or not shots:
        raise BatchError("Manifest shots must be a nonempty list.")
    seen = set()
    for shot in shots:
        if not isinstance(shot, dict):
            raise BatchError("Each shot must be an object.")
        sid = shot.get("id")
        if not isinstance(sid, str) or not re.fullmatch(r"S\d{2}", sid) or sid in seen:
            raise BatchError("Shot IDs must be unique S01-style identifiers.")
        seen.add(sid)
        if not isinstance(shot.get("title"), str) or not shot["title"].strip():
            raise BatchError(sid + " needs a title.")
        duration = shot.get("duration")
        if type(duration) is not int or not 4 <= duration <= 30:
            raise BatchError(sid + " duration must be an integer from 4 to 30.")
        prompt = relative_file(path.parent, shot.get("prompt_file"), sid + " prompt")
        try:
            prompt_text = prompt.read_text(encoding="utf-8").strip()
        except (OSError, UnicodeError):
            raise BatchError(sid + " prompt must be readable UTF-8.")
        if not prompt_text:
            raise BatchError(sid + " prompt is empty.")
        frame = relative_file(path.parent, shot.get("first_frame"), sid + " first frame")
        png_info(frame)
        edit = shot.get("edit")
        if not isinstance(edit, dict) or not all(k in edit for k in ("in", "out", "start", "end")):
            raise BatchError(sid + " needs edit in/out/start/end.")
        values = [edit[k] for k in ("in", "out", "start", "end")]
        if any(type(v) not in (int, float) for v in values):
            raise BatchError(sid + " edit values must be numbers.")
        a, b, c, d = values
        if not (0 <= a < b <= duration and 0 <= c < d and abs((b-a)-(d-c)) < 0.001):
            raise BatchError(sid + " edit ranges are inconsistent.")
    return path, manifest


def select_shots(manifest, ids):
    requested = [part for token in ids for part in token.split(",") if part]
    if requested == ["all"]:
        return manifest["shots"]
    known = {s["id"] for s in manifest["shots"]}
    if not requested or len(requested) != len(set(requested)) or any(s not in known for s in requested):
        raise BatchError("Use --ids all or unique existing shot IDs.")
    return [s for s in manifest["shots"] if s["id"] in requested]


def build_payload(manifest_path, manifest, shot, resolution=None, model_override=None):
    root = manifest_path.parent
    frame, _, _ = png_info(relative_file(root, shot["first_frame"], "First frame"))
    prompt = relative_file(root, shot["prompt_file"], "Prompt").read_text(encoding="utf-8").strip()
    model = model_override or manifest["defaults"]["model"]
    if not isinstance(model, str) or not re.fullmatch(r"[A-Za-z0-9_.-]+", model):
        raise BatchError("ARK_MODEL_ID is not a valid model/endpoint identifier.")
    payload = dict(manifest["defaults"])
    payload.update(model=model, duration=shot["duration"], content=[
        {"type": "text", "text": prompt},
        {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(frame).decode("ascii")},
         "role": "first_frame"},
    ])
    if resolution:
        if resolution not in {"720p", "1080p"}:
            raise BatchError("Resolution must be 720p or 1080p.")
        payload["resolution"] = resolution
    if len(json_bytes(payload)) > MAX_BODY:
        raise BatchError("Encoded request exceeds 64 MiB.")
    return payload


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ArkClient:
    def __init__(self, api_key):
        self._key = api_key
        self._opener = urllib.request.build_opener(NoRedirect())

    def request(self, method, path, body=None):
        request = urllib.request.Request(BASE_URL + path, data=json_bytes(body) if body is not None else None,
                                         method=method, headers={"Authorization": "Bearer " + self._key,
                                         "Content-Type": "application/json"})
        try:
            with self._opener.open(request, timeout=60) as response:
                return json.loads(response.read())
        except urllib.error.HTTPError as error:
            # Inspect a bounded body only for error.code; never retain message/headers.
            code = None
            try:
                raw = error.read(MAX_ERROR_BODY + 1)
                if len(raw) <= MAX_ERROR_BODY:
                    code = response_error_code(json.loads(raw), self._key)
            except Exception:
                pass
            finally:
                error.close()
            raise HTTPFailure(error.code, code) from None

    def download(self, url, target):
        if not isinstance(url, str) or urllib.parse.urlsplit(url).scheme != "https":
            raise BatchError("Video URL must use HTTPS.")
        target = Path(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        count = 0
        checksum = hashlib.sha256()
        prefix = b""
        expected_length = None
        try:
            with tempfile.NamedTemporaryFile(mode="wb", dir=target.parent, prefix=".ark-video-", delete=False) as stream:
                temporary = Path(stream.name)
                # Deliberately do not send the Ark Authorization header to media URLs.
                with urllib.request.urlopen(url, timeout=60) as response:
                    length = response.headers.get("Content-Length", "")
                    if length.isdigit():
                        expected_length = int(length)
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        if len(prefix) < 64:
                            prefix += chunk[:64-len(prefix)]
                        count += len(chunk)
                        checksum.update(chunk)
                        stream.write(chunk)
                stream.flush()
                os.fsync(stream.fileno())
            if count == 0:
                raise BatchError("Downloaded video was empty.")
            if expected_length is not None and count != expected_length:
                raise BatchError("Downloaded video length was incomplete.")
            if b"ftyp" not in prefix:
                raise BatchError("Downloaded response does not look like an MP4 file.")
            os.replace(temporary, target)
            temporary = None
            return {"path": str(target.resolve()), "bytes": count, "sha256": checksum.hexdigest()}
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)


def retry_request(client, method, path, body=None, sleep=time.sleep):
    """Retry only explicit 429 rejection; unknown POST results are never retried."""
    for attempt in range(4):
        try:
            return client.request(method, path, body)
        except HTTPFailure as error:
            if error.status != 429 or attempt == 3:
                raise
            sleep(min(2 ** (attempt + 1), 16))


def create_one(client, run_path, run, shot, payload, sleep=time.sleep):
    sid = shot["id"]
    if sid in run["shots"]:
        raise BatchError(sid + " already has an intent; it will not be submitted again.")
    job = {"shot_id": sid, "title": shot["title"], "status": "intent", "intent_at": now(),
           "payload_sha256": digest(json_bytes(payload)), "model": payload["model"],
           "duration": payload["duration"], "resolution": payload["resolution"]}
    run["shots"][sid] = job
    save_run(run_path, run)  # This must happen before any POST.
    try:
        result = retry_request(client, "POST", "/contents/generations/tasks", payload, sleep)
        task_id = result.get("id") if isinstance(result, dict) else None
        if not isinstance(task_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", task_id):
            raise UnknownOutcome("Create returned no usable task ID.")
    except HTTPFailure as error:
        # A 408 or 5xx may have happened after the service accepted the request.
        job["status"] = "failed" if 400 <= error.status < 500 and error.status != 408 else "unknown"
        job["phase"] = "create"
        job["error_kind"] = "http_%d" % error.status
        code = safe_error_code(error.error_code, getattr(client, "_key", None))
        if code:
            job["error_code"] = code
        save_run(run_path, run)
        if job["status"] == "unknown":
            raise UnknownOutcome(sid + " submission outcome unknown; inspect the console before any new run." + error_code_hint(code)) from None
        raise BatchError(sid + " create request was rejected; no automatic resubmission." + error_code_hint(code)) from None
    except (Exception, KeyboardInterrupt):
        job["status"] = "unknown"
        job["phase"] = "create"
        job["error_kind"] = "ambiguous_create_result"
        save_run(run_path, run)
        raise UnknownOutcome(sid + " submission outcome unknown; inspect the console before any new run.") from None
    job.update(status="submitted", task_id=task_id, accepted_at=now())
    save_run(run_path, run)  # Save task ID before polling or downloading.
    return job


def downloaded(job):
    info = job.get("download")
    if not isinstance(info, dict):
        return False
    path = Path(info.get("path", ""))
    if not path.is_file() or path.stat().st_size != info.get("bytes"):
        return False
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(chunk)
    return checksum.hexdigest() == info.get("sha256")


def watch_run(client, run_path, run, ids=None, interval=10, max_polls=360, sleep=time.sleep, out=print):
    if interval < 10 or max_polls < 1:
        raise BatchError("Watch interval must be at least 10 seconds and max-polls at least 1.")
    selected = ids or list(run["shots"])
    for sid in selected:
        if sid not in run["shots"]:
            raise BatchError("Unknown shot in run.")
        if run["shots"][sid].get("status") == "intent":
            run["shots"][sid].update(status="unknown", error_kind="interrupted_after_intent")
            save_run(run_path, run)
    for poll in range(max_polls):
        active = False
        for sid in selected:
            job = run["shots"][sid]
            if job.get("status") in ACTIVE:
                task_id = job.get("task_id")
                if not task_id:
                    job.update(status="unknown", error_kind="missing_task_id")
                    save_run(run_path, run)
                    continue
                try:
                    response = retry_request(client, "GET", "/contents/generations/tasks/" + urllib.parse.quote(task_id, safe=""), sleep=sleep)
                    status = response.get("status") if isinstance(response, dict) else None
                    if status not in TERMINAL | {"queued", "running"}:
                        raise BatchError("Query returned an unrecognized status; run preserved for inspection.")
                except Exception as error:
                    job["last_error_kind"] = "query_failed"
                    code = safe_error_code(error.error_code, getattr(client, "_key", None)) if isinstance(error, HTTPFailure) else None
                    if code:
                        job["error_code"] = code
                    save_run(run_path, run)
                    raise BatchError(sid + " query failed; resume watch later using the existing task ID." + error_code_hint(code)) from None
                job["status"] = status
                job["last_checked_at"] = now()
                job.pop("error_code", None)
                code = response_error_code(response, getattr(client, "_key", None))
                if code:
                    job["error_code"] = code
                if status == "succeeded":
                    content = response.get("content") or {}
                    job["video_url"] = content.get("video_url") if isinstance(content, dict) else None
                    job["result"] = {key: response[key] for key in ("duration", "resolution", "ratio", "generate_audio", "model") if key in response}
                elif status in {"failed", "expired"}:
                    job["error_kind"] = "remote_" + status
                save_run(run_path, run)
                out(sid + ": " + status + error_code_hint(code))
            if job.get("status") == "succeeded" and not downloaded(job):
                target = Path(run_path).resolve().parent / "videos" / (sid + "-" + job["task_id"] + ".mp4")
                try:
                    job["download"] = client.download(job.get("video_url"), target)
                except Exception:
                    job["download_status"] = "failed"
                    save_run(run_path, run)
                    raise BatchError(sid + " download failed; resume watch to retry the existing result.") from None
                job["download_status"] = "succeeded"
                save_run(run_path, run)
                out(sid + ": downloaded")
            active = active or job.get("status") in ACTIVE
        if not active:
            return all(run["shots"][sid].get("status") == "succeeded" and downloaded(run["shots"][sid]) for sid in selected)
        if poll + 1 < max_polls:
            sleep(interval)
    out("Watch limit reached; task IDs are saved. Resume watch; do not resubmit.")
    return False


def client_from_environment(factory=ArkClient):
    key = os.environ.get("ARK_API_KEY")
    if not key:
        raise BatchError("ARK_API_KEY is required for --execute; enter it in your shell, never in this file.")
    return factory(key)


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("validate", help="Offline validation; never uses the network.")
    submit = sub.add_parser("submit", help="Dry-run by default; --execute submits and watches sequentially.")
    submit.add_argument("--ids", nargs="+", required=True)
    submit.add_argument("--resolution", choices=["720p", "1080p"])
    submit.add_argument("--run", type=Path)
    submit.add_argument("--execute", action="store_true")
    watch = sub.add_parser("watch", help="Resume saved tasks without creating tasks; --execute enables network.")
    watch.add_argument("--run", type=Path, required=True)
    watch.add_argument("--execute", action="store_true")
    for command in (submit, watch):
        command.add_argument("--interval", type=float, default=10)
        command.add_argument("--max-polls", type=int, default=360)
    return p


def main(argv=None, client_factory=ArkClient, sleep=time.sleep, out=print):
    args = parser().parse_args(argv)
    try:
        if args.command == "watch":
            run_path = args.run.resolve()
            run = load_run(run_path)
            if not args.execute:
                for sid, job in run["shots"].items():
                    out(sid + ": " + str(job.get("status", "missing_status")))
                out("DRY RUN: no queries or downloads; add --execute to watch existing tasks.")
                return 0
            if args.interval < 10 or args.max_polls < 1:
                raise BatchError("Interval must be >=10 and max-polls >=1.")
            with run_lock(run_path):
                return 0 if watch_run(client_from_environment(client_factory), run_path, load_run(run_path),
                                      interval=args.interval, max_polls=args.max_polls, sleep=sleep, out=out) else 2
        manifest_path, manifest = load_manifest(args.manifest)
        if args.command == "validate":
            out("VALID: %d shots; offline schema, files, PNG headers and edit ranges checked." % len(manifest["shots"]))
            out("This does not verify Ark portrait acceptance, visual quality or account access.")
            return 0
        if args.interval < 10 or args.max_polls < 1:
            raise BatchError("Interval must be >=10 and max-polls >=1.")
        shots = select_shots(manifest, args.ids)
        model_override = os.environ.get("ARK_MODEL_ID")
        payloads = [(s, build_payload(manifest_path, manifest, s, args.resolution, model_override)) for s in shots]
        run_path = (args.run or manifest_path.parent / "runs" / "ark-run.json").resolve()
        for shot, payload in payloads:
            out("%s: %ss %s adaptive silent; payload_sha256=%s" %
                (shot["id"], payload["duration"], payload["resolution"], digest(json_bytes(payload))))
        if not args.execute:
            out("DRY RUN: no API key read, network, run creation or downloads. Add --execute to create paid tasks.")
            return 0
        with run_lock(run_path):
            if run_path.exists():
                run = load_run(run_path)
                if run.get("manifest") != str(manifest_path):
                    raise BatchError("Run belongs to another manifest.")
            else:
                run = {"version": 1, "created_at": now(), "manifest": str(manifest_path), "shots": {}}
            client = client_from_environment(client_factory)
            for shot, payload in payloads:
                sid = shot["id"]
                existing = run["shots"].get(sid)
                if existing:
                    if existing.get("payload_sha256") != digest(json_bytes(payload)):
                        raise BatchError(sid + " input changed; use a deliberate new run after reviewing prior task status.")
                    if existing.get("status") in {"intent", "unknown"}:
                        existing.update(status="unknown", error_kind="prior_outcome_unresolved")
                        save_run(run_path, run)
                        raise UnknownOutcome(sid + " has an unresolved intent; check console before a new run.")
                else:
                    create_one(client, run_path, run, shot, payload, sleep)
                    out(sid + ": task ID saved")
                # Conservative concurrency=1: finish/download one shot before creating the next.
                if not watch_run(client, run_path, run, [sid], args.interval, args.max_polls, sleep, out):
                    out("Stopped batch after " + sid + "; no later shots were submitted.")
                    return 2
            return 0
    except (BatchError, OSError, ValueError) as error:
        # Only our own messages are printed; arbitrary OS/remote exception details are suppressed.
        out("ERROR: " + (str(error) if isinstance(error, BatchError) else "Local file or data operation failed."))
        return 2
    except KeyboardInterrupt:
        out("Interrupted. Keep the run file and resume watch; do not assume the remote task stopped.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
