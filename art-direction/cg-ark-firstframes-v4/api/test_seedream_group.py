import importlib.util
import http.client
import io
import json
from pathlib import Path
import stat
import struct
import tempfile
import unittest
from unittest import mock
import zlib


SPEC = importlib.util.spec_from_file_location("seedream_group", Path(__file__).with_name("seedream_group.py"))
group = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(group)


def png_bytes():
    def chunk(name, value):
        return struct.pack(">I", len(value)) + name + value + struct.pack(">I", zlib.crc32(name + value) & 0xffffffff)
    return (group.PNG_SIGNATURE + chunk(b"IHDR", struct.pack(">IIBBBBB", 2, 1, 8, 2, 0, 0, 0))
            + chunk(b"tEXt", b"OriginalMetadata\x00preserve-me")
            + chunk(b"IDAT", zlib.compress(b"\0\x10\x20\x30\x40\x50\x60")) + group.PNG_END)


class FakeClient:
    def __init__(self, run, result=None, error=None):
        self.run, self.result, self.error = run, result, error
        self.posts = self.downloads = 0

    def generate(self, payload):
        self.posts += 1
        state = json.loads((self.run / "state.json").read_text())
        assert state["status"] == "intent"
        if self.error:
            raise self.error
        return self.result

    def download(self, url, path):
        self.downloads += 1
        path.parent.mkdir(exist_ok=True)
        path.write_bytes(png_bytes())
        return group.image_info(path)


class GroupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.prompt = self.root / "prompt.txt"
        self.prompt.write_text("同一角色的七张独立电影首帧，无文字。", encoding="utf-8")
        self.run = self.root / "run"
        self.args = ["--prompt", str(self.prompt), "--run-dir", str(self.run)]

    def tearDown(self):
        self.temp.cleanup()

    def test_dry_run_does_not_read_credentials_or_create_client_or_files(self):
        with mock.patch.object(group, "read_key", side_effect=AssertionError("credential access")), \
             mock.patch.object(group.urllib.request, "urlopen", side_effect=AssertionError("network")):
            code = group.main(self.args + ["--credentials-file", str(self.root / "nonexistent.env")],
                              client_factory=lambda *_: self.fail("client construction"), out=lambda _: None)
        self.assertEqual(code, 0)
        self.assertFalse(self.run.exists())

    def test_payload_is_text_only_with_seven_as_upper_bound(self):
        payload = group.payload_from_file(self.prompt)
        self.assertEqual(payload, {"model": group.MODEL, "prompt": self.prompt.read_text(),
            "size": "2560x1440", "sequential_image_generation": "auto",
            "sequential_image_generation_options": {"max_images": 7}, "stream": False,
            "output_format": "png", "response_format": "url", "watermark": False})
        self.assertNotIn("image", payload)
        self.assertNotIn("content", payload)
        self.assertEqual(group.MODEL, "doubao-seedream-5-0-260128")
        with self.assertRaises(group.GroupError):
            group.payload_from_file(self.prompt, "doubao-seedream-5-0-pro-260628")

    def test_explicit_credentials_formats_and_ambiguity(self):
        path = self.root / "test-credential"
        key = "offline-test-key"
        for text in (key, 'ARK_API_KEY="' + key + '"\n', 'export apiKey=' + key + ' # comment\n',
                     json.dumps({"api_key": key})):
            path.write_text(text)
            self.assertEqual(group.read_key(path), key)
        for text in ('{"api_key":"offline-test-key","apiKey":"different-test-key"}',
                     '{"api_key":"offline-test-key","api_key":"different-test-key"}',
                     'UNKNOWN_KEY=offline-test-key', 'ARK_API_KEY="$(do-not-execute)"'):
            path.write_text(text)
            with self.assertRaises(group.GroupError) as error:
                group.read_key(path)
            self.assertNotIn(key, str(error.exception))

    def test_unknown_post_is_persisted_and_never_repeated(self):
        self.run.mkdir()
        client = FakeClient(self.run, error=TimeoutError("private transport details"))
        payload = group.payload_from_file(self.prompt)
        for _ in range(2):
            with self.assertRaises(group.GroupError):
                group.create_group(client, self.run, payload)
        self.assertEqual(client.posts, 1)
        state = json.loads((self.run / "state.json").read_text())
        self.assertEqual(state["status"], "unknown")
        self.assertNotIn("private transport details", (self.run / "state.json").read_text())
        self.assertFalse((self.run / "response.json").exists())

    def test_partial_group_is_incomplete_and_resume_never_posts_or_reads_key(self):
        response = {"model": group.MODEL, "created": 1, "data": [
            {"url": "https://example.invalid/image-%d.png?private=signed" % i, "size": "2x1"} for i in range(3)],
            "usage": {"generated_images": 3}}
        client = FakeClient(self.run, response)
        lines = []
        with mock.patch.object(group, "read_key", return_value="offline-test-key"):
            result = group.main(self.args + ["--execute"], client_factory=lambda *_: client, out=lines.append)
        self.assertEqual(result, 2)
        self.assertEqual(client.posts, 1)
        self.assertEqual(client.downloads, 3)
        self.assertEqual(json.loads((self.run / "state.json").read_text())["status"], "incomplete")
        self.assertEqual(json.loads((self.run / "response.json").read_text()), response)
        self.assertEqual(stat.S_IMODE((self.run / "response.json").stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE((self.run / "state.json").stat().st_mode), 0o600)
        self.assertIn("incomplete: 3/7", lines[-1])
        self.assertNotIn("private=signed", "\n".join(lines))
        (self.run / "raw/image-02.png").write_bytes(b"corrupted")
        with mock.patch.object(group, "read_key", side_effect=AssertionError("resume credential access")):
            result = group.main(["--run-dir", str(self.run), "--resume-downloads", "--execute"],
                                client_factory=lambda *_: client, out=lambda _: None)
        self.assertEqual(result, 2)
        self.assertEqual(client.posts, 1)
        self.assertEqual(client.downloads, 4)
        self.assertEqual((self.run / "raw/image-02.png").read_bytes(), png_bytes())

    def test_download_has_no_authorization_and_preserves_original_bytes(self):
        class Response(io.BytesIO):
            pass
        raw = png_bytes()
        response = Response(raw)
        response.headers = {"Content-Length": str(len(raw))}
        path = self.root / "raw/image-01.png"
        client = group.Client("offline-test-key")
        with mock.patch.object(group.urllib.request, "urlopen", return_value=response) as opener:
            info = client.download("https://example.invalid/image.png", path)
        request = opener.call_args.args[0]
        self.assertEqual(request.get_method(), "GET")
        self.assertIsNone(request.get_header("Authorization"))
        self.assertNotIn("offline-test-key", repr(request.header_items()))
        self.assertEqual(path.read_bytes(), raw)
        self.assertEqual(info, group.image_info(path))
        self.assertEqual((info["width"], info["height"]), (2, 1))
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)

    def test_http_failure_prints_only_safe_code_and_does_not_retry(self):
        client = group.Client("offline-test-key")
        body = group.encoded({"error": {"code": "InvalidParameter.Content", "message": "offline-test-key private-message"}})
        error = group.urllib.error.HTTPError(group.ENDPOINT, 400, "private-reason", {}, io.BytesIO(body))
        lines = []
        with mock.patch.object(client._opener, "open", side_effect=error) as opener, \
             mock.patch.object(group, "read_key", return_value="offline-test-key"):
            result = group.main(self.args + ["--execute"], client_factory=lambda *_: client, out=lines.append)
        self.assertEqual(result, 2)
        self.assertEqual(opener.call_count, 1)
        self.assertIn("InvalidParameter.Content", lines[-1])
        visible = "\n".join(lines) + (self.run / "state.json").read_text()
        for text in ("offline-test-key", "private-message", "private-reason"):
            self.assertNotIn(text, visible)

    def test_sse_response_is_archived_privately_with_headers_and_parse_type(self):
        class Response(io.BytesIO):
            pass
        raw = b'event: image_generation.completed\ndata: {"usage":{"generated_images":0}}\n\n'
        response = Response(raw)
        response.status = 200
        response.headers = {"Content-Type": "text/event-stream; charset=utf-8", "X-Tt-Logid": "20260910ABC123",
                            "Unneeded-Header": "do-not-retain-header"}
        client = group.Client("offline-test-key")
        self.run.mkdir()
        with mock.patch.object(client._opener, "open", return_value=response) as opener:
            with self.assertRaises(group.GroupError):
                group.create_group(client, self.run, group.payload_from_file(self.prompt))
        self.assertEqual(opener.call_count, 1)
        state = json.loads((self.run / "state.json").read_text())
        self.assertEqual(state["status"], "unknown")
        self.assertEqual(state["exception_type"], "JSONDecodeError")
        diagnostic = state["diagnostics"]
        self.assertEqual(diagnostic["request_id"], "20260910ABC123")
        self.assertEqual(diagnostic["response_content_type"], "text/event-stream")
        self.assertEqual(diagnostic["http_status"], 200)
        self.assertEqual(diagnostic["timeout_seconds"], 600)
        self.assertIn("elapsed_seconds", diagnostic)
        self.assertNotIn("do-not-retain-header", json.dumps(state))
        path = self.run / "http-response-body.bin"
        self.assertEqual(path.read_bytes(), raw)
        self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertFalse((self.run / "response.json").exists())

    def test_partial_read_preserves_received_body_and_request_id(self):
        class Response(io.BytesIO):
            def read(self, size=-1):
                raise http.client.IncompleteRead(b'{"data":[', 100)
        response = Response()
        response.status = 200
        response.headers = {"Content-Type": "application/json", "X-Request-ID": "request-test-01"}
        client = group.Client("offline-test-key")
        self.run.mkdir()
        with mock.patch.object(client._opener, "open", return_value=response):
            with self.assertRaises(group.GroupError):
                group.create_group(client, self.run, group.payload_from_file(self.prompt))
        state = json.loads((self.run / "state.json").read_text())
        self.assertEqual(state["exception_type"], "IncompleteRead")
        self.assertEqual(state["diagnostics"]["request_id"], "request-test-01")
        self.assertTrue(state["diagnostics"]["response_body_incomplete"])
        self.assertEqual((self.run / "http-response-body.bin").read_bytes(), b'{"data":[')

    def test_network_reason_type_is_saved_without_exception_text(self):
        client = group.Client("offline-test-key")
        self.run.mkdir()
        error = group.urllib.error.URLError(TimeoutError("offline-test-key private-transport-message"))
        with mock.patch.object(client._opener, "open", side_effect=error):
            with self.assertRaises(group.GroupError):
                group.create_group(client, self.run, group.payload_from_file(self.prompt))
        state_text = (self.run / "state.json").read_text()
        state = json.loads(state_text)
        self.assertEqual(state["exception_type"], "URLError")
        self.assertEqual(state["reason_type"], "TimeoutError")
        self.assertEqual(state["diagnostics"]["stage"], "waiting_for_response_headers")
        for text in ("offline-test-key", "private-transport-message"):
            self.assertNotIn(text, state_text)

    def test_raw_body_with_credential_echo_is_never_archived(self):
        class Response(io.BytesIO):
            pass
        key = "offline-test-key"
        for value in (key, "\\u006f" + key[1:], "offline%2Dtest%2Dkey"):
            with self.subTest(value=value):
                run = self.root / ("secret-case-" + str(len(list(self.root.iterdir()))))
                run.mkdir()
                raw = ('{"error":{"message":"' + value + '"}}').encode()
                response = Response(raw)
                response.status = 200
                response.headers = {"Content-Type": "application/json", "X-Request-ID": key}
                client = group.Client(key)
                with mock.patch.object(client._opener, "open", return_value=response):
                    with self.assertRaises(group.GroupError):
                        group.create_group(client, run, group.payload_from_file(self.prompt))
                self.assertFalse((run / "http-response-body.bin").exists())
                self.assertFalse((run / "response.json").exists())
                metadata = (run / "state.json").read_text() + (run / "http-diagnostics.json").read_text()
                self.assertNotIn(key, metadata)
                self.assertIn("credential_echo", metadata)

    def test_stream_maps_indices_and_persists_each_event_before_download(self):
        class Response(io.BytesIO):
            pass
        order = [2, 0, 1, 3, 4, 5, 6]
        events = [{"type": "image_generation.partial_succeeded", "image_index": i,
                   "url": "https://example.invalid/%d.png" % i, "size": "2x1",
                   "model": group.MODEL, "created": 1} for i in order]
        events.append({"type": "image_generation.completed", "model": group.MODEL,
                       "created": 2, "usage": {"generated_images": 7, "output_tokens": 100}})
        wire = b"".join(b"event: " + event["type"].encode() + b"\ndata: " +
                        json.dumps(event).encode() + b"\n\n" for event in events)
        response = Response(wire)
        response.status = 200
        response.headers = {"Content-Type": "text/event-stream", "X-Request-ID": "stream-test-01"}
        client = group.Client("offline-test-key")
        self.run.mkdir()
        downloaded = []

        def download(url, path):
            position = len(downloaded)
            index = order[position]
            event_path = self.run / "events" / ("%03d.json" % (position + 1))
            self.assertEqual(json.loads(event_path.read_text()), events[position])
            snapshot = json.loads((self.run / "partial-response.json").read_text())
            self.assertEqual(snapshot["data"][index]["url"], url)
            self.assertEqual(path.name, "image-%02d.png" % (index + 1))
            self.assertEqual(stat.S_IMODE(event_path.stat().st_mode), 0o600)
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(png_bytes())
            downloaded.append(index)
            return group.image_info(path)

        with mock.patch.object(client._opener, "open", return_value=response) as opener, \
             mock.patch.object(client, "download", side_effect=download) as downloader:
            result, state = group.create_group(client, self.run,
                                               group.payload_from_file(self.prompt, stream=True), out=lambda _: None)
            self.assertTrue(group.download_group(client, self.run, result, state, out=lambda _: None))
        self.assertEqual(opener.call_count, 1)
        self.assertEqual(downloader.call_count, 7)
        self.assertEqual(downloaded, order)
        self.assertEqual([item["image_index"] for item in result["data"]], list(range(7)))
        self.assertEqual(result["usage"]["generated_images"], 7)
        self.assertTrue(result["stream_completed"])
        self.assertEqual(state["status"], "complete")
        self.assertEqual(len(list((self.run / "events").glob("*.json"))), 8)

    def test_stream_interruption_preserves_urls_and_resume_never_posts(self):
        class Response(io.BytesIO):
            pass
        events = [
            {"type": "image_generation.partial_succeeded", "image_index": 2,
             "url": "https://example.invalid/partial.png", "size": "2x1"},
            {"type": "image_generation.partial_failed", "image_index": 0,
             "error": {"code": "OutputImageSensitiveContentDetected", "message": "private-failure"}},
        ]
        wire = b"".join(b"data: " + json.dumps(event).encode() + b"\n\n" for event in events)
        response = Response(wire)  # EOF before completed simulates a broken stream.
        response.status = 200
        response.headers = {"Content-Type": "text/event-stream", "X-Tt-Logid": "stream-partial-01"}
        client = group.Client("offline-test-key")
        self.run.mkdir()
        lines = []
        with mock.patch.object(client._opener, "open", return_value=response) as opener, \
             mock.patch.object(client, "download", side_effect=OSError("private-download-failure")):
            with self.assertRaises(group.GroupError):
                group.create_group(client, self.run, group.payload_from_file(self.prompt, stream=True), out=lines.append)
        self.assertEqual(opener.call_count, 1)
        state = json.loads((self.run / "state.json").read_text())
        self.assertEqual(state["status"], "partial_stream_interrupted")
        saved = json.loads((self.run / "response.json").read_text())
        self.assertEqual(saved["data"][2]["url"], events[0]["url"])
        self.assertEqual(saved["data"][0]["error"]["code"], events[1]["error"]["code"])
        self.assertFalse(saved["stream_completed"])
        self.assertEqual(len(list((self.run / "events").glob("*.json"))), 2)
        self.assertNotIn("https://", "\n".join(lines))
        self.assertNotIn("private-failure", "\n".join(lines))
        resume_client = group.Client()

        def download(url, path):
            self.assertEqual(url, events[0]["url"])
            self.assertEqual(path.name, "image-03.png")
            path.parent.mkdir(exist_ok=True)
            path.write_bytes(png_bytes())
            return group.image_info(path)

        with mock.patch.object(group, "read_key", side_effect=AssertionError("credential access")), \
             mock.patch.object(resume_client, "generate", side_effect=AssertionError("POST")), \
             mock.patch.object(resume_client, "download", side_effect=download) as downloader:
            result = group.main(["--run-dir", str(self.run), "--resume-downloads", "--execute"],
                                client_factory=lambda *_: resume_client, out=lambda _: None)
        self.assertEqual(result, 2)
        self.assertEqual(downloader.call_count, 1)
        self.assertEqual((self.run / "raw/image-03.png").read_bytes(), png_bytes())
        self.assertEqual(json.loads((self.run / "state.json").read_text())["status"], "partial_stream_interrupted")


if __name__ == "__main__":
    unittest.main()
