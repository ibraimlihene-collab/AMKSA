# v19 repair ledger

Baseline: `a11bb5440b7e3e867bc5d15fbb0a315f957d31a4`.
The original App.tsx SHA-256 is `e05f388f91bc3a21e8b3734fe05bdde44aa33ee27d6ddb62108e83b97cffd75c`.

This ledger distinguishes implementation from acceptance. A code repair is not proof of an uninterrupted journey.
The master blueprint session ran the project checks locally: type check, unit and route tests, world audit, build and the Chromium browser suite. See `docs/design/implementation-report.md`.
The supplied CI template defines the same checks for CI.
GitHub rejected workflow creation because the integration lacks `workflows` permission.
A maintainer must install `docs/ci/game-checks.yml` as `.github/workflows/ci.yml` before CI can execute these checks.
Local results are recorded in the implementation report. CI results still require the workflow installation.

## Confirmed programming defects

| ID | v19 reproduction or inspection | Change and evidence | Acceptance remaining |
| --- | --- | --- | --- |
| BUG-01 | A stone activates cedar lever three before its puzzle. | `activate` blocks that path. The real cedar fixture checks the closed gate. | Browser attempt through every input. |
| BUG-02 | Puzzle callback opens a door without incrementing sequence progress. | PuzzleSolved uses `activate`. Regression expects progress three and one award. | Repeated natural puzzle entry and cancellation. |
| BUG-03 | The count question has no visible piles. | PuzzlePanel renders `piles`. The answer is their array length. | Human comprehension and changed-count browser coverage. |
| BUG-04 | Symbol questions need external alphabet knowledge. | A repeated-pair clue and shape comparison supply the rule. | Native language review remains open. |
| BUG-05 | Multiple-choice guessing substitutes for environmental interaction. | Numeric puzzles now use adjustable counts, a balance, and square diagrams. | Full environmental room redesign remains open. |
| BUG-06 | Elevator plate increments solved despite its dynamic purpose. | Dynamic plates never call `award`. Restore filters their invalid award IDs. | Lift objective playtest. |
| BUG-07 | Attempt state can duplicate historical sequence credit. | Unique awards survive attempt resets. A regression repeats ten attempts. | The original reachable reproduction remains uncertain. |
| BUG-08 | Pasture and gorge portals extend beyond safe terrain. | Their exits and cedar exit have full walking support. Geometry audit checks portal width. | Walk through both directions. |
| BUG-09 | Necessary rocks and boxes can disappear into pits. | Renewable stones near mechanisms and pause resource recovery restore supplies. | Deliberate loss at every required mechanism. |
| BUG-10 | Pasture lift shaft intersects tall platforms. | A clear shaft replaces the solid column. Its upper ledge and gate sit outside the shaft. | Visible debug collision and full lift journey. |
| BUG-11 | The lift moves after collision without transporting passengers. | Platforms and lifts use `movePlatform` before player collision. It carries boxes and stacked riders. | One-minute ride, return jump, and loaded lift. |
| BUG-12 | Punch damage repeats on every active frame. | Each strike keeps enemy IDs and checks wall visibility. Shared-rule regressions cover 30/60/120 Hz. | Full combat replay on target devices. |
| BUG-13 | Simultaneous damage can count one enemy more than once. | `damageEnemy` owns the transition and returns false after death. | Browser simultaneous-contact case. |
| BUG-14 | A zero impact speed hides a falling box velocity. | Previous bottom and pre-collision impact speed drive `downwardContact`. | Live falling-body cases. |
| BUG-15 | Platform velocity moves passengers twice and reverses the carry sign. | Measured deltas transport passengers once. Reversal, stacked riders, ceiling, and refresh-rate cases cover the shared rule. | Ten complete live cycles per target refresh rate. |
| BUG-16 | Cedar boar and snow animal begin inside terrain. | Full rectangles select a clear supporting surface. Geometry audit validates every terrestrial spawn. | Full patrol playthrough. |
| BUG-17 | Animals ignore walls and edges. | Terrain probes, bounded patrols, collision visibility, and stationary attack preparation limit motion. | Exhaustive AI state and fairness review remains open. |
| BUG-18 | Eagle uses ground gravity and pasture has no eagle. | Eagles use bounded reference-height flight and a preparation/dive/recovery cycle. Pasture contains an eagle. | Ten-minute flight and attack review. |
| BUG-19 | Aim preview and actual throw use different launch rules. | Both use `launch` and `projectileStep`. Trajectory stops on its first predicted obstacle. | Measure live error. Target tolerance is eight logical pixels before first impact. |
| BUG-20 | Variable dt and frame multipliers change outcomes. | FixedClock advances at 60 Hz. Damping uses elapsed time. Suspension pauses safely. | Complete movement input replays with artificial stalls. |
| BUG-21 | Respawn retains action state and continues a partially reset tick. | `createPlayer` restores all action fields. Fatal branches stop the current simulation batch. | Death during every action and threat. |
| BUG-22 | Up jumps and aims. Focus loss leaves movement active. | Action bindings separate jump and aim. Cleanup clears keyboard, touch, charge, and power. Blur pauses play. | Browser regression and physical device review. |
| BUG-23 | A moving bridge has no collision barrier. | Its entrance stays blocked until progress reaches one. Render and runtime use that threshold. | Moving-bridge bypass attempts. |
| BUG-24 | Checkpoints omit puzzle and resource recovery. | Versioned room snapshots preserve mechanisms and achievements. Resources return to safe positions. | Exhaustive room soft-lock attempts. |
| BUG-25 | Door height alone cannot prove bypass prevention. | Closed gates extend through the reachable vertical corridor. Dash collision remains sub-stepped. | Every adjacent-surface bypass attempt and natural cave art remain open. |

