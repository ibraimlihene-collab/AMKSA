# Master blueprint implementation report

This report follows section 68 of `AMKSA_Master_Implementation_Prompt_AR.txt`.
It records what changed, what proves it, and what remains open.
A passing build is not proof of play quality. Human playtests have not taken place.

Baseline: `cedaeef` on `main` (PR 1 merged).
Technology stays React, TypeScript, Vite and Canvas 2D.

## Phase A — Stabilise the current state

1. **Inspected.** `src/App.tsx`, every module in `src/game`, `scripts`, `tests`, `package.json`, `tsconfig.json`, `playwright.config.ts`.
2. **Confirmed problems.**
   - `npm run lint` failed with TS2322. `@types/react` and `@types/react-dom` were absent, so JSX was untyped.
   - Two puzzles required Tifinagh shape knowledge (puzzle 1 and 5). Puzzle 4 was a number sequence with no world clue.
   - The snow world had three sheep, so the eight-sheep story was inconsistent.
   - Touching a sheep rescued it instantly.
   - A keyboard tap shorter than one 60 Hz step was lost. The browser suite exposed this.
3. **Changed.**
   - Added the React type packages. The type check is clean.
   - Extracted player movement and collision to `src/game/physics.ts`. The game and the audit use the same function.
   - Added `src/game/reach.ts`, a reachability bot that replays real input scripts. It replaces guessed jump arcs.
   - Keydown queues an action, so a short tap always counts.
4. **Why.** Route fairness and gate integrity must be measured with the real physics, not estimated.
5. **Tests run.** See the test record at the end of this file.
6. **Not tested.** Physical devices and real players.
7. **Risks.** The bot samples input timings. A frame-perfect human might find an arc that the bot misses.
8. **Next.** Phase B.

### Measured movement envelope

The bot measured these limits with the unchanged baseline constants (gravity 2100, jump 760, speed 300, dash 700 for 0.15 s):

| Measure | Result |
| --- | --- |
| Single jump height | about 137 px |
| Highest reachable ledge, double jump | 236 px measured, 248 px theoretical |
| Widest same-height gap, jump + double jump + dash | 420 px |
| Widest gap under a ceiling 70–130 px above take-off | 310–360 px |

Design rule derived from the measurement: a mandatory gate is a wall the shepherd cannot climb (rise above 250 px) or a gap wider than 430 px.

## Phase B — Cedar forest vertical slice

- Zone 1: safe start, hoofprints, wool, a practice target that gives no credit.
- Zone 2, **rope bridge**: a raised drawbridge seals the far terrace. A rope runs from the bridge to a peg in the far cliff face. A quick throw from the ledge hits the peg. The bridge lowers with a creak and a short camera focus. Sheep 1 waits on the terrace.
- Zone 4, **crate step and throwing slot**: a target hangs behind a log gate. A rock slab above the gate leaves a slot. The high ledge facing the slot is out of jumping reach. The shepherd pushes the crate under the ledge, climbs, and throws through the slot. Low cedar boughs stop a bypass from the pillars.
- Zone 6: wolves are announced by tracks and a howl. Perch rocks let the shepherd wait above them. A rock between the shepherd and a wolf hides the shepherd.
- Optional: a cairn deduction panel gives five coins. Select three fixed piles that satisfy both the sum and left-right rules.

## Phase C — Shared systems

| System | File | Behaviour |
| --- | --- | --- |
| Sheep | `src/game/sheep.ts` | idle → alert (if you run) → fear (hostile animal within 230 px) → calming → rescued → gone. A slow approach or the Interact call calms a sheep in about one second. A frightened sheep cannot be calmed and never leaves its surface. |
| Animals | `src/game/animals.ts` | walk → notice (?) → warn (!) → chase or attack → recover → retreat. Wolves give up on a raised shepherd. Boars charge in a straight line, then recover. Snakes warn before they strike. A landing stone distracts; a hit makes the animal flee. Fox and macaque never attack. The eagle casts a shadow and cries for 1.15 s before a dive and cannot dive into a shelter. |
| Mechanisms | `src/game/mechanisms.ts` | Stone scale (rocks weigh 1, crates 2, the shepherd 0), lift plate, sluices, floating logs, cracking ice that regrows, award triggers, shelters, flood, avalanche. |
| Hints | `src/game/content.ts`, `src/game/ui.tsx` | Each room has an objective and three free hint tiers. H reveals the next tier in play. Pause shows the tiers. |
| Objectives | `src/game/world.ts` | The HUD shows the current room goal, then the next unmet goal ahead. |
| Camera | `src/App.tsx` | Velocity look-ahead, wider look toward a flood or avalanche, short skippable focus shots (bridge, gate, sluice, rescue), optional shake. |
| Settings | `src/game/save.ts` | Language, music, effects, reduced motion, shake, large text, challenge mode, touch size and opacity, key bindings. Stored in `amksa_settings_v1`, apart from progress. |
| Saves | `src/game/save.ts`, `src/game/world.ts` | Save v4 schema is unchanged. New mechanism state is stored as award IDs. Restore rebuilds sluice and water levels. A save cannot invent awards. |

## Phase D — Pasture and watercourse

**Pasture** teaches weight and planning.
- A scale near the start shows one large stone balancing two small ones.
- The **stone scale** beside the gate shows two empty sockets. Interact places a carried stone. Two stones open and latch the gate.
- The **lift**: a crate on the plate raises the lift to a high ledge with sheep 2. A cable draws the link. The plate sits next to the shaft.
- The **terrace step**: a crate pushed to the cliff edge lets the shepherd climb. The terrace underside is the eagle shelter.

