# SPEC history (archived 2026-11-02)

Older entries moved verbatim from `SPEC.md`. Newer entries stay in the root file.

## Licensed Daphnia asset —2026-10-27

UC Davis Tahoe Environmental Research Center's original animated Daphnia is available via its own public AR exhibit; its GLB embeds author, original Sketchfab URL, and CC BY4.0 terms. Adapt the original eight meshes and source motion rather than creating a substitute. Retain the single eye, upright body, paired swimming antennae and feeding appendages; reduce triangle and skeletal costs, remove photographic maps, use a muted soft-organic palette, and suppress source root translation so simulation owns movement. Retain a bounded source-derived swimming cycle and paused/idle pose. Validate source and adapted anatomy/animation, scale, geometry/rig cost and exact license/provenance before production integration. Render at the existing0.105 presentation envelope and distinct28CSSpx hit target; locate the actual rendered body wholly below water and keep solver, diet, stock, movement, saves and interaction ranges untouched. Keep a clear retry path if the model fails; no new dependency or saved field.

## Recover after a real meal —2026-10-27

Matched twelve-scenario diagnosis found14–337 departures per colony from the granary while unloaded workers had just eaten, retained gut material and were below the existing35reserve care-ready threshold. These workers repeatedly move out then return for another bite, while depleted queens lose meal access. After higher-priority actual carrying and self-feeding, an unloaded worker already in the granary with reserve<35 and nonempty gut can pause to digest using the existing resting maintenance cost. It resumes existing tasks when reserve recovers or its gut empties. No rest at distant food, no teleport, free reserve, lower care threshold, altered gut/digestion/food capacity/rates or changed save data. Actual task routing/ant futures intentionally change. This is a generic resource-priority approximation, not empirical species-specific resting physiology; survival may still fail and matched scenarios must report adverse outcomes.

## Propagule scale and close observation —2026-10-27

The current shared0.15long seed/spore exceeds a0.115worker ant and contradicts the permanent no-magnification rule. Reuse the existing seed geometry with species-specific presentation envelopes: moss0.001, fern0.0015, clover0.03, grass0.06, bloom0.035, tree0.08, lily0.045, reed0.018long. These preserve a coherent relative hierarchy; they do not turn world units into calibrated metres. Keep stocks and soil/feeding/placement rules unchanged. Seed picking uses the existing28CSS-pixel target math independent of mesh/growth; the selection ring is a screen-space cue. Plant close framing reads the same seed envelope and permits a microscopic camera with a suitable near plane. Exiting tiny follow, or entering/returning from pond/nest, restores the prior normal surface pose. Preserve all mature plant and animal asset dimensions. No new assets, dependencies or saved fields.

Life-stage refinement in the same pass: fern/moss/lily/reed germinants currently jump from a seed directly to roughly one-third adult geometry at development3. Their existing foliage must emerge from a near-zero developmental fraction across development3→24, still bounded by existing funded biomass. Preserve the mature formula from24onward. Close camera follows the actual young envelope rather than jumping back to1.7units while a tiny plant begins growing; keep the normal surface pose until leaving close observation. Cotyledon-bearing plants keep their current shoot geometry and gain appropriate close framing. No solver rate, stage, seed material or RNG change.

Actual portrait tree-seed close view fits the canvas but is partly hidden behind the right inspector. During plant focus on side-panel layouts (>760CSSpx), shift the projection12%left into available observation space; restore the previous projection on exit and on pond/nest swaps. Phone stacked layouts keep ordinary projection. Verify actual source bounds with the shifted projection, then inspect the seed in game. No organism/camera-target biological coordinates change.

## Replacement brood under continuing forage —2026-10-27

In six cycled mineral-tended controls with edible plant stock at every sampled hour, the queen remained at90 reserve with food in her gut and six workers, but the granary rarely reached the hard0.06 threshold. Only the initial two funded workers emerged; all founding workers age-died together and the colony eventually died with food still growing. Retain the existing stocked-brood rule, but permit one new egg when no brood is present, at least three adults are ready for care, the queen has strong reserve and enough actual gut material, and a real small amount of food is in stores or already being carried. The egg and metabolic/waste costs remain paid from her gut; carried food is an eligibility signal, not deducted, reserved or guaranteed to reach the young. Larval development still requires real nurse-delivered material and can fail. No new stocks/saved fields/dependency, no changes to age limits or resource rates. Validate limited-food controls, actual body transfers, cases with depleted queen/no workers/no incoming food/existing brood and multi-seed full-ecology results; document numerical thresholds as design parameters rather than species-specific physiological claims.
## Trace ant remains / orphaned brood feedback —2026-10-27

Native QA B812dry run selected larva2dies naturally at1758and correctly hands observation to its true-depth remains. At1759wetting, the absolute0.001residue cutoff releases the entire≈0.0002body in one step, overriding the modeled fractional decay. For recorded ant remains only, cap cleanup at min(0.001,2.5%initial body pool); keep existing decay fractions/soil transfers and old non-ant/unrecorded trajectories unchanged. This is numerical residue handling, not an invented biological rate or new stock. At most2.5% of a trace body is merged at completion. Also explain when an underfed larva has no workers available, without promising emergence; existing funded pupae may still emerge normally. No format/dependency/asset change.
## Visible seed supply and local plant care —2026-10-27

The food audit distinguishes existing plant biomass from mature harvestable seed material; the player should see that distinction in the existing plant inspector when a colony is present. Read the existing `seedMaterialAvailable` result, explain immature/low-cover compatible plants versus non-seed-host species, and never promise delivery or survival. For terrestrial plants, add a direct “Tend this plant's soil” action into the existing selected-soil panel so water/mineral recipes can target the actual root pocket. It must clear close plant/organism follow and change no World stock/time until an explicit existing input. Aquatic plants retain their existing pond controls. No new data/asset/dependency, no new metric dashboard or simulated seed reservoir.

## Funded care assignment —2026-10-27

Longevity audit reproduced unloaded adult carers being recalled from surface forage while the granary has≤0.002material; the same ants exit and are recalled repeatedly. Select a new food-loading nurse only while a real meal can be loaded. Carried care deliveries remain committed even if stores empty, as do normal heat/teneral protection and adult hunger. Do not alter diet/carry capacity/metabolic costs, grant food, force colony survival or change saved fields. Compare preserved before/after coupled runs and add a failing regression before the fix. This corrects the already scoped needs-aware behavior, rather than tuning ecological rates to make negative scenarios disappear.

Further needs refinement after the fixed-recall audit: mineral-tended mature plots retain seed food throughout1440h, but only one funded worker emerges and the founding workforce eventually ages out. When stores are empty, a ready adult returning with actual harvested material may provision a needy queen or hungry larvae directly, using the existing nursing activity/chamber routes and costs, rather than dropping the load into a granary that cannot assign a carer until next hour. Personal critical hunger/teneral protection still precedes this voluntary change; no new food or automatic brood funding. Test arrival/paid travel, full-gut clamps, real larval transfer, low-reserve/teneral guards, non-empty-store behavior, accounting and matched full-ecology outcomes. Preserve before reports; do not claim guaranteed stability if cycles/supply remain inadequate.

## Spatial chamber resources — before edit,2026-10-27

The current adult solver already drinks and deposits waste at its actual position, but brood development/emergence, nursery waste, egg costs and granary spoilage still use the entrance pocket. Correct this mismatch using the existing four nearest-column soil reservoirs: nursery moisture controls development and funds newborn water; nursery/queen/granary transfers return to their own column. Excavation planning uses the actual parent column and work uses the advancing face column. Expose the same derived chamber/face water in inspection so local tending has an observable consequence. Retain the current shared buffered nest temperature (no invented depth hydrology/heat diffusion), graph, asset scale, schema, rate constants, caps and material ledger. No unsolicited organisms/dependency or saved field. Old saves load unchanged; ant futures may intentionally differ where rooms cross a column boundary, while no-ant trajectories stay exact.

## Recovery feedback — before edit,2026-10-27

Actual long-run native world at812has0plants,2springtails and a failed colony, yet its overview still says Small things are happening; the existing state-derived outlook is hidden in phone layout. Put that actual outlook in the overview card, prioritize resource stress over flavor text, and offer the existing nursery when plants are absent. Distinguish litter/fungal survivors from a fully empty land web, without declaring algae/soil life extinct. No automatic recovery, resources, new organism/schema or saved progression. Native bare/declined vs planted worlds must produce accurate different feedback and the recovery action must open existing planting, keeping current time/stocks until a real placement.

