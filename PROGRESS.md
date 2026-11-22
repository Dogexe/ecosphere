# ECOSPHERE development progress

## Earthworms — 2026-11-21

Owner's pick from the new-species card. Red earthworms (Eisenia fetida, kind `worm`, jar holds 3) live in the soil:

- Eat damp litter (bite up to 0.02 an hour, leaving 0.6 of a patch's organic matter in soil crumbs), gaining 30 energy a unit; casts return 45% as plant nutrients and 15% as humus, so worms speed the mineral cycle (Vermicompost, Eisenia fetida on Wikipedia).
- Breathe through moist skin: upkeep 0.1 + 0.7 x dryness, more in waterlogged soil (water above 92); a worm that starves in dry soil dies of desiccation.
- Hermaphrodites that still cross-fertilise: a worm breeds only when a second adult is in the jar, paying the young's body (0.3) from the litter where it lays. Dead worms leave cocoons (dormancy.ts) that hatch when the soil is damp and litter-rich again.
- Out of the tiger beetle's reach (they live in the soil); ants scavenge their remains. Active day and night.
- Drawn in 3D (`src/scene/Earthworm3D.tsx`) in a burrow against the glass at the worm's bearing, about 4-12 mm under the surface; no licensed model existed (ASSETS.md).
- The starter jar has two worms on the right-hand bank (the land side of the glass). Worms were present at the end of every 3-year sealed run.
- Two weak spots the long runs showed, fixed: some jars ended with only male woodlice (broods now keep a young male only while males are under a third of the jar, as in female-biased isopod broods), and caterpillars that starved left no reserve (now part of each brood waits as pupae, as Pieris rapae overwinters). 12-seed 3-year sealed runs: every starting kind present at the end in 9 of 12 jars (was 6 of 12), colony lasting 2 years in 11 of 12 (was 9), woodlice kept in 9 of 12 (unchanged).
- Notebook pages: Red earthworm, Worm casts (40 pages). Observatory series: Earthworms. Old autosave histories read the new series as 0.

Also fixed: the GitHub Pages site was blank since the 2026-11-20 care-warnings deploy, because the build used absolute `/assets/` paths. Deploy builds now use `npm run build:pages` (relative base).

## Closed-jar pass — 2026-11-20

Owner asked: make the sealed system sustainable and add more kinds of life. Benchmark is the untouched starter jar, sealed. Before this pass it lost its moss in about a week, its water fleas and springtails in about 15 days, its pond crew in about two months and its ant colony within a year. It now keeps every kind it starts with for three model years in all six probe seeds (tests/closed-jar.test.mjs, one seed, about 4 s).

- More life in the starter jar: 3 springtails on the soil and 3 water fleas in the pond (8 animal kinds, 7 plant kinds).
- Resting eggs and a soil seed bank (`src/sim/dormancy.ts`): dying fleas, springtails and land plants, and caterpillars that reach the end of larval life, leave dormant eggs or seed (at most 4 per kind, stored as optional `world.dormant`). When a kind falls below 2 and its food is back, one egg hatches or one seed comes up per day, its body paid from food at the spot.
- Food refuges: grazers leave 35% of a plant, fleas leave 0.3 algae, snails and shrimp leave a 0.4 film, springtails leave 1.0 fungi, so no grazer eats its food to zero.
- Woodlice store sperm for 4 broods (optional `life.stored`), so a lone female can still raise young; siblings may pair; young are released at the refuge.
- Ants scavenge the remains of small animals as well as seeds (goal kind `'remains'`), keep a worker force of at least 6 and lay replacement workers before the old ones age out.
- Pond plants in a sealed jar keep at least 70% of their carbon fit (bicarbonate use), aquatic plants judge moisture by pond water, violets flower at 55% cover and need less nitrogen, trees cost half the upkeep.

Save format: three optional fields (`world.dormant`, woodlouse `life.stored`, ant goal kind `'remains'`); old saves load unchanged. 296 tests pass.

Limits: a beetle or a fish in the starter jar still wipes out its prey (a jar this small holds no lasting predator); the ant colony usually lasts about 2.6-3 years before it runs down; in about 1 seed in 6 the woodlice die out in year 3.

## Time pace (plan item 5) — 2026-11-20

Speeds are now Ⅱ, 1×, 3× and a new 10× fast-forward (two model hours per 96 ms tick, events kept; a 60-day seal runs in about 70 s on the PC). Animals animate at no more than 3× so fast-forward does not look frantic. Fast time (3× and 10×) pauses itself when a care warning turns urgent ("Time paused: …"), except for a single hungry animal, so a jar is never lost unseen; at 1× the warning is a toast as before. The care forecast refreshes every 12 model hours at 10× (6 otherwise). Speed buttons explain their pace on hover. Time away stays one model hour per real hour (owner-approved). The "well-kept notebook" goal now asks for 30 pages: a fresh starter jar finds 20 within a few model days.

## Hands-on care (plan item 4) — 2026-11-20

New care verbs in `src/sim/tending.ts`, none of which work through a sealed lid:

- Mist (dock): +4 water to every soil pocket and humid air for 8 model hours (`world.mistUntil`), during which moss drinks from the air as in a sealed jar (`humidAir` in ecosystem.ts).
- Move along the sill (under the light slider, desktop): shady corner 0.30, bright window 0.55, sunny sill 0.85.
- Trim back (selected plant, at least 50% cover and past seedling): takes 40% of its leaves; the clippings stay as litter (0.42 of tissue, as with leaf fall) for woodlice and springtails.
- Take a cutting (selected plant, growing/mature, at least 60% cover): 25% of the parent becomes a rooted young plant of the same kind on the nearest open spot (needs a free plant slot; the jar holds 32).
- Feed (selected woodlouse, springtail or pond animal): a dry leaf (+4 organic) at its soil pocket, or a pinch of food (+3 organic) to the pond, which decays and uses oxygen if overdone. Grazers and hunters find their own food.

295 tests pass (5 new in tests/tending.test.mjs).

## Field goals and unlocks (plan item 3) — 2026-11-20

The notebook now has direction. `src/sim/goals.ts` holds eight field goals in an order that teaches the jar (a week of green, woodlice pair up, first flowers, a new woodlouse, a sealed jar reaching its goal, the ants dig a chamber, 20 notebook pages, two months sealed). They are read from the notebook and the jar, stored with the notebook (key `ecosphere.notebook`, field `goals`, so they stay with the player across jars), and each unlocks something:

- Odd objects for the soil (`src/scene/OddObjects.tsx`, procedural real geometry at the 19 mm scale, no new assets): a 16 mm glass marble, an empty banded wood-snail shell (Cepaea), an oak acorn in its cup, a fallen leaf (existing Poly Haven scan), a quartz point cluster. Placed from Introduce life → Odd objects in any open poured jar (tap again to take out; max 20) and from the jar builder.
- Glass shapes (`JarSetting.tsx` glassForms): bubble bowl, apothecary jar, wide bowl, chosen in Environment → The glass. All keep the squat jar's footprint and lower wall, so soil and pond are untouched. Open jars dry through the opening: drying = 0.4 + 0.6 × opening area (bubble 0.67, apothecary 0.76, squat 1, wide 1.15); stored as `substrate.glass`.

The overview shows the next goal and opens the notebook's new Goals tab. Reaching a goal writes a journal line and a toast. 290 tests pass (5 new in tests/goals.test.mjs).

## Early care warnings (plan item 2) — 2026-11-20

The jar now says what is about to go wrong while there is still time. `src/sim/care.ts` runs the unchanged simulation 48 model hours ahead on a copy, with no player action, and reports what would die or fail (ageing out excluded), why (drying, waterlogged, too dim/bright, cold/hot, poor soil, stale sealed air, pond drying or out of oxygen, too little food for animals or the colony) and the one action that answers it. The field notes show up to three warnings under the headline (urgent = loss within 24 h), each with a one-tap action (Add water, Add compost, Refill the pond, Add pond litter, Move into shade, Give more light, Lift the lid, Open the seal, Adjust warmth); tapping the text selects the plant or animal. A new urgent warning also shows as a toast while time runs. On phones the collapsed sheet shows the top warning. The forecast refreshes every 6 model hours or when water, light, the pond, the seal or the population change (about 10-30 ms).

285 tests pass (6 new in tests/care.test.mjs). Typecheck and build pass.

## Systems rebalance (plan item 1) — 2026-11-20

Owner asked to return to game systems. Audit: the untouched starter jar died fast (open: drought by day 30; sealed: moss day 7, frogbit day 14, pond crew and ants by day 60, woodlice never bred). Rebalanced the ecology (details and sources in ECOLOGY.md): logistic plant growth with per-tissue upkeep and Liebig fit, sourced light classes (starter at bright indirect 0.55), squared greenhouse heat, ambient-relative CO2, moss drinking humid air, minerals recycled in open jars, pond-bank seepage, algae inoculum, slower pond grazers, seed-setting at flowering, pond plant cap 10, woodlouse mating across the jar, longer-lived harvester queen/workers who feed the queen first, perennial grass, mixed starter ages.

279 tests pass (4 new in tests/balance.test.mjs; 23 older stock-flow tests updated where minerals now recycle or the bank seeps, living-jar trajectory fixture regenerated). Typecheck and build pass. Probe scripts: artifacts/systems/.

## Image 12 rounds 2-3 — 2026-11-07

Toward concept image 12 (owner's main target). The default jar is re-poured as a sculpted low bank (gravel about 9 mm, soil bank 30-45 mm) with the pond dug to the gravel where it meets the front glass, so water, pebble bed, shrimp and snails are seen side-on; the waterline has a broken meniscus glint. The jar is squatter with a thinner screw cap, the front camera frames the whole jar above the dock, gravel through the glass reads as 5-8 mm stones, condensation beads are drawn as small lenses (dark rim, bright lower crescent, glint) concentrated on the upper glass with short wiped trails, the window shows a rainy garden behind a dark frame, the sill is matte dark walnut, and the vignette is lighter. Calathea, fern and violet presentation sizes match image 12 (no solver change).

Codex art-director scores (sealed view vs image 12, `artifacts/image12-review-r2/`, `-r3/`): round 1 about 3.6, round 2 about 3.9, round 3 about 4.1 of 10. Main remaining gaps per Codex: moss as rounded cushions, plant clusters with painted leaves, warmer neutral light, glass thickness at the base.

269 tests, typecheck and build pass. Headless Chrome on the owner's PC (RTX 3060 laptop): about 11.6 ms mean frame at 1920×1080, similar to before.

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

## Field notebook — 2026-11-04

`src/sim/notebook.ts` + `src/FieldNotebook.tsx`: a Notebook button (header, shows pages found) opens Pages (Who lives here 15, Things I saw them do 17, The jar itself 6) and a Journal (first finds, hunts, births, deaths, ant milestones, new jar/away summaries, player's own notes). A new find shows a toast and a dot on the button, which opens straight to that page. Sizes and names follow the paper-look species in scale.ts/ScanPlant/paperNature. Stored at `ecosphere.notebook`; damaged parts are dropped, not the whole book. `liveAway` takes an optional read-only observer. Tests: tests/notebook.test.mjs (9). Screens: /mnt/project-files/notebook/.

## 3D moss tufts — 2026-11-08

Owner's moss brief. Four modelled tuft GLBs (asset search first; record in ASSETS.md), lod0/lod1 instanced with per-instance LOD, on sim moss plants, blanket crowns, stones and the log; browning/thinning from soil moisture. Validated: 6-view turnarounds, in-game macro/mid/overview, moisture comparison, tests 271 pass, build OK. Renderer triangles: overview 1.36M (old sprigs 1.83M), macro 1.8-1.9M (old 2.7M); frame time at the 165 Hz cap in headless Chrome. Paired Codex A/B: new leaves 6.5 vs 5.5. Open: blanket's vertical fuzz edge at the glass, brown plinths still glimpsed, physical iPad unmeasured.

Moss round 2 (2026-11-08, owner "ปรับต่อ"): shell fur fades at grazing view angles (no vertical curtain), moss off slopes steeper than n.y 0.75-0.9 (no green bank walls), soil plinths tucked under leaves, small outlying tufts taper cushion edges, deeper greens, third overview LOD chosen by on-screen size. Triangles: overview ~0.95M, macro ~2.1M. Paired Codex vs the previous deploy: narrow wins at macro and mid.

Moss round 3 (2026-11-08, owner: "looks like flowers"): flat radial leaf sprays replaced by round leaf puffs (leaves out in all directions, baked radial normals, bright tops and olive undersides, no dark centres); the blanket between cushions is a warm olive. Paired Codex: puffs beat sprays 6.5 vs 5.5 (macro) and 6 vs 5 (mid); olive floor 6.5 vs 6 (macro), tie (mid).

Moss round 4 (2026-11-08, owner: still flower-like; bring back 360): Codex diagnosis was that each puff formed a radial rosette with lime rims. The puffs became short leaning shoots: 5-7 rounded strap leaves (2.7:1) in tiers, the low tier drooping, grouped into sprays with a shared lean, no lime rims, cushion-wide shading, body lowered. Paired Codex: shoots beat puffs 6.5 vs 5.5 (macro), droop 5.5 vs 5. Natural look camera turns a full 360 degrees (verified with real mouse drags); walls behind the camera hide.

Moss round 5 (2026-11-08, owner: up close it must look like moss, not flowers): shoots are now compact stems densely clothed in small narrow leaves set in a spiral, tip leaves clasped shut (no open centre), about 50% denser and 35% shorter, shaded backing body lowered and darkened. Paired Codex "reads as moss up close" vs round 4: 6 vs 3 and 5 vs 3 (both orders). Codex still calls it somewhat fern-like.

Moss round 6 (2026-11-08, owner: denser, fix other things): shoots ~1.85x denser and shorter with slightly broader leaves, ~20% less yellow, darker interiors; blanket domes 0.2 (no thick green edges); cushion size 0.65-1.35x; 2-3 satellite tufts join neighbouring cushions. Paired Codex vs round 5: 5 vs 4 and 5 vs 3 (both orders). Close-up renderer triangles now 2.5-2.7M (about the old sprig level); overview 1.05M.

Overview fixes 2026-11-08 (owner chose items 1-3): (1) things poking through the glass: moss crown/satellite/prop tufts now stay inside r 3.7, and the poured pond's square water sheet pulls its outer vertices onto a circle inside the glass (the stair-step "zigzag" outside the jar). (2) moss cover widened (patch threshold 0.26-0.5, slopes n.y 0.68-0.86). (3) natural look draws the grazer as a 16 mm fourth-instar cabbage white (was 25 mm) and the shrimp as a 13 mm juvenile (was 20 mm), grazer colours muted 40%, shrimp reds softened. Not done: bare steep bank behind the pond, sharp bank corners, nest cavities seen from above.

Moss optimisation 2026-11-08 (owner brief: keep the look, cut cost). Measured with WebGL timer queries summed over all ~30 render passes per frame, production builds served locally, paused jar, identical cameras (artifacts/moss-asset/review/gpu-4k.txt, gpu-ipadpro.txt). GPU ms before -> after at 3840x2160: overview 12.1 -> 11.9, mid 17.1 -> 17.6 (+3%), macro 18.6 -> 17.8, close 18.2 -> 17.3. Moss triangles: overview 447k -> 43k, close 2.08M -> ~0.4-0.5M; moss instanced meshes 72 -> 48, fur shells 192k -> under 100k triangles. Lesson: an alpha-tested material on all levels doubled close-up tuft GPU time despite 87% fewer triangles; near levels must be opaque geometry. Codex pass check (up close still moss): passes in both orders, ~1 point below the original. iPad Safari not tested (no device); a 6x CPU-throttled run is CPU-bound and equal for both versions. Item 4: painted leaves softened; paired Codex style consistency 8 vs 6 both orders.

Moss shingles + item 2 (2026-11-08, owner: overlap leaves until the mound is hidden, like the reference; do item 2). Near levels are now broad rounded leaves laid down-slope like roof tiles, two rings of drooping skirt leaves over the plinth, four sporophytes per tuft; atlas rebaked from the same leaves. Mound visible (Blender magenta test): top 3%, 3/4 5%, side 3% (was 17% before the skirt rings). Paired Codex vs the previous live moss against the owner's image: 7 vs 4 and 7 vs 4.5; colour/rim fix 7 vs 6 and 6.5 vs 6. Smaller leaves tied (not kept). Near-level triangles fell from 17-22k to 3-3.5k per tuft. Item 2: ground smoothing 2 -> 4 passes (paired 7.5 vs 7 both orders). Moss creeping down steep banks was tried and rejected (Codex both orders: scattered fragments look unfinished). Remaining: tall bare bank behind the pond.

Item 5 pond water (2026-11-08): natural look shades the poured pond by depth (nearly clear shallows, richer darker teal toward the deepest water, same hue), softer specular/clearcoat, clearer water wall at the glass; sim murk (algae/silt/stale) still clouds it. A first version mixed white into the shallows and Codex preferred the old water in both orders (grey haze); the depth-only version wins narrowly from above in both orders and ties at mid distance. The big white glare in the mid view is not the water (raycast + material changes did nothing): most likely the jar glass highlight, left for item 6.

Item 6 glass and room (2026-11-08): the big white glare on the pond was the ground's standing-water layer (LayeredGround puddles: specularIntensity 1, roughness 0.06), not the glass or the pond sheet (found by hiding layers). Natural look: puddle sheen 0.22/0.16; jar lip thinner (0.045) and fainter, one lip ring instead of two; contact shadow darker; table #a07a58 (was saturated orange); window frame #7a6250. Paired Codex, front and 3/4, both orders: new wins all four (about 8.4 vs 7.7).

Item 7 soil wall (2026-11-08): natural-look wall shader now draws a soil profile from world height and wall UVs: dark topsoil grading to sandier subsoil, broad wavy layers with sandy streaks, round embedded stones (UV aspect corrected; colours set relative to the hard window light, which turned absolute greys cream), pale roots from the plants, damp band above the gravel; the stretched cream ovals are gone. Paired Codex back view, both orders: 6 vs 4 and 6.5 vs 4.5 (remaining: middle still fairly uniform). GPU +0.1 ms in normal views, +0.6 ms (4%) with the wall filling the screen.

Soil refinement 2026-11-08 (owner brief + reference): the round stones/gravel were ovals because the old cells were scaled 5x17 on near-square wall UVs. Wall shader now: broad triangle facets, four strata following depth under the real surface (new `below` attribute) with jagged boundaries, six-sided faceted stones with contact shade, broad leaf litter under the moss edge, larger faceted gravel (layer proportions unchanged), roots from soilRoots.ts by species (tree/bloom/fern/clover/grass; moss none) baked into a 2048x352 canvas texture on plant changes. Paired Codex vs previous live with the owner's reference, back and side, both orders: new wins all four (~7 vs 4-5.5). GPU (timer queries, production builds): first version cost +11 ms at 4K / +5 ms iPad res close-up; after texture roots, soil-only stones, gravel-only pebbles and 2x2 cell checks: +0.1-0.2 ms. Tests 274.

Gravel irregularity (2026-11-08, owner: the gravel still read as a pattern): staggered randomly shifted rows, sizes about 2:1, overlapping, 5-7 sided, random elongation/turn, grey/tan/rust mix; 2x2 nearest-cell search. Paired Codex both orders: 7 vs 4, 7 vs 5. GPU at iPad res close-up +0.15 ms.

3D gravel (2026-11-08, owner brief): drainage layer is now packed instanced pebbles (8 shapes, 4 sizes incl. fillers, palette warm grey/brown/beige/charcoal, embedded in the wall and flattened to the glass, uneven top with soil crumbs); shader gravel behind them darkened to gaps. Jar builder pours gravel as tumbling pebbles that pile up as pebbles. Paired Codex close-up vs previous, both orders: 7 vs 5 and 8 vs 6.5. GPU (timer queries, iPad Pro res, production builds) within noise of before in all views (close 8.6 vs 8.6 ms).

Worms and ant nest (2026-11-21, owner): worms visit the glass only part of the time; the Underground view shows them ghosted at their real positions through see-through soil. Ant-nest audit against Tschinkel 2004: chambers are now flat-floored slabs (sim, mesh and glass window), and growth branches from the shallowest point first (top-heavy). Chambers still do not enlarge with colony size (would need a save field). See ECOLOGY.md.

Ten-year jar (2026-11-22, owner pick): woodlouse feeding reach 0.24 -> 0.45 (only 4 fitted round a litter pocket), lily rhizome in the dormant bank, caterpillar pupae wait for 2 leafy food plants. Sealed starter keeps every kind 10 years in 11 of 12 seeds. See ECOLOGY.md.

Butterflies (2026-11-22, owner): grazers pupate at 20 days and come out as cabbage whites at 30 (src/sim/butterfly.ts, src/scene/Pierid3D.tsx); only butterflies lay. 10-year sealed starter still 11/12 every kind.

## 2026-11-22 Visual check tooling
- `npm run visual -- --label <name>` (scripts/visual/capture.mjs + turntable.html): fixed-save game shots (day, night, three-quarter, macro, underground, underwater) and six-view GLB turntables on one captioned sheet with draw calls/triangles in artifacts/visual/<name>/.
- View buttons carry data-testid. Rubric and score log: docs/visual-rubric.md. Solved-problem recipes: docs/asset-recipes.md.
- Baseline 2026-11-22: overview 880 draw calls / 957k triangles, underwater 1.57M triangles (budget 300 / 400k).
- Phase 1 (2026-11-22): RenderBudget (shadow map every other frame, no shadows from meshes under ~1 mm), GLB loads retry by themselves (15 s timeout, 3 retries) so plants no longer stay on fallbacks, smooth normals for Quaternius clover/fern, no flatShading on fallback plants. Overview 543 calls / 667k tris per frame.
- Phase 2 (2026-11-22): UnderwaterEffect (depth haze, caustics, Snell's window; clarity from pond algae/organic, light from daylight) in Polish when underwater; open soil tones (humus/ochre/rust world-space patches, clustered crumbs) in LayeredGround natural look.
- Phase 3 (2026-11-22): natural-violet.glb (bloom) and natural-broadleaf.glb (tree) replace the painted cards in the natural look (painted plant kept as loading fallback); proportions kept near the models' own (violet rosette, broadleaf clump). Underground backdrop dark soil #33231a.
- Phase 4 (2026-11-22): caterpillar (leaf-grazer.glb, swallowtail-patterned source) repainted cabbage-white green in the natural look via ModelShape.recolor (texture light/dark kept as shading, health tint kept) plus smooth normals. Visual sheet adds a close-up per land animal kind.
- Phase 5 (2026-11-22): underground cutaway on a dark soil backdrop (`UndergroundBackdrop` sets scene.background each frame; the swapped `<color attach>` left it null so the cream page showed); nest cavity walls in linear soil tones with position-smoothed normals. Tests 301/301.
- Phase 6 (2026-11-22): room details. Natural-look window paints a layered sunny garden; three Kenney CC0 sill props (potted plant, books, cup; adapted on the owner PC by scripts/adapt_room_props.py) placed by `SillProps.tsx`. Overview 525 draw calls / 677k tris. Tests 301/301.
- Phase 7 (2026-11-22): performance. Overview 525 → 285 draw calls, 677k → 487k triangles, same image: N8AO transparency pass off, `trimSheet` drops empty water/puddle quads, invisible pick targets hidden, lily rosette leaves and water-flea opaque parts merged. Still over: triangles overview 487k (target 400k), macro/underwater ~663k (600k). Tests 301/301.
