#!/usr/bin/env python3
"""Seedream 5.0 lite text-only image group. Network requires --execute."""

import argparse
import contextlib
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import struct
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request


ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
MODEL = "doubao-seedream-5-0-260128"
MODEL_ALIAS = "doubao-seedream-5-0-lite-260128"
COUNT = 7
RESPONSE_LIMIT = 16 * 1024 * 1024
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
PNG_END = b"\x00\x00\x00\x00IEND\xaeB\x60\x82"
KEY_NAMES = {"ARK_API_KEY", "api_key", "apiKey"}


class GroupError(Exception):
    pass


def safe_code(value, secret=None):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_.-]{0,127}", value):
        return None
    return None if secret and secret in value else value


class HTTPFailure(Exception):
    def __init__(self, status, code=None):
        self.status, self.code = status, safe_code(code)
        super().__init__("HTTP %s" % status)


def stamp():
    return datetime.now(timezone.utc).isoformat()


def encoded(value):
    return json.dumps(value, ensure_ascii=False, indent=2).encode("utf-8")


def private_bytes(path, value):
    """Atomic private metadata; flush to disk before starting paid work."""
    path = Path(path)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".metadata-", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(value)
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


def private_json(path, value):
    private_bytes(path, encoded(value))


def safe_identifier(value, secret=None):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.-]{1,128}", value):
        return None
    return None if secret and secret in value else value


def exception_details(error, secret=None):
    result = {"exception_type": safe_identifier(type(error).__name__, secret) or "Exception"}
    reason = getattr(error, "reason", None)
    if isinstance(reason, BaseException):
        result["reason_type"] = safe_identifier(type(reason).__name__, secret) or "Exception"
    number = getattr(reason if isinstance(reason, BaseException) else error, "errno", None)
    if type(number) is int:
        result["os_errno"] = number
    return result


@contextlib.contextmanager
def lock_run(run_dir):
    run_dir.mkdir(parents=True, mode=0o700, exist_ok=True)
    lock = run_dir / ".lock"
    try:
        fd = os.open(str(lock), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    except FileExistsError:
        raise GroupError("Run is locked. Check for a live process before removing its .lock file.") from None
    try:
        with os.fdopen(fd, "w") as stream:
            stream.write(str(os.getpid()))
        yield
    finally:
        lock.unlink(missing_ok=True)


def valid_key(value):
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9._~+/-]{8,4096}={0,2}", value):
        raise GroupError("Credential format is invalid; no credential value will be displayed.")
    return value


def read_key(credentials_file=None):
    """Read only the explicit file or ARK_API_KEY; never search for credentials."""
    if credentials_file is None:
        return valid_key(os.environ.get("ARK_API_KEY"))
    path = Path(credentials_file)
    if path.stat().st_size > 64 * 1024:
        raise GroupError("Credential file is too large for a simple credential file.")
    text = path.read_text(encoding="utf-8-sig").strip()
    values = []
    if text.startswith("{"):
        def unique_pairs(pairs):
            result = {}
            for name, value in pairs:
                if name in result:
                    raise GroupError("Credential JSON contains duplicate fields.")
                result[name] = value
            return result
        data = json.loads(text, object_pairs_hook=unique_pairs)
        if not isinstance(data, dict) or not data or set(data) - KEY_NAMES:
            raise GroupError("Credential JSON must contain only ARK_API_KEY, api_key or apiKey.")
        values = list(data.values())
    elif re.fullmatch(r"[A-Za-z0-9._~+/-]{8,4096}={0,2}", text):
        values = [text]
    else:
        for line in text.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            match = re.fullmatch(r"(?:export\s+)?(ARK_API_KEY|api_key|apiKey)\s*=\s*(.*)", line)
            if not match:
                raise GroupError("Credential file must be a simple supported .env, JSON or plain key file.")
            tokens = shlex.split(match[2], comments=True, posix=True)
            if len(tokens) != 1:
                raise GroupError("Credential assignment is ambiguous.")
            values.append(tokens[0])
    keys = {valid_key(value) for value in values}
    if len(keys) != 1:
        raise GroupError("Credential file must identify exactly one unambiguous API key.")
    return keys.pop()


