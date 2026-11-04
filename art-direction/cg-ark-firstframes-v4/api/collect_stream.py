"""Collect the already submitted curl stream. This file has no generation call."""
from pathlib import Path
import argparse
import json
from seedream_group import Client, image_info, private_json, stamp

BASE = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--run", default="group-02-stream", choices=["group-02-stream", "group-03-young-man", "group-04-childhood", "group-05-reader", "group-06-departure"])
    args = parser.parse_args()
    RUN = BASE / "runs" / args.run
    intent = json.loads((RUN / "intent.json").read_text())
    expected = intent["max_images"]
    raw = (RUN / "events.sse").read_text(encoding="utf-8").replace("\r\n", "\n")
    events = []
    for block in raw.split("\n\n")[:-1]:
        lines = block.splitlines()
        data = "\n".join(line[5:].lstrip(" ") for line in lines if line.startswith("data:"))
        if not data or data.strip() == "[DONE]":
            continue
        event = json.loads(data)
        if not isinstance(event, dict):
            raise SystemExit("Unexpected event shape; original stream is preserved.")
        events.append(event)
    previous = RUN / "state.json"
    state = json.loads(previous.read_text()) if previous.exists() else {
        "version": 1, "created_at": stamp(), "downloads": {}, "requested_count": expected,
        "model": "doubao-seedream-5-0-260128", "size": "2560x1440",
        "source": "curl SSE capture", "collector_can_submit_generation": False,
    }
    response = {"model": state["model"], "data": [], "stream_completed": False}
    event_dir = RUN / "events"
    event_dir.mkdir(mode=0o700, exist_ok=True)
    for number, event in enumerate(events, 1):
        private_json(event_dir / ("%03d.json" % number), event)
        kind = event.get("type")
        if kind in {"image_generation.partial_succeeded", "image_generation.partial_failed"}:
            index = event.get("image_index")
            if type(index) is not int or not 0 <= index < expected:
                raise SystemExit("Unexpected image index; inspect preserved events.")
            while len(response["data"]) <= index:
                response["data"].append(None)
            if response["data"][index] not in (None, event):
                raise SystemExit("Conflicting index; original stream is preserved.")
            response["data"][index] = event
        elif kind == "image_generation.completed":
            response.update({k: event[k] for k in ("model", "created", "usage", "error") if k in event})
            response["stream_completed"] = True
        elif kind == "error":
            response["error"] = event.get("error")
    private_json(RUN / "response.json", response)
    state.update(received_events=len(events), stream_completed=response["stream_completed"])
    client = Client()  # Unauthenticated image download only. Never reads the API key.
    for index, event in enumerate(response["data"]):
        if not isinstance(event, dict) or not isinstance(event.get("url"), str):
            continue
        name = "image-%02d.png" % (index + 1)
        path = RUN / "raw" / name
        record = state["downloads"].get(name, {})
        if path.is_file() and record.get("status") == "downloaded" and image_info(path) == record.get("info"):
            continue
        try:
            info = client.download(event["url"], path)
            state["downloads"][name] = {"status": "downloaded", "path": "raw/" + name, "info": info}
            print("Saved %s (%dx%d)." % (name, info["width"], info["height"]), flush=True)
        except Exception as error:
            state["downloads"][name] = {"status": "download_failed", "exception_type": type(error).__name__}
            print(name + ": download deferred; URL retained privately.", flush=True)
        private_json(previous, state)
    count = sum(item.get("status") == "downloaded" for item in state["downloads"].values())
    state.update(downloaded_count=count, checked_at=stamp())
    state["status"] = "complete" if response["stream_completed"] and count == expected else "collecting"
    if (RUN / "transport-result.json").exists() and not response["stream_completed"]:
        state["status"] = "partial_stream_interrupted" if count else "unknown"
    private_json(previous, state)
    print(json.dumps({"status": state["status"], "downloaded": count,
                      "completed_event": response["stream_completed"], "usage": response.get("usage")}), flush=True)


if __name__ == "__main__":
    main()
