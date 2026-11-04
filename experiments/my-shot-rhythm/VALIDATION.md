# Validation · 2026-10-28

- Root `npm test`: 201 passed, 0 failed.
- Root `npm run build`: bilingual checks, TypeScript, Vite passed.
- `npm run rhythm:test`: 24 passed, 0 failed. Includes judgement boundaries, chords, repeated keys, holds, pause-time invariance, invalid presses, range scoring, frame jumps and completion.
- `npm run rhythm:build`: experiment bilingual source coverage, all section text pairs, strict TypeScript and production build passed.
- `analysis/validate_chart.py`: both difficulty charts, note IDs/time/lane/spacing, maximum two-key chords, continuous sections, beat ordering and exact supplied MP3 SHA-256 passed.
- Both real full-song charts simulated at 60 fps, 4 fps and one frame every 2.5 seconds: autoplay 1,000,000 points / 0 misses. No-input completion marks every note missed.

## Browser observations

Local IAB preview at `http://127.0.0.1:1786/`:

- Real MP3 fetch/decode/start; visible progress, actual-decoded waveform, falling notes, accurate autoplay score progression.
- Circle mode uses the same chart and can change while playing without resetting transport.
- Space pauses, position remains frozen; switching Chinese/English primary languages preserves score and position; resume continues from the frozen position after pre-roll.
- D/F keyboard input produces judgement feedback. R while paused resets to the selected start and clears score.
- The opening 45-second autoplay completes with 96 notes, 1,000,000 points and 100% accuracy.
- The final Coda section autoplay reaches the actual file end, completes all 5 notes and displays 1,000,000 / 100%. The same section with no input ends with 5 misses and zero score.
- Four language settings exercised: dual, dual-en, zh, en. Both dual-primary modes additionally inspected in a 390px iframe viewport; normal controls follow only the primary language. A narrow live browser layout was also observed.
- Console warning/error query returned no entries during the final manual-mode check.

## Repairs during review

- End detection clamps to decoded audio duration and allows floating-point tolerance.
- Restart is distinct from resume, including when paused.
- Practice segments reserve the full late-hit window (including a positive input offset), instead of cutting off notes on the segment boundary.
- Waveform initializes even after a first load was cancelled by losing focus.

## Limits

No full phrase-by-phrase musical listening pass; the chart is signal-guided and should be refined through human playtesting. Desktop and narrow responsive UI were inspected, but other browsers, hardware latency and long-session user performance remain unmeasured. Full-song scoring was simulated; real browser playback completion was exercised on the final section. No production deployment.