def payload_from_file(prompt_file, model=MODEL, stream=False):
    if model not in {MODEL, MODEL_ALIAS} and not re.fullmatch(r"ep-[A-Za-z0-9_-]+", model):
        raise GroupError("Use the verified lite model or an actual Endpoint ID serving that model.")
    prompt = Path(prompt_file).read_text(encoding="utf-8").strip()
    if not prompt:
        raise GroupError("Prompt file is empty.")
    return {"model": model, "prompt": prompt, "size": "2560x1440",
            "sequential_image_generation": "auto",
            "sequential_image_generation_options": {"max_images": COUNT},
            "stream": stream, "output_format": "png", "response_format": "url", "watermark": False}


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class Client:
    def __init__(self, key=None):
        self._key = key
        self._opener = urllib.request.build_opener(NoRedirect())
        self.diagnostic_dir = None
        self.diagnostics = {}
        self.on_event = None
        self.stream_response = None

    def _save_diagnostics(self):
        if self.diagnostic_dir is not None:
            private_json(self.diagnostic_dir / "http-diagnostics.json", self.diagnostics)

    def _has_credential_echo(self, raw):
        # JSON/SSE error text may echo credentials, including JSON/unicode escapes.
        text = raw.decode("utf-8", errors="replace")
        normalized = re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m[1], 16)), text).replace("\\/", "/")
        return bool(self._key and any(self._key in value for value in
                                     (text, normalized, urllib.parse.unquote(normalized))))

    def _archive_body(self, raw, incomplete=False):
        self.diagnostics.update(response_body_bytes=len(raw), response_body_incomplete=incomplete,
                                response_body_retained=False)
        if self._has_credential_echo(raw):
            self.diagnostics["response_body_suppressed"] = "credential_echo"
        elif self.diagnostic_dir is not None:
            name = "http-response-body.bin"
            private_bytes(self.diagnostic_dir / name, raw)
            self.diagnostics.update(response_body_retained=True, response_body_file=name)
        self._save_diagnostics()

    def _record_headers(self, response):
        headers = {str(name).lower(): value for name, value in response.headers.items()}
        status = getattr(response, "status", None) or getattr(response, "code", None)
        if type(status) is int:
            self.diagnostics["http_status"] = status
        content_type = headers.get("content-type", "").split(";", 1)[0].strip().lower()
        if re.fullmatch(r"[a-z0-9!#$&^_.+-]{1,64}/[a-z0-9!#$&^_.+-]{1,64}", content_type) and not (self._key and self._key in content_type):
            self.diagnostics["response_content_type"] = content_type
        for name in ("x-request-id", "x-tt-logid", "x-ark-request-id"):
            value = safe_identifier(headers.get(name), self._key)
            if value:
                self.diagnostics["request_id"] = value
                self.diagnostics["request_id_header"] = name
                break
        self.diagnostics["stage"] = "reading_response"
        self._save_diagnostics()  # Retain request ID even if the subsequent read times out.

    def _read_response(self, response):
        self._record_headers(response)
        raw = bytearray()
        try:
            while len(raw) <= RESPONSE_LIMIT:
                chunk = response.read(min(65536, RESPONSE_LIMIT + 1 - len(raw)))
                if not chunk:
                    break
                raw.extend(chunk)
        except (Exception, KeyboardInterrupt) as error:
            partial = getattr(error, "partial", None)
            if isinstance(partial, bytes):
                raw.extend(partial[:max(0, RESPONSE_LIMIT + 1 - len(raw))])
            self._archive_body(bytes(raw), incomplete=True)
            raise
        self._archive_body(bytes(raw), incomplete=len(raw) > RESPONSE_LIMIT)
        if len(raw) > RESPONSE_LIMIT:
            raise GroupError("Unexpectedly large response; private diagnostic body retained.")
        return bytes(raw)

    def _read_stream(self, response):
        """Consume complete SSE events; never reconnect a paid POST."""
        wire, data_lines = bytearray(), []
        event_name, completed = None, False
        try:
            while True:
                line = response.readline(65537)
                if not line:
                    break
                wire.extend(line)
                if len(line) > 65536 or len(wire) > RESPONSE_LIMIT:
                    raise GroupError("Streaming response exceeds the bounded event/body limit.")
                line = line.rstrip(b"\r\n")
                if not line:
                    if not data_lines:
                        event_name = None
                        continue
                    data = b"\n".join(data_lines)
                    data_lines = []
                    if data.strip() == b"[DONE]":
                        break
                    if self._has_credential_echo(data):
                        raise GroupError("Stream event cannot safely be retained.")
                    event = json.loads(data)
                    if not isinstance(event, dict):
                        raise GroupError("Unexpected stream event format.")
                    if "type" not in event and event_name:
                        event["type"] = event_name
                    if self._has_credential_echo(encoded(event)):
                        raise GroupError("Stream event cannot safely be retained.")
                    if self.on_event is None:
                        raise GroupError("Stream event persistence is not configured.")
                    self.on_event(event)  # Persist URL before any download or subsequent socket read.
                    if event.get("type") == "image_generation.completed":
                        completed = True
                        break
                    if event.get("type") == "error" or ("error" in event and "type" not in event):
                        raise GroupError("Image stream returned an error; inspect private events.")
                    event_name = None
                elif line.startswith(b"data:"):
                    value = line[5:]
                    data_lines.append(value[1:] if value.startswith(b" ") else value)
                elif line.startswith(b"event:"):
                    event_name = line[6:].strip().decode("utf-8")
                # SSE comments, id and retry fields do not authorize reconnection.
            if not completed:
                raise GroupError("Stream ended before image_generation.completed.")
            self.diagnostics["stage"] = "stream_completed"
            return self.stream_response
        finally:
            self._archive_body(bytes(wire), incomplete=not completed)

    def generate(self, payload):
        request = urllib.request.Request(ENDPOINT, data=encoded(payload), method="POST",
                                         headers={"Authorization": "Bearer " + self._key,
                                                  "Content-Type": "application/json"})
        started = time.monotonic()
        self.diagnostics = {"started_at": stamp(), "timeout_seconds": 600, "stage": "waiting_for_response_headers"}
        self._save_diagnostics()
        try:
            http_error = None
            try:
                response = self._opener.open(request, timeout=600)
            except urllib.error.HTTPError as error:
                response, http_error = error, error
            with response:
                if payload.get("stream") and http_error is None:
                    self._record_headers(response)
                    if self.diagnostics.get("response_content_type") == "text/event-stream":
                        return self._read_stream(response)
                raw = self._read_response(response)
            self.diagnostics["stage"] = "decoding_response"
            try:
                result = json.loads(raw)
            except (ValueError, UnicodeError) as error:
                self.diagnostics["parse_error_type"] = exception_details(error, self._key)["exception_type"]
                if http_error is not None:
                    raise HTTPFailure(http_error.code) from None
                raise
            if http_error is not None:
                detail = result.get("error") if isinstance(result, dict) else None
                code = safe_code(detail.get("code"), self._key) if isinstance(detail, dict) else None
                raise HTTPFailure(http_error.code, code) from None
            if (not isinstance(result, dict) or self.diagnostics.get("response_body_suppressed") == "credential_echo"
                    or self._key in encoded(result).decode("utf-8")):
                raise GroupError("Response cannot safely be retained.")
            return result
        except (Exception, KeyboardInterrupt) as error:
            self.diagnostics.update(exception_details(error, self._key))
            raise
        finally:
            self.diagnostics["elapsed_seconds"] = round(time.monotonic() - started, 3)
            try:
                self._save_diagnostics()
            except OSError:
                self.diagnostics["diagnostic_save_failed"] = True

    def download(self, url, path):
        parsed = urllib.parse.urlsplit(url) if isinstance(url, str) else None
        if not parsed or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
            raise GroupError("Image URL is invalid.")
        path = Path(path)
        path.parent.mkdir(mode=0o700, exist_ok=True)
        temporary = None
        try:
            with tempfile.NamedTemporaryFile(dir=path.parent, prefix=".image-", delete=False) as stream:
                temporary = Path(stream.name)
                # Separate unauthenticated request: never forward the Ark API key to image hosts.
                request = urllib.request.Request(url, method="GET")
                with urllib.request.urlopen(request, timeout=60) as response:
                    length = response.headers.get("Content-Length", "")
                    count = 0
                    while True:
                        chunk = response.read(1024 * 1024)
                        if not chunk:
                            break
                        count += len(chunk)
                        if count > 64 * 1024 * 1024:
                            raise GroupError("Image download exceeds the local size limit.")
                        stream.write(chunk)
                stream.flush()
                os.fsync(stream.fileno())
            if length.isdigit() and count != int(length):
                raise GroupError("Image download was incomplete.")
            info = image_info(temporary)
            os.replace(temporary, path)
            temporary = None
            return info
        finally:
            if temporary is not None:
                temporary.unlink(missing_ok=True)


