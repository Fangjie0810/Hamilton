# Portrait batch B — source notes and delivery state

Built-in image_gen was used for every generated asset and every background edit. No CLI fallback, cropping, Python image editing, or secret/credit redemption was used.

## Delivery state

- Planned: 18 separate portraits, six role types with A/B/C rendering variants.
- Ready: 6 — `lafayette-a/b/c.png` and `laurens-a/b/c.png`.
- Pending: 12 — Mulligan, citizen, revolutionary, soldier, each A/B/C.
- The six ready portraits are 1024 × 1536 RGB PNGs with opaque deep warm-gray backgrounds. They are not transparent.
- Full prompts, exact image input paths, public output paths, generation status and source references are in `portraits-b.json`.
- The first five successful images contained painted checkerboards instead of alpha. Those are draft-only files in `art-direction/rejected/`. They are retained for provenance, not counted as usable final assets.
- Targeted built-in background edits preserved character, outfit, framing and rendering style and replaced those checkerboards with gray.
- Retry/correction count: 5 successful background-only corrections; 1 Laurens C resubmission after the initial call produced no recovered result or file. Six additional calls total.
- The current six-call correction/resubmission batch completed successfully. Remaining generation was paused on root instruction after another batch reported image-generation-specific HTTP 429 `usage_limit_reached`. This agent did not independently receive that 429. No additional attempts were made after that instruction.

## Shared art direction

A: realistic 3D animation; B: fine hand-painted cinematic animation; C: restrained graphic animation realism. All portraits retain mature adult proportions, a neutral attentive expression, a slight turn toward viewer right, soft front-left light, and visible hair and elbows. No text or other people.

Ready variants visibly share each role's person, hairstyle, uniform and basic stance; generated versions have small rendering and pose differences and should not be represented as pixel-identical style transfers.

## Inspected original production references

The primary galleries identify the images as the filmed original Broadway production:

- https://press.disney.co.uk/gallery/hamilton-images
- https://press.disneyplus.com/disney-plus/hamilton/images

1. `b-lafayette-mulligan-disney.jpeg` — https://lumiere-a.akamaihd.net/v1/images/hamilton_still_01092812_7724ed43.jpeg
   - Lafayette on left: tightly swept-back hair gathered in a compact high rear textured puff, angular face, mustache and trimmed goatee, navy coat, cream waistcoat and white ruffled neckcloth.
   - Mulligan on right: broad build, gray ribbed slouch knit cap, dark green work coat, cream waistcoat and white ruffle.

2. `b-lafayette-disney.jpeg` — https://lumiere-a.akamaihd.net/v1/images/hamilton_025_477bf355.jpeg
   - Lafayette at center in military costume: navy blue coat, gold/buff edging and gold epaulettes. Ensemble provides cream/buff costume reference.

3. `b-revolutionaries-disney.jpeg` — https://lumiere-a.akamaihd.net/v1/images/hamilton_034_1d8d4780.jpeg
   - Original cast in blue/buff costumes. Laurens is at far right seen from side/rear, with low curly tied hair.

4. `b-friends-disney.jpeg` — https://lumiere-a.akamaihd.net/v1/images/hamilton_7984f03f.jpeg
   - Clear original quartet: Laurens second from left, Hamilton center-left, Lafayette center-right, Mulligan far right behind.
   - Laurens: slim, light olive skin, freckles, dark curls tied low, clean shaven. Civil costume in this photo is brown coat with tan collar; portrait uses Act I blue/buff military clothing from the other reference.
   - Mulligan's coat is dark green/teal, not a blue officer uniform. Prompt respects that observed work-coat shape, with a dark green-brown palette.
   - Visible ensemble supports generic cream/buff linen costume types.

5. `b-laurens-disney.jpeg` — https://lumiere-a.akamaihd.net/v1/images/hamilton_c787c119.jpeg
   - Wide Act I ensemble photo, used for period cloth, tricorn and cream/buff ensemble costume language.

6. `b-lafayette-officer-disney.jpeg` — https://lumiere-a.akamaihd.net/v1/images/hamilton_e05bc3a8.jpeg
   - Do not use as Lafayette. The gallery caption says Lafayette, but the actual image visibly shows Jefferson with purple suit and loose hair. It was inspected, excluded from generation, and retained as a reference audit example. Filename predates that visual correction.

The Playbill original-cast gallery was located as a supporting cast-identification source, but no photo was downloaded from it because the direct page returned 403:
https://playbill.com/gallery/are-you-ready-just-in-time-for-opening-check-these-incredible-new-shots-from-broadways-hamilton-com-356222

The downloaded production photos are reference inputs, held outside public assets; they are not final generated portraits. The Disney UK gallery labels its photos ©Disney, editorial use only.

## Remaining role boundaries

Mulligan follows Okieriete Onaodowan as Hercules Mulligan, never Madison. Generic citizen, revolutionary and soldier are reusable crowd asset types with original faces, not additional named story characters. Citizen working dress/apron/haircap is a costume-inspired adaptation; it is not presented as an exact recreation of a particular ensemble performer. Each remaining prompt is ready to run through the built-in tool using the exact inspected reference paths in the JSON.

