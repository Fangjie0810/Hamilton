import importlib.util
import http.client
import io
import json
from pathlib import Path
import socket
import struct
import tempfile
import unittest
from unittest import mock
import zlib


SPEC = importlib.util.spec_from_file_location("ark_batch", Path(__file__).with_name("ark_batch.py"))
ark = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ark)


def make_png(width=1600, height=900):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    pixels = zlib.compress((b"\0" + b"\0" * width * 3) * height)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", pixels) + chunk(b"IEND", b"")


class FakeClient:
    def __init__(self, responses=None, run_path=None):
        self.responses = list(responses or [])
        self.calls = []
        self.run_path = run_path
        self.download_calls = 0

    def request(self, method, path, body=None):
        if method == "POST" and self.run_path:
            assert ark.load_run(self.run_path)["shots"]["S01"]["status"] == "intent"
        self.calls.append((method, path, body))
        result = self.responses.pop(0)
        if isinstance(result, BaseException):
            raise result
        return result

    def download(self, url, target):
        self.download_calls += 1
        target.parent.mkdir(parents=True, exist_ok=True)
        data = b"offline-test-video"
        target.write_bytes(data)
        return {"path": str(target), "bytes": len(data), "sha256": ark.digest(data)}


class BatchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        (self.root / "prompts").mkdir()
        (self.root / "firstframes").mkdir()
        (self.root / "prompts/S01.txt").write_text("固定机位，无人声。", encoding="utf-8")
        (self.root / "firstframes/S01.png").write_bytes(make_png())
        self.manifest = {"version": 3, "defaults": {"model": ark.DEFAULT_MODEL, "resolution": "720p",
            "ratio": "adaptive", "generate_audio": False, "output_format": "mp4"}, "shots": [
            {"id": "S01", "title": "测试", "prompt_file": "prompts/S01.txt",
             "first_frame": "firstframes/S01.png", "duration": 12,
             "edit": {"in": 1, "out": 8, "start": 0, "end": 7}}]}
        self.manifest_path = self.root / "manifest.json"
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        self.run_path = self.root / "runs/test.json"
        self.run = {"version": 1, "manifest": str(self.manifest_path), "shots": {}}
        self.shot = self.manifest["shots"][0]

    def tearDown(self):
        self.temp.cleanup()

    def payload(self):
        return ark.build_payload(self.manifest_path, self.manifest, self.shot)

    def test_validate_and_payload_fields(self):
        path, manifest = ark.load_manifest(self.manifest_path)
        payload = ark.build_payload(path, manifest, self.shot, "1080p", "ep-test-only")
        self.assertEqual(payload["model"], "ep-test-only")
        self.assertEqual(payload["ratio"], "adaptive")
        self.assertIs(payload["generate_audio"], False)
        self.assertEqual(payload["resolution"], "1080p")
        self.assertEqual(payload["content"][1]["role"], "first_frame")
        self.assertTrue(payload["content"][1]["image_url"]["url"].startswith("data:image/png;base64,"))
        self.assertFalse({"seed", "camera_fixed", "draft", "service_tier"} & set(payload))

    def test_dry_run_does_not_construct_client_read_key_or_write_run(self):
        def no_client(key):
            self.fail("Dry-run attempted to construct a network client")
        lines = []
        with mock.patch.object(ark, "client_from_environment", side_effect=AssertionError("key read")), \
             mock.patch.object(ark.urllib.request, "urlopen", side_effect=AssertionError("network")):
            code = ark.main(["--manifest", str(self.manifest_path), "submit", "--ids", "all",
                             "--run", str(self.run_path)], no_client, out=lines.append)
        self.assertEqual(code, 0)
        self.assertFalse(self.run_path.exists())
        self.assertIn("DRY RUN", lines[-1])

    def test_timeout_records_unknown_and_never_reposts(self):
        client = FakeClient([socket.timeout()], self.run_path)
        with self.assertRaises(ark.UnknownOutcome):
            ark.create_one(client, self.run_path, self.run, self.shot, self.payload(), sleep=lambda _: None)
        self.assertEqual(len(client.calls), 1)
        self.assertEqual(ark.load_run(self.run_path)["shots"]["S01"]["status"], "unknown")
        with self.assertRaises(ark.BatchError):
            ark.create_one(client, self.run_path, self.run, self.shot, self.payload())
        self.assertEqual(len(client.calls), 1)

    def test_500_and_missing_id_are_unknown_without_retry(self):
        for result in (ark.HTTPFailure(500), {}, {"id": None}, http.client.IncompleteRead(b"partial")):
            with self.subTest(result=type(result).__name__):
                self.run["shots"] = {}
                client = FakeClient([result], self.run_path)
                with self.assertRaises(ark.UnknownOutcome):
                    ark.create_one(client, self.run_path, self.run, self.shot, self.payload())
                self.assertEqual(len(client.calls), 1)
                self.assertEqual(self.run["shots"]["S01"]["status"], "unknown")

    def test_429_retries_are_bounded(self):
        client = FakeClient([ark.HTTPFailure(429)] * 4, self.run_path)
        sleeps = []
        with self.assertRaises(ark.BatchError):
            ark.create_one(client, self.run_path, self.run, self.shot, self.payload(), sleeps.append)
        self.assertEqual(len(client.calls), 4)
        self.assertEqual(sleeps, [2, 4, 8])
        self.assertEqual(self.run["shots"]["S01"]["status"], "failed")

    def test_http_error_extracts_only_whitelisted_code(self):
        key = "offline-test-secret"
        cases = [
            ("InvalidParameter.Content", "InvalidParameter.Content"),
            ("A" * 128, "A" * 128),
            ("A" * 129, None),
            ("InvalidParameter.Content\n", None),
            ("InvalidParameter.Content with details", None),
            ("InvalidParameter.内容", None),
            (123, None),
            (None, None),
            ("Error." + key, None),
        ]
        for value, expected in cases:
            with self.subTest(value=value):
                client = ark.ArkClient(key)
                body = ark.json_bytes({"error": {"code": value, "message": "private-message " + key}})
                remote_error = ark.urllib.error.HTTPError(ark.BASE_URL, 400, "private-reason", {"X-Private": key}, io.BytesIO(body))
                with mock.patch.object(client._opener, "open", side_effect=remote_error):
                    with self.assertRaises(ark.HTTPFailure) as caught:
                        client.request("POST", "/contents/generations/tasks", {})
                self.assertEqual(caught.exception.error_code, expected)
                self.assertEqual(str(caught.exception), "HTTP 400")
                self.assertTrue(remote_error.closed)

    def test_malformed_or_oversized_http_body_keeps_generic_failure(self):
        bodies = [b"not-json", ark.json_bytes({"error": "private-message"}),
                  ark.json_bytes({"error": {"code": "InvalidParameter.Content", "message": "x" * ark.MAX_ERROR_BODY}})]
        for body in bodies:
            with self.subTest(size=len(body)):
                client = ark.ArkClient("offline-test-secret")
                remote_error = ark.urllib.error.HTTPError(ark.BASE_URL, 400, "private-reason", {}, io.BytesIO(body))
                with mock.patch.object(client._opener, "open", side_effect=remote_error):
                    with self.assertRaises(ark.HTTPFailure) as caught:
                        client.request("POST", "/contents/generations/tasks", {})
                self.assertIsNone(caught.exception.error_code)
                self.assertEqual(str(caught.exception), "HTTP 400")

    def test_create_failure_records_code_without_message_headers_or_key(self):
        key = "offline-test-secret"
        client = ark.ArkClient(key)
        body = ark.json_bytes({"error": {"code": "InvalidParameter.Content", "message": "private-message " + key},
                               "body_marker": "private-body"})
        remote_error = ark.urllib.error.HTTPError(ark.BASE_URL, 400, "private-reason",
                                                  {"X-Private": "private-header " + key}, io.BytesIO(body))
        lines = []
        with mock.patch.object(client._opener, "open", side_effect=remote_error) as opener, \
             mock.patch.dict(ark.os.environ, {"ARK_API_KEY": key, "ARK_MODEL_ID": ""}):
            result = ark.main(["--manifest", str(self.manifest_path), "submit", "--ids", "S01",
                               "--run", str(self.run_path), "--execute"], client_factory=lambda _: client, out=lines.append)
        self.assertEqual(result, 2)
        self.assertEqual(opener.call_count, 1)
        job = ark.load_run(self.run_path)["shots"]["S01"]
        self.assertEqual(job["status"], "failed")
        self.assertEqual(job["error_code"], "InvalidParameter.Content")
        self.assertIn("Check error_code InvalidParameter.Content", "\n".join(lines))
        observable = "\n".join(lines) + self.run_path.read_text()
        for private in (key, "private-message", "private-body", "private-reason", "private-header"):
            self.assertNotIn(private, observable)

    def test_failed_query_records_only_safe_error_code(self):
        key = "offline-test-secret"
        for code in ("InvalidParameter.Content", "InvalidParameter.Content\n", "Error." + key, None):
            with self.subTest(code=code):
                self.run["shots"] = {"S01": {"status": "submitted", "task_id": "task-test"}}
                client = FakeClient([{"status": "failed", "error": {"code": code, "message": "private-message " + key},
                                      "body_marker": "private-body"}])
                client._key = key
                lines = []
                self.assertFalse(ark.watch_run(client, self.run_path, self.run, out=lines.append))
                job = ark.load_run(self.run_path)["shots"]["S01"]
                self.assertEqual(job["status"], "failed")
                if code == "InvalidParameter.Content":
                    self.assertEqual(job["error_code"], code)
                    self.assertIn("Check error_code " + code, lines[-1])
                else:
                    self.assertNotIn("error_code", job)
                    self.assertEqual(lines[-1], "S01: failed")
                observable = "\n".join(lines) + self.run_path.read_text()
                for private in (key, "private-message", "private-body"):
                    self.assertNotIn(private, observable)
                self.assertEqual(len(client.calls), 1)

    def test_query_http_error_preserves_code_and_existing_task_id(self):
        self.run["shots"] = {"S01": {"status": "submitted", "task_id": "task-test"}}
        client = FakeClient([ark.HTTPFailure(403, "AccessDenied")])
        with self.assertRaises(ark.BatchError) as caught:
            ark.watch_run(client, self.run_path, self.run, out=lambda _: None)
        job = ark.load_run(self.run_path)["shots"]["S01"]
        self.assertEqual(job["task_id"], "task-test")
        self.assertEqual(job["status"], "submitted")
        self.assertEqual(job["error_code"], "AccessDenied")
        self.assertIn("Check error_code AccessDenied", str(caught.exception))
        self.assertEqual(len(client.calls), 1)

    def test_task_id_persisted_and_success_downloaded_once(self):
        client = FakeClient([{"id": "task-test"}, {"status": "succeeded", "content": {"video_url": "https://example.invalid/result.mp4"}}], self.run_path)
        ark.create_one(client, self.run_path, self.run, self.shot, self.payload())
        self.assertEqual(ark.load_run(self.run_path)["shots"]["S01"]["task_id"], "task-test")
        self.assertTrue(ark.watch_run(client, self.run_path, self.run, sleep=lambda _: self.fail("unexpected wait"), out=lambda _: None))
        self.assertTrue(ark.watch_run(client, self.run_path, self.run, out=lambda _: None))
        self.assertEqual(client.download_calls, 1)

    def test_all_terminal_failures_exit_without_polling_or_sleeping(self):
        for status in ("failed", "cancelled", "expired", "unknown", "intent"):
            with self.subTest(status=status):
                self.run["shots"] = {"S01": {"status": status}}
                client = FakeClient()
                result = ark.watch_run(client, self.run_path, self.run, sleep=lambda _: self.fail("terminal loop"), out=lambda _: None)
                self.assertFalse(result)
                self.assertEqual(client.calls, [])

    def test_running_then_expired_does_not_loop_forever(self):
        self.run["shots"] = {"S01": {"status": "submitted", "task_id": "task-test"}}
        client = FakeClient([{"status": "running"}, {"status": "expired"}])
        sleeps = []
        self.assertFalse(ark.watch_run(client, self.run_path, self.run, sleep=sleeps.append, out=lambda _: None))
        self.assertEqual(sleeps, [10])
        self.assertEqual(len(client.calls), 2)

    def test_interval_and_paths_are_validated(self):
        with self.assertRaises(ark.BatchError):
            ark.watch_run(FakeClient(), self.run_path, self.run, interval=1)
        self.manifest["shots"][0]["prompt_file"] = "../outside.txt"
        self.manifest_path.write_text(json.dumps(self.manifest), encoding="utf-8")
        with self.assertRaises(ark.BatchError):
            ark.load_manifest(self.manifest_path)

    def test_download_rejects_truncated_or_non_mp4_without_authorization(self):
        class Response(io.BytesIO):
            pass
        for data, length in ((b"\0\0\0\x18ftypmp42" + b"x" * 20, "100"), (b"<html>error</html>", "18")):
            response = Response(data)
            response.headers = {"Content-Length": length}
            target = self.root / "videos/result.mp4"
            with mock.patch.object(ark.urllib.request, "urlopen", return_value=response) as opener:
                with self.assertRaises(ark.BatchError):
                    ark.ArkClient("offline-test-secret").download("https://example.invalid/video.mp4", target)
            self.assertIsInstance(opener.call_args.args[0], str)
            self.assertNotIn("offline-test-secret", repr(opener.call_args))
            self.assertFalse(target.exists())

    def test_resume_unknown_does_not_submit_and_does_not_print_key(self):
        payload = self.payload()
        self.run["shots"] = {"S01": {"status": "unknown", "payload_sha256": ark.digest(ark.json_bytes(payload))}}
        ark.save_run(self.run_path, self.run)
        lines = []
        client = FakeClient()
        with mock.patch.dict(ark.os.environ, {"ARK_API_KEY": "offline-test-secret", "ARK_MODEL_ID": ""}):
            code = ark.main(["--manifest", str(self.manifest_path), "submit", "--ids", "S01", "--run", str(self.run_path), "--execute"],
                            client_factory=lambda key: client, out=lines.append)
        self.assertEqual(code, 2)
        self.assertEqual(client.calls, [])
        self.assertNotIn("offline-test-secret", "\n".join(lines) + self.run_path.read_text())


if __name__ == "__main__":
    unittest.main()
