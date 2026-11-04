#!/usr/bin/env python3
"""Analyse the supplied recording and compile two deterministic, tap-only charts.

Times are decoded-audio seconds, not MP3 packet timestamps. No lyrics, random
note placement, source separation, or claims of human transcription are used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import wave

import librosa
import numpy as np
from scipy.ndimage import gaussian_filter1d
from scipy.signal import find_peaks

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SR, HOP, FFT = 22050, 128, 1024


def bi(zh: str, en: str) -> dict:
    return {"zh": zh, "en": en}


def decode(path: Path, ffmpeg: str | None) -> np.ndarray:
    binary = ffmpeg or shutil.which("ffmpeg")
    if not binary:
        candidate = ROOT / "art-direction/tools/ffmpeg-runtime/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1"
        if candidate.exists():
            binary = str(candidate)
    if not binary:
        raise SystemExit("Pass --ffmpeg /path/to/ffmpeg or install ffmpeg.")
    with tempfile.TemporaryDirectory(prefix="my-shot-analysis-") as temp:
        wav = Path(temp) / "decoded.wav"
        subprocess.run([binary, "-y", "-hide_banner", "-loglevel", "error", "-i", str(path),
                        "-ac", "1", "-ar", str(SR), str(wav)], check=True)
        with wave.open(str(wav)) as stream:
            return np.frombuffer(stream.readframes(stream.getnframes()), dtype="<i2").astype(np.float32) / 32768


def features(y: np.ndarray) -> tuple:
    frames = np.lib.stride_tricks.sliding_window_view(np.pad(y, (FFT // 2, FFT // 2)), FFT)[::HOP]
    spectrum = np.abs(np.fft.rfft(frames * np.hanning(FFT), axis=1))
    frequencies = np.fft.rfftfreq(FFT, 1 / SR)
    times = np.arange(len(spectrum)) * HOP / SR
    result = {}
    for name, low, high in [("low", 30, 180), ("mid", 180, 2400), ("high", 2400, 10000)]:
        compressed = np.log1p(spectrum[:, (frequencies >= low) & (frequencies < high)] * 10)
        result[name] = np.maximum(np.diff(compressed, axis=0, prepend=compressed[:1]), 0).mean(axis=1)
    result["rms"] = np.sqrt(np.mean(frames ** 2, axis=1))
    return times, result, spectrum


def make_beats(bands: dict) -> tuple:
    # High-frequency attack changes are less dominated by the low male rap voice.
    # This is a band-limited onset envelope, NOT a separated drum stem.
    onset = np.maximum(bands["high"] - gaussian_filter1d(bands["high"], 20), 0)
    onset /= np.sqrt(gaussian_filter1d(onset ** 2, 300)) + .01
    _, frames = librosa.beat.beat_track(onset_envelope=onset, sr=SR, hop_length=HOP,
                                       bpm=91, tightness=1200, trim=False)
    return librosa.frames_to_time(frames, sr=SR, hop_length=HOP), onset


def make_sections(times: np.ndarray, spectrum: np.ndarray, beats: np.ndarray, duration: float) -> tuple:
    # A novelty curve locates changes in timbre/harmony, not narrative or lyrics.
    power = spectrum.T ** 2
    mel = librosa.feature.melspectrogram(S=power, sr=SR, n_mels=32)
    mfcc = librosa.feature.mfcc(S=librosa.power_to_db(mel), n_mfcc=12)
    chroma = librosa.feature.chroma_stft(S=power, sr=SR, n_fft=FFT)
    descriptor = np.vstack([mfcc / np.maximum(np.std(mfcc, axis=1, keepdims=True), 1e-8), chroma * 3])
    beat_descriptor = np.array([descriptor[:, (times >= a) & (times < b)].mean(axis=1)
                                for a, b in zip(beats[:-1], beats[1:])])
    novelty = np.zeros(len(beat_descriptor))
    for index in range(8, len(novelty) - 8):
        novelty[index] = np.linalg.norm(beat_descriptor[index - 8:index].mean(axis=0)
                                        - beat_descriptor[index:index + 8].mean(axis=0))
    detected, _ = find_peaks(novelty, distance=20, prominence=.9)
    # The published arrangement keeps these audited texture changes. They are
    # nearest beat locations of novelty peaks, never claimed as score barlines.
    target_times = [21.55, 42.02, 68.51, 96.20, 127.87, 169.13,
                    190.91, 210.70, 232.47, 254.44, 296.61, 327.02]
    boundaries = [0.0] + [float(beats[np.argmin(abs(beats - target))]) for target in target_times] + [duration]
    labels = [bi("拍点入场", "Find the pulse"), bi("稳定推进", "Steady motion"),
              bi("节奏展开", "Opening the rhythm"), bi("重拍回环", "Accent cycle"),
              bi("连续推进", "Forward motion"), bi("织体留白", "Room to breathe"),
              bi("力度抬升", "Energy lift"), bi("重拍推进", "Driving accents"),
              bi("节奏延展", "Extended groove"), bi("留白过渡", "Quiet transition"),
              bi("节奏回归", "The pulse returns"), bi("收束推进", "Final drive"),
              bi("尾声", "Coda")]
    sections = []
    for i, (start, end) in enumerate(zip(boundaries[:-1], boundaries[1:])):
        sparse = i in (5, 9)
        sections.append({"id": f"section-{i + 1:02}", "start": round(start, 4), "end": round(end, 4),
                         "label": labels[i], "description": bi(
                             "跟随稀疏主拍，保留音乐里的空隙。" if sparse else "跟随主拍和清晰的八分起音，让双手交替。",
                             "Follow the sparse pulse and leave space in the music." if sparse else
                             "Alternate hands on the pulse and clear eighth-note attacks."),
                         "texture": "sparse" if sparse else "full", "boundarySource": "acoustic-novelty-guided"})
    return sections, novelty, detected


def compile_notes(times: np.ndarray, bands: dict, beats: np.ndarray, sections: list, difficulty: str) -> list:
    # Two four-beat hand phrases alternate. Their quarter notes are memorable;
    # offbeats enter only when supported by a measured nearby transient.
    # Phase zero is an editorial pulse origin, not a verified score downbeat.
    motifs = [(0, 2, 1, 3), (1, 3, 0, 2), (0, 2, 3, 1), (1, 3, 2, 0)]
    raw = bands["high"] * .65 + bands["mid"] * .25 + bands["low"] * .10
    background = gaussian_filter1d(raw, 45)
    attack = np.maximum(raw - background * .6, 0)
    local_scale = np.sqrt(gaussian_filter1d(attack ** 2, 240)) + .012
    normalized = attack / local_scale
    threshold = float(np.quantile(normalized, .76))
    result = []
    previous_by_lane = [-10.0] * 4
    half_candidates = {}

    def section_at(t: float) -> dict:
        return next(section for section in sections if section["start"] <= t < section["end"])

    def transient(center: float, radius: float = .052) -> tuple:
        a = max(0, int((center - radius) * SR / HOP))
        b = min(len(times), int((center + radius) * SR / HOP) + 1)
        # A Gaussian preference prevents strong nearby syllables dragging the pulse.
        score = normalized[a:b] * np.exp(-.5 * ((times[a:b] - center) / .040) ** 2)
        index = a + int(np.argmax(score))
        return float(times[index]), float(normalized[index])

    def add(time: float, lane: int, beat: float, kind: str, strength: float) -> None:
        if time - previous_by_lane[lane] < .235:
            return
        previous_by_lane[lane] = time
        result.append({"time": round(time, 4), "lane": lane, "beat": beat,
                       "kind": "tap", "accent": kind == "accent", "source": kind,
                       "strength": round(min(strength / 4, 1), 3)})

    for index in range(3, len(beats) - 1):
        center = float(beats[index])
        if center > 329.1:
            break  # no chart notes over the final decay/silence
        section = section_at(center)
        sparse = section["texture"] == "sparse"
        bar, step = divmod(index - 3, 4)
        phrase = motifs[(bar // 2) % len(motifs)]
        lane = phrase[step]
        if difficulty == "beginner":
            active_steps = (0, 2) if sparse else ((0, 1, 3) if bar % 2 == 0 else (0, 2, 3))
            if step not in active_steps:
                continue
        elif sparse and step not in (0, 2):
            continue
        snap, strength = transient(center)
        # No attack evidence: retain only a sparse, audible broad pulse when
        # the segment still has energy, otherwise leave a rest.
        local_rms = bands["rms"][int(min(len(times) - 1, center * SR / HOP))]
        if local_rms < .025 or (sparse and strength < .65):
            continue
        add(snap, lane, float(index), "pulse", strength)
        if difficulty == "normal" and not sparse:
            # Double accents only on strong phrase openings, never >2 keys.
            if bar % 4 == 0 and step == 0 and strength > 2.25:
                add(snap, (lane + 2) % 4, float(index), "accent", strength)
            midpoint = (float(beats[index]) + float(beats[index + 1])) / 2
            off_time, off_strength = transient(midpoint, .055)
            # Deterministic rhythmic cells leave breathing room. The third
            # eighth of a pair alternates between phrases instead of a stream.
            eligible_step = step in ((1, 3) if bar % 2 == 0 else (0, 2, 3))
            if eligible_step and off_strength >= threshold and off_strength >= strength * .5:
                half_candidates.setdefault(bar, []).append((off_strength, off_time, (lane + 2) % 4, index + .5))
    if difficulty == "normal":
        # At most two offbeat inserts per four-pulse cell, picked by attack
        # evidence. Lane cooldown is rechecked below after sorting.
        for items in half_candidates.values():
            for strength, time, lane, beat in sorted(items, reverse=True)[:2]:
                result.append({"time": round(time, 4), "lane": lane, "beat": beat, "kind": "tap",
                               "accent": False, "source": "eighth-attack", "strength": round(min(strength / 4, 1), 3)})
    result.sort(key=lambda n: (n["time"], n["lane"]))
    filtered, latest = [], [-10.0] * 4
    for note in result:
        if note["time"] - latest[note["lane"]] >= .235:
            latest[note["lane"]] = note["time"]
            note["id"] = f"{difficulty}-{len(filtered):04}"
            filtered.append(note)
    return filtered


def validate(chart: dict) -> dict:
    report = {}
    assert len(chart["beats"]) > 400
    assert all(a < b for a, b in zip(chart["beats"], chart["beats"][1:]))
    for name, difficulty in chart["difficulties"].items():
        notes = difficulty["notes"]
        lanes = [-10.0] * 4
        simultaneous = {}
        assert notes == sorted(notes, key=lambda n: (n["time"], n["lane"]))
        assert len(set(n["id"] for n in notes)) == len(notes)
        for note in notes:
            assert 0 <= note["lane"] < 4 and 0 <= note["time"] < chart["duration"]
            assert note["time"] - lanes[note["lane"]] >= .2349
            assert note["kind"] == "tap"
            lanes[note["lane"]] = note["time"]
            simultaneous[note["time"]] = simultaneous.get(note["time"], 0) + 1
        assert max(simultaneous.values()) <= 2
        max_nps = max(sum(t <= n["time"] < t + 1 for n in notes) for t in (n["time"] for n in notes))
        report[name] = {"notes": len(notes), "peakNotesInOneSecond": max_nps,
                        "doubleAccents": sum(count == 2 for count in simultaneous.values()),
                        "offbeatNotes": sum(n["source"] == "eighth-attack" for n in notes),
                        "firstNote": notes[0]["time"], "lastNote": notes[-1]["time"]}
    return report


def attack_proximity(times: np.ndarray, bands: dict, chart: dict) -> dict:
    # A separately thresholded high-band peak list is a signal sanity check,
    # not human ground truth and not a measure of perceived input latency.
    high = bands["high"]
    peaks, _ = find_peaks(high, height=np.quantile(high, .75),
                          prominence=np.median(high) * .4,
                          distance=int(.06 * SR / HOP))
    reference = times[peaks]
    result = {"referencePeakCount": len(peaks),
              "definition": "Nearest 2.4–10 kHz flux peak; height >= 75th percentile, prominence >= 0.4 * median, separation >= 60 ms.",
              "interpretation": "Transient proximity only: same recording, no independent human timing ground truth. Voices can produce high-band peaks."}
    for name, difficulty in chart["difficulties"].items():
        note_times = np.array([n["time"] for n in difficulty["notes"]])
        delta = np.min(abs(note_times[:, None] - reference[None, :]), axis=1) * 1000
        result[name] = {"meanMs": round(float(delta.mean()), 3),
                        "medianMs": round(float(np.median(delta)), 3),
                        "p95Ms": round(float(np.percentile(delta, 95)), 3),
                        "within30MsPercent": round(float(np.mean(delta <= 30) * 100), 2),
                        "within60MsPercent": round(float(np.mean(delta <= 60) * 100), 2)}
    return result


def draw_report(times: np.ndarray, bands: dict, beats: np.ndarray, novelty: np.ndarray, chart: dict) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, axes = plt.subplots(4, 1, figsize=(16, 11), constrained_layout=True)
    axes[0].plot(times[::16], bands["rms"][::16], color="#936a25", linewidth=.6)
    axes[0].set(title="My Shot / decoded audio energy and editorial sections", ylabel="RMS", xlim=(0, chart["duration"]))
    for section in chart["sections"]:
        axes[0].axvline(section["start"], color="#999999", linewidth=.5)
    tempo = chart["tempoMap"]
    axes[1].plot([v["time"] for v in tempo], [v["bpm"] for v in tempo], color="#244b55")
    axes[1].set(title="16-pulse average tempo (estimated, not a published score)", ylabel="BPM", xlim=(0, chart["duration"]))
    for name, color in [("beginner", "#4f8f8f"), ("normal", "#be7138")]:
        notes = chart["difficulties"][name]["notes"]
        bins = np.arange(0, chart["duration"] + 10, 10)
        count, _ = np.histogram([n["time"] for n in notes], bins=bins)
        axes[2].step(bins[:-1], count / 10, label=name, color=color, where="post")
    axes[2].set(title="Chart density / 10-second windows", ylabel="notes / second", xlim=(0, chart["duration"]))
    axes[2].legend()
    mask = (times >= 60) & (times < 72)
    axes[3].plot(times[mask], bands["high"][mask], color="#555555", label="2.4–10 kHz attack flux")
    for note in chart["difficulties"]["normal"]["notes"]:
        if 60 <= note["time"] < 72:
            axes[3].axvline(note["time"], color="#bd532e" if note["source"] == "eighth-attack" else "#276979", alpha=.7)
    axes[3].set(title="Timing spot check: pulse taps (teal), supported eighths (orange)", xlabel="seconds", xlim=(60, 72))
    axes[3].legend()
    fig.savefig(HERE / "timing-report.png", dpi=130)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("audio", type=Path, nargs="?", default=HERE.parent / "public/my-shot.mp3",
                        help="The exact supplied My Shot MP3 (default: ../public/my-shot.mp3)")
    parser.add_argument("--ffmpeg")
    parser.add_argument("--output", type=Path, default=HERE.parent / "chart.json")
    parser.add_argument("--plot", action="store_true")
    args = parser.parse_args()
    y = decode(args.audio, args.ffmpeg)
    times, bands, spectrum = features(y)
    beats, onset = make_beats(bands)
    duration = len(y) / SR
    sections, novelty, detected = make_sections(times, spectrum, beats, duration)
    tempo_map = [{"time": round(float(beats[i]), 4), "beat": i,
                  "endTime": round(float(beats[min(i + 16, len(beats) - 1)]), 4),
                  "bpm": round(60 * min(16, len(beats) - 1 - i) / (beats[min(i + 16, len(beats) - 1)] - beats[i]), 3)}
                 for i in range(0, len(beats) - 1, 16)]
    chart = {"id": "my-shot-original-cast-v1", "version": 1, "title": "My Shot",
             "artist": "Lin-Manuel Miranda · Hamilton (Original Broadway Cast Recording)",
             "duration": round(duration, 6), "bpm": 91, "offset": round(float(beats[0]), 4),
             "lanes": ["D", "F", "J", "K"], "beats": [round(float(t), 4) for t in beats],
             "tempoMap": tempo_map, "sections": sections, "difficulties": {},
             "analysis": {"method": "band-limited spectral flux + constrained dynamic-programming pulse tracking + authored phrase rules",
                          "sampleRate": SR, "hopLength": HOP, "fftSize": FFT,
                          "timeResolutionMs": round(1000 * HOP / SR, 3),
                          "audioSha256": hashlib.sha256(args.audio.read_bytes()).hexdigest(),
                          "pulseCount": len(beats), "tempoPriorBpm": 91,
                          "beatTrackerTightness": 1200, "downbeatConfidence": "not verified",
                          "reviewStatus": "signal-guided prototype; not a manual lyric/syllable transcription",
                          "timeOrigin": "decoded audio sample zero; do not add MP3 packet start_time",
                          "notice": bi("根据音频起音与节拍分析编排的试玩谱；尚未逐句人工听审。", "A playable arrangement guided by audio attacks and pulse analysis; not yet reviewed phrase by phrase by ear.")}}
    for name, label, level in [("beginner", bi("入门", "Beginner"), 2), ("normal", bi("标准", "Standard"), 4)]:
        notes = compile_notes(times, bands, beats, sections, name)
        chart["difficulties"][name] = {"label": label, "level": level, "notes": notes, "noteCount": len(notes)}
    metrics = validate(chart)
    args.output.write_text(json.dumps(chart, ensure_ascii=False, indent=2) + "\n")
    evidence = {"audio": {"duration": duration, "sha256": chart["analysis"]["audioSha256"]},
                "timing": {"estimatedMainBpm": 91, "firstTrackedPulse": float(beats[0]), "pulseCount": len(beats),
                           "pulseIntervalPercentiles": [float(v) for v in np.percentile(np.diff(beats), [0, 10, 50, 90, 100])],
                           "tempoMap": tempo_map},
                "acousticNoveltyPeaks": [{"beat": int(i), "time": round(float(beats[i]), 4),
                                           "novelty": round(float(novelty[i]), 3)} for i in detected],
                "charts": metrics, "attackProximity": attack_proximity(times, bands, chart),
                "limitations": ["Band-limited attacks are not isolated percussion; voices can also create attacks.",
                                "4-pulse grouping is editorial, not a verified original score bar origin.",
                                "No lyric/syllable transcription or full human listening pass has been performed.",
                                "Calibration corrects device latency; it cannot repair a badly aligned chart."]}
    (HERE / "evidence.json").write_text(json.dumps(evidence, ensure_ascii=False, indent=2) + "\n")
    if args.plot:
        draw_report(times, bands, beats, novelty, chart)
    print(json.dumps({"output": str(args.output), "duration": duration, "pulseCount": len(beats), "charts": metrics}, indent=2))


if __name__ == "__main__":
    main()
