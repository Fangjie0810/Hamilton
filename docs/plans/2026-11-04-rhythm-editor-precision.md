# Precision editing: draggable playhead and dense notes

- Drag the gold playhead or vertical ruler to seek continuously, pausing playback and preserving the viewport. The ruler handle shows milliseconds. Releasing keeps the chosen position. Direct note editing takes priority over the line where they intersect; the ruler handle remains available.
- Place a right-pointing, vertically centered arrow and a short timing tick at every note head. The arrow tip is exactly at the note's true hit time.
- Pack nearby same-lane heads into narrower stair-step columns. Reuse a column once heads no longer overlap vertically, keeping long fast phrases legible. Recompute while dragging and zooming. Preserve all chart note IDs, lanes, colors and timing.
- Painting and hit testing share the same geometry. Heads remain selectable even where a hold body passes behind them. No project format changes.
- Validate dense clusters, exact timestamps, long phrases, four/six lanes and hit testing with focused tests; verify mouse interaction and export preservation in the browser. Run the repository's required tests/build and editor checks.

## Verified locally

- `npm run editor:test`: 28 passing tests, including eight geometry/hit-test cases; `npm test`: 213 passing tests.
- `npm run editor:build` and `npm run build`: passed, including bilingual validation.
- Browser: drag line and ruler handle to 3914 ms without moving notes; continue playback at the chosen line height. Select all three notes at 2000/2100/2200 ms independently; drag a fourth from 4600 to 2293 ms, observe four steps, and undo.
- Export after drag/undo preserves all seven fixture notes byte-for-byte at the data level, including IDs, times, lanes, A/B and hold duration. Test fixture uses isolated port 1788; user drafts on 1787 are untouched.
- Four language modes checked; 390 px primary Chinese/English views have no horizontal overflow. Browser warning/error logs empty.
- Preview rebuilt on 1787; no online release or version change.
