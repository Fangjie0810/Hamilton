# Harbor and New York dusk implementation plan

**Goal:** Enlarge the dock slightly, conceal New York until its entry interaction, and extend the street scenery under near-night dusk lighting.

**Architecture:** Keep the existing chapter transitions and street navigation. Extend procedural scenery in `World.ts`; apply regional fog to the Opening world's materials after cutaway preparation; select dusk lighting for the street through `SceneCatalog.ts`.

**Tech Stack:** TypeScript, Three.js, Vite, existing Node tests and Playwright browser checks.

1. Expand the dock by roughly a quarter in area and align the water collision opening with the deck. Keep all story standing points reachable.
2. Replace the empty grass backdrop with cobbled surroundings and successive rows of nonwalkable city buildings. Preserve batching and limit additional point lights.
3. Use blue dusk ambient light, a low warm directional light, lit windows and lanterns. Keep other scenes' lighting unchanged.
4. Apply position-based fog to Opening materials, including instanced geometry and existing cutaway shaders. It remains through reading the letter, language changes and approaching the exit. The existing chapter reload removes it only after entering Arrival; restarting Opening restores it.
5. Run `npm test`, `npm run build`, and the focused browser regression. Inspect screenshots of the dock, the unlocked but foggy entrance, Arrival, and the city from multiple camera angles. Check three language modes and dual mode at 1024 px.

No new player-visible text is required for the atmosphere itself. Any adjusted descriptive text is paired in Chinese and English.

## Verification completed

- `npm test`: 62 passed.
- `npm run build`: passed, including the 58-file bilingual check and TypeScript.
- `scripts/street-atmosphere-check.mjs`: 10 browser checks passed, eight screenshots; no page/shader errors or failed game assets.
- Inspected the final dock and Arrival views at 1440×900 and dual-mode 1024×640. Moved the dock lantern away from the spawn sightline so Hamilton remains visible.
- The deck is 7.2×4.2 (29.2% more area). Street boundaries and story standing points remain unchanged; the two added deck strips accept real walking.