## Asset-first tiny soil organism — before adaptation,2026-10-27

Replace the visibly provisional primitive springtail using the museum's actual public AR Mesaphorura macrochaeta mesh, after inspecting original anatomy. Exact linked.hapto publication34561f36da8e4c728e9f4ebb144803ee has verified CC BY4.0 metadata; preserve source/hash/license and credit modifications. This is an artistic representative of the existing fungal-feeding guild, not a named-species solver or new saved organism. Retain six limbs, antennae, segmented soil-adapted body and reduced jumping apparatus; do not add decorative hopping or invented eyes. Adapt original geometry/materials and bounded gait only if quality/anatomy pass. Existing14assets must stay byte-identical.

Correct the legacy springtail envelope0.17 to approximately0.022body length, consistent with the museum's0.7mm representative versus the existing0.34woodlouse/10–11.5mm reference. This is a relative presentation decision, not a metric-world claim. Never change RNG/feeding/navigation/body-material stocks to compensate for clickability. Keep independent28px picking, appropriately small highlight, and add a close-follow camera/near plane so the genuine tiny source can be inspected. Restore normal camera settings on leaving micro follow. No dependency/persistent field. Failed model loads show explicit Retry rather than silently rebuilding a primitive animal.

## Observable colony generations — before edits,2026-10-27

Complete the already scoped brood observation/follow loop without a persistent field, dependency or new model. The existing Observe developing young action currently focuses a room without identifying a cohort. Add transient cohort selection, actual stage/age/funded material/remaining larval food and explicit blocked-development explanations. Reuse the imported larva/pupa and existing permitted egg geometry, with separate28CSSpx targets and direct anatomy taps. Stage changes retain cohort identity. A birth event may carry transient source-cohort ID, allowing the observing player to follow the first actually emerged worker; a dead observed cohort switches to its actual recorded remains. Do not infer parentage for old saves or create adult offspring. Preserve current fixed solver transfers/timings and prior needs/death QA evidence.

## Autonomous continuation — colony survival and observable food web (2026-10-26)

Next coherent increment within the already approved v3 **ant remains** scope: preserve optional ant-only death provenance on the existing material pool (`ant?:{sourceId,form,count,body,y}`). This records the real death position/form/body rather than inventing underground coordinates from a2D corpse marker; it adds no reservoir/version/species/dependency. Old missing metadata stays unchanged and is never fabricated. Existing decay equations/soil compartments remain authoritative. Bound parsing and aggregation must preserve all material while dropping individual attribution if pools mix at the cap. Reuse the actual CC0 worker/queen/larva/pupa meshes in a static fallen pose, scaled by actual body and remaining material; eggs reuse the existing permitted oval representation. Expose corpse inspection and preserve follow-at-death context; selection/camera remain transient. This is completion of approved ant-remains fidelity, not a new common-world format or speculative chemistry system.

Continue the master directive after the3D nest checkpoint; passing a milestone is not a stop condition. First diagnose actual normal habitat/cycle/seed/placement trajectories against matched no-colony controls. Distinguish absent suitable reproductive material from failed navigation, misallocated labor and starvation despite accessible stored/carried food. Correct demonstrated decision/transport defects before altering ecological rate constants. No survival bonus, free feed, unsolicited animals, dependency or new persistent shape. Keep source plant mass/carry/storage/gut/brood/waste/remains explicitly funded and no-colony futures unchanged.

Coherent increment1: needs-aware feeding/nursing/foraging using current actor state and graph only, including recovery from low-store situations and visible accurate colony/food-source feedback. Colony failure remains valid when the environment cannot support seed harvesters. Favorable suitable habitats must demonstrably support real collection and a funded new generation without an unexplained external food grant. Preserve source assets and body scale. Follow with native playable observation; then reassess the next highest-value weakness from the master roadmap (observable death/recycling, chamber conditions and remaining weak biodiversity assets) rather than ending at this increment.

## Evolving spatial nest — 2026-10-26 (current user directive)

User approved the optional v3 excavation fields in this run. Concrete shape: `construction?:{enabled,removed,job:null|{from,target:NestNode,work}}`, new `excavating` activity and functional `rest` room. Old missing construction retains historical trajectories until player explicitly enables expansion. New colonies enable it. Soil is a geometric displacement proxy with aggregated entrance spoil handling; no per-pellet hauling or soil chemistry claim. Graph caps remain12nodes/20edges. New resting capacity4/room, initial3; worker+brood demand must exceed capacity,3workers minimum, queen alive, stored-food margin and soil20–88. All rates/capacities are game design approximations.

Measured mesh CPU cost27–57ms after field preprocessing/coarser consistent0.04 sampling, previously52–91ms reviewer sample. Use one native module Web Worker for active underground meshing, transferred typed arrays and request IDs to reject stale worlds/views. Main-thread geometry is only a compatibility fallback. No server, package, per-frame remesh or simulation worker. Verify actual compiled worker request/render and live excavation frames.

Decisions before implementation (/spec): preserve imported ants, feeding/brood/ledger and old graphs. New colonies receive a non-coplanar connected graph; old worlds keep their saved graph. Replace the projected soil panel with a single implicit 3D union of real chambers and tunnel capsules, open toward the observer using interior-facing walls. Full orbit, pan/zoom, chamber selection/focus and individual following must operate in world coordinates. Geometry is regenerated on graph changes only. No extra animals/dependencies. Existing licensed caste assets remain appropriate; static printable formicaria cannot represent live connectivity.

Original excavation proposal, now approved and implemented: optional current dig project with parent/target/work and removed-soil amount; worker excavation activity. Older missing fields mean no active project. One builder at a time, funded by actual reserve and food surplus, with hunger/nursing ahead of work. The implemented first demand is worker/brood crowding; dry/saturated soil prevents excavation. Workers must visit the active face, then progressively extend a connected tunnel before opening a functional chamber. No clock-only growth or free food/biomass. Soil volume is an explicitly separate geometric proxy, never added as nutrient/organic material.

## Native observation correction — ant contact (2026-10-26)

Actual compiled pupal emergence produced pale worker#5, but it and an adult shared the granary center and visibly intersected. Within the approved v3 actor-location scope, add optional physical nest offsets (missing means zero), not rendering-only jitter. Actual `antPosition`, route departure, local resource access and native saves must use them. Deterministic bounded soft contact≤0.04/worker/hour, stationary queen, chamber/tunnel bounds and real land/soil limits; contact uses only the unspent part of the existing0.14stride. Offset return to a route consumes travel distance. No stock/RNG/energy grant, no rigid-body/kinetic-work claim. Render the same solver-owned chamber/tunnel clearance. Preserve all earlier native QA files and accept missing offsets. This is a correction within the already approved colony v3, not another format proposal.

Add a44px paused-only +1h action to existing time observation controls, invoking the same real fixed-step solver once. This helps players observe a single hatch/emergence/feeding transfer without racing480ms playback; literal Enter must advance exactly one model hour and keep the world paused. No separate preview solver or saved setting.

## Approved increment — one explorable harvester-ant colony (v3 approved2026-10-26)

The user explicitly approved the exact v3 proposal below on2026-10-26. Build the master directive's first coherent surface/soil colony from an actual adapted ant asset. Prefer mujtaba-io's CC0 generic Ant over the attached-leaf Gobkit model for this seed-collecting functional group; verify its walking anatomy before final selection. Do not claim a calibrated species or complete reproductive biology. Source/adapted model previews and native walk/eat/pause evidence exist under candidates; no ant is in the shipped world yet.

### Proposed persistent extension

Write`{version:3,world}`; continue reading v1/v2/v3, with no colony added to old worlds. Preserve A/B keys, native file limits and every existing producer/animal field. Existing six animal roles stay in`world.creatures`; keep colony actors together so specialized nest transit/brood bookkeeping does not rewrite those systems. Add only`world.colony: null | AntColony` and allow an`ant`tag in the existing remains records. View/camera/selection stay transient. No dependency.

`AntColony` contains a single fertile introduced queen, at most16workers, bounded brood cohorts, entrance/home soil-pocket ID, connected chamber/tunnel graph, food material, monotonic local ant/brood IDs and a material ledger. Nodes have ID/x/y/z/role; edges connect node IDs. Actor fields are ID, age, body mass, gut, energy/hydration proxies, carried material, activity/target and a discriminated location: surface x/z/heading or nest edge IDs/progress. Nest positions/depth are derived from the saved graph; do not persist contradictory coordinates. Brood cohorts contain ID/count/stage/age/total material and maternal identity. All references, counts, finite stocks, locations and graph connectivity must validate on load.