def image_info(path):
    data = Path(path).read_bytes()
    if len(data) < 45 or not data.startswith(PNG_SIGNATURE) or data[12:16] != b"IHDR" or not data.endswith(PNG_END):
        raise GroupError("Downloaded file is not a complete PNG; original response is preserved.")
    width, height = struct.unpack(">II", data[16:24])
    if not width or not height:
        raise GroupError("Downloaded PNG dimensions are invalid.")
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(), "width": width, "height": height}


def create_group(client, run_dir, payload, out=None):
    out = out or emit
    state_path = run_dir / "state.json"
    if state_path.exists() or (run_dir / "response.json").exists():
        raise GroupError("This run already has an intent/response. Never resubmit it; use --resume-downloads if a response exists.")
    state = {"version": 1, "status": "intent", "created_at": stamp(), "requested_count": COUNT,
             "model": payload["model"], "size": payload["size"],
             "payload_sha256": hashlib.sha256(encoded(payload)).hexdigest(), "downloads": {}}
    private_json(state_path, state)
    if isinstance(client, Client):
        client.diagnostic_dir = run_dir
        client.on_event, client.stream_response = None, None
        if payload.get("stream"):
            partial = {"model": payload["model"], "data": [], "stream_completed": False}
            client.stream_response = partial
            event_count = 0

            def retain_event(event):
                nonlocal event_count
                event_count += 1
                event_dir = run_dir / "events"
                event_dir.mkdir(mode=0o700, exist_ok=True)
                private_json(event_dir / ("%03d.json" % event_count), event)
                kind = event.get("type")
                index = event.get("image_index")
                if kind in {"image_generation.partial_succeeded", "image_generation.partial_failed"}:
                    if type(index) is not int or not 0 <= index < COUNT:
                        raise GroupError("Stream image index is outside the requested group.")
                    while len(partial["data"]) <= index:
                        partial["data"].append(None)
                    previous = partial["data"][index]
                    if previous is not None and previous != event:
                        raise GroupError("Conflicting events share an image index; saved events need review.")
                    partial["data"][index] = event
                elif kind == "image_generation.completed":
                    partial.update({key: event[key] for key in ("model", "created", "usage", "error") if key in event})
                    partial["stream_completed"] = True
                elif kind == "error" or ("error" in event and kind is None):
                    partial["error"] = event.get("error")
                private_json(run_dir / "partial-response.json", partial)
                private_json(run_dir / "response.json", partial)
                state.update(status="streaming", received_events=event_count,
                             stream_completed=partial["stream_completed"])
                private_json(state_path, state)
                if kind == "image_generation.partial_succeeded" and isinstance(event.get("url"), str):
                    name = "image-%02d.png" % (index + 1)
                    out(name + ": URL saved privately; downloading original PNG")
                    try:
                        info = client.download(event["url"], run_dir / "raw" / name)
                        state["downloads"][name] = {"status": "downloaded", "path": "raw/" + name, "info": info}
                        out(name + ": original PNG saved")
                    except Exception as error:
                        state["downloads"][name] = {"status": "download_failed", **exception_details(error, client._key)}
                        out(name + ": download deferred; original URL is saved")
                    private_json(state_path, state)
                elif kind == "image_generation.partial_failed":
                    detail = event.get("error")
                    code = safe_code(detail.get("code"), client._key) if isinstance(detail, dict) else None
                    out("image-%02d.png: generation failed" % (index + 1) + ("; error_code=" + code if code else ""))
            client.on_event = retain_event
    try:
        response = client.generate(payload)  # Exactly one POST; no automatic retries, including 429.
        private_json(run_dir / "response.json", response)  # Save every original URL before any download.
    except HTTPFailure as error:
        state.update(status="rejected" if 400 <= error.status < 500 and error.status != 408 else "unknown",
                     error_kind="http_%d" % error.status)
        if error.code:
            state["error_code"] = error.code
        state.update(exception_details(error, getattr(client, "_key", None)))
        if isinstance(client, Client):
            state["diagnostics"] = client.diagnostics
        private_json(state_path, state)
        hint = " Check error_code " + error.code + "." if error.code else ""
        raise GroupError("Image request " + state["status"] + "; no automatic resubmission." + hint) from None
    except (Exception, KeyboardInterrupt) as error:
        partial = getattr(client, "stream_response", None)
        has_urls = isinstance(partial, dict) and any(isinstance(item, dict) and item.get("url") for item in partial.get("data", []))
        state.update(status="partial_stream_interrupted" if has_urls else "unknown",
                     error_kind="interrupted_stream" if has_urls else "ambiguous_post_result")
        state.update(exception_details(error, getattr(client, "_key", None)))
        if isinstance(client, Client):
            state["diagnostics"] = client.diagnostics
        private_json(state_path, state)
        raise GroupError("Image request " + state["status"] + " (" + state["exception_type"] +
                         "). Preserve this run; resume saved downloads if available. Do not repeat the paid request.") from None
    state.update(status="response_saved", response_saved_at=stamp())
    if isinstance(client, Client):
        state["diagnostics"] = client.diagnostics
    private_json(state_path, state)
    return response, state


