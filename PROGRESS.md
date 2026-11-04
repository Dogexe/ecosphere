# ECOSPHERE development progress

## Autosave — 2026-11-03

The game now remembers the world between visits. It autosaves every few seconds while things change and immediately when the tab is hidden or closed, then on the next visit brings back the same world and its Observatory graph, paused, with "Welcome back". A/B experiment slots are separate and untouched. Observatory also graphs Jar oxygen and Jar CO2.

223 tests (7 new in `autosave.test.mjs`), typecheck and build pass. Browser (headless Chromium, desktop 1440×900 and iPhone 13): ran a few hours, reloaded; the same hour and history came back paused with the notice, stayed paused, no horizontal overflow, no console errors. A fresh run's autosave is ~5 KB; a full 60-day history is well under 1 MB.

Limits: one autosave per browser (clearing site data or private mode loses it); a phone that kills the page without `pagehide` loses at most the last 5 s.

## Living jar — 2026-11-03

Compared the game with real closed terrariums (Claude Doc "ECOSPHERE เทียบกับ terrarium จริง"): untouched sealed starters died in ~120 days. Fixed the causes: sealed jars can now grow seedlings (the seal guard had blocked the solver itself), perennial plants and woodlice/springtails live realistic lifespans, and soil bacteria mineralise litter. While sealed, minerals and carbon are conserved exactly and the jar has its own air: plants run short of CO2 by day and soil life breathes it back, rich soil can pull O2 down (the Biosphere 2 lesson), bright light heats the jar, waterlogged soil rots roots and the glass fogs. The report shows temperature, O2, CO2 and fog; "Air it for a moment" lets in room air and is counted.

Untouched 365-day sealed runs (seed 2217, day/night on). Before: all four starters had no plants or animals left by day 365 (garden, meadow and wetland by day 180). After: woodland survives with 32 plants and 3 woodlice (O2 down to 12.9% from its rich soil); wetland and meadow survive with 1 plant each (meadow limited by heat); the bright mixed garden collapses after ~120 days. A hand-built moss + fern jar at light 0.45 survives a year with ~22 plants (now a test).

216 tests, typecheck and build pass. Re-baselined 5 older tests whose exact numbers changed (litter after bacterial decay, woodlouse lifespan constant, new trajectory fixture `living-jar-trajectories.json`; earlier fixtures kept). Browser (headless Chromium, desktop 1440×900 and phone 390×844): sealed, ran 3×, report readouts and airing work, fog overlay visible, no overflow, no console errors.

Limits: units are relative, not grams or mg/L; the 0.65/0.35 mineral/carbon split and the 0.08%/h bacterial rate are design choices. The pond's own oxygen is not part of the jar-air budget. High CO2 itself does not harm animals. Grazers, beetles, fleas and fish keep their short game lifespans.

## Seal Mode — 2026-11-03

Header **Seal** opens a dialog: choose 10/30/60 days and seal. While sealed the dock, soil mixture, nursery, move-out links, colony export, rain slider and pond inputs are disabled and the pure functions refuse them too; light and warmth still work. Evaporated and transpired water is held as jar vapour and condenses back, so jar water is conserved (tests: < 1e-9 relative drift over 30 days in five worlds). Reaching the goal or losing all producers pauses time and opens the report (status, plants/animals/algae, water held and as vapour, nutrients, main limiting factor) with links to the Observatory and to open the seal. `src/sim/seal.ts`; optional `sealed` save field approved by the owner. Context.md updated with the owner's decisions (personal game, web stack, owner is the only tester).

Limits: only water is closed. Nutrient and carbon pools keep their open approximations, so this is not yet the full common-unit mass ledger. Browser checks are listed with the PR; no physical iPad check.

## Observatory — 2026-11-03

New header **Observatory** dialog (pauses time like other dialogs). *This run* charts one in-memory reading per model hour (14 metrics: plants, leaf cover, soil water/nutrients/organic, pond oxygen, algae, six animal roles, ant workers), capped at 60 days and cleared on begin/restore. *Compare A & B* replays each kept snapshot forward 3/7/14 days with the unchanged `simulateStep` and no tending, overlaid on one SVG chart. Pure helpers in `src/sim/observatory.ts`; no dependency, solver, RNG or save-format change.