Ledger categories: introduced material, harvested material, metabolized material, direct return to soil, transfer to remains and exported material. Assert introduced+harvested equals current queen/worker/gut/carry/food/brood material plus these outflows. Existing open atmospheric/energy proxies remain explicitly uncalibrated; this is a colony-material invariant, not a complete ecosystem carbon/oxygen ledger. Decomposition of already exported remains must not be counted a second time inside the colony.

### Coherent first food/life loop

Biological refinement after primary-source review: visible ant growth belongs to the larva, followed by pupa and a pale teneral worker whose body size is fixed after emergence. Teneral→adult is cuticle maturation, not adult exoskeleton growth. Worker size follows material funded before pupation; nursing uses carried food from the granary. This stays within the approved life-stage/material scope. No calibrated caste biology, seed-size processing, germination, trophallaxis or pheromone chemistry is claimed.

Reuse existing surface navigation through a small pure land module, preserving all old math/defaults and re-exported API. Its optional conservative hull clearance is for ants and remains independent of mesh/tap targets. Empty/legacy in-memory worlds may omit colony; native v3 writes an explicit null, and parsing null omits it in memory so no-colony futures retain existing trajectories. v3 non-null colonies require strict graph/identity/reference/material validation.

The player explicitly introduces one colony (queen plus a few imported workers and a bounded initial food stock) on suitable land. No unsolicited colonies or instant adult offspring. Workers collect small reproductive-material portions from mature, sufficiently covered clover/grass/blooms, reducing actual parent biomass; spores/aquatic plants/immature vegetation are unsuitable. This represents aggregate available seeds within producer biomass, not leaf eating or a separate free seed grant. Carry visibly to the entrance, traverse real connected routes, deposit once, feed/rest, and nurse when brood needs it. Distance/food/heat/moisture affect success; no scripted boom.

Queen egg production and larval growth require stored material and reserve. Egg→larva→pupa→teneral-worker stages take modeled time and nursing; larval growth draws from transferred food and returns explicit waste. Emerged workers keep their body size, digest food for reserve, age/starve/dehydrate and leave existing compartment-backed remains. Existing fungi/microbes recycle them. Predation on ants, mating flights, genetics, excavation choice, pheromone chemistry and inter-colony conflict remain later work; do not invent decorative versions in this first colony.

### Exploration and art

Keep tiny worker/queen biological envelopes independent of28px picking. Adapt original geometry/rig/palette rather than building primitive insects. Surface workers forage in the existing world. Add a usable soil observation mode exposing the saved nest graph/chambers and real stores/brood; follow a worker between surface and nest. A custom graph-matched tunnel/cutaway presentation requires a recorded asset search/reason; a static decorative anthill must not stand in for connected routes. No decorative underground animals, fake extra root stocks or implied3D hydrology. Source/animation/cost/pose checks precede integration.

Acceptance: v1/v2 migration gains no organisms and v3 continues exactly; colony ledger closes through collection/delivery/digestion/brood/birth/death/remains; food-rich/poor, distance, heat and drying scenarios diverge without grants; native game shows actual carrying/transit/nursing/development with selectable tiny actors and safe camera transitions. Existing122checks and representative plant/woodlouse/fish loops remain working. Implement only after approval of the extension above; asset adaptation/inspection can proceed independently.

## Current increment — woodlouse contact at shared litter (2026-10-26)

Native mother/offspring observation exposed bodies interpenetrating at the aggregate litter center. Correct actual saved simulation positions, never apply hidden rendering offsets or enlarge touch proxies. Add a narrow deterministic soft-contact pass for surviving/newborn woodlice after ecological transfers and reproduction. Radius is a simulation design parameter scaled by funded body mass (adult0.16); no Three/scene imports, RNG consumption or new saved state. Six fixed pair sweeps, sorted identities, bounded total correction≤0.08 per actor/step, existing land/bank navigation and unchanged heading. Contact is an overdamped positional constraint, not an active foraging move or a calibrated kinetic-energy model; it grants no energy/material. Courtship pairs retain≤0.28 contact allowance inside the existing0.3 pairing range. Other species/prey capture/feeding/mating rates are not rewritten.

Avoid long-lived coincident bodies while retaining aggregation, funded growth/brood and access to local litter. Contact may affect future paths/ecological outcomes; preserve earlier hashes/actual QA snapshots and record explicit corrected trajectories. Existing v1/v2 content remains loadable and no organisms/stocks are added. No dependency or persistent-format change.

## Current increment — imported woodlouse refinement (2026-10-26)

Continue the authorized weak-fauna audit while the colony data proposal awaits an answer. The museum's public AR page links its exact Trachelipus ratzeburgii model to .hapto GmbH's CC BY4.0 publication. Inspect the retrieved57,360-triangle static mesh, append no downloaded scripts, and preserve its original bytes. Adapt its original segmented shell, seven pairs of legs and antennae into a muted matte local GLB; evaluate silhouette before replacing the provisional woodlouse. A static AR model has no source walking clip: any added gait must be explicitly recorded as an adaptation, using the original geometry rather than substitute primitives.

Retain all woodlouse simulation, growth, hydration, brood, feeding, selection and Scale Bible body length. Walk/eat/idle and pause must read existing decisions. Preserve the current fallback only for failed local asset loading; do not claim a successful model replacement from a fallback. No persistent state/dependency/species addition. Target<6,500triangles and<300KB, shared immutable geometry with independent animation/material state. Brood pouch/food cues may retain existing state-driven presentation. Verify actual mesh body bounds separately from antennae and28px picking.

## Native touch ownership correction (2026-10-26)

Actual compiled play after replacing a world leaves the canvas with computed`touch-action:auto`, despite our existing CSS intention. Installed OrbitControls.dispose writes this inline on the shared canvas; mouse orbit/wheel still work but Safari may reclaim native gestures. Make the existing canvas-only`touch-action:none` rule authoritative over that cleanup style. Keep surrounding UI/document scrolling, controls, camera dimensions and ecology unchanged. Actual820px inspection also found header/dock/time buttons only30–34px high. Give these existing controls≥44px width/height at tablet/phone widths or a coarse pointer; retain the visual hierarchy and keep the scene primary. This is an existing-control defect correction, not a new navigation system. Physical multi-touch Safari still requires a device test.

### Follow visibility on narrow screens

Actual390px play selected/followed the woodlouse but left canvas top at-233.8px (scrollY308.8), showing the inspector instead of the animal. Reuse the already implemented plant-focus scroll effect for a newly followed animal, including offspring/next-animal handoffs. Scroll only on transient focus ID changes, respect reduced motion, keep manual page scrolling and avoid resetting the camera/world. No extra observer or dependency.

## Current increment — close plant observation (2026-10-26)

Following `/spec`, extend the existing organism-inspection scope after actual plant-growth play exposed tiny, hard-to-observe flowers at overview distance. Add a44px Look closer action for a selected surface plant, with Return to overview. Reuse existing native orbit/pan/zoom and surface controls. Transient selection only: no new asset, mesh enlargement, ecology, save field or dependency. Animal following remains independent and unchanged. Focus identity must distinguish plant IDs from animal IDs.

Frame the measured Scale Bible envelope at actual growth/development, with extra portrait margin; seeds/cotyledons use their actual small representation rather than a mature-tree envelope. Track the plant position/height as it grows while permitting native orbit/zoom. Clear focus on removal/death, nursery, selection changes, world replacement and underwater entry. Stop/return restores overview distance. Underwater already provides close observation; its existing basin constraints must remain unchanged. Test imported/fallback foliage fits, identity collisions, cleanup/resize, and native close observation with44px controls at desktop/tablet/phone.

## Current increment — seedling survival through darkness (2026-10-26)

Actual nursery play revealed both newly introduced aquatic propagules disappeared by Day3. A32-case headless comparison found several well-resourced cycled seedlings die on their first night while their constant-light counterparts survive. Diagnosis: the0.55-unit seedling pays the same absolute mature-plant turnover before it has mature biomass. Seeds/germination already use their own reserve cost. Do not grant starting biomass or waive nighttime costs.

Following `/spec`, scale only established-leaf turnover below the existing22%-capacity seedling boundary by its biomass fraction of that boundary. This is a simplified size-dependent maintenance surrogate; preserve photosynthetic gross uptake, zero-dark growth, stress multipliers, maturity threshold and existing transfer fractions. Mature/growing plants retain their previous rates. Apply consistently in constant/cycled conditions; existing snapshots remain readable, but recruited plants can have intentionally different futures. No saved field, dependency or calibrated respiration claim. Poor water/light/nutrients must still prevent establishment and eventually cause death. Complete the in-progress aquatic asset validation alongside this directly observed life-cycle defect.

