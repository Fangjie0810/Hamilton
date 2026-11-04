#!/usr/bin/env python3
"""Dependency-free structural and recording-identity checks for the saved chart."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
chart = json.loads((root / "chart.json").read_text())
audio = root / "public/my-shot.mp3"
assert audio.is_file(), "Original recording is required for the identity check"
assert hashlib.sha256(audio.read_bytes()).hexdigest() == chart["analysis"]["audioSha256"], "Wrong audio recording"
assert chart["duration"] > 330
assert 490 < len(chart["beats"]) < 520
assert all(a < b for a, b in zip(chart["beats"], chart["beats"][1:]))
assert chart["sections"][0]["start"] == 0
for a, b in zip(chart["sections"], chart["sections"][1:]):
    assert a["end"] == b["start"], "Section gap or overlap"
for section in chart["sections"]:
    assert section["start"] < section["end"]
    for field in ("label", "description"):
        assert section[field]["zh"].strip() and section[field]["en"].strip()
for name, difficulty in chart["difficulties"].items():
    notes = difficulty["notes"]
    assert difficulty["label"]["zh"].strip() and difficulty["label"]["en"].strip()
    assert len(notes) == difficulty["noteCount"]
    assert len({note["id"] for note in notes}) == len(notes)
    assert notes == sorted(notes, key=lambda note: (note["time"], note["lane"]))
    latest, chords = [-10] * 4, {}
    for note in notes:
        assert note["kind"] == "tap"
        assert 0 <= note["lane"] < 4
        assert 2 < note["time"] < chart["duration"] - 3
        assert note["time"] - latest[note["lane"]] >= .2349
        latest[note["lane"]] = note["time"]
        chords[note["time"]] = chords.get(note["time"], 0) + 1
    assert max(chords.values()) <= 2
    assert len(notes) > 300
    print(f"{name}: {len(notes)} taps; chronological order, IDs, lanes, spacing, range, <=2-key chords, bilingual labels PASS")
print("503-pulse grid, continuous sections and original MP3 identity PASS")
