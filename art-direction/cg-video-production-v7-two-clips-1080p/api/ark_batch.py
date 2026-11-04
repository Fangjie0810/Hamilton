#!/usr/bin/env python3
"""Review-bound, resumable Ark multi-reference source clips. Network is opt-in."""

import argparse
import base64
import contextlib
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import struct
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
DEFAULT_MODEL = "doubao-seedance-2-5-260628"
DEFAULT_MANIFEST = Path(__file__).resolve().parent.parent / "manifest.json"
DEFAULT_KEY_FILE = Path(__file__).resolve().parents[3] / ".env.ark.local"
CONTRACT = "ark-video-v7-original-png-multi-reference-v1"
ACTIVE = {"submitted", "queued", "running"}
TERMINAL = {"succeeded", "failed", "cancelled", "expired"}
SID = r"[AB]\d{2}"
REFERENCE_ID = r"[A-Z]\d{2}"
MAX_REFERENCE_IMAGES = 30
MAX_BODY = 64 * 1024 * 1024
MAX_ERROR_BODY = 64 * 1024


class BatchError(Exception):
    pass


class UnknownOutcome(BatchError):
    pass


class HTTPFailure(Exception):
    def __init__(self, status, error_code=None):
        self.status = status
        self.error_code = safe_code(error_code)
        super().__init__("HTTP %s" % status)


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def json_bytes(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode("utf-8")


def safe_code(value, secret=None):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]{0,127}", value):
        return None
    return None if secret and secret in value else value


def error_code(response, secret=None):
    detail = response.get("error") if isinstance(response, dict) else None
    return safe_code(detail.get("code"), secret) if isinstance(detail, dict) else None


def hint(code):
    return " Official error code: " + code + "." if code else ""


def atomic_json(path, value):
    """Intent/task IDs and review locks are flushed before any subsequent action."""
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=path.parent, prefix=".ark-", delete=False) as stream:
            temporary = Path(stream.name)
            os.chmod(temporary, 0o600)
            stream.write(json_bytes(value))
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        temporary = None
        if hasattr(os, "O_DIRECTORY"):
            fd = os.open(str(path.parent), os.O_RDONLY | os.O_DIRECTORY)
            try:
                os.fsync(fd)
            finally:
                os.close(fd)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def read_json(path, label):
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, ValueError):
        raise BatchError("Cannot read " + label + ".") from None
    if not isinstance(value, dict):
        raise BatchError(label + " must be a JSON object.")
    return value


@contextlib.contextmanager
def process_lock(path):
    lock = Path(str(path) + ".lock")
    lock.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise BatchError("A lock already exists. Check the process before removing a stale .lock file.") from None
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(str(os.getpid()))
        yield
    finally:
        lock.unlink(missing_ok=True)


def relative_file(root, value, label):
    root = Path(root).resolve()
    if not isinstance(value, str) or not value or Path(value).is_absolute():
        raise BatchError(label + " must be a relative path.")
    path = (root / value).resolve()
    try:
        path.relative_to(root)
    except ValueError:
        raise BatchError(label + " must stay inside the plan folder.") from None
    if not path.is_file():
        raise BatchError(label + " is missing.")
    return path


def png_info(path):
    data = path.read_bytes()
    if len(data) < 33 or data[:8] != b"\x89PNG\r\n\x1a\n" or data[12:16] != b"IHDR":
        raise BatchError("Reference image must be an original PNG with an IHDR header.")
    width, height = struct.unpack(">II", data[16:24])
    if not (300 <= width <= 6000 and 300 <= height <= 6000):
        raise BatchError("Reference-image dimensions must each be 300..6000 pixels.")
    if not 0.4 <= width / height <= 2.5 or len(data) >= 30 * 1024 * 1024:
        raise BatchError("Reference image exceeds image ratio or size limits.")
    return data, width, height


