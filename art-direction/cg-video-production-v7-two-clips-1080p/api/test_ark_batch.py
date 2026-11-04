"""Offline tests only. No real key file, network, or chargeable task."""
import base64
import copy
from datetime import datetime, timezone
import importlib.util
import io
import json
from pathlib import Path
import socket
import struct
import tempfile
import unittest
from unittest import mock
import zlib

SPEC = importlib.util.spec_from_file_location("ark_v7", Path(__file__).with_name("ark_batch.py"))
ark = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ark)


def png(width=800, height=450, marker=b""):
    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xffffffff)
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"tEXt", b"Source\x00native-original" + marker)
            + chunk(b"IDAT", zlib.compress((b"\0" + b"\0" * width * 3) * height)) + chunk(b"IEND", b""))


MP4 = b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom" + b"test-payload"


class FakeClient:
    def __init__(self, responses=None, run_path=None, download_results=None):
        self.responses = list(responses or [])
        self.calls = []
        self.download_calls = []
        self.run_path = run_path
        self.download_results = list(download_results or [])
        self._key = "offline-secret-only"

    def request(self, method, path, body=None):
        if method == "POST" and self.run_path:
            run = ark.load_run(self.run_path)
            assert any(job["status"] == "intent" for job in run["jobs"].values()), "POST before intent persisted"
        self.calls.append((method, path, body))
        result = self.responses.pop(0)
        if isinstance(result, BaseException):
            raise result
        return result

    def download(self, url, target):
        self.download_calls.append(url)
        if self.download_results:
            result = self.download_results.pop(0)
            if isinstance(result, BaseException):
                raise result
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(MP4)
        return {"path": str(target), "bytes": len(MP4), "sha256": ark.digest(MP4)}


def success(url="https://example.invalid/video.mp4"):
    return {"status": "succeeded", "content": {"video_url": url}, "duration": 30,
            "resolution": "720p", "generate_audio": False, "usage": {"completion_tokens": 1000, "total_tokens": 1000}}


class BackendTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        (self.root / "references").mkdir()
        (self.root / "prompts").mkdir()
        self.manifest = {"version": 7, "defaults": {"model": ark.DEFAULT_MODEL, "resolution": "720p",
            "ratio": "16:9", "generate_audio": False, "output_format": "mp4", "omni_reference_task_type": "reference"},
            "jobs": [], "edit_timeline": [{"source": "A01", "in": 0, "out": 3, "start": 0, "end": 3}]}
        for sid, prefix, cuts in (("A01", "S", [0, 3, 6, 10, 14, 18, 24, 30]), ("B01", "E", [0, 3, 6, 9, 12, 16, 20])):
            refs, segments = [], []
            for i in range(len(cuts)-1):
                rid = prefix + "%02d" % (i+1)
                frame = self.root / "references" / (rid + ".png")
                frame.write_bytes(png(marker=rid.encode()))
                refs.append({"image_index": i+1, "id": rid, "file": "references/" + rid + ".png", "sha256": ark.digest(frame.read_bytes())})
                segments.append({"id": rid, "start": cuts[i], "end": cuts[i+1], "reference_index": i+1})
            prompt = self.root / "prompts" / (sid + ".txt")
            prompt.write_text("多镜头。按编号参考：" + "、".join("@图片" + str(i+1) for i in range(len(refs))) + "。无对白或人声。\n", encoding="utf-8")
            self.manifest["jobs"].append({"id": sid, "title": "测试 " + sid, "duration": cuts[-1], "references": refs,
                "prompt_file": "prompts/" + sid + ".txt", "prompt_sha256": ark.digest(prompt.read_bytes()),
                "segments": segments})
        self.path = self.root / "manifest.json"
        self.write_manifest()
        self.snapshot = ark.prepare(self.path, self.manifest)
        self.fingerprint = self.snapshot["plan_sha256"]
        self.run_path = ark.run_path_for(self.path, self.fingerprint)
        self.run = {"version": 7, "plan_sha256": self.fingerprint, "jobs": {}}
        self.lines = []

    def tearDown(self):
        self.temp.cleanup()

    def write_manifest(self):
        self.path.write_text(json.dumps(self.manifest, ensure_ascii=False), encoding="utf-8")

    def payload(self, index=0):
        return ark.build_payload(self.path, self.manifest, self.manifest["jobs"][index])

    def call(self, command, client=None, extra=(), real_key_loader=False):
        args = ["--manifest", str(self.path), command, *extra]
        if real_key_loader:
            return ark.main(args, out=self.lines.append, sleep=lambda _: None)
        with mock.patch.object(ark, "client_from_file", return_value=client or FakeClient()):
            return ark.main(args, out=self.lines.append, sleep=lambda _: None)

    def execute(self, client):
        return self.call("run", client, ("--execute", "--approved-plan-sha256", self.fingerprint))

    def submitted_job(self, index=0):
        return {"status": "submitted", "task_id": "task-" + str(index), "payload_sha256": ark.digest(ark.json_bytes(self.payload(index)))}

    def test_multi_reference_payload_keeps_all_original_pngs_in_numeric_order(self):
        _, manifest = ark.load_manifest(self.path)
        for job in manifest["jobs"]:
            job["references"].reverse()
            payload = ark.build_payload(self.path, manifest, job)
            self.assertEqual(payload["resolution"], "720p")
            self.assertIs(payload["generate_audio"], False)
            self.assertEqual(payload["ratio"], "16:9")
            self.assertEqual(payload["omni_reference_task_type"], "reference")
            self.assertEqual(len(payload["content"]), len(job["references"])+1)
            self.assertEqual(payload["content"][0]["type"], "text")
            for content, reference in zip(payload["content"][1:], sorted(job["references"], key=lambda x: x["image_index"])):
                self.assertEqual(content["role"], "reference_image")
                data = base64.b64decode(content["image_url"]["url"].split(",", 1)[1])
                self.assertEqual(data, (self.root / reference["file"]).read_bytes())
                self.assertIn(b"native-original", data)
            self.assertNotIn("first_frame", ark.json_bytes(payload).decode())
            self.assertFalse({"seed", "draft", "camera_fixed", "service_tier"} & payload.keys())

    def test_prepare_does_not_store_base64_or_read_key(self):
        for file in ("review-lock.json", "review-summary.json"):
            text = (self.root / file).read_text()
            self.assertNotIn("base64", text)
            self.assertNotIn("ARK_API_KEY", text)
        before = (self.root / "review-lock.json").read_bytes()
        with mock.patch.object(ark, "client_from_file", side_effect=AssertionError("key read")):
            self.assertEqual(self.call("prepare", real_key_loader=True), 0)
        self.assertEqual(before, (self.root / "review-lock.json").read_bytes())

    def test_all_dry_modes_never_read_credentials_network_or_create_run(self):
        with mock.patch.object(ark, "client_from_file", side_effect=AssertionError("key read")), \
             mock.patch.object(ark.urllib.request, "build_opener", side_effect=AssertionError("network")):
            for command in ("validate", "prepare", "run", "watch", "preflight"):
                with self.subTest(command=command):
                    self.assertEqual(self.call(command, real_key_loader=True), 0)
        self.assertFalse(self.run_path.exists())

    def test_frame_and_prompt_hash_changes_refuse_execution_before_key(self):
        for relative in ("prompts/A01.txt", "references/S01.png"):
            with self.subTest(relative=relative):
                path = self.root / relative
                original = path.read_bytes()
                path.write_bytes(original + b"changed")
                with mock.patch.object(ark, "client_from_file", side_effect=AssertionError("key read")):
                    self.assertEqual(self.call("run", extra=("--execute", "--approved-plan-sha256", self.fingerprint), real_key_loader=True), 2)
                path.write_bytes(original)
        self.assertFalse(self.run_path.exists())

    def test_manifest_or_approval_hash_changes_refuse_execution(self):
        client = FakeClient()
        self.assertEqual(self.call("run", client, ("--execute", "--approved-plan-sha256", "0" * 64)), 2)
        self.manifest["defaults"]["resolution"] = "1080p"
        self.write_manifest()
        self.assertEqual(self.execute(client), 2)
        self.assertEqual(client.calls, [])

    def test_missing_explicit_approval_never_reads_key(self):
        with mock.patch.object(ark, "client_from_file", side_effect=AssertionError("key read")):
            self.assertEqual(self.call("run", extra=("--execute",), real_key_loader=True), 2)

    def test_timeout_and_500_and_missing_id_are_unknown_single_post(self):
        for result in (socket.timeout(), ark.HTTPFailure(500), {}, {"id": None}):
            with self.subTest(result=type(result).__name__):
                self.run["jobs"] = {}
                client = FakeClient([result], self.run_path)
                with self.assertRaises(ark.UnknownOutcome):
                    ark.create_one(client, self.run_path, self.run, self.manifest["jobs"][0], self.payload())
                self.assertEqual(len(client.calls), 1)
                self.assertEqual(ark.load_run(self.run_path)["jobs"]["A01"]["status"], "unknown")
                with self.assertRaises(ark.BatchError):
                    ark.create_one(client, self.run_path, self.run, self.manifest["jobs"][0], self.payload())
                self.assertEqual(len(client.calls), 1)

    def test_429_post_is_not_retried(self):
        client = FakeClient([ark.HTTPFailure(429)], self.run_path)
        self.assertEqual(self.execute(client), 2)
        self.assertEqual([c[0] for c in client.calls], ["POST"])
        self.assertEqual(ark.load_run(self.run_path)["jobs"]["A01"]["status"], "failed")

    def test_unknown_anywhere_blocks_all_requests_including_prior_queries(self):
        self.run["jobs"]["A01"] = self.submitted_job()
        self.run["jobs"]["B01"] = {"status": "unknown", "payload_sha256": ark.digest(ark.json_bytes(self.payload(1)))}
        ark.save_run(self.run_path, self.run)
        client = FakeClient()
        with mock.patch.object(ark, "client_from_file", side_effect=AssertionError("key read")):
            self.assertEqual(self.call("run", extra=("--execute", "--approved-plan-sha256", self.fingerprint), real_key_loader=True), 2)
        self.assertEqual(client.calls, [])

    def test_resume_queries_existing_then_submits_only_unstarted_environment(self):
        self.run["jobs"]["A01"] = self.submitted_job()
        ark.save_run(self.run_path, self.run)
        client = FakeClient([success(), {"id": "task-new-env"}, success()], self.run_path)
        self.assertEqual(self.execute(client), 0)
        self.assertEqual([c[0] for c in client.calls], ["GET", "POST", "GET"])
        ledger = ark.load_run(self.run_path)
        self.assertEqual(set(ledger["jobs"]), {"A01", "B01"})
        self.assertEqual(ledger["jobs"]["A01"]["usage"]["total_tokens"], 1000)
        again = FakeClient()
        self.assertEqual(self.execute(again), 0)
        self.assertEqual(again.calls, [])
        self.assertEqual(again.download_calls, [])

    def test_watch_never_submits_unstarted_environment(self):
        self.run["jobs"]["A01"] = self.submitted_job()
        ark.save_run(self.run_path, self.run)
        client = FakeClient([success()])
        self.assertEqual(self.call("watch", client, ("--execute",)), 0)
        self.assertEqual([c[0] for c in client.calls], ["GET"])
        self.assertNotIn("B01", ark.load_run(self.run_path)["jobs"])

    def test_remote_failure_stops_before_next_paid_request(self):
        client = FakeClient([{"id": "task-first"}, {"status": "failed", "error": {"code": "InputSensitiveContent", "message": "private-user-detail"}}], self.run_path)
        self.assertEqual(self.execute(client), 2)
        self.assertEqual([c[0] for c in client.calls], ["POST", "GET"])
        self.assertNotIn("private-user-detail", self.run_path.read_text() + "\n".join(self.lines))

    def test_succeeded_missing_download_refreshes_url_without_post(self):
        self.run["jobs"]["A01"] = {**self.submitted_job(), "status": "succeeded", "video_url": "https://example.invalid/expired.mp4"}
        ark.save_run(self.run_path, self.run)
        client = FakeClient([success("https://example.invalid/refreshed.mp4")])
        self.assertEqual(self.call("watch", client, ("--execute",)), 0)
        self.assertEqual(client.download_calls, ["https://example.invalid/refreshed.mp4"])
        self.assertEqual([c[0] for c in client.calls], ["GET"])

    def test_download_failure_refreshes_and_retry_only_download(self):
        self.run["jobs"]["A01"] = self.submitted_job()
        ark.save_run(self.run_path, self.run)
        client = FakeClient([success("https://example.invalid/old.mp4"), success("https://example.invalid/new.mp4")], download_results=[OSError("private URL")])
        self.assertEqual(self.call("watch", client, ("--execute",)), 0)
        self.assertEqual(client.download_calls, ["https://example.invalid/old.mp4", "https://example.invalid/new.mp4"])
        self.assertEqual([c[0] for c in client.calls], ["GET", "GET"])
        self.assertNotIn("https://", "\n".join(self.lines))

    def test_corrupt_local_download_is_downloaded_again(self):
        self.run["jobs"]["A01"] = self.submitted_job()
        ark.save_run(self.run_path, self.run)
        self.assertEqual(self.call("watch", FakeClient([success()]), ("--execute",)), 0)
        ledger = ark.load_run(self.run_path)
        Path(ledger["jobs"]["A01"]["download"]["path"]).write_bytes(b"corrupted")
        again = FakeClient([success()])
        self.assertEqual(self.call("watch", again, ("--execute",)), 0)
        self.assertEqual(len(again.download_calls), 1)

    def test_http_error_redaction_keeps_only_whitelisted_code(self):
        key = "offline-secret-only"
        for code, expected in (("InvalidParameter.Content", "InvalidParameter.Content"), ("Error." + key, None), ("bad code", None), ("X" * 129, None)):
            client = ark.ArkClient(key)
            body = ark.json_bytes({"error": {"code": code, "message": "private-message " + key}})
            remote = ark.urllib.error.HTTPError(ark.BASE_URL, 400, "private-reason", {"Private": key}, io.BytesIO(body))
            with mock.patch.object(client._opener, "open", side_effect=remote):
                with self.assertRaises(ark.HTTPFailure) as caught:
                    client.request("POST", "/contents/generations/tasks", {})
            self.assertEqual(caught.exception.error_code, expected)
            self.assertEqual(str(caught.exception), "HTTP 400")
            self.assertTrue(remote.closed)

    def test_create_rejection_does_not_log_private_error_fields(self):
        client = FakeClient([ark.HTTPFailure(403, "AccessDenied")], self.run_path)
        self.assertEqual(self.execute(client), 2)
        observed = self.run_path.read_text() + "\n".join(self.lines)
        self.assertNotIn(client._key, observed)
        self.assertIn("AccessDenied", observed)

    def test_preflight_executes_get_models_only_and_does_not_grant_input_acceptance(self):
        client = FakeClient([{"data": [{"id": ark.DEFAULT_MODEL}]}])
        self.assertEqual(self.call("preflight", client, ("--execute",)), 0)
        self.assertEqual(client.calls, [("GET", "/models", None)])
        report = ark.read_json(self.root / "reports/preflight.json", "preflight")
        self.assertEqual(report["model_access_assessment"], "listed_not_generation_tested")
        self.assertEqual(report["specific_input_moderation"], "not_tested")
        self.assertFalse(report["paid_submission"])
        self.assertFalse(self.run_path.exists())
        self.assertFalse(ark.read_json(self.root / "review-lock.json", "lock")["video_submission_authorized"])

    def test_unlisted_model_is_unknown_and_http_failure_report_is_sanitized(self):
        client = FakeClient([{"data": [{"id": "another-model"}]}])
        self.assertEqual(self.call("preflight", client, ("--execute",)), 0)
        self.assertEqual(ark.read_json(self.root / "reports/preflight.json", "report")["model_access_assessment"], "unknown")
        client = FakeClient([ark.HTTPFailure(401, "AuthenticationError")])
        self.assertEqual(self.call("preflight", client, ("--execute",)), 2)
        report = (self.root / "reports/preflight.json").read_text()
        self.assertNotIn("offline-secret-only", report)
        self.assertIn("AuthenticationError", report)

    def test_only_get_requests_retry_transient_errors(self):
        client = FakeClient([ark.HTTPFailure(503), socket.timeout(), {"data": []}])
        waits = []
        self.assertEqual(ark.get_with_retry(client, "/models", waits.append), {"data": []})
        self.assertEqual([c[0] for c in client.calls], ["GET"] * 3)
        self.assertEqual(waits, [2, 4])

    def test_media_download_has_no_authorization_and_rejects_truncation(self):
        class Response(io.BytesIO):
            pass
        for data, length, ok in ((MP4, str(len(MP4)), True), (MP4, "9999", False), (b"<html>error</html>", "18", False)):
            with self.subTest(ok=ok, length=length):
                response = Response(data)
                response.headers = {"Content-Length": length}
                opener = mock.Mock()
                opener.open.return_value = response
                target = self.root / "download/video.mp4"
                target.unlink(missing_ok=True)
                client = ark.ArkClient("offline-secret-only")
                with mock.patch.object(ark.urllib.request, "build_opener", return_value=opener):
                    if ok:
                        result = client.download("https://example.invalid/video.mp4", target)
                        self.assertEqual(result["sha256"], ark.digest(MP4))
                    else:
                        with self.assertRaises(ark.BatchError):
                            client.download("https://example.invalid/video.mp4", target)
                request = opener.open.call_args.args[0]
                self.assertFalse(request.has_header("Authorization"))
                self.assertNotIn("offline-secret-only", repr(request.header_items()))
                self.assertEqual(target.exists(), ok)
                self.assertEqual(list(target.parent.glob(".video-*")), [])

    def test_pricing_expiry_refuses_paid_run_but_dry_and_watch_are_permitted(self):
        self.manifest["pricing"] = {"review_before": "2000-01-01T14:00:00+08:00"}
        self.write_manifest()
        self.snapshot = ark.prepare(self.path, self.manifest, replace=True)
        self.fingerprint = self.snapshot["plan_sha256"]
        with mock.patch.object(ark, "client_from_file", side_effect=AssertionError("key read")):
            self.assertEqual(self.call("run", extra=("--execute", "--approved-plan-sha256", self.fingerprint), real_key_loader=True), 2)
            self.assertEqual(self.call("run", real_key_loader=True), 0)
        with self.assertRaises(ark.BatchError):
            ark.verify_pricing_window({"pricing": {"review_before": "2026-09-17T14:00:00"}})
        ark.verify_pricing_window({"pricing": {"review_before": "2026-09-17T14:00:00+08:00"}}, datetime(2026, 9, 11, tzinfo=timezone.utc))

    def test_review_cannot_be_silently_replaced_or_changed_after_run_exists(self):
        self.manifest["notes"] = "change"
        self.write_manifest()
        with self.assertRaises(ark.BatchError):
            ark.prepare(self.path, self.manifest)
        ark.save_run(self.run_path, self.run)
        with self.assertRaises(ark.BatchError):
            ark.prepare(self.path, self.manifest, replace=True)

    def test_local_key_file_parser_only_explicit_file_and_never_logs_key(self):
        key_file = self.root / "offline.env"
        key_file.write_text("IGNORED=value\nexport ARK_API_KEY='offline-secret-only'\n")
        received = []
        ark.client_from_file(key_file, received.append)
        self.assertEqual(received, ["offline-secret-only"])
        key_file.write_text("ARK_API_KEY=one\nARK_API_KEY=two\n")
        with self.assertRaises(ark.BatchError):
            ark.client_from_file(key_file)

    def test_path_traversal_and_discontinuous_source_segments_rejected(self):
        self.manifest["jobs"][0]["prompt_file"] = "../outside.txt"
        self.write_manifest()
        with self.assertRaises(ark.BatchError):
            ark.load_manifest(self.path)
        self.manifest["jobs"][0]["prompt_file"] = "prompts/A01.txt"
        self.manifest["jobs"][1]["segments"][1].update(start=4)
        self.write_manifest()
        with self.assertRaises(ark.BatchError):
            ark.load_manifest(self.path)

    def test_source_segments_reject_gaps_overlaps_partial_coverage_and_wrong_refs(self):
        original = copy.deepcopy(self.manifest)
        mutations = [
            lambda job: job["segments"][0].update(start=1),
            lambda job: job["segments"][1].update(start=2),
            lambda job: job["segments"][1].update(start=4),
            lambda job: job["segments"][-1].update(end=29),
            lambda job: job["segments"][-1].update(end=31),
            lambda job: job["segments"][0].update(reference_index=8),
            lambda job: job["segments"][0].update(reference_index=True),
            lambda job: job["segments"][0].update(id="S07"),
            lambda job: job["segments"][0].update(start=float("nan")),
            lambda job: job.update(duration=31),
        ]
        for index, change in enumerate(mutations):
            with self.subTest(mutation=index):
                self.manifest = copy.deepcopy(original)
                change(self.manifest["jobs"][0])
                self.write_manifest()
                with self.assertRaises(ark.BatchError):
                    ark.load_manifest(self.path)

    def test_reference_mapping_rejects_duplicate_gapped_and_invalid_indices(self):
        original = copy.deepcopy(self.manifest)
        mutations = [
            lambda refs: refs[1].update(image_index=1),
            lambda refs: refs[1].update(image_index=9),
            lambda refs: refs[0].update(image_index=0),
            lambda refs: refs[0].update(image_index=True),
            lambda refs: refs[1].update(id="S01"),
            lambda refs: refs[0].update(file="../outside.png"),
            lambda refs: refs[0].update(sha256="0" * 64),
        ]
        for index, change in enumerate(mutations):
            with self.subTest(mutation=index):
                self.manifest = copy.deepcopy(original)
                change(self.manifest["jobs"][0]["references"])
                self.write_manifest()
                with self.assertRaises(ark.BatchError):
                    ark.load_manifest(self.path)

    def test_unmapped_prompt_image_number_is_rejected(self):
        prompt = self.root / "prompts/A01.txt"
        prompt.write_text("0-30秒参考 @图片8。", encoding="utf-8")
        self.manifest["jobs"][0]["prompt_sha256"] = ark.digest(prompt.read_bytes())
        self.write_manifest()
        with self.assertRaises(ark.BatchError):
            ark.load_manifest(self.path)

    def test_layout_only_n02_reference_accepts_metadata_and_preserves_original_bytes(self):
        source = self.root / "references/S02.png"
        layout = self.root / "references/S02-space-reference.png"
        layout.write_bytes(source.read_bytes())
        job = self.manifest["jobs"][0]
        job["references"][1].update(id="N02", file="references/S02-space-reference.png",
            scope="layout-only; exclude the person in the source reference", preview_is_desired_output=False)
        job["segments"][1]["id"] = "N02"
        prompt = self.root / job["prompt_file"]
        prompt.write_text(prompt.read_text() + "@图片2仅参考房间布局，画面中不出现参考图中的人物。\n", encoding="utf-8")
        job["prompt_sha256"] = ark.digest(prompt.read_bytes())
        self.write_manifest()
        _, manifest = ark.load_manifest(self.path)
        payload = ark.build_payload(self.path, manifest, manifest["jobs"][0])
        reference = manifest["jobs"][0]["references"][1]
        self.assertEqual(reference["id"], "N02")
        self.assertIs(reference["preview_is_desired_output"], False)
        self.assertIn("layout-only", reference["scope"])
        self.assertEqual(payload["content"][2]["role"], "reference_image")
        encoded = payload["content"][2]["image_url"]["url"].split(",", 1)[1]
        self.assertEqual(base64.b64decode(encoded), source.read_bytes())
        self.assertNotEqual(ark.plan_snapshot(self.path, manifest)["plan_sha256"], self.fingerprint)

    def test_real_encoded_request_size_is_recorded_and_enforced_in_validate(self):
        payload = self.payload()
        encoded_size = len(ark.json_bytes(payload))
        binding = self.snapshot["binding"]["jobs"][0]
        self.assertEqual(binding["encoded_request_bytes"], encoded_size)
        self.assertGreater(encoded_size, sum((self.root / ref["file"]).stat().st_size for ref in self.manifest["jobs"][0]["references"]))
        with mock.patch.object(ark, "MAX_BODY", encoded_size):
            self.assertEqual(len(ark.json_bytes(self.payload())), encoded_size)
        with mock.patch.object(ark, "MAX_BODY", encoded_size-1):
            with self.assertRaises(ark.BatchError):
                self.payload()
            with self.assertRaises(ark.BatchError):
                ark.load_manifest(self.path)
        self.assertEqual(ark.MAX_BODY, 64 * 1024 * 1024)

    def test_reference_count_30_allowed_31_rejected_without_recompression(self):
        job = self.manifest["jobs"][0]
        original = copy.deepcopy(job["references"][0])
        job["references"] = [{**original, "image_index": i+1, "id": "S%02d" % (i+1)} for i in range(30)]
        payload = self.payload()
        self.assertEqual(len(payload["content"]), 31)
        job["references"].append({**original, "image_index": 31, "id": "S31"})
        self.write_manifest()
        with self.assertRaises(ark.BatchError):
            self.payload()
        with self.assertRaises(ark.BatchError):
            ark.load_manifest(self.path)

    def test_edit_timeline_is_bound_even_though_submission_uses_source_order(self):
        self.manifest["edit_timeline"][0]["out"] = 2
        self.write_manifest()
        client = FakeClient()
        self.assertEqual(self.execute(client), 2)
        self.assertEqual(client.calls, [])

    def test_first_frame_settings_cannot_replace_multi_reference_contract(self):
        original = copy.deepcopy(self.manifest)
        for field, value in (("ratio", "adaptive"), ("omni_reference_task_type", "first_last_frame"), ("generate_audio", True)):
            with self.subTest(field=field):
                self.manifest = copy.deepcopy(original)
                self.manifest["defaults"][field] = value
                self.write_manifest()
                with self.assertRaises(ark.BatchError):
                    ark.load_manifest(self.path)

    def test_request_settings_modified_between_shots_stop_next_charge(self):
        outer = self
        class EditingClient(FakeClient):
            def download(self, url, target):
                result = super().download(url, target)
                outer.manifest["notes"] = "changed while first video was running"
                outer.write_manifest()
                return result
        client = EditingClient([{"id": "task-first"}, success()], self.run_path)
        self.assertEqual(self.execute(client), 2)
        self.assertEqual([c[0] for c in client.calls], ["POST", "GET"])


if __name__ == "__main__":
    unittest.main()