**Oum Er-Rbia watercourse** teaches water.
- The **sluice** sends water to one of two basins. The first basin drains and exposes stepping stones. The second fills and floats a cedar trunk to bank level. Level marks are carved on both banks. Water moves at 70 px/s, so the change is visible.
- The **lob**: a raised bridge seals the next terrace. A charged high throw passes over it and hits the peg on the far cliff.
- A snake guards sheep 2. The sheep is afraid until the snake is driven off.
- The **flood** starts only after the shepherd passes the trigger. It warns for 5 s, then rises 14 px/s from a known level to a known level. Wooden walkways climb to the exit.

## Phase E — Snow peaks and ending

- **Ice reading**: a two-plate demonstration over a shallow dip, then safe snow columns with hoofprints beside cracked decoy plates. A cracked plate breaks 0.45 s after a landing and regrows after 3 s.
- **Hoofprint route**: tracks mark the safe columns. Lower cracked plates are tempting shortcuts.
- **Three bells**: a carved tablet shows three bell sizes with order dots. It glows and plays the pattern when the shepherd approaches. A wrong bell gives a soft cue and restarts the attempt. The correct order lowers the ice bridge, which hinges on the far bank.
- **Avalanche**: triggered past the last checkpoint. 6 s of rumble, shake, flashing borders and pulsing shelter outlines, then a front at 190 px/s. Standing under a cairn-marked overhang lets it pass. Reaching the summit also ends it.
- **Ending**: a short scene, not a text screen. The shepherd walks home with exactly the rescued sheep. Empty places are drawn for missing sheep. With all eight home, the bell returns to its post and the gate closes. The text matches the rescue count.

## Phase F — Art, audio and polish

- **Prologue**: four illustrated beats (quiet fold, storm, empty fold at dawn, departure), drawn with the same painters as play.
- **Art**: cedar bough canopies, icicle and rock overhangs, cracked ice, sluice gates, floating trunk, bells, a carved tablet, scales, hoofprints, wool, cairns, wind-blown grass, an eagle ground shadow, animal state marks, sheep head poses for grazing, alert and fear, calming ring, shepherd calm and push poses, landing dust and splashes.
- **Music states**: menu, explore, puzzle, warning, chase, rescue, shelter, ending. The supplied recording is filtered and levelled per state, with a synthesised frame-drum pulse and drone. Transitions crossfade.
- **Ambience and effects**: wind and water beds per world, synthesised birds, footsteps by surface (dirt, rock, wood, snow), bells, bleats (near, far, afraid, calm), cracking ice, rumble, sluice water, splash, bridge creak, gate, lift, checkpoint, hint, and one cue per animal.
- **HUD**: health, sheep, main puzzles, stones, coins, objective, threat warning, hint key. Kill counts are not shown.
- **Pause**: resume, restart puzzle room, save and return, one bell per sheep across the journey, hints, settings and controls.
- **Touch**: a Hint button, three button sizes, adjustable opacity.

## Decisions taken where the prompt and the code disagreed

1. Eight main sheep, two per world. The third snow sheep was removed so story, counters, save and ending agree.
2. Tifinagh puzzles were removed. Mechanism panels remain only as optional coin puzzles with cairn relationships and weights.
3. Light-and-shadow puzzles were not built. The world lists in sections 22–25 do not ask for them. They remain a candidate for a future room.
4. A rescued sheep walks toward the fold and fades instead of following the shepherd through the level. Section 27 allows this for a first version. The ending shows the flock arriving together.
5. The lynx stays in the code but appears in no world, pending the ecology review in section 30.
6. All sound except the supplied recording is synthesised. Nothing claims to be a field recording.

## Test record

All commands ran in the task sandbox on this branch.

| Command | Result |
| --- | --- |
| `npm run lint` | 0 errors |
| `npm test` | 57 passed, 0 failed |
| `npm run audit` | 0 errors |
| `npm run build` | success |
| `npx playwright test` (Chromium) | 13 passed, 0 failed |

Route integrity (`tests/journeys.test.ts`) proves for each world, with the real physics:
- Every gated sheep is unreachable before its mechanism is solved and reachable afterwards.
- Every throw target can be hit from its intended spot. The cedar gate target cannot be hit from the floor.
- Every exit, summit, walkway and shelter is reachable.

System tests (`tests/systems.test.ts`) cover the sheep states, animal phases and warnings, shelters, scale, lift, sluice speed and fixed water bed, crack regrowth, triggers, avalanche and flood timing margins, spawn safety, objectives, translation coverage and the absence of alphabet puzzles.

Browser tests (`tests/e2e/journey.spec.ts`) cover save, reload and continue; focus loss; mobile menus; the prologue in French; Arabic right-to-left; settings persistence; quick throw; the stone scale; the sluice; a sheep rescue that survives a reload; tiered hints; the full ending (8 / 8); a partial ending (1 / 8); and the pause bell panel.
Several of these tests start from a valid saved checkpoint. That is a fixture, not a natural playthrough.

## Open items

- No uninterrupted human playthrough of all four worlds has been recorded.
- No new-player observation sessions (section 57) took place.
- Physical phones, tablets, gamepads and low-end hardware are untested. Frame time and memory were not profiled.
- Native Arabic, French and Amazigh review, cultural review of clothing and tablets, and ecology review remain open.
- The recording's licence and attribution remain unverified. The mix has not been checked by listening.
- Sprite-sheet animation was not produced. Characters remain procedural Canvas drawings.
- CI cannot run until a maintainer installs `docs/ci/game-checks.yml` as `.github/workflows/ci.yml`.