def load_manifest(path):
    path = Path(path).resolve()
    manifest = read_json(path, "manifest")
    if manifest.get("version") != 7:
        raise BatchError("Manifest version must be 7.")
    defaults = manifest.get("defaults")
    required = {"model", "resolution", "ratio", "generate_audio", "output_format", "omni_reference_task_type"}
    if not isinstance(defaults, dict) or set(defaults) != required:
        raise BatchError("Defaults must specify exactly the reviewed model, resolution, ratio, audio, format and reference-task type.")
    if defaults["model"] != DEFAULT_MODEL or defaults["resolution"] not in {"720p", "1080p"}:
        raise BatchError("The reviewed Seedance 2.5 model and 720p/1080p resolution are required.")
    if (defaults["ratio"] != "16:9" or defaults["generate_audio"] is not False or defaults["output_format"] != "mp4"
            or defaults["omni_reference_task_type"] != "reference"):
        raise BatchError("This plan requires 16:9, generate_audio=false, MP4 and omni_reference_task_type=reference.")
    jobs = manifest.get("jobs")
    if not isinstance(jobs, list) or not jobs:
        raise BatchError("Manifest jobs must be a nonempty list.")
    seen = set()
    for job in jobs:
        if not isinstance(job, dict):
            raise BatchError("Each source-clip job must be an object.")
        sid = job.get("id")
        if not isinstance(sid, str) or not re.fullmatch(SID, sid) or sid in seen:
            raise BatchError("Job IDs must be unique A01/B01-style identifiers.")
        seen.add(sid)
        if not isinstance(job.get("title"), str) or not job["title"].strip():
            raise BatchError(sid + " needs a title.")
        duration = job.get("duration")
        if type(duration) is not int or not 4 <= duration <= 30:
            raise BatchError(sid + " duration must be an integer from 4 to 30.")
        prompt_file = relative_file(path.parent, job.get("prompt_file"), sid + " prompt")
        if not re.fullmatch(r"[0-9a-f]{64}", str(job.get("prompt_sha256", ""))) or digest(prompt_file.read_bytes()) != job["prompt_sha256"]:
            raise BatchError(sid + " prompt hash differs from the reviewed manifest.")
        try:
            prompt = prompt_file.read_text(encoding="utf-8")
        except UnicodeError:
            raise BatchError(sid + " prompt must be UTF-8.") from None
        if not prompt.strip():
            raise BatchError(sid + " prompt is empty.")
        references = job.get("references")
        if not isinstance(references, list) or not 1 <= len(references) <= MAX_REFERENCE_IMAGES:
            raise BatchError(sid + " requires 1..30 reference images.")
        mapping, ref_ids = {}, set()
        for reference in references:
            if not isinstance(reference, dict):
                raise BatchError(sid + " reference must be an object.")
            index, rid = reference.get("image_index"), reference.get("id")
            if type(index) is not int or index < 1 or index in mapping:
                raise BatchError(sid + " reference image_index must be a unique positive integer.")
            if not isinstance(rid, str) or not re.fullmatch(REFERENCE_ID, rid) or rid in ref_ids:
                raise BatchError(sid + " reference IDs must be unique A-Z plus two-digit identifiers, such as S01, E01 or N02.")
            image = relative_file(path.parent, reference.get("file"), sid + " reference " + str(index))
            frame, _, _ = png_info(image)
            if not re.fullmatch(r"[0-9a-f]{64}", str(reference.get("sha256", ""))) or digest(frame) != reference["sha256"]:
                raise BatchError(sid + " reference " + str(index) + " hash differs from the reviewed manifest.")
            mapping[index] = rid
            ref_ids.add(rid)
        if sorted(mapping) != list(range(1, len(references)+1)):
            raise BatchError(sid + " reference indices must be consecutive from 1.")
        mentioned = {int(index) for index in re.findall(r"@图片\s*(\d+)", prompt)}
        if not mentioned.issubset(mapping):
            raise BatchError(sid + " prompt mentions a reference index that does not exist.")
        segments = job.get("segments")
        if not isinstance(segments, list) or not segments:
            raise BatchError(sid + " needs a nonempty source-clip segments list.")
        cursor = 0
        for segment in segments:
            if not isinstance(segment, dict):
                raise BatchError(sid + " segment must be an object.")
            a, b, index = segment.get("start"), segment.get("end"), segment.get("reference_index")
            if any(type(v) not in (int, float) or not math.isfinite(v) for v in (a, b)):
                raise BatchError(sid + " segment times must be finite numbers.")
            if type(index) is not int or index not in mapping or segment.get("id") != mapping[index]:
                raise BatchError(sid + " segment reference_index and id must match a supplied reference image.")
            if a != cursor or not 0 <= a < b <= duration:
                raise BatchError(sid + " source segments must be consecutive, without overlap or gaps.")
            cursor = b
        if cursor != duration:
            raise BatchError(sid + " source segments must cover the full requested duration.")
        # Validate the real UTF-8 JSON body, including all Base64 expansion, offline.
        build_payload(path, manifest, job)
    return path, manifest


