# Portable editor acceptance

Package SHA-256: `688f652730263448545316c916d3819b6f7742d348733aa078a666410dfa697e`.

All 3 embedded recordings, ZIP round trip, 30 editor tests, 216 root tests on final rerun, editor/root builds, isolated browser playback and cross-origin JSON return/import/undo passed.

Direct file:// opening was blocked by the browser automation URL policy (HTTP/HTTPS only). The extracted self-contained HTML was tested over an isolated HTTP preview with network connections disabled by CSP. Actual double-click launch and playback were confirmed by the user on 2026-11-04.

## User acceptance — 2026-11-04

The user confirmed that the extracted offline HTML opens and plays audio: “可以打开并试听”. This completes the previously pending local-file startup verification. The ZIP is ready for distribution; collaborators return `.hamchart.json` files for import.
