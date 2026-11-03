# ECOSPHERE — scoped development

## Seal Mode — 2026-11-03 (owner approved the optional save field)

Context.md Phase 2: seal the world and test whether it lasts. Optional `World.sealed = { since, goalDays, vapor }`, written inside the existing v3 envelope only when sealed; v1/v2/v3 saves without it load unchanged. While sealed every matter input or removal is refused in the pure functions (water, compost, soil mixture, rain, pond inputs, introducing or removing life, introducing or exporting the colony); light, temperature and day/night remain. Rain is set to 0 on sealing and a sealed save with rain is rejected.

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