def download_group(client, run_dir, response, state, out):
    items = response.get("data") if isinstance(response, dict) else None
    if not isinstance(items, list):
        raise GroupError("Saved response has no image list. Review the private response; do not resubmit this run.")
    state.setdefault("downloads", {})
    state.update(status="downloading", response_item_count=len(items))
    private_json(run_dir / "state.json", state)
    successful = 0
    for index, item in enumerate(items, 1):
        name = "image-%02d.png" % index
        path = run_dir / "raw" / name
        record = state["downloads"].get(name, {})
        if item is None and response.get("stream_completed") is False:
            record = {"status": "not_received"}
            out(name + ": no image result received before stream interruption")
        elif not isinstance(item, dict) or not isinstance(item.get("url"), str):
            detail = item.get("error") if isinstance(item, dict) else None
            code = safe_code(detail.get("code")) if isinstance(detail, dict) else None
            record = {"status": "generation_failed"}
            if code:
                record["error_code"] = code
            out(name + ": generation failed" + ("; error_code=" + code if code else ""))
        else:
            try:
                try:
                    existing = image_info(path) if path.is_file() else None
                except (OSError, GroupError):
                    existing = None
                if record.get("status") != "downloaded" or existing != record.get("info"):
                    existing = client.download(item["url"], path)
                record = {"status": "downloaded", "path": "raw/" + name, "info": existing}
                successful += 1
                out("%s: saved original PNG (%dx%d)" % (name, existing["width"], existing["height"]))
            except (Exception, KeyboardInterrupt) as error:
                record = {"status": "download_failed"}
                if isinstance(error, KeyboardInterrupt):
                    state["downloads"][name] = record
                    state["status"] = "download_interrupted"
                    private_json(run_dir / "state.json", state)
                    raise
                out(name + ": download failed; resume downloads using the existing response")
        state["downloads"][name] = record
        private_json(run_dir / "state.json", state)
    status = "complete" if successful == COUNT and len(items) == COUNT else "incomplete"
    if response.get("stream_completed") is False:
        status = "partial_stream_interrupted"
    state.update(status=status,
                 downloaded_count=successful, checked_at=stamp())
    private_json(run_dir / "state.json", state)
    out("%s: %d/%d original images saved. Visual review is still required." % (state["status"], successful, COUNT))
    return state["status"] == "complete"