def build_payload(path, manifest, shot):
    references = shot.get("references")
    if not isinstance(references, list) or not 1 <= len(references) <= MAX_REFERENCE_IMAGES:
        raise BatchError("A request must contain 1..30 reference images.")
    prompt = relative_file(path.parent, shot["prompt_file"], "Prompt").read_text(encoding="utf-8").strip()
    content = [{"type": "text", "text": prompt}]
    for reference in sorted(references, key=lambda item: item["image_index"]):
        frame, _, _ = png_info(relative_file(path.parent, reference["file"], "Reference image"))
        content.append({"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(frame).decode("ascii")},
                        "role": "reference_image"})
    payload = dict(manifest["defaults"])
    payload.update(duration=shot["duration"], content=content)
    if len(json_bytes(payload)) > MAX_BODY:
        raise BatchError("Actual encoded JSON request exceeds 64 MiB; original reference images will not be recompressed.")
    return payload


def plan_snapshot(path, manifest):
    jobs = []
    for shot in manifest["jobs"]:
        references = []
        for reference in sorted(shot["references"], key=lambda item: item["image_index"]):
            frame, width, height = png_info(relative_file(path.parent, reference["file"], "Reference image"))
            references.append({"image_index": reference["image_index"], "id": reference["id"], "file": reference["file"],
                               "sha256": digest(frame), "bytes": len(frame), "width": width, "height": height})
        payload = build_payload(path, manifest, shot)
        body = json_bytes(payload)
        jobs.append({"id": shot["id"], "title": shot["title"], "duration": shot["duration"],
                     "references": references, "reference_count": len(references), "prompt_file": shot["prompt_file"],
                     "prompt_sha256": shot["prompt_sha256"], "payload_sha256": digest(body),
                     "encoded_request_bytes": len(body), "segments": shot["segments"]})
    binding = {"contract": CONTRACT, "manifest_sha256": digest(path.read_bytes()), "defaults": manifest["defaults"], "jobs": jobs}
    return {"version": 1, "plan_sha256": digest(json_bytes(binding)), "binding": binding}