Related diagnostic finding: shade-tolerant suitability remained positive even at peak light0, so fern/moss could grow with the light slider fully off. Multiply suitability by incident light relative to that guild's optimum (bounded0–1). The niche still distinguishes shade from full sun, but no producer can create photosynthetic biomass at zero light. This deliberately changes some existing trajectories; preserve the old hashes as historical evidence and add explicit zero-light/stock-flow checks before recording the new deterministic baseline.

Separate ontogeny from leaf cover: a damaged adult must not be labeled a seedling or return to cotyledon geometry. Development/age determine life stage; at least70% cover still funds visible mature flowers/seed heads. Keep the78% material-funded reproduction rule. This presentation/stage correction must leave ecological step trajectories unchanged.

## Current increment — aquatic asset refinement (2026-10-26)

Following `/spec`, inspect the actual CC0 Kenney Nature Kit lily/moss files already downloaded before selecting a replacement. Use the installed Blender at`D:/Blender/blender.exe` for inspection/adaptation where useful; its absence from PATH in the earlier audit did not establish that it was uninstalled. Compare anatomy, palette, underside, flower maturity, bounds and cost against the authored lily and preserved fern. Retain an asset only if it improves the game; do not relabel hanging moss as terrestrial moss or generic grass as a reed without a suitable silhouette.

First target is the floating lily: preserve current0.68spread/0.22height envelope, local biomass/development/health and water-surface anchoring. Separate flower meshes/materials if necessary so actual maturity controls flowers without hiding pads. Source pads must float above water and remain visible from below. Keep the existing fallback and update exact provenance/hashes. No ecology, saved field, dependency or species addition. Accept only after native asset render, young/mature/declining states, underwater/surface scale and fallback checks in the compiled game.

Candidate review: Kenney's coarse lily/star flower was rejected; hanging moss does not match ground moss. Retrieved/inspected Pixor's CC0 water lily and reeds from the publisher. The layered lens petals/notched leaf and swept blades/cattail heads are suitable for adaptation. Include the existing rooted-aquatic functional group using the cattail silhouette, without claiming a calibrated Phragmites species. Remove unrelated bob/sway clips, preserve all source faces, split existing material groups and apply the common matte palette. Show seedling/germinating aquatic assets at their actual reduced growth with reproductive parts hidden, replacing the old generic terrestrial cotyledons. Fix shared-loader health tint to retain each source material's base color; existing white/texture palettes must remain identical.

## Current increment — portable experiments (2026-10-25)

Following `/spec`, complete the existing save/load loop across browser addresses/devices. Reuse the exact approved `{version:2,world}` export and existing v1/v2 parser; no new saved field, key, dependency or service. Native Blob/download and file input provide a local/offline path even when browser storage is unavailable. Export current paused world as JSON. Import reads at most200KB (existing parser cap), validates first, then shows filename/day/populations and an explicit Open imported world action. Selecting a file alone never replaces the current world or A/B. Cancel/Escape/failed or oversized reads keep them intact. Opening a validated file uses the same paused restore/event-clearing/surface-view path as A/B.

Keep async read epochs so an older selection or a read finishing after close cannot become the active preview. Apply invalidates its epoch before the single onLoad call, preventing duplicate apply. File chooser/download require actual native browser QA, not setting hidden state. No File System Access API, upload endpoint, autosave/cloud or new format. Add brief pond onboarding/copy corrections identified during real empty-pond play while preserving the existing simulation.

## Current increment — submerged pond observation (2026-10-25)

Following `/spec`, continue the master directive's multi-scale exploration with a real camera below the existing water surface. Decisions: explicit Surface/Pond view is transient UI only; enter from the pond inspector or a small persistent scene control, return through a44px control. Preserve the previous surface pose/zoom; a new/restored world returns to Surface. No new dependency, organism asset, model size or saved field. Reuse the licensed fish, existing aquatic flora, basin geometry and exact solver populations. No decorative new aquatic species.

The submerged camera can orbit, pan and zoom within the existing0.93 water footprint and-.20/.07 bed/surface band, with appropriate near clip. Selection retains independent28px targets. Following a fish/flea moves the focus while keeping the eye in water and outside the body. Surface life remains simulated while culled from the underwater view; underwater picking considers only visible aquatic animals. The current pond is shallow: do not enlarge fish or pretend to have a deep bathymetric solver. Render the surface underside and existing lily pads. Lightweight fog/colour respond to actual algae/organic stocks and shared daylight; this is a visual clarity approximation, not turbidity chemistry. No new scene asset needs sourcing because this increment reuses existing inspected models and basin.

Acceptance: actual below-surface rendered view with selectable native fish/fleas, feeding/rest linked to simulation, constrained camera during orbit/pan/follow/resize and no underwater placement outside the existing rules. Returning restores surface pose/zoom without affecting simulation or snapshots. Drying water safely returns to Surface. Test camera hull/projection at multiple headings/targets, controls cleanup/restore and unchanged ecology; play compiled/private clients at desktop/tablet/phone dimensions. Review camera/default-controls ordering and render-only filtering independently. Continue onward after validation; a successful increment is not the full-game completion gate.

## Current correction — aquatic body clearance (2026-10-25)

Following `/spec`, fix the recorded shoreline defect before adding underwater navigation. The solver currently admits animal centers to the water boundary, allowing the visible body to cross a vertical bank. Decisions: conservative adult horizontal hull clearances for fish and water fleas, owned by the pure pond model; placement, swimming, fleeing and birth use that inset domain. Rendering retains the Scale Bible and never feeds mesh dimensions or touch targets into physics. Tiny prey retain more nearshore space than a fish center, while the existing nose capture range can still reach them at the bank; capture distance/costs stay unchanged. No new asset, dependency or saved field. Legacy snapshots still load unchanged; a surviving animal outside its new safe domain is projected inward on its next step, including during scheduled rest. This is a deliberate navigation bug correction; affected aquatic futures may differ, while legacy terrestrial trajectories must remain exact.

Acceptance: test edge placements and rest/wander/hunt/flee/birth bounds, unchanged source data/resources/IDs on boundary correction, deterministic save continuation, and the actual animated imported fish hull against the water radius at worst adult variation/headings. Verify real compiled/private aquatic observation, placement feedback, follow/pause and runtime errors. This is a bounded navigation fix, not a claim of full underwater exploration.

## Current increment — ecological photoperiod (2026-10-25)

Following `/spec`, the accepted next milestone and master directive establish the goal: a shared world clock drives light, temperature, producer fluxes and species activity. No new asset, dependency or new save envelope. Add optional boolean `climate.photoperiod` inside the previously approved v2 climate scope. Missing flags and legacy saves retain constant conditions exactly. Newly created playable UI worlds start at08:00 with the cycle enabled; pure starter APIs/capacity fixtures remain unchanged. An Environment toggle pauses and switches the current experiment without advancing its clock or replacing saves.

Decisions: fixed12-hour daylight (06–18), a smooth solar curve and modest temperature lag around the existing temperature setting; all are simplified game forcing, not location/season/weather forecasts. Use one shared pure conditions function for simulation, inspection and lighting. Existing producer growth coefficients represent continuous daily-average potential: normalize the daylight curve to the same daily integral, concentrate photosynthesis into daylight, continue maintenance at night, and explicitly account for gross plant uptake/turnover in cycle mode. Keep peak-light niche preference distinct from the daily darkness so healthy shade plants do not turn sick every night. Algae/photosynthetic pond plants supply oxygen in light; respiration/decay continue at night.

Diurnal grazer/tiger-beetle/fish and nocturnal woodlouse/springtail roles rest in their inactive period; water fleas continue grazing. This is a selected functional-group simplification, not a statement that every species shares those rhythms. Existing threat, low hydration and severe hunger override rest. Rest pays basal maintenance, never creates reserve. Digestion, gestation, age, reproduction costs and death continue. Use existing woodlouse activity plus a shared derived resting predicate for other fauna; no cosmetic sleep independent from decisions.

Acceptance: all89 baseline checks preserve constant-mode behavior. Add deterministic phase/temperature, zero-night photosynthesis/gross transfers, pond oxygen, behavioral override, save migration/continuation and multi-day coexistence/bounds tests. Inspect actual sunrise/day/sunset/night, feeding/rest, pause, native toggle/keyboard sliders, save continuation in an isolated empty origin, responsive controls and the private route. Use smooth lightweight lighting with readable nights and no new renderer effects. Independent read-only review must check double-applied forcing, maintenance/body/resource ordering, legacy compatibility and diagnosis/render agreement. Physical iPad Safari remains unverified.