## Story, interface, and technical delivery

| Audit item | Delivered | Still open |
| --- | --- | --- |
| STORY-01 | Persistent sheep IDs and zero/partial/all endings. No kill requirement. | End-to-end zero/partial/all journeys. |
| STORY-02 | Short, manually advanced storm and trail introduction. | Character naming, regional dialogue, and in-world narrative scenes. |
| STORY-03 | Rescued sheep leave the scene for shelter. | Visible shelter arrival animation. No following-herd promise. |
| CULTURE-01 | Removed unverified world-name inscriptions. Symbol puzzles explain shapes. | Native review of the title, retained symbols, clothing, and terminology. |
| ECOLOGY-01/02 | No snow leopard. Removed the snow lynx encounter. Foxes and macaques patrol without hunting the player. | Documented fauna and geography review. |
| ART-01/04 | Increased cloak contrast and retained state-specific poses. | Commissioned character turnaround, final animal sheets, and animation approval. |
| ART-02 | Sheep feet use one origin and full-width supporting surfaces. | Normal-scale review of every sheep. |
| ART-03 | Tree placement checks trunk width. | Final cedar silhouettes and terrain composition. |
| ART-05 | Water layers preserve the depth gradient. Flood grows from a fixed bottom. | A connected authored river, sluices, and floating-log room. |
| ART-06 | Reduced-motion option and existing follow camera. | Puzzle-wide camera staging and measured lighting approval. |
| UX-01 | Fixed rope anchors and explicit target/lift cables. | Final shared affordance art. |
| UX-02 | Responsive Canvas, DPR scaling, DOM HUD, focus styles, larger text, pause, remapping, touch, and standard gamepad input. | Physical devices, screen-reader gameplay alternatives, and full accessibility review. |
| LANG-01 | One selected language applies to menus, clues, controls, warnings, and ending text. | Native translation and Tifinagh font review. |
| INTRO-01 | Manual Next, Skip, and replay through a new journey. Continue skips the introduction. | A separate non-destructive replay menu. |
| AUDIO-01 | Separate music/SFX levels and pause/stop handling. | Original licensed regional score, final mix, and listening review. |
| SAVE-01/02 | Validated v4 saves, backup, legacy migration, export/import, chapter revisits, and confirmed New Game. | Cross-browser storage failure matrix and exhaustive resume cases. |
| QUALITY-01 | Three deaths since a checkpoint restart mechanisms only in optional challenge mode. | Human difficulty agreement. |
| TECH-01 | Split content, rules, state, save, input, audio, language, and UI modules. | Further collision/render extraction if profiling or maintenance requires it. |
| TECH-02 | Rule/save tests, rectangle geometry audit, browser integration suite, and a CI template. Removed Regex existence checks. | Full deterministic journey replays and human playtests. |
| TECH-03 | Bounded simulation debt and particle lifetimes. | Actual profiling, target frame budget, memory budget, and spatial partition assessment. |
| TECH-04 | Normal Vite module deployment replaces Base64 execution. | Hosting review under the production CSP. |
| TECH-05 | Known baseline, task branch, lockfile, source commits, and a CI template for SHA-named assets. | A release tag follows acceptance, not this repair alone. |
| TECH-06 | Game-specific README and removal of unused API-key injection. | Dependency, vulnerability, ownership, and license audit. |

## Master blueprint implementation

| Item | Delivered | Still open |
| --- | --- | --- |
| BLUEPRINT-01 Puzzle rooms | Language-free in-world rooms in all four worlds. Gates proven closed and solvable by the reachability bot. | Human comprehension tests. |
| BLUEPRINT-02 Eight sheep | Two per world. Calming, fear and departure states. | Visible arrival at the fold during play. |
| BLUEPRINT-03 Animals | Notice, warning, attack, recovery and retreat phases. Distraction, hiding and shelters. | Ecology review and animation sheets. |
| BLUEPRINT-04 Threats | Telegraphed flood and avalanche with tested timing margins. | Timing with new players. |
| BLUEPRINT-05 Hints and objectives | Three free tiers per room and a live objective line. | Wording review by native speakers. |
| BLUEPRINT-06 Prologue and ending | Illustrated four-beat prologue and a return-to-the-fold scene that matches rescues. | Art approval. |
| BLUEPRINT-07 Audio | Music states, ambience, surface footsteps and cues. | Listening review and licensed field recordings. |
| BUG-26 | Taps shorter than one simulation step were lost. | Keydown now queues the action. A browser test covers it. | Physical keyboards and gamepads. |

## Required final acceptance

The full acceptance gate is not satisfied by this branch alone.
No uninterrupted four-world playthrough, final art approval, specialist review, physical device matrix, or final soundtrack enters this repair.
The replacement puzzle rooms are now built. Their human playtest remains open.
Do not describe those items as repaired, approved, or verified.
See `release-checklist.md` for the release gate.