def prepare(path, manifest, replace=False):
    snapshot = plan_snapshot(path, manifest)
    lock_path = path.parent / "review-lock.json"
    with process_lock(lock_path):
        if lock_path.exists():
            previous = read_json(lock_path, "review lock")
            if previous.get("plan_sha256") != snapshot["plan_sha256"] and not replace:
                raise BatchError("The plan changed. Review it before using prepare --replace-review.")
            if previous.get("plan_sha256") == snapshot["plan_sha256"]:
                return previous
            runs = path.parent / "runs"
            if any(p.name == "run.json" for p in runs.glob("*/run.json")):
                raise BatchError("A production ledger exists. Preserve this plan and prepare a separate version for changes.")
        snapshot["prepared_at"] = now()
        snapshot["video_submission_authorized"] = False
        atomic_json(lock_path, snapshot)
        summary = {"plan_sha256": snapshot["plan_sha256"], "jobs": snapshot["binding"]["jobs"],
                   "defaults": manifest["defaults"], "job_count": len(manifest["jobs"]),
                   "generated_seconds": sum(s["duration"] for s in manifest["jobs"]),
                   "segment_count": sum(len(s["segments"]) for s in manifest["jobs"]),
                   "edit_timeline_bound_via_complete_manifest": True,
                   "prepared_only": True, "network_used": False}
        atomic_json(path.parent / "review-summary.json", summary)
    return snapshot


def verify_review(path, manifest, approved=None):
    actual = plan_snapshot(path, manifest)
    locked = read_json(path.parent / "review-lock.json", "review lock; run prepare first")
    if locked.get("plan_sha256") != actual["plan_sha256"] or locked.get("binding") != actual["binding"]:
        raise BatchError("Plan, prompt, frame or request settings changed after preparation. No task was submitted.")
    if approved is not None and approved != actual["plan_sha256"]:
        raise BatchError("Approval hash does not match the prepared plan. No task was submitted.")
    return actual


def verify_pricing_window(manifest, current_time=None):
    pricing = manifest.get("pricing")
    deadline = pricing.get("review_before") if isinstance(pricing, dict) else None
    if deadline is None:
        return
    try:
        expires = datetime.fromisoformat(deadline)
        if expires.tzinfo is None:
            raise ValueError("timezone required")
    except (TypeError, ValueError):
        raise BatchError("Pricing review_before must be an ISO timestamp with timezone.") from None
    if (current_time or datetime.now(timezone.utc)) >= expires:
        raise BatchError("The reviewed price window expired. Recheck official pricing and review the plan before submitting paid tasks.")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ArkClient:
    def __init__(self, api_key):
        self._key = api_key
        self._opener = urllib.request.build_opener(NoRedirect())

    def request(self, method, path, body=None):
        if method not in {"GET", "POST"} or not path.startswith("/") or ".." in path or "://" in path:
            raise BatchError("Invalid API method/path.")
        request = urllib.request.Request(BASE_URL + path, data=json_bytes(body) if body is not None else None,
            method=method, headers={"Authorization": "Bearer " + self._key, "Content-Type": "application/json"})
        try:
            with self._opener.open(request, timeout=60) as response:
                raw = response.read(MAX_BODY + 1)
                if len(raw) > MAX_BODY:
                    raise BatchError("API response was too large.")
                return json.loads(raw)
        except urllib.error.HTTPError as error:
            code = None
            try:
                raw = error.read(MAX_ERROR_BODY + 1)
                if len(raw) <= MAX_ERROR_BODY:
                    code = error_code(json.loads(raw), self._key)
            except Exception:
                pass
            finally:
                error.close()
            raise HTTPFailure(error.code, code) from None

    def download(self, url, target):
        parsed = urllib.parse.urlsplit(url) if isinstance(url, str) else None
        if not parsed or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or self._key in url:
            raise BatchError("Video URL must be a valid HTTPS media URL.")
        target = Path(target)
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = None
        checksum, prefix, count = hashlib.sha256(), b"", 0
        try:
            with tempfile.NamedTemporaryFile(mode="wb", dir=target.parent, prefix=".video-", delete=False) as stream:
                temporary = Path(stream.name)
                # A separate opener has no API Authorization or other account headers.
                media = urllib.request.build_opener(NoRedirect())
                with media.open(urllib.request.Request(url, method="GET"), timeout=60) as response:
                    length = response.headers.get("Content-Length", "")
                    expected = int(length) if length.isdigit() else None
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        prefix += chunk[:max(0, 64-len(prefix))]
                        count += len(chunk)
                        checksum.update(chunk)
                        stream.write(chunk)
                stream.flush()
                os.fsync(stream.fileno())
            if count < 16 or expected is not None and count != expected or prefix[4:8] != b"ftyp":
                raise BatchError("Downloaded file is empty, incomplete or not an MP4 container.")
            os.replace(temporary, target)
            temporary = None
            return {"path": str(target.resolve()), "bytes": count, "sha256": checksum.hexdigest()}
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)