## Current increment — adapted organism assets and close observation (2026-10-25)

Following `/spec`, the master directive establishes the goal and authorizes asset selection; no further interview is required. Decisions: begin with the downloaded CC0 tiger beetle and fish candidates, inspect source geometry/rigs before selecting the fish; preserve existing grazer/woodlouse biology and good fern art. Adapt proportions, palette and idle/walk/meal clips offline with Python (Blender was not found on PATH during that earlier audit), export small self-contained GLBs. Never substitute a different biological taxon for a missing asset. Continue sourcing one coherent vegetation family, but only replace plants after inspecting its actual files. Keep existing models as loading-failure fallbacks, clearly record their provisional status. No dependency, simulation format or save changes.

Use independent 28 CSS-pixel animal selection targets, nearest-screen-center disambiguation, a close camera focus and user panning. Preserve biological dimensions, feeding distances, deterministic state and existing snapshot keys. Rendering animation follows actual movement/feeding and pauses with simulation. Validate native imported clips rather than trusting source labels. This increment precedes day/night, deep pond, cutaway and ants; those need their own coherent simulation/terrain scope, not decorative additions.

Acceptance: production uses adapted assets with provenance, measured bounds and bounded loading failure; multiple animated clones remain independent, grow continuously and face real travel; pause stops their clips. All existing ecology checks pass. In the actual compiled game inspect default/maximum worlds, add/follow a hunter/fish, test touch-sized selection and orbit/pan/zoom at desktop/tablet sizes, profile renderer cost and check exact local/private asset requests. Preserve stored A/B experiments.

Render inspection exposed a dependency: a correctly scaled fish intersects the old 0.018-deep decorative puddle. Add a genuine opening through the existing terrain top, a recessed bed/bank and readable translucent water while retaining the solver's exact pond footprint and stocks. This is terrain presentation, not a claim of underwater exploration/hydrology. Adapt the source fish's exaggerated width/height, keep its .43 length, and locate its body below the surface. Existing asset kits do not provide a terrain opening matching this solver anchor; a small custom terrain cutout is justified. Verify empty hole ray intersections, bed/animal bounds and live aquatic selection. Follow must also reset camera target height after vertical panning.

## Goal

Make a browser terrarium that is pleasant to explore and responds to player actions through a small, reproducible ecological simulation. This milestone is a playable prototype, not a general ecosystem engine.

## Decisions

- The implementation uses TypeScript, Vite, React, Three.js, React Three Fiber, and Drei, as requested. Native CSS and browser APIs cover the UI; no state or animation library is needed.
- A fixed one-hour simulation step owns all ecological changes. Rendering interpolates or animates the current state but never changes it. A seeded pseudo-random generator makes initial placement and creature wandering repeatable.
- The first world has soil water, nutrients, organic matter, eight individual plants, and three grazing creatures. Water and compost are external interventions. Evaporation, decomposition, plant uptake, leaf fall, and grazing are explicit transfers or losses.
- Plants grow when light, water, and nutrients are available. Drought and heavy shade cause biomass loss. Creature movement targets edible plants; feeding removes plant biomass and raises creature energy. Their visible positions and plant sizes come from simulation state.
- Inputs are intentionally limited to water, compost, and sunlight. Time can pause, run at 1×, or run at 3×. The interface shows current conditions and an event response after interventions.
- The scene is a soft organic low-poly cutaway island with restrained greens, warm stone, shallow water, modeled foliage, and small creatures. Camera controls support pointer and touch orbit and zoom. The UI remains usable at iPad widths and smaller phones.

## Exclusions for this slice

No reproduction, microbial species, oxygen or carbon bookkeeping, save files, scientific prediction claims, or speculative materials. These belong to later phases of `Context.md`.

## Completion criteria

1. A fresh install builds and typechecks without errors.
2. Deterministic tests prove equal seeds and actions yield equal state, water and compost affect the expected stocks, plant response differs between healthy and stressed conditions, and grazing transfers biomass to creature energy.
3. In a real browser, the scene renders, orbit and zoom respond, controls change the displayed ecological state, and pause stops simulation time.
4. The scene and controls remain visible and usable at desktop and iPad-sized viewports; no horizontal page scrolling.
5. A brief browser performance check shows no obvious frame stall during normal orbit, input, and 3× simulation.

## Milestone 2 — a consequential grazer food loop

### Why this is next

A headless ten-day run of the existing model shows plants falling from 59% to 8% vitality while all three grazers remain alive and near full energy. Feeding changes plant biomass, but the grazer population cannot respond to scarcity or abundance. The scene therefore loses the most visible opportunity for emergent consequences.

### Decisions

- Keep the existing `World`, `Plant`, `Creature`, and intervention data shapes. Add no dependencies or save format.
- Make creature energy an active constraint. Basal metabolism and movement spend energy; actual bites replenish it. Low-energy grazers slow, and grazers reaching zero energy leave the population.
- Allow reproduction only when a grazer has sufficient reserve energy, a nearby plant has enough biomass to support offspring, and the world is below a small population cap. A birth splits the parent's energy and consumes plant biomass for offspring material; a death returns fixed body material to the organic pool. Exact numbers are stylized and uncalibrated.
- Keep deterministic fixed steps and seeded variation for offspring placement. Avoid scripted timed births and random visual-only behavior.
- Make feeding visible only when the simulation position is in bite range of an edible plant. Show low energy through creature posture/color, let players tap a grazer to inspect its energy, and reflect population changes in the existing field notes/status copy.
- Preserve the current water, compost, light, time, orbit, and plant inspection controls.

### Acceptance criteria

1. Food-rich runs can produce offspring; food-poor runs lose grazer energy and eventually grazers. Births and deaths follow resource/energy thresholds, not a fixed event schedule.
2. Tests verify deterministic runs, birth energy/material costs, starvation, and the existing plant/resource responses.
3. In the browser, creatures visibly seek and feed, population changes appear in the scene and field notes, and controls remain responsive at desktop and iPad-sized layouts.
4. Typecheck, tests, and production build pass. Browser console has no errors, and normal orbit/3× play shows no obvious stall.

### Explicit limit

This milestone improves consumer dynamics. Atmospheric carbon, oxygen, microbial populations, full material conservation, and calibrated rates remain later work. The terrarium is still an open simplified system.

## Milestone 3 — functional plant and decomposer diversity

### Goal and scope

The first biodiversity increment should make several plant forms occupy different environmental niches and make organic recycling depend on a living decomposer. It should yield visibly different outcomes under shade, drought, compost, and grazer pressure. This remains one terrarium habitat; the full biome library comes later.

### Proposed decisions (data-format approval required)

- Extend the world with a small set of equal-area soil patches holding local moisture, nutrients, organic matter, and fungal biomass. Keep existing world-level water/nutrient/organic values as derived summaries for the current UI and tests. Introduce a versioned migration if saved worlds are added later; none exist now.
- Give existing clover, fern, and bloom forms distinct growth, moisture/light tolerance, and grazer palatability. Add a low-growing moss producer adapted to wet shade and poorly palatable to grazers. Species traits live in one pure simulation table, not in renderer conditionals.
- Bind each plant to the nearest soil patch by position. Uptake, leaf fall, and grazing affect that patch. Compost and water remain external inputs distributed across the terrarium for now; point application belongs to the placement-tools milestone.
- Fungal biomass increases when it processes moist organic matter, dies back when starved or dry, and returns nutrients to local soil. Conversion to unmodeled atmospheric gases is recorded as an explicit open-system loss in tests/documentation. Mushroom visuals reflect actual fungal biomass, not a decorative timer.
- Preserve seeded fixed steps, the grazer birth/death loop, current controls, and the private Tailscale route. Add no dependency.

### Acceptance criteria

1. Each plant species has a testable advantage or disadvantage in at least one environment; moss does not simply copy fern behavior.
2. Local resource depletion makes co-located plants compete; wet and dry patches diverge under the same global light.
3. Compost and moisture change fungal growth and nutrient release; fungi can decline without substrate.
4. The scene visibly shows moss/fungal responses and remains readable at desktop and iPad sizes.
5. Existing eight tests and new deterministic/resource tests pass, typecheck/build pass, and the live browser/Tailscale page render without console errors.

### Scientific boundary

