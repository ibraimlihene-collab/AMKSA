# Amksa

Amksa is a Canvas puzzle platformer about a shepherd who searches for a flock in an imagined Middle Atlas journey.
The current version is a prototype under repair. It is not a commercial release.

## Development

Use Node 22 and `npm ci`. Start the Vite server with `npm run dev`.
Open `/` through the configured preview service. The game needs no account, API key, or backend.

Vite serves normal ES modules. Deploy the complete `dist/` directory after CI builds it.
The legacy `standalone` command now copies the module entry document. It requires the adjacent assets and HTTP hosting.
It no longer executes Base64 code with `new Function`.

## Controls

Choose Arabic, English, or French in the menu. The selected language applies to menus, clues, controls, and endings.

| Action | Default key |
| --- | --- |
| Move | Left / Right |
| Jump / double jump | Space |
| Interact / collect / replenish stones | E |
| Charge and release a throw | R |
| Adjust aim | Up / Down |
| Quick throw | F |
| Dash | Left Shift |
| Defend | G |
| Pause | Escape |

The settings panel remaps keys. A conflicting assignment swaps the two actions.
Touch buttons use pointer capture. Standard gamepads use the left stick, A, X, B, Y, RT, and RB.
Gamepad support still needs hardware testing.

Focus loss pauses play and clears held input. Pause offers resource recovery and a saved return to the menu.
The introduction advances manually. Continue does not repeat it.

## Save policy

`amksa_v4` stores validated JSON in localStorage. A previous valid save forms a backup.
The v3 migration preserves chapter, coins, and deaths. It cannot recover rescues or mechanisms that v3 never stored.
Malformed input falls back to the backup or a new save. Import rejects invalid files without replacing progress.
Export provides a portable JSON file. New Game requires confirmation before it erases progress.

Save events include rescue, collected coins, mechanism activation, checkpoints, death, pause, and chapter exit.
Continue restores the checkpoint and historical rescues, coins, puzzle awards, doors, and bridges.
Loose stones, boxes, hanging weights, and projectiles return to safe initial positions.
Timed gates resume closed. A solved timed gate can reopen from either side with E.

The optional challenge mode restarts room mechanisms after three deaths since the last checkpoint.
It preserves rescued sheep and currency history. Normal play preserves puzzle progress after death.
Chapter selection permits revisits to unlocked chapters.

## Systems

- `src/game/content.ts`: world geometry and puzzle data.
- `src/game/world.ts`: typed world construction, safe entity placement, and room snapshots.
- `src/game/rules.ts`: fixed clock, mechanism transitions, combat, platform transport, and shared projectile motion.
- `src/game/save.ts`: validation, migration, backup, import, and persistence.
- `src/game/input.ts`: independent action bindings.
- `src/game/i18n.ts`: selected-language interface and puzzle copy.
- `src/game/ui.tsx`: accessible settings and puzzle controls.
- `src/game/audio.ts`: the supplied looping Atlas recording with separate music and synthesized effects levels.
- `src/App.tsx`: orchestration, collision loop, and Canvas rendering. Further extraction remains possible.

Each puzzle award has a stable ID. Each sheep and enemy has a stable ID.
The simulation uses 60 fixed ticks per second. Rendering interpolates player positions.
A suspended tab pauses instead of simulating damage during the absence.
Killing animals never gates progress. Endings distinguish zero, partial, and complete rescues.
Rescued sheep leave the scene for shelter. Following-herd AI is not part of this implementation.

## Checks and evidence

The task environment leaves all project checks to CI.
The workflow template in `docs/ci/game-checks.yml` runs TypeScript, rule/save tests, geometry validation, a production build, and Chromium integration checks.
GitHub rejected the workflow push because the integration lacks `workflows` permission.
A maintainer must install this template as `.github/workflows/ci.yml` through an authorized account.
No automatic checks run until the workflow is installed.
It preserves failed browser traces and the built assets with the commit SHA.

`npm test` covers shared rules and save recovery. `npm run audit` checks full entity rectangles, lift shafts, exits, IDs, and controllers.
Geometry validation does not establish reachability, puzzle quality, or a complete journey.
The browser suite covers new play, pause, focus loss, save/resume, confirmation, and mobile overflow.

See [the repair ledger](docs/repair-ledger.md) for defect coverage and remaining acceptance work.
See [the release checklist](docs/release-checklist.md) before any release tag.
See [the Arabic master implementation prompt](docs/design/AMKSA_Master_Implementation_Prompt_AR.txt) for the target design, world maps, and phased plan (A–F).