def client_from_file(path, factory=ArkClient):
    try:
        lines = Path(path).read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeError):
        raise BatchError("Cannot read the configured local Ark key file.") from None
    values = []
    for line in lines:
        match = re.fullmatch(r"\s*(?:export\s+)?ARK_API_KEY\s*=\s*(.*?)\s*", line)
        if match:
            key = match.group(1)
            if len(key) >= 2 and key[0] == key[-1] and key[0] in {"'", '"'}:
                key = key[1:-1]
            if key and not any(c.isspace() for c in key):
                values.append(key)
    if len(values) != 1:
        raise BatchError("The local key file must contain one nonempty ARK_API_KEY assignment.")
    return factory(values[0])


def get_with_retry(client, path, sleep=time.sleep):
    for attempt in range(4):
        try:
            return client.request("GET", path)
        except HTTPFailure as error:
            if error.status not in {408, 429, 500, 502, 503, 504} or attempt == 3:
                raise
        except (TimeoutError, OSError, ValueError):
            if attempt == 3:
                raise
        sleep(min(2 ** (attempt + 1), 16))


def preflight(client, path, manifest, sleep=time.sleep):
    report = {"checked_at": now(), "endpoint": BASE_URL + "/models", "method": "GET", "paid_submission": False,
              "expected_model": manifest["defaults"]["model"], "credential_value_recorded": False,
              "specific_input_moderation": "not_tested", "generation_capability": "not_tested"}
    try:
        response = get_with_retry(client, "/models", sleep)
        candidates = response.get("data") if isinstance(response, dict) else None
        ids = [item.get("id") for item in candidates if isinstance(item, dict) and isinstance(item.get("id"), str)] if isinstance(candidates, list) else []
        report.update(connectivity="ok", http_status=200, returned_model_count=len(ids),
                      expected_model_in_returned_list=manifest["defaults"]["model"] in ids,
                      model_access_assessment="listed_not_generation_tested" if manifest["defaults"]["model"] in ids else "unknown")
    except Exception as error:
        report.update(connectivity="failed", model_access_assessment="unknown")
        if isinstance(error, HTTPFailure):
            report["http_status"] = error.status
            code = safe_code(error.error_code, getattr(client, "_key", None))
            if code:
                report["error_code"] = code
    atomic_json(path.parent / "reports" / "preflight.json", report)
    return report


def run_path_for(path, fingerprint):
    return path.parent / "runs" / fingerprint[:16] / "run.json"


def save_run(path, run):
    run["updated_at"] = now()
    atomic_json(path, run)