Rates are stylized and arbitrary. Soil stocks are local model quantities and world values are equal-area summaries. Atmospheric carbon/oxygen and microbes other than the fungal aggregate are not modeled yet; matter leaving those tracked stocks is explicitly identified as open-system flux.

## Milestone 4 — tend a place, observe a local response

### Scope

- Tapping bare terrain focuses the nearest existing soil patch. The current field-notes panel then shows local moisture, nutrients, and fungal activity. Tapping an organism retains organism inspection.
- Water and compost buttons affect the focused patch while a patch is selected; with no selection they keep the existing whole-world behavior. Local input adds the same per-patch dose as a whole-world action, so global summaries rise by one quarter of the unsaturated whole-world dose.
- Focus is a UI state only. No stored world or action data shape changes, no new dependency, and no simulated resources originate in rendering. A subtle ground tint and focus ring reveal the affected patch without turning the diorama into a grid.
- Clearing focus restores whole-world controls. Orbit drag must not accidentally select soil.

### Acceptance criteria

1. Pure tests show a local input changes exactly one patch and the world summary reflects it; whole-world inputs and deterministic stepping still work.
2. In the live browser, a terrain tap focuses one patch, buttons alter its local values, organism taps still inspect organisms, and orbit drag does not apply inputs.
3. The focused state and controls remain readable at desktop and tablet widths; tests, typecheck, build, and console check pass.

## Milestone 5 — introduce life and recover an ecosystem

### Key decisions

- Add a compact nursery in the existing field-notes panel. Choose clover, fern, bloom, moss, or a grazer, then tap clear ground to introduce it. A persistent tool label and a return-to-observation button make the mode explicit.
- Introduced plants and grazers are external living-material inputs. They use the existing organism data shapes, receive deterministic unique IDs, and immediately participate in growth, feeding, reproduction, and starvation. Removing a selected organism exports it from the terrarium; it does not also create litter.
- Placement rejects pond interiors, the edge of the island, crowding, and modest population limits (32 plants, 7 grazers). Invalid placement explains the constraint and changes no simulation state. The same pure land boundary keeps grazer movement out of water and off the tray.
- Preserve observation, local tending, time controls, and seeded fixed steps. Reuse native buttons/CSS and the existing meshes. No new dependency or saved-world shape change is needed.

### Acceptance criteria

1. Pure tests verify valid/invalid placement, IDs, caps, immutable state, and removal. Introduced organisms measurably feed or grow in later steps.
2. A deterministic path test shows a grazer reaching food on the opposite side of the pond without crossing water; long runs stay on land.
3. In the live browser, choose and place a plant and a grazer, inspect/remove an organism, reject a crowded location, cancel the tool, and resume ordinary tending/orbit.
4. Nursery controls are reachable and readable at desktop, tablet, and narrow phone sizes. Tests, typecheck, production build, and browser console checks pass.

## Milestone 6 — keep and compare experiments

### Approved data format and behavior

- The user approved the browser save envelope `{ version: 1, world }` and two experiment slots. Store each slot under its own ECOSPHERE localStorage key. Save the existing world state; add no new world fields or dependency.
- A native dialog opened from the header pauses time and offers Experiment A and B. Each card shows the saved day, life counts, leaf cover, water, and light so players can compare snapshots and restore a branch. State and seeded random progression resume deterministically from a restored snapshot.
- Saving is explicit. A populated slot offers a clearly labeled replace action. Beginning another world does not erase either slot. Loading pauses time, clears selection/tools, and never treats restored population differences as births or deaths.
- Parse and validate the complete saved state before replacing the running world: finite bounded numbers, recognized species, unique IDs, array limits, and four soil cells. Recompute summaries from local stocks. Invalid/unsupported saves and storage failures show a useful message while the game keeps working.
- Saves belong to the current browser and address. Cross-device sync, imported files, automatic replay, and a calibrated experiment analysis remain later features.

### Acceptance criteria

1. A snapshot round trip yields the same future seeded simulation; serialized data does not share mutable objects with the running world.
2. Malformed JSON, unsupported versions, invalid species, bad numbers, duplicate IDs, missing soil, and oversized populations are rejected without replacing the world.
3. In the live browser, save two distinct paused states, compare their cards, load one, reload the page, and confirm both slots persist. Press literal Escape to close the native dialog and verify focus/control recovery.
4. The dialog fits tablet/phone widths, storage failure is handled, and tests, typecheck, production build, and console checks pass.

## Milestone 7 — plant populations can recover and disappear

### Key decisions

- Remove the immortal minimum-root behavior: a plant whose declining biomass reaches the root threshold dies, and its remaining tracked material returns to the same organic pool as leaf litter. The player can restore lost producers with the nursery.
- Healthy, mature plants can establish nearby offspring through seeded dispersal. Clover and moss spread shorter distances; fern and bloom disperse farther. Recruitment requires clear land, suitable local resources, and the existing 32-plant cap.
- A seedling's biomass is deducted from its parent. Rendering does not create offspring. Preserve the existing World/Plant/Creature shapes and version-1 save envelope; no dependency or data-format change is needed.
- Show recruitment/death in field notes; existing size and habitat-driven color reveal growth and stress. Empty-world status and the nursery provide recovery after extinction.

### Acceptance criteria

1. Sustained unsuitable conditions can eliminate plants and return their residual material locally. Good conditions can establish offspring; recruitment transfers biomass without creating it.
2. Seed/action replay remains deterministic; new IDs, spacing, pond exclusion, caps, and snapshot continuation remain valid.
3. In the real game, a progressed stressed snapshot shows fewer plants; a recovered/seeded world remains playable. Newborn/death notes reflect actual population changes and do not fire on save restore.
4. Tests, typecheck, production build, and browser checks pass. Document that rates and dispersal represent simplified functional groups rather than validated species parameters.

## Milestone 8 — a living detrital food web

### Key decisions

- Add a woodlouse functional group that seeks moist litter, consumes local organic matter, releases a modeled nutrient fraction, and pays extra maintenance in dry ground. It does not eat living plants. Existing grazers retain their leaf diet and behavior.
- Apply the already-approved explicit species-identity extension to `Creature.kind` (`grazer` / `woodlouse`). Missing kind in legacy version-1 saves/in-memory worlds migrates to grazer; unknown explicit values are rejected. The save envelope remains `{ version: 1, world }`. No dependency is added.
- Preserve the seven-grazer cap and add a separate four-woodlouse cap. Begin new worlds with three grazers and two woodlice; existing snapshots gain no unsolicited organisms. Births require reserve energy and source body material from the species' real food pool; deaths return the corresponding fixed body stock locally.
- A woodlouse bite partitions its removed litter into fecal organic matter (40%), available nutrients (35%), and untracked respiration (25%). These are explicit game coefficients, not experimental estimates. Adult body mass is fixed; energy is a separate reserve scale.
- Model visible leaf-litter piles from local organic stocks, a distinct segmented woodlouse silhouette, and feeding/movement cues driven by the same food-target rules used in simulation. Nursery, inspection, notices, and experiment comparisons distinguish animal roles.
- Add an opt-in renderer probe for browser profiling. Measure draw calls/frame time before deciding whether an optimization is warranted. Normal play has no performance dashboard.

### Acceptance criteria

1. Woodlice move toward suitable litter, gain energy from it, change local litter/nutrients, and leave plant biomass untouched. Dry or foodless runs lose them; wet litter can fund offspring with split reserve and an explicit body cost.
2. Tests verify per-species population limits, target/navigation behavior, nonnegative stocks, the litter partition invariant, seeded replay, and legacy/new snapshot validation/continuation.
3. In the real browser, a fresh world shows both animal forms and litter; add/inspect a woodlouse, use local compost/water, observe feeding, and restore a legacy grazer-only snapshot. Controls and layout remain usable at tablet sizes.
4. Tests, typecheck, build, independent review, live console checks, and a browser render profile are recorded. Real iPad hardware remains a separate release gate.

## Milestone 9 — predators and observable consequences

### Key decisions

