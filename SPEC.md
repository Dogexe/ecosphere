# ECOSPHERE — scoped development

## Autosave — 2026-11-03 (owner chose autosave from the plan)

Closing or reloading the page (common on a phone) no longer loses the world. One browser-local autosave under `ecosphere.autosave`, separate from the A/B experiment slots, which are never touched. Contents: `{ version: 1, savedAt, world: <the existing v3 save text>, keys, history }`, where history rows are `[tick, ...metric values]` rounded to 0.01 and capped at the Observatory limit (24×60). The world format itself is unchanged and still validated by `parseSave`. Written at most every 5 s while the world changes, at once on `pagehide` and when the page becomes hidden, and right after a world is begun or restored. On load the world and its history come back paused with a short notice. A damaged world means a fresh start (the bad save is left in place, not deleted, until the next autosave replaces it); a damaged history is dropped and the world still loads; history written before jar air was measured gets room air (20.9%, 420 ppm). Blocked or full storage never breaks play: if full, the world is saved without history. The stress profile neither reads nor writes it. Observatory gains Jar oxygen and Jar CO2 (room air while open). No new dependency, no solver change.

## Living jar: closed matter, jar air, heat, fog and rot — 2026-11-03 (owner approved the fixes and save additions)

Benchmark: real sealed jars last years (Latimer bottle sealed since 1972; Wardian cases), while every untouched sealed starter here died within ~120 days with water and nutrients left. Owner's criteria: fun and realistic. Causes found: (1) the seal guard in `placementIssue` also blocked the solver's own seedlings, so sealed jars could never recruit; (2) plant lifetimes of 30–150 days for perennials (moss, fern, clover, grass); (3) litter only decomposed through fungi, so carbon piled up as litter; (4) the open model drops 58% of plant turnover, so a closed jar leaked minerals.

Changes. Seedling placement ignores the seal. Perennial lifetimes: moss 10 y, fern 5 y, tree 20 y, clover/grass 1 y, lily/reed 2 y; bloom stays an annual (120 d). Woodlouse lifespan 2 y, springtail 180 d. Soil bacteria mineralise 0.08%/h of litter × moisture × temperature rate (mineral share to nutrients, carbon respired) in every world. Sealed only: every material unit = 0.65 mineral + 0.35 carbon; `closeMatterCycle` returns minerals the solver lost to the soil and moves carbon to/from jar air (CO2 up, O2 down equally). Photosynthesis of plants and algae × CO2/(CO2+ambient), capped so a step never fixes more carbon than the air holds. O2 below 16% raises animal upkeep and slows aerobic decay, and lowers the pond's air-exchange target. Light warms a sealed jar by up to 10 °C at full light. Soil above 85% water rots land plants (sealed only, where water cannot escape). Fog on the glass from condensing vapour, shown as an overlay and in the report. "Air it for a moment" swaps in room air, releases half the vapour and is counted. Save: `sealed` gains optional `co2`, `o2`, `airings` (defaults: fresh air, 0).

## Seal Mode — 2026-11-03 (owner approved the optional save field)

Context.md Phase 2: seal the world and test whether it lasts. Optional `World.sealed = { since, goalDays, vapor }` (air and airings added later the same day, see above), written inside the existing v3 envelope only when sealed; v1/v2/v3 saves without it load unchanged. While sealed every matter input or removal is refused in the pure functions (water, compost, soil mixture, rain, pond inputs, introducing or removing life, introducing or exporting the colony); light, temperature and day/night remain. Rain is set to 0 on sealing and a sealed save with rain is rejected.

Water closure: after each sealed step, water the unchanged open solver lost (soil, pond, woodlouse and adult-ant body water) is added to jar vapour; 50% of vapour per hour condenses evenly onto the four soil pockets and the pond, capped at 100. Jar water (held + vapour) is therefore conserved; open-world futures are unchanged. Nutrients and carbon stay the existing open approximations and the UI says so. Goal 10/30/60 days; survived = producers (plants or algae ≥ 0.05) alive at the goal; collapsed = no producers. The report names the plants' most common limiting factor (or the scarcest soil stock when none remain). This narrows roadmap M2's "full mass ledger" to water; a common-unit nutrient/carbon budget is future work.

## Observatory: run history and A/B projections — 2026-11-03

Context.md's core loop (Simulate → Observe → Experiment → Analyze) has no analysis view yet: A/B shows one frozen snapshot each. Add a read-only Observatory dialog with two views, both built from pure `src/sim/observatory.ts`:

1. **This run**: one sample per model hour of the live world (plants, leaf cover, soil water/nutrients/organic, pond oxygen %, algae, each animal role, ant workers). Kept only in memory, capped at 24×60 samples, cleared when a world is begun/restored or time moves backwards. No saved field.
2. **Compare A/B**: from each kept snapshot, run the unchanged `simulateStep` forward for 3/7/14 model days without interventions and overlay the chosen metric. Labelled as an untouched projection from the snapshot moment, not the player's later run. Deterministic: the same snapshot gives the same curve; the live world and stored slots are never mutated.

Hand-written SVG line chart, no new dependency, no save-format or solver change, no RNG use outside the copied projection worlds. Opening pauses time like other dialogs.

## Supported nursery and granary contents — 2026-10-31

Review refinement: use a horizontal nursery bed grid (0.085 X / 0.05 Z spacing) for distinct cohorts. Old rows separated only in height collapsed together when settled. Keep within-cohort spacing/count and biological dimensions unchanged; test all eight cohort slots for noncoincident supported positions.

Reuse existing imported larva/pupa assets, egg representation and food grains. Place each cohort's existing arrangement and each stored-food grain on the same cavity field as adults, along world down using conservative rotated bounds. Preserve anatomy, cohort count, growth scaling, food-count mapping, graph, simulation and saves. Shift the whole cohort, including its picking center and halo; chamber focus remains a view of the room. This is static rigid support, not crawling brood or individual carrying. No new dependency or asset is needed: existing approved caste models are retained. Gate with actual asset vertices and real UI nursery inspection before expanding to remains.

## Cavity-supported ant presentation —2026-10-29

Retain imported caste assets and authoritative graph positions. Replace the fixed underground art offset with a conservative rigid-body support offset along the model's local down direction, bounded by the same cavity field used for meshing. Use measured model bounds and keep a small skin clearance; no inverse-kinematics claim. Keep scale, solver movement, RNG, resources and saved data unchanged. Move carried food and tap center together with the rendered body. Surface behavior remains unchanged. Reject an offset that starts outside the cavity; never force an organism through soil to find another cavity. Verify stationary rooms, sloped/vertical transit and juvenile envelopes before integration.

> Older entries are archived verbatim in `docs/archive/SPEC-history-to-2026-10-29.md`. Read them only when a task needs that history.

