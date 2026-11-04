#!/usr/bin/env python3
"""One authorized N02 still-image edit; never submits video or retries generation."""
from pathlib import Path
import argparse
import hashlib
import importlib.util
import json
import shutil

BASE = Path(__file__).resolve().parents[1]
ROOT = BASE.parents[1]
SOURCE = BASE.parent / "cg-ark-firstframes-v4" / "firstframes" / "S02.png"
INPUT = BASE / "references" / "S02-edit-source.png"
OUTPUT = BASE / "references" / "N02.png"
RUN = BASE / "runs" / "absence-N02"
CONNECT_FAILURE = BASE / "runs" / "absence-N02-connect-failed"
ORIGIN = BASE / "references" / "N02-origin.json"
SHOT = {"id": "N02", "run_id": "absence-N02", "image_prompt": "prompts/images/N02.txt",
        "edit_source": "references/S02-edit-source.png"}
PLAN = {"model": "doubao-seedream-5-0-pro-260628", "size": "2560x1440"}


def load_existing_workflow():
    path = BASE.parent / "cg-environments-v5" / "api" / "generate_environments.py"
    spec = importlib.util.spec_from_file_location("ark_environment_workflow_for_n02", path)
    workflow = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(workflow)
    workflow.BASE = BASE
    workflow.ROOT = ROOT
    return workflow


def prepare_input():
    INPUT.parent.mkdir(parents=True, exist_ok=True)
    source_bytes = SOURCE.read_bytes()
    if INPUT.exists():
        if INPUT.read_bytes() != source_bytes:
            raise RuntimeError("Existing edit input differs; preserved without modification.")
    else:
        with INPUT.open("xb") as stream:
            stream.write(source_bytes)


def preserve_result(workflow):
    original = RUN / "original.png"
    info = workflow.image_info(original)
    if OUTPUT.exists():
        if workflow.image_info(OUTPUT)["sha256"] != info["sha256"]:
            raise RuntimeError("Existing N02 differs; preserved without modification.")
    else:
        shutil.copyfile(original, OUTPUT)
    state = json.loads((RUN / "state.json").read_text())
    old_review = json.loads(ORIGIN.read_text()).get("visual_review") if ORIGIN.exists() else None
    metadata = {
        "id": "N02", "purpose": "Two-second empty-room absence reference",
        "mode": "single_image_edit", "model": PLAN["model"],
        "endpoint": workflow.ENDPOINT, "output": "references/N02.png", "image": info,
        "source": str(SOURCE.relative_to(ROOT)), "source_image": workflow.image_info(SOURCE),
        "edit_input": "references/S02-edit-source.png", "edit_input_role": "image_edit_only",
        "edit_input_excluded_from_video_references": True,
        "prompt": SHOT["image_prompt"],
        "prompt_sha256": hashlib.sha256((BASE / SHOT["image_prompt"]).read_bytes()).hexdigest(),
        "run": "runs/absence-N02", "usage": state.get("usage"),
        "estimated_normal_price_cny": 0.60, "actual_billing_verified": False,
        "maximum_generation_requests": 1, "automatic_generation_retries": 0,
        "preconnection_failure_archive": "runs/absence-N02-connect-failed" if CONNECT_FAILURE.exists() else None,
        "video_requests": 0, "completed_at": state.get("completed_at"),
        "visual_review": old_review or {"status": "pending"}
    }
    workflow.private_json(ORIGIN, metadata)
    print(json.dumps({"output": str(OUTPUT), **info, "estimated_normal_price_cny": 0.60,
                      "video_requests": 0}, ensure_ascii=False), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--resume-downloads", action="store_true",
                        help="Download an already saved response only; never repeats image generation.")
    parser.add_argument("--recover-connect-failure", action="store_true",
                        help="One explicit recovery only after curl exit 7 proves no connection was established.")
    args = parser.parse_args()
    if not args.execute and not args.resume_downloads:
        print("DRY RUN: one N02 2560x1440 Pro still edit, estimated CNY 0.60; no key read or network.")
        return 0
    workflow = load_existing_workflow()
    if args.resume_downloads:
        if not (RUN / "response.json").is_file():
            print("No saved response; do not resubmit generation.")
            return 2
        ok = workflow.download_existing(SHOT, RUN)
    else:
        if args.recover_connect_failure:
            state = json.loads((RUN / "state.json").read_text())
            if (CONNECT_FAILURE.exists() or state.get("curl_exit_code") != 7
                    or state.get("http_status") != 0
                    or (RUN / "response-body.json").stat().st_size != 0
                    or (RUN / "response.json").exists()):
                raise RuntimeError("Recovery not safe: preserve prior run and do not submit.")
            request = (RUN / "request.json").read_bytes()
            if hashlib.sha256(request).hexdigest() != state.get("payload_sha256"):
                raise RuntimeError("Saved request changed; no submission.")
            if json.loads(request)["prompt"] != (BASE / SHOT["image_prompt"]).read_text():
                raise RuntimeError("Prompt changed; no submission.")
            RUN.rename(CONNECT_FAILURE)
        if RUN.exists():
            print("Existing N02 run preserved; no image POST. Use download-only recovery if applicable.")
            return 2
        prepare_input()
        key = workflow.read_key(ROOT / ".env.ark.local")
        ok = workflow.generate_one(SHOT, PLAN, key)
        del key
    if not ok:
        print("N02 not complete; no automatic image retry and no video request.")
        return 2
    preserve_result(workflow)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