def load_run(path):
    run = read_json(path, "run ledger")
    if run.get("version") != 7 or not isinstance(run.get("jobs"), dict) or not re.fullmatch(r"[a-f0-9]{64}", str(run.get("plan_sha256", ""))):
        raise BatchError("Unsupported run ledger.")
    for sid, job in run["jobs"].items():
        if not re.fullmatch(SID, sid) or not isinstance(job, dict) or job.get("status") not in ACTIVE | TERMINAL | {"intent", "unknown"}:
            raise BatchError("Invalid shot/status in run ledger.")
        task_id = job.get("task_id")
        if task_id is not None and (not isinstance(task_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", task_id)):
            raise BatchError("Invalid saved task ID.")
        if job.get("status") in ACTIVE | {"succeeded"} and not task_id:
            raise BatchError("Active/succeeded job is missing its task ID.")
    return run


def create_one(client, run_path, run, shot, payload):
    sid = shot["id"]
    if sid in run["jobs"]:
        raise BatchError(sid + " already has a submission intent; it will not be submitted again.")
    job = {"shot_id": sid, "title": shot["title"], "status": "intent", "intent_at": now(),
           "payload_sha256": digest(json_bytes(payload)), "model": payload["model"],
           "duration": payload["duration"], "resolution": payload["resolution"]}
    run["jobs"][sid] = job
    save_run(run_path, run)
    try:
        # Deliberately one POST attempt, including HTTP 429. Never automatically pay twice.
        response = client.request("POST", "/contents/generations/tasks", payload)
        task_id = response.get("id") if isinstance(response, dict) else None
        if not isinstance(task_id, str) or not re.fullmatch(r"[A-Za-z0-9_-]+", task_id):
            raise UnknownOutcome("Create returned no usable task ID.")
    except HTTPFailure as error:
        job.update(status="failed" if 400 <= error.status < 500 and error.status != 408 else "unknown",
                   phase="create", error_kind="http_%d" % error.status)
        code = safe_code(error.error_code, getattr(client, "_key", None))
        if code:
            job["error_code"] = code
        save_run(run_path, run)
        if job["status"] == "unknown":
            raise UnknownOutcome(sid + " submission outcome is unknown; reconcile the saved intent in Ark before proceeding." + hint(code)) from None
        raise BatchError(sid + " was rejected; later source clips have not been submitted. No automatic retry." + hint(code)) from None
    except (Exception, KeyboardInterrupt):
        job.update(status="unknown", phase="create", error_kind="ambiguous_create_result")
        save_run(run_path, run)
        raise UnknownOutcome(sid + " submission outcome is unknown; do not create a replacement run.") from None
    job.update(status="submitted", task_id=task_id, accepted_at=now())
    save_run(run_path, run)
    return job


def numeric_metadata(value):
    if isinstance(value, dict):
        return {key: clean for key, val in value.items() if isinstance(key, str) and re.fullmatch(r"[A-Za-z0-9_]{1,64}", key)
                and (clean := numeric_metadata(val)) is not None}
    if type(value) in (int, float) and math.isfinite(value):
        return value
    return None


def apply_query(client, job, response):
    status = response.get("status") if isinstance(response, dict) else None
    if status not in TERMINAL | {"queued", "running"}:
        raise BatchError("Task query returned an unrecognized status.")
    job.update(status=status, last_checked_at=now())
    job.pop("error_code", None)
    code = error_code(response, getattr(client, "_key", None))
    if code:
        job["error_code"] = code
    if isinstance(response.get("usage"), dict):
        job["usage"] = numeric_metadata(response["usage"])
    result = dict(job.get("result") or {})
    for key in ("duration", "resolution", "ratio", "generate_audio", "model", "seed", "framespersecond", "created_at", "updated_at"):
        value = response.get(key)
        if type(value) in (int, float, bool) and (type(value) is bool or math.isfinite(value)):
            result[key] = value
        elif isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_.:-]{1,128}", value) and not (getattr(client, "_key", None) and client._key in value):
            result[key] = value
    job["result"] = result
    if status == "succeeded":
        content = response.get("content")
        url = content.get("video_url") if isinstance(content, dict) else None
        if isinstance(url, str) and not (getattr(client, "_key", None) and client._key in url):
            job["video_url"] = url
        else:
            job.pop("video_url", None)
    if status in {"failed", "expired", "cancelled"}:
        job["error_kind"] = "remote_" + status
    return code


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


def query_one(client, run_path, run, sid, sleep):
    job = run["jobs"][sid]
    try:
        response = get_with_retry(client, "/contents/generations/tasks/" + urllib.parse.quote(job["task_id"], safe=""), sleep)
        code = apply_query(client, job, response)
    except Exception as error:
        job["last_error_kind"] = "query_failed"
        code = safe_code(error.error_code, getattr(client, "_key", None)) if isinstance(error, HTTPFailure) else None
        if code:
            job["error_code"] = code
        save_run(run_path, run)
        raise BatchError(sid + " query failed; resume the saved task instead of resubmitting." + hint(code)) from None
    save_run(run_path, run)
    return code


def watch_one(client, run_path, run, sid, interval=10, max_polls=360, sleep=time.sleep, out=print):
    job = run["jobs"][sid]
    if job["status"] in {"intent", "unknown"}:
        job.update(status="unknown", error_kind="prior_outcome_unresolved")
        save_run(run_path, run)
        raise UnknownOutcome(sid + " has an unresolved intent; no further submissions are allowed.")
    if job["status"] in {"failed", "expired", "cancelled"}:
        return False
    if job["status"] == "succeeded" and downloaded(job):
        return True
    for poll in range(max_polls):
        # Refresh a saved succeeded result URL too: CDN URLs may have expired while offline.
        code = query_one(client, run_path, run, sid, sleep)
        out(sid + ": " + job["status"] + hint(code))
        if job["status"] == "succeeded":
            target = run_path.parent / "videos" / (sid + "-" + job["task_id"] + ".mp4")
            for attempt in range(2):
                try:
                    job["download"] = client.download(job.get("video_url"), target)
                    job["download_status"] = "succeeded"
                    save_run(run_path, run)
                    out(sid + ": downloaded")
                    return True
                except Exception:
                    job["download_status"] = "failed"
                    save_run(run_path, run)
                    if attempt == 0:
                        query_one(client, run_path, run, sid, sleep)
                        if job["status"] != "succeeded":
                            break
            raise BatchError(sid + " download failed; the paid result/task ID is preserved. Resume later.") from None
        if job["status"] in TERMINAL:
            return False
        if poll + 1 < max_polls:
            sleep(interval)
    out(sid + ": poll limit reached; resume the saved task. No later source clips were submitted.")
    return False


def validate_run_binding(run, snapshot):
    if run.get("plan_sha256") != snapshot["plan_sha256"]:
        raise BatchError("Run ledger belongs to another reviewed plan.")
    expected = {s["id"]: s["payload_sha256"] for s in snapshot["binding"]["jobs"]}
    for sid, job in run["jobs"].items():
        if sid not in expected or job.get("payload_sha256") != expected[sid]:
            raise BatchError("Run ledger does not match the reviewed request fingerprints.")
        if job["status"] in {"intent", "unknown"}:
            raise UnknownOutcome(sid + " has an unresolved paid-submission intent. No API calls or new tasks will be made.")


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    p.add_argument("--key-file", type=Path, default=DEFAULT_KEY_FILE)
    sub = p.add_subparsers(dest="command", required=True)
    sub.add_parser("validate", help="Offline reference/prompt hashes, source segments and encoded request size.")
    prep = sub.add_parser("prepare", help="Offline review lock and redacted payload summary.")
    prep.add_argument("--replace-review", action="store_true")
    pre = sub.add_parser("preflight", help="Dry run, or GET /models only with --execute.")
    pre.add_argument("--execute", action="store_true")
    for command in ("run", "watch"):
        item = sub.add_parser(command, help="Dry run by default. " + ("Submit sequentially and resume." if command == "run" else "Only query/download saved tasks."))
        item.add_argument("--execute", action="store_true")
        item.add_argument("--interval", type=float, default=10)
        item.add_argument("--max-polls", type=int, default=360)
        if command == "run":
            item.add_argument("--approved-plan-sha256")
    return p


def main(argv=None, client_factory=ArkClient, sleep=time.sleep, out=print):
    args = parser().parse_args(argv)
    try:
        path, manifest = load_manifest(args.manifest)
        if args.command == "validate":
            out("VALID: %d source clips; reference/prompt hashes, complete source segments and encoded request sizes checked offline." % len(manifest["jobs"]))
            return 0
        if args.command == "prepare":
            snapshot = prepare(path, manifest, args.replace_review)
            out("PREPARED: plan_sha256=" + snapshot["plan_sha256"])
            out("No key read, network request or video task. User approval is still required before execution.")
            return 0
        if args.command == "preflight":
            if not args.execute:
                out("DRY RUN: would GET /models only; no key read or network.")
                return 0
            report = preflight(client_from_file(args.key_file, client_factory), path, manifest, sleep)
            out("PREFLIGHT: " + report["connectivity"] + "; model_access=" + report["model_access_assessment"] + ". No paid task; input acceptance was not tested.")
            return 0 if report["connectivity"] == "ok" else 2
        if args.interval < 10 or not math.isfinite(args.interval) or args.max_polls < 1:
            raise BatchError("Interval must be at least 10 seconds and max-polls at least 1.")
        snapshot = verify_review(path, manifest)
        run_path = run_path_for(path, snapshot["plan_sha256"])
        for shot in snapshot["binding"]["jobs"]:
            out("%s: %ss %s 16:9 reference silent; images=%s encoded_bytes=%s payload_sha256=%s" %
                (shot["id"], shot["duration"], manifest["defaults"]["resolution"], shot["reference_count"], shot["encoded_request_bytes"], shot["payload_sha256"]))
        if not args.execute:
            out("DRY RUN: no key read, network, run ledger or paid submission. plan_sha256=" + snapshot["plan_sha256"])
            return 0
        if args.command == "run":
            if not args.approved_plan_sha256:
                raise BatchError("Paid execution requires --approved-plan-sha256 after the user reviews and authorizes this plan.")
            snapshot = verify_review(path, manifest, args.approved_plan_sha256)
            verify_pricing_window(manifest)
        with process_lock(run_path):
            if run_path.exists():
                run = load_run(run_path)
                validate_run_binding(run, snapshot)
            elif args.command == "watch":
                raise BatchError("No saved tasks exist; watch never creates paid tasks.")
            else:
                run = {"version": 7, "created_at": now(), "plan_sha256": snapshot["plan_sha256"], "manifest": str(path), "jobs": {}}
            # Read the credential only after all review/run safeguards have passed.
            client = client_from_file(args.key_file, client_factory)
            for shot in manifest["jobs"]:
                sid = shot["id"]
                if sid not in run["jobs"]:
                    if args.command == "watch":
                        continue
                    # Revalidate all inputs immediately before each chargeable request.
                    fresh_path, fresh_manifest = load_manifest(path)
                    verify_review(fresh_path, fresh_manifest, snapshot["plan_sha256"])
                    verify_pricing_window(fresh_manifest)
                    payload = build_payload(path, manifest, shot)
                    expected = next(s["payload_sha256"] for s in snapshot["binding"]["jobs"] if s["id"] == sid)
                    if digest(json_bytes(payload)) != expected:
                        raise BatchError(sid + " payload changed before submission.")
                    create_one(client, run_path, run, shot, payload)
                    out(sid + ": task ID saved")
                if not watch_one(client, run_path, run, sid, args.interval, args.max_polls, sleep, out):
                    out("Batch stopped after " + sid + "; no later source clip was submitted.")
                    return 2
            out("COMPLETE: " + ("all reviewed source clips downloaded." if args.command == "run" else "all saved tasks processed; no new tasks created."))
            return 0
    except (BatchError, OSError, ValueError) as error:
        out("ERROR: " + (str(error) if isinstance(error, BatchError) else "Local file or data operation failed."))
        return 2
    except KeyboardInterrupt:
        out("Interrupted. Keep the run ledger and resume; a remote task may still be running.")
        return 130
    except Exception:
        out("ERROR: Operation failed; private exception details were suppressed. Preserve the run ledger before retrying.")
        return 2


if __name__ == "__main__":
    sys.exit(main())
