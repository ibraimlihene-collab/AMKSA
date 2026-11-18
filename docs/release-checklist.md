# Release gate

Do not tag or publish a commercial release from source inspection alone.

1. Record the source commit, dependency lockfile, and build artifact digest.
2. Install `docs/ci/game-checks.yml` as `.github/workflows/ci.yml` through an account with workflow permission. Require passing CI on that exact commit. Local results in `docs/design/implementation-report.md` do not replace CI.
3. Complete all four worlds from an empty save without developer tools.
4. Record one uninterrupted journey per world and one complete connected journey.
5. Exercise every checkpoint, reverse route, puzzle cancellation, retry, and resource reset.
6. Repeat each puzzle ten times and confirm unique awards.
7. Compare input replays at 30, 60, and 120 Hz, including delayed frames and focus loss.
8. Record the actual target hardware, browser versions, frame budget, memory budget, and profiler results.
9. Test 1280×720, 360px mobile, high-density screens, touch, and a physical gamepad.
10. Obtain art approval at the normal game scale.
11. Obtain native Amazigh language and cultural review before presenting inscriptions as authentic.
12. Commission or license the final score and record the rights for every asset.
13. Observe new players without help (prompt section 57) in Arabic, English and French. Record where they stall.
14. Obtain the owner's acceptance for each remaining P1 item.
15. Create a release tag only after those gates pass.

## Assets and provenance

The current game draws its graphics with Canvas and uses a system font stack.
Background music uses the recording supplied by the project owner. Music-state drums and drones, ambience and sound effects use Web Audio synthesis.
See `src/assets/audio/README.md` for the recording source and digest.
The supplied recording has no independently verified license or regional performance attribution in this repository.
The existing repository license and original source ownership still require confirmation before commercial distribution.
Template dependencies remain in the lockfile until a separate dependency and license audit confirms removal is safe.

The supplied CI template names its artifact with the source commit SHA. It does not create release tags or deploy automatically.
