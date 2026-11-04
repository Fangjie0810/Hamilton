# My Shot Rhythm Prototype Implementation Plan

**Goal:** Build a playable, keyboard-controlled, responsive single-page rhythm experiment using the supplied complete My Shot recording.

**Architecture:** Keep the experiment in `experiments/my-shot-rhythm`. Audio analysis produces absolute-second note data; an independent judgement engine consumes the same audio clock as the canvas renderer. The page shares Hamilton's bilingual utilities but has its own audio lifecycle and no story-state side effects.

**Tech Stack:** TypeScript, Vite, Canvas 2D, Web Audio, existing `bi` / `setText` / `setLabel` language bindings; reproducible local Python signal analysis.

## Design decisions

- Default four-lane falling notes on D/F/J/K. A second circle-convergence view uses the exact same chart and scoring, allowing direct comparison of reading styles. A free-position mouse/touch Cytus replica would conflict with the requested keyboard focus.
- Gold foil, charcoal stage, engraved rules and warm paper form a theatrical scorebook aesthetic. The playfield remains the dominant object; no dashboard cards or story interruptions.
- Complete song, beginner and normal arrangements, section practice, autoplay demonstration, pause/resume, restart, offset and lead-time controls, real result screen.
- Beat/onset analysis informs a composed chart. Spectral onsets are evidence, not an automatically correct mapping of every rap syllable. Document confidence and the need for human musical playtesting.
- Share all four existing language modes; non-dialogue UI only displays the primary language. Language changes never reset playback.
- Local-only prototype follows the project publication boundary. No release/version bump or production switch.

## Work and verification

1. `analysis/`, `chart.json`, music design note: determine duration, beat times, tempo stability and sections; generate deterministic note patterns with onset guidance and chart validation.
2. `engine.ts`, `types.ts`, `engine.test.ts`: pure audio-time-based hit windows, combo/accuracy/scoring, holds and no-input completion. Test window edges, duplicate input, chords, holds, range filtering and full-score behavior.
3. `audio.ts`: decode supplied MP3, use output-aligned Web Audio clock, schedule count-in and optional beat guide, preserve transport on pause, reject stale async loading.
4. `main.ts`, `style.css`, `index.html`: bilingual interface, two canvas modes, responsive layout, scoped shortcuts, input calibration, section/range selection, autoplay and results.
5. `vite.config.ts`, `tsconfig.json`, package scripts and `README.md`: reproducible separate development/build paths, standalone distributable, documented controls and chart pipeline.
6. Run `npm test`, `npm run build`, prototype engine tests, strict type checking and bilingual source scan. Inspect the page in a browser at desktop and narrow sizes; verify real audio starts, pause freezes time, controls and languages preserve state, both note renderers, section completion and restart.

## Audio clock reference

`AudioContext.getOutputTimestamp()` relates the frame being rendered by the audio device to `performance.now()`: https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/getOutputTimestamp . Use that mapping when available, with a latency-aware context-time fallback. A user offset remains available for device and personal timing differences.

## Current status

Implemented and locally verified. See `experiments/my-shot-rhythm/VALIDATION.md` for commands, browser evidence and limits. Musical phrase-by-phrase human review remains pending; no deployment.
