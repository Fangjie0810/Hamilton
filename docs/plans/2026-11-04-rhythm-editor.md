# Rhythm chart editor implementation plan

**Goal:** Author reusable Hamilton song charts with exact timing, tap/hold notes, two independent colors and four/six keyboard lanes.

**Architecture:** Independent local app in `experiments/rhythm-editor`, port 1787. Pure project model validates versioned JSON; canvas edits absolute millisecond notes; an audio transport provides waveform, seek, slow playback and loop preview. Shared Hamilton bilingual bindings handle all four language modes without resetting playback. Existing game and My Shot experiment remain separately addressable.

**Tech stack:** TypeScript, Vite, Canvas 2D, Web Audio, localStorage drafts plus IndexedDB audio cache. No new runtime packages.

## Decisions

- Editor layout: song/key selection and tools, central vertical time grid, selected-note inspector, overview waveform/transport. Keep screen text limited to actions, values and essential help.
- Four keys are S D K L; six are S D F J K L. Each song/layout has a separate draft, avoiding silent lane loss or merging.
- Songs: Alexander Hamilton (user-specified vocal recording), My Shot (supplied recording), Helpless (user-specified recording). Do not fabricate audio or song duration.
- A and B are note properties independent of lane. Tap duration is zero; hold duration is positive. Head/tail dragging, inspector inputs and ±1/10/50 ms nudges allow exact edits. Grid snap can be disabled.
- Selection, add tap, draw hold, erase; undo/redo; note table selection; seek, playback speed, repeat range; waterfall audition and keyboard tap/hold recording.
- JSON format `hamilton-rhythm-project`, version 1, millisecond units, track identity/audio hash, exact key list, tempo grid, notes with stable IDs/lane/key/color/type/head/duration. Import validates the complete file before changing the current work. Optional embedded audio makes a portable project. Export preserves a timestamp and sorts notes deterministically.
- Save drafts per song/layout. Export remains usable when browser storage is unavailable, with clear status.

## Implementation and verification

1. `model.ts` / tests: strict JSON validation, canonical keys, precise timing, duration/range limits, deterministic export, history, overlap warnings and snapping. Preserve unknown future versions by rejecting them rather than guessing.
2. `audio.ts`: bundled/local/embedded loading, output-aligned clock, pause/seek/rate/loop and waveform data. Cancel stale async loads.
3. `main.ts`, `style.css`: all interactions, bilingual UI, accessible property inputs, storage/export/import and waveform/vertical chart rendering.
4. `check.ts`, project configuration, root npm scripts: build/type/bilingual checks and standalone output.
5. Validate import-export round trips and failure cases. Run editor tests, root `npm test` and `npm run build`; inspect the editor in-browser at wide/narrow sizes and both language primaries. Verify actual editing, undo, holds, six lanes and a downloadable project.

Status: complete; implemented and locally verified.

## 音频补充（已落实）

用户指定 Alexander Hamilton 人声版与 Helpless 的 Downloads 文件，均已复制并逐字节 SHA-256 核验。三首内置音频全部可用。

## Acceptance completed

- Editor 20 tests, root 213 tests, both production builds and bilingual checks passed.
- Browser: all three supplied recordings load; four and six keys; A/B; tap/hold; precise 1 ms adjustment; head/lane/tail drag; undo; keyboard hold recording; note audition loop; four language modes.
- Embedded-audio export/import round trip preserves six-key F-lane B hold at 1234 ms for 731 ms; audio SHA-256 matches.
- 390 px Chinese/English layouts have no horizontal overflow. Browser warning/error log empty. Served JS/CSS/audio return HTTP 200; all three served audio hashes match the project copies.
- Local preview: http://127.0.0.1:1787/ . No deployment or version change.
