# Portable chart exchange

Goal: send one ZIP to another person; they open an offline editor and return a small JSON chart.

- Package a self-contained HTML with classic bundled JavaScript, inline CSS and all three supplied MP3 recordings encoded inline. No Node/Python installation or local server for recipients. Avoid local-file module/fetch restrictions entirely.
- Reuse the same validated project model, editor, precise timing and bilingual UI. Add an optional charter name, retain format version 1 compatibility, and include the name in exported filenames.
- Default export omits audio; SHA-256 matches the built-in recording on either computer. Custom audio can still be embedded explicitly. JSON can be re-imported by the recipient or sender.
- Include concise Chinese/English instructions in the ZIP. No automatic delivery or upload.
- Build reproducibly through `npm run editor:pack`; verify inline payload hashes, no external assets, ZIP round trip, real file:// audio playback and offline export/re-import. Run editor/root tests and builds.

## Delivery and validation

- Final ZIP: `artifacts/rhythm-editor/20261104T030733Z/Hamilton-Chart-Editor-Offline.zip`, 13,220,384 bytes; identical convenient copy in Downloads. Two members only: `Hamilton-Editor.html` and Chinese/English README.
- ZIP CRC/extraction and exact file-byte comparison passed. All three inline MP3 SHA-256 hashes match the supplied project recordings. The HTML has inline CSS/classic JavaScript and a CSP blocking network connections.
- Editor tests: 30 passed. Root tests initially encountered one street-boundary assertion, then the focused check and complete rerun passed (216/216); root and editor builds passed. No main-game source changes made for packaging.
- Extracted HTML tested through an isolated HTTP preview: My Shot, Alexander Hamilton and Helpless decode/play; bilingual UI and source-free application load without external assets. Server log shows only the HTML document request.
- Sender exported 639 notes as 118,725-byte JSON with charter name and no audio. A separate receiver origin imported it, preserved a B-colored hold at 2401 ms with duration 731 ms, and restored the previous draft with Undo, then redid the import.
- Browser policy refused file:// navigation. No workaround attempted. Actual double-click/file-origin launch remains unverified by automation; asked the user to confirm the extracted file can open and play.

- Receiver UI at 390 px has no horizontal overflow; primary English charter label and Chinese return-data view verified. Temporary QA servers/tabs closed; distributable ZIP remains in Downloads.

## User acceptance — 2026-11-04

The user confirmed that the extracted offline HTML opens and plays audio: “可以打开并试听”. This completes the previously pending local-file startup verification. The ZIP is ready for distribution; collaborators return `.hamchart.json` files for import.
