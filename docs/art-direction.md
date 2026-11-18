# Atlas illustration direction

This revision uses original vector artwork drawn for Amksa.
It adds no downloaded asset pack, stock photograph, web font, or paid asset.

## Asset record

| Asset | Source | Use and license limits |
| --- | --- | --- |
| `src/assets/art/atlas-valley.svg` | Original SVG artwork authored for this project | Editable source ships with the game. No third-party pack license or purchase applies. |
| `src/game/art.ts` | Original Canvas scenery, terrain, and sheep painters | Editable source ships with the game. Existing repository ownership and license terms apply. |
| `src/App.tsx` | Original mountain mark, shepherd garment details, and interface composition | Existing repository ownership and license terms apply. |
| `src/index.css` | Original interface styles using the system font stack | No external font or image service is required. |

No third-party illustration enters this revision.
This record does not change the existing repository license or claim that the complete game is public domain.
The supplied music has a separate provenance record in `src/assets/audio/README.md`.
Commercial distribution still requires the ownership and license checks in the release checklist.

## Visual rules

- Use warm limestone, muted cedar greens, cream wool, and brass interaction accents.
- Separate mountain layers with value and parallax. Keep distant silhouettes behind playable ground.
- Keep platform tops and edges legible. Painted strata remain inside the existing collision rectangles.
- Anchor sheep hooves at the recorded surface. Do not animate the legs above the ground.
- Give the shepherd a cream cloak, green shoulder wrap, and visible wooden staff.
- Treat the illustration as a fictional Atlas landscape. It is not a verified geographical or clothing reference.
- Preserve readable language controls, keyboard focus, reduced motion, pause, and mobile controls.

The initial design revision changes presentation only.
The river correction also replaces three narrow water hazards with four continuous basins between existing banks.
Their spans are 380–950, 1210–1720, 2046–2540, and 2960–3480 world pixels.
Their initial surface is y = 500. Their fixed bottom is y = 690.
The existing flood cap remains y = 420. Room recovery restores the initial surface.
The water painter clips all effects to the damage rectangle and keeps its depth gradient visible.
River haze uses sparse horizontal ellipses behind terrain and actors.
The correction uses original Canvas instructions and palette values. It adds no external artwork.
Terrain collisions, puzzle rules, stable IDs, saves, and audio playback remain unchanged.
Full traversal and flood timing still require player acceptance.
Human art approval, cultural review, and physical-device acceptance remain open.

## Master blueprint additions

All new visuals are original Canvas drawing code in `src/game/art.ts`, `src/game/scenes.ts` and `src/App.tsx`.
No image, font or sound file was added. No third-party pack or paid asset enters the change.

| Element | Source |
| --- | --- |
| Prologue and ending scenes (fold, gate, bell post, flock, shepherd) | `src/game/scenes.ts`, original |
| Bough canopies, icicle and rock overhangs, cracked ice, ledges | `src/game/art.ts`, original |
| Sluice gate, floating trunk, bells, carved bell tablet, scales, water marks | `src/game/art.ts`, original |
| Hoofprints, wool, cairns, grass, eagle shadow, animal state marks | `src/game/art.ts`, original |
| Sheep head poses, calming ring and departure; shepherd calm and push poses | `src/game/art.ts`, `src/App.tsx`, original |

The bell tablet uses bell sizes and dots. It contains no letters and claims no historical inscription.
The basin layout from the river correction was replaced by the sluice room. Water still renders only inside its damage rectangle and keeps a fixed bed at y = 700.