- Add a carnivorous ground-beetle functional group through the approved species identities, with a cap of two. Default/loaded worlds receive no automatic predators; players introduce one through the nursery.
- A hungry beetle searches within a finite perception radius, pursues grazers or woodlice, spends energy moving, and catches only within contact range. Fed beetles conserve energy. Nearby prey stop feeding and flee; this can alter herbivory before a kill. These are simplified game rules, not measured carabid parameters.
- Captures remove exactly one living prey and partition its fixed body stock. A modeled litter fraction returns locally; the rest is an explicit open respiratory/assimilation loss. A well-reserved beetle can instead fund one offspring body directly from a sufficiently large catch when prey are abundant; its reserve is split. No cannibalism or litter/plant feeding is modeled for this archetype.
- Keep World and the version-1 save envelope unchanged apart from the approved Creature.kind value extension. Add an additive pure `simulateStep` result containing the next World and transient deterministic events; retain `stepWorld` as the World-only compatibility wrapper. Events are not persisted or used to alter ecology.
- Feeding, predation, birth, and death events drive visual cues and notices, replacing population-count guesses. Restore/intervention clears transient events. Save/load must not fabricate deaths or meals.
- Give the beetle a distinct three-part body, six legs, and visible pursuit/meal cues. Keep the seven-option nursery reachable on short tablet layouts. Update snapshot role counts and the capacity fixture to include two predators; profile the actual result.

### Acceptance criteria

1. Tests prove pursuit/contact, fleeing versus feeding, hunger/rest, diet exclusion, starvation, single-consumption ordering, explicit catch/body partition, reproduction costs/caps, land bounds, and deterministic event/state replay.
2. In a defined tended high-grazer experiment, compare 0/1/2 beetles across seeds 17/183/2217. Record living producer biomass, consumed leaves, and all animal roles; validate a producer-recovery effect where the model supports it. Never hardcode a plant benefit or claim predators always improve outcomes.
3. Legacy grazer-only and mixed detritivore snapshots still load. Predator snapshots validate their role cap and continue identically. Events remain transient and do not change snapshot state.
4. In a live browser, introduce/inspect a beetle, observe pursuit/capture and prey disappearance with a truthful note, pause/resume, and save/restore. The production build and tablet/phone controls work without errors. Tests, typecheck, build, independent review, and a capacity profile pass.

## Milestone 10 — existing organism art refresh

User explicitly requested updates to existing plant/animal models and authorized external assets. Following `/spec`, the goal and art direction are already clear, so no additional interview is needed.

### Decisions

- Preserve all ecological kinds, positions, traits, saved data, and interactions. Improve silhouettes: low trifoliate clover, arching pinnate fern, layered meadow flowers, textured moss cushions, a recognizable segmented leaf grazer, and refined woodlouse details.
- Evaluate reputable downloadable nature assets against the authored alternatives; only ship commercially usable, redistributable files with verified provenance/license. Use existing Three.js loaders/utilities, no dependency. Do not silently substitute a decorative species for a simulated organism.
- Use local, curated assets rather than runtime third-party requests. Keep a procedural fallback so a failed model request cannot remove ecological life or break play. Match palette/scale and bind growth/decline/feeding/movement to real state.
- Inspect before/after renders at the same paused state. Measure the full-capacity rendering cost, then share/merge geometry where the measured result warrants it. No Safari-performance claims from desktop evidence.

### Acceptance criteria

1. All four plants and both previous animal roles have readable, distinct silhouettes at normal zoom. Growth/decline and movement/meal cues still work; selection and placement remain usable.
2. Every downloaded file shipped in the build has source, license, and modifications recorded. No dependency or persistent format changes.
3. Tests, typecheck, and build pass. Actual desktop/tablet/phone and production renders are inspected, console/request failures checked, capacity profiling recorded, and asset failure degrades gracefully.

### Art-direction correction after player feedback

The player found the cup-shaped imported flowers and original cone grass incompatible with the fern. Keep the fern's light, organic leaf language. Replace the cup flowers with authored rounded radial petals, slim stems, and the same folded leaf geometry; replace cone grass with curved tapered blades. Use one restrained leaf palette and comparable detail. Asset permission is not a reason to keep a mismatched asset. Retain only suitable external meshes after inspecting the composed scene.

## Milestone 11 — choose conditions, discover a habitat

Following `/spec`, the user's autonomous-development prompt and existing next priority already establish the goal: meaningful habitat variation with the world as the main interface. No further interview, dependency, or persistent-format change is needed.

### Decisions

- Replace the instant Begin again action with a native, cancellable start dialog. Offer the existing mixed garden unchanged, a damp shaded floor, and a bright meadow. Each option explains its initial conditions, resident community, and one observable experiment. Opening or choosing a card does not replace the running world. An explicit Begin button replaces only the unsaved running world and starts paused; the two saved experiment slots are untouched. Closing leaves the previous world paused.
- Habitat starters are initial conditions assembled from the existing four producers and three animal roles. Their differences are local water/nutrients/litter/fungi, light, species proportions, and starting consumer pressure. No persistent habitat identifier, passive bonus, automatic watering, weather script, or different solver is introduced. Changing conditions afterward can erase the initial habitat's advantage.
- Preserve the default `createWorld` exactly. A pure starter factory creates deterministic, land-valid, uncrowded communities via existing placement rules. All starters round-trip through the unchanged v1 save validator and continue deterministically. These are small terrestrial habitat experiments sharing the tray/pond geometry, not complete forest/meadow biomes or new ecological species.
- In plant inspection, explain its strongest environmental constraint and whether the current growth equation predicts gain or decline before grazing. Use the same pure flux calculation as the solver; do not infer ecological outcomes from art or population counts. Improve the all-shade status so shade-adapted communities are not incorrectly described as universally seeking sunlight.
- Preserve the player's shared art direction. Starter previews reuse the existing plant silhouettes/colors. The live world differs through its actual organism composition and soil stocks; no mismatched asset set or full-screen dashboard is added.
- Bind the scene's key-light warmth/intensity to the existing sunlight input while retaining fill light for readability. Reset animal presentation identity on explicit begin/restore, preserving interpolation during simulation and camera position across world replacement.

### Acceptance criteria

1. All starters are deterministic, correctly summarized, within placement/cap rules, and independent objects. The mixed starter equals the old default. Old/new snapshots preserve continuation and contain no habitat metadata.
2. Paired tests with identical plants and controlled soil inputs demonstrate the existing fern/moss versus bloom/clover response to shade/moisture. Multi-seed starter runs show distinct producer/detrital trajectories without habitat-specific stepping rules; preserve all 44 baseline checks.
3. In the actual browser, opening/choosing/cancelling preserves the old world; beginning changes the composition and conditions, pauses time, clears selection/tools/events, and leaves experiment slots intact. Literal Escape closes the dialog and restores focus. Inspect a plant's actual environmental feedback, tend it, and run at 3×.
4. Tests/typecheck/build pass. Inspect the compiled game and private Tailscale route, desktop/tablet/phone layouts, console errors, and measured rendering cost. Obtain independent review and fix material findings. Physical iPad Safari remains a separate pending device gate.

## Milestone 12 — composition-based soil experiments

Following `/spec`, this is the next small part of the requested material sandbox. Keep the three existing modeled soil stocks; no persistent field, save-format change, species, or dependency is added.

### Decisions

- Route existing water/compost actions through one pure input-transfer function. A transient recipe contains amounts of the existing water, organic, and nutrient stocks; the target is one soil pocket or the whole tray. Preserve old doses/results exactly (18 water / 16 organic per targeted pocket).
- Add an optional soil-mixture dialog from the tending dock, paused on open. Players can choose water/litter/mineral-feed recipes or combine their own amounts, 0–20 relative units per targeted pocket. Explicitly show the target and that mineral nutrients bypass the litter web. Apply once, return to observation, clear old step events, and retain selection/time pause. No timed resource bonus or direct organism-health change.
- Reject nonfinite/negative/oversized inputs and unknown patch IDs before changing anything. Cap local moisture at 100; return a transient receipt with actual stock imports and water not retained. Check sums against requested dose × targeted pockets. Excess is an explicit unmodeled outflow, not hidden material disappearance.
- Recipes are game-unit blends, not measured chemical compositions. This increment does not label a mixture as semen or other specific biological fluid: water/organic/available nutrients alone cannot justify claims about their chemistry, pathogens, salinity, pH, oxygen demand, or complete ecological effects. Broader named substances wait for the appropriate modeled interactions. The reusable transfer path is ready for richer composition later.

### Acceptance criteria

1. Existing water/compost tests remain unchanged and pass. Local/global stock import receipts balance, including near-saturated water; invalid input is an immutable no-op. Saving/continuing mixtures uses unchanged v1 snapshots.
2. Controlled equal-world experiments show that organic input supplies fungi/woodlice after processing while mineral nutrients are available directly; neither creates extra animals or bypasses growth/feeding rules. Mixture/action replay is deterministic.
3. In the compiled browser, open/cancel/Escape the dialog without adding anything, use literal keys for recipe sliders, apply a local mixture, read the truthful receipt, inspect changed patch values, and confirm untargeted patches/time stay unchanged. Check all-zero/invalid handling and normal quick actions.
4. Tests/typecheck/build/independent review pass. Inspect desktop/tablet/phone layouts, live errors, final capacity cost, and the exact private route. Report remaining scientific/device/release limits honestly.