203 tests (3 new: sample fidelity/non-mutation, hourly recorder reset/cap, projection equals manual replay and is deterministic), typecheck and production build pass; existing chunk-size warning remains. Headless Chromium (SwiftShader) on the compiled build at 1280×800 and 390×844: ran 3× time, saved A, lowered sunlight to 0.25, saved B, opened both views. 7-day leaf cover projection A 49%→40% vs B 49%→8%; no horizontal overflow, no console errors. Not tested on a physical iPad or in the host Windows browser.

Limits: run history is lost on reload; projections show "left untouched" futures only, not the player's later actions. Next: Seal Mode can reuse these projections and the history view.

## Cavity-supported adult ants — 2026-10-31

Imported worker/queen models now use measured rigid-body support against the same cavity field as the rendered nest, replacing the uniform underground base -0.055. Body, carried food, selection marker and 28CSSpx proxy share the presentation translation. The transient rendered-center map feeds nest follow before camera updates; native inspection found and fixed queen clipping caused by following the old graph center. Surface dimensions, assets, graph travel, material accounting, RNG and saves are unchanged.

Tests cover actual animated caste vertices in rooms, both directions along every initial edge (including vertical shafts), juvenile/adult scales, lateral contact offsets, disconnected voids, and separated worker pairs. Independent review exposed two defects: off-center legs penetrating walls and full centerline recovery collapsing a separated pair. Minimal recovery with the existing expanded anatomy envelope fixes the sampled cases. Independent240 valid eight-direction contact states: zero vertex failures, worst field -0.005588; problematic pair retains0.01903 separation. This does not establish full multi-body collision avoidance or per-foot contact.

197tests, typecheck and production build pass. JS1,380.82KB/393.88KB gzip; existing chunk warning. Native compiled QA restored A106 without overwriting A/B, inspected/followed queen and worker, tapped the visible worker, used literal ArrowRight and orbited. A live run advanced106→150h: workers3→4, granary.214→.133, pupa→worker plus new egg/larva, excavation21→42%; no runtime errors. Measured desktop scene sample6.1ms mean/6.3ms p95,19draws/16,528triangles; not an iPad benchmark. Screenshots ant-supported-queen.png and ant-supported-worker-final.png precede the final minimal-recovery refinement. Final build opened and displayed the colony, but the host viewport/input mapping changed during final repeat and clicks stopped reliably hitting controls; viewport capability then failed with browser.user unavailable. Do not claim final-refinement native interaction or physical Safari validation.

Remaining: rigid support may retain visible foot gaps and reduce visual spacing in tight shafts; no per-leg IK, guaranteed clearance for arbitrary interpolated rotations, or true foot placement. Brood, stored food and remains retain earlier placement and need a coherent support pass. Next: restore reliable browser input, verify final minimal recovery in motion, then scope brood/cache grounding and close-up framing. Full release and multigeneration stability remain incomplete.

Recovery note: a documentation write failed due Windows default encoding and truncated this progress file. Restored from the historical full read plus42 successful recorded patches and the two documented text replacements, excluding failed patches; the latest35 previously read lines match exactly. Recovery source and replay script retained under artifacts/progress-recovered.md and scripts/recover_progress.py. Game and snapshots were unaffected. Future writes use explicit UTF-8 and encode before opening the destination.

> Older entries are archived verbatim in `docs/archive/PROGRESS-history-to-2026-10-29.md`. Read them only when a task needs that history.


## Time away — 2026-11-04

`src/sim/away.ts` + `src/AwayPanel.tsx`: on load (from the autosave's `savedAt`) and when a hidden tab returns, the jar lives one model hour per real hour away (max 60 days), in 96-hour slices behind a "catching up" veil, then shows a "While you were away" notebook page (duration, plants/animals/soil water before → after, new growth, births, losses, hunts, ants, drying warning, sealed-goal/collapse). Observatory history includes the away hours. Hours already run while a tab was hidden are not lived twice. No save-format change: spare minutes are carried by writing `savedAt` earlier. Tests: tests/away.test.mjs (7).