def emit(message):
    print(message, flush=True)


def main(argv=None, client_factory=Client, out=emit):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prompt", type=Path, help="UTF-8 plain text prompt file; required for a new group")
    parser.add_argument("--run-dir", type=Path, required=True, help="Dedicated private directory for one paid request")
    parser.add_argument("--model", default=MODEL, help="Verified lite model or its actual Endpoint ID")
    parser.add_argument("--stream", action="store_true", help="Persist each SSE image event and URL as it arrives")
    parser.add_argument("--credentials-file", type=Path, help="Explicit local simple .env / JSON / plain key; overrides ARK_API_KEY")
    parser.add_argument("--resume-downloads", action="store_true", help="Use saved response only; never POST or read credentials")
    parser.add_argument("--execute", action="store_true", help="Enable the requested network operation; absent means dry-run")
    args = parser.parse_args(argv)
    try:
        run_dir = args.run_dir.resolve()
        if args.resume_downloads:
            response = json.loads((run_dir / "response.json").read_text(encoding="utf-8"))
            state = json.loads((run_dir / "state.json").read_text(encoding="utf-8"))
            if not isinstance(state, dict) or state.get("version") != 1:
                raise GroupError("Unsupported run state.")
            if not args.execute:
                out("DRY RUN: would resume saved image downloads only; no credentials read, POST or network.")
                return 0
            with lock_run(run_dir):
                return 0 if download_group(client_factory(), run_dir, response, state, out) else 2
        if not args.prompt:
            raise GroupError("A new text-only group requires --prompt.")
        payload = payload_from_file(args.prompt, args.model, args.stream)
        out("Text-only image group: up to 7 independent PNGs, 2560x1440; no image input.")
        if not args.execute:
            out("DRY RUN: no credentials read, network, run files or downloads. --execute creates a paid image request.")
            return 0
        with lock_run(run_dir):
            if (run_dir / "state.json").exists() or (run_dir / "response.json").exists():
                raise GroupError("This run already has an intent/response. Use --resume-downloads; never repeat its POST.")
            client = client_factory(read_key(args.credentials_file))
            out("Submitting one paid image-group request; the intent will be saved before POST.")
            response, state = create_group(client, run_dir, payload, out)
            return 0 if download_group(client, run_dir, response, state, out) else 2
    except (GroupError, OSError, ValueError, TypeError) as error:
        out("ERROR: " + (str(error) if isinstance(error, GroupError) else "Local file or response format error; private details suppressed."))
        return 2
    except KeyboardInterrupt:
        out("Interrupted. Preserve this run and resume downloads; do not assume the remote request stopped.")
        return 130


if __name__ == "__main__":
    sys.exit(main())