## Full-game continuation — milestones 13 onward

The user explicitly requests sustained implementation toward the full game, without stopping after a small increment. Apply `/spec` using that clear goal and `/verify` against the release checklist below. Preserve working systems and the unified art direction. Work through coherent checkpoints and browser checks in the same run; checkpoint completion is not a reason to claim the whole game complete.

### M13: habitat engineering and a fungal consumer

- Apply the approved species-identity extension to grass, a small broadleaf tree, and springtails, using existing Plant/Creature fields and v1 snapshots. Old worlds receive no automatic additions. Plant cap32; separate springtail cap6. Update validation/role counts rather than changing existing organism shapes.
- Trees grow, die, reproduce, use local resources, and cast biomass-dependent local ecological shade. Nearby understory uses attenuated sunlight; shade reduces local evaporative loss without adding water. Tree trunks/foliage are poor grazer food. Grass is a fast sunny producer and palatable food. Existing worlds without trees keep their previous equations.
- Springtails seek living fungal biomass in moist ground, consume it (not litter or plant leaves), return explicit organic/nutrient fractions, and have reserve/body costs for birth and death. They become possible beetle prey. This creates a real litter→fungi→consumer→predator route alongside the existing woodlouse litter route.
- Woodland/meadow starters include their new functional roles; default mixed world and legacy saves remain intact. Baked rounded tree parts and curved living grass share the existing materials/leaf language. Small springtails have a distinct pale body and movement-driven hop, not an independent decorative wander.

### M14: playable fieldwork, discovery and a living record

- Add a field guide of all implemented roles, with actual diets/habitat needs and model limitations. Introduce from the guide into the existing nursery; inspect living members through the same selection path.
- Provide optional fieldwork scenarios with seeded initial worlds and objectives evaluated from actual states/events. Include a hands-on learning sequence, woodland coexistence, and recovery after depletion. No scripted births, free health bonuses, or success based on elapsed time alone. Present concise progress in the game, a clear completion state, and continue in sandbox afterward.
- Keep a bounded, transient journal of significant actual events (including player actions), cleared on whole-world replacement. Avoid repetitive feeding spam. The journal is session-only unless a further save-format extension is approved.
- Improve world creation with a validated seed and a bare-ground start. Keep game controls reachable on touch screens and let the world occupy more space than static introductory copy.

### M15: complete snapshot workflow and reliability

- Add file export/import of the existing validated v1 snapshot envelope for transferring worlds between devices. Preview an imported world before explicitly exploring it; cap file size and never overwrite stored slots during import. Use native browser/file APIs, no dependency.
- Verify modal focus/order, keyboard controls, snapshot continuation, storage/file failure recovery, responsive layout, and capacity cost. Finish with a second-model review and real compiled/private browser requests.

### Further persistent model extension — approval required before implementation

The following proposal is reviewable scope, not implemented state: a v2 snapshot that can load/migrate all v1 worlds, adds explicit `climate` (temperature and rainfall controls), `pond` (water, available nutrients, organic matter, dissolved oxygen and algae), and animal age/life-stage fields; a separate versioned player-progress record for scenario completion/autosave. These enable a real aquatic habitat, climate disturbances and life histories instead of hidden habitat switches. Migration must preserve old organisms/resources, introduce no unsolicited animals, and document any initialized physical reservoirs. No full atmospheric carbon/oxygen or measured biological-fluid chemistry claim follows from these fields. Wait for explicit approval under AGENTS.md; continue all authorized M13–15 work meanwhile.

Approved by the user on 2026-10-24: proceed with this extension. Implement climate/pond/life history before final fieldwork so its objectives can observe both food webs. V2 writes retain full v1 reading; existing A/B keys remain unchanged and are never overwritten by migration alone. New worlds initialize a separate pond reservoir (60 water,5 available nutrients,4 organic,48 oxygen,1 algae); legacy worlds receive this explicitly documented reservoir but no new organisms. Oxygen is a relative stock bounded by water, not measured mg/L. The atmosphere is an open exchange boundary.

- Add lily/reed producers, algal-grazing water fleas and small predatory fish with aquatic placement/navigation. Land animals never enter water and do not select aquatic producers as distant food. Pond organisms use pond stocks, not soil-pocket means. Wetland starter includes an actual aquatic food web.
- Pond algae photosynthesis consumes nutrients, turnover returns organic matter, microbial processing releases nutrients and consumes oxygen, and atmospheric exchange/producer photosynthesis replenish oxygen. Water loss concentrates oxygen capacity and can cause habitat failure. Temperature scales rates; rain is an explicit external input with retained/outflow accounting. No hydraulic coupling or carbon closure is claimed.
- Animal age/stage denotes reproductive maturity. Existing/v1 animals migrate as mature; newborns start juvenile and cannot reproduce immediately. Fixed body stocks remain the existing coarse surrogate; age is not growth allometry. Fish can retain an explicitly tracked portion of catch material for offspring, consuming it for births and returning it on death. No body material is created from reserve-energy numbers.
- Controls for temperature/rain and pond inputs act on these actual fields. Show low oxygen, food availability and stage in inspection; environmental changes have consequences through shared equations. Temperature/rain are serialized so a save follows the same future.

### Release acceptance checklist

- Functional producers, leaf consumers, litter consumers, fungal consumers and predators; local canopy engineering; at least two distinct functioning terrestrial habitats. Test species-specific responses, coexistence/extinction/recovery and material transfers.
- Coherent, readable 3D silhouettes and truthful movement/growth/feeding; responsive native controls; smooth measured host-browser play at capacity with separately recorded physical Safari evidence.
- A complete create/learn/experiment/observe/refine loop: optional objectives, guide, journal, time controls, meaningful interventions, local snapshots and portable files. Preserve user data.
- Tests/typecheck/build, deterministic long runs, save compatibility, independent review and real browser/HTTP checks. Do not label unimplemented aquatic/chemical/life-stage systems as complete or call host viewport checks physical iPad verification.

## Living-organism continuation — 2026-10-25 user priority

The user specifically prioritizes a complete observable lifecycle for representative organisms before merely expanding counts. Continue the full-game work, implementing this before fieldwork polish. Existing age/stage gating alone is insufficient.

- Add plant age/development with visible seed, germination, seedling, growth, maturity, reproduction and senescence. Development needs suitable moisture/temperature; photosynthesis begins after germination. Propagules transfer parent biomass, and age/stress death returns a documented material fraction. Imported/legacy established plants retain mature development. Start with all existing functional groups using species-specific timelines; document compressed game times.
- Make the woodlouse the first complete individual animal lifecycle: explicit sex, hydration, current body material, courtship/partner, brood material and incubation state; needs-driven foraging, moist-ground seeking, mating, resting and brood release. Juveniles have a small, funded body and gain body material from food. Reproduction uses nearby mates and real maternal food/body costs. Other groups keep their tested simplified reproductive surrogate until separately developed; do not imply biological courtship for them.
- Keep small persistent corpses/plant remains as actual material reservoirs that release material into local detritus over fixed steps. Prevent duplicate death/capture/decay accounting. Render fading fallen plants or shells from this state, not unrelated timers. Preserve legacy snapshots through explicitly initialized defaults under the approved v2 lifecycle extension.
- Player inspection should show the stage, actual needs/behavior and family connection; allow following a selected animal with camera target interpolation. Animation follows actual feeding/movement/courtship/brooding state. Preserve manual orbit/zoom and provide an explicit stop-follow control.
- Validate plant development/drought delay/aging, mating and brood costs, juvenile material growth, hydration/rest, death/remains partition and deterministic save continuation before expanding the pattern. Existing model boundaries remain explicit.
# Scale Bible pass — 2026-10-25

Player-requested scope: use stylized readable ecological scale across all eight producers, six animals, life stages, and environment anchors. Add `SCALE_BIBLE.md` and a small presentation-only `src/scene/scale.ts` shared by models. Define target dimensions, bounded stable variation, juvenile ratios, contact heights, and independent minimum picking volumes. Keep island/pond navigation footprints unchanged; no ecological stock, placement rule, save schema, dependency, or gameplay rewrite is needed for scale. Unsupported shrub/worm categories get reserved ranges, not decorative species. Normalize authored geometry against measured bounds rather than applying one multiplier to everything. Follow with actual whole-scene/close/tablet inspection and a second correction if necessary.
