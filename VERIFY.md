# Verification plan — first playable slice

## Nursery and granary support — before implementation, 2026-10-31

Test the pure world-down placement using real imported larva/pupa bounds, existing rotation, egg dimensions, cohort stacking and supported food grains. Require finite offsets, nonmutation, preserved scale/count and actual vertices within the cavity. Keep adult support/contact regressions. Run all tests/typecheck/build. Reopen the compiled game, verify current adult follow and nursery/chamber picking, step real development, inspect floors from multiple angles and collect current errors/profile. If native input remains unreliable, record that gate as incomplete and do not expand to another visual feature.

## Cavity-supported ant presentation —before implementation,2026-10-29

Measure imported worker/queen bounds and check all support samples against the existing cavity field at rooms and transit fractions/headings. Require finite bounded offsets, nonmutation, safe fallback when the box cannot fit, and no jump across disconnected voids. Evaluate actual animated caste vertices against the selected support margin. Keep surface anchor and scale unchanged. Run tests/typecheck/build and inspect actual paused/live nest, selection and follow. Cache prepared field per graph and skip unchanged poses; measure native scene cost. This is rigid-body support, not per-foot IK or a solver correction.

## Final Daphnia integration and responsive continuation —2026-10-29

Re-run all tests/typecheck/build after final export and documentation edits. Restart only the disposable local preview if unavailable. Inspect current compiled capacity world and actual pond interaction; obtain real viewport dimensions before claiming phone/tablet QA. Preserve snapshots and private route. Record current verified results and limitations; no dependency/schema/solver change.

Result:194tests/typecheck/build passed. Actual compiled capacity world and pond inspected. Phone width measured390CSSpx, document378px, height844; selected/followed fish and imported water flea, literal Right dispatched; console errors[]. Exported static idle and body-relative gait passed independent vertex/pose review. Screenshot `daphnia-phone-390.png`. Browser controls require host-scale compensation for viewport dimensions; physical Safari remains unverified.

## Accessible Daphnia source — before acquisition,2026-10-27

UC Davis TERC's official Tahoe-Species exhibit links Daphnia to both its creator Sketchfab page (CC Attribution candidate) and a public AR route. Inspect the exact creator license and official AR source, download only through that public route if permissions match, retain source/metadata/hash. Do not extract authenticated Sketchfab viewer/cache content. Inspect actual anatomy/topology/materials/animation before adapting or integrating; retain existing game art until source quality and licensing pass. No dependency/schema change. Any eventual GLB must preserve the existing water-flea biological envelope, solver/habitat/picking independence and be verified in the real pond.

Source obtained from the public AR metadata: 2,058,460 bytes, SHA256 6741bbc253e922e53a97b885b0af341ae7e710b51f33c0f9a1d620078fdcb5da. Embedded extras independently identify ucdavisterc, the exact source URL and CC BY4.0. Blender inspection shows 33,044 triangles,190 bones, one 3-second source action and eight distinct body/eye/gut/limb meshes. Inspect original and adapted render; target ≤6,500 triangles, ≤64 deform bones, self-contained GLB, and unchanged max visual diameter0.105 at adult before ≤6% individual variation. Test actual skinned bounds over animation and headings against pond bank/surface/bed, independent rigs, state-driven motion and frozen pause; compare solver legacy trajectories. Validate surface/underwater picking and real live/pause playback in a compiled browser, record render cost and provenance. Stop the integration if anatomy, motion, or water-clearance gate fails.

## Fed low-reserve worker diagnosis — before audit,2026-10-27

Measure actual nest workers who have just eaten, have reserve<35 and remaining gut material, stand in the granary with no carried delivery, and nevertheless depart. Use the unchanged twelve coupled food-access scenarios and record examples/material error before proposing rest behavior. If reproducible, scope a granary recovery pause using the existing rest cost/digestion and care-ready reserve; never refill reserve or food directly. Test real digestion/waste, departure after recovery, guards for hungry/no-meal and committed carriers, exact continuation and foodless controls. Compare all matched2400h cases and observe actual low-reserve resting/feeding in game. Keep scale changes and anatomy independent.

Before edit: `ant-food-capacity-fed-departure-before.json` reports14–337 such departures in all12cases. Example seed17/site(1.7,1.7)/tended at181: worker5reserve27.63/gut.0063/granary.0629 begins foraging. Write failing-first granular tests for recovery without body/stock creation, preserved carrying priority, actual granary location, hungry release and exact saved continuation; then compare the same12scenarios and inspect the actual game.

## Propagule scale / camera — before edit,2026-10-27

- Check actual seed geometry bounds for every producer against shared envelopes, including growth/identity; moss/fern must be much smaller than springtail and worker. Mature asset dimensions remain unchanged. Camera must project each seed inside portrait/landscape margins with a valid near plane; target diameter stays28CSSpx at micro and overview ranges.
- Verify whole-form germinants remain tiny just after development3, grow monotonically toward24, and match the prior formula at24/60. Actual camera bounds must cover their tiny shoots and transition without a clipping near plane. Native step the planted fern through emergence, preserving actual stock costs and paused controls.
- Confirm pure deterministic no-colony fixture trajectories remain unchanged. Run focused failing-first tests, all tests/typecheck/build and independent review.
- Actual tree seed showed inspector overlap despite fitting full-canvas bounds. Cover the12%side-panel projection shift in measured imported-bound tests; verify restoration after focus/pond exit and no shift on phone stacked layouts.
- In the actual compiled game introduce a real seed/spore through nursery, tap its independent target, Look closer, orbit/pan/zoom with literal arrow input, leave/re-enter pond and verify normal surface return. Compare larger tree/clover seeds, paused stock/time and native A/B preservation. Inspect mature capacity world and tiny fauna without inflating their anatomy. Test tablet/phone layouts and runtime errors; physical Safari remains unverified.

## Long-run food access diagnosis — before audit, 2026-10-27

Extend the existing deterministic 12-scenario audit only: record nearby edible stock at the nest, worker task/location/reserves, and actual harvest and queen-feeding events in 120-hour windows. Keep the same inputs, seeds, sites and solver. Compare declining queen supply with accessible source and workforce age; do not change behavior or invent food based on aggregate plant biomass. Preserve the report and update the next priority. Run tests, typecheck and build after the diagnostic edit.

Result: `artifacts/ant-food-capacity-food-access.json` preserves the full samples. For seed183/site(1.7,1.7), 0.288 material was harvested in the 120 hours to tick1089 while the queen received none; nearby edible stock was15.9, and returning workers sampled at roughly25–27 reserve, below the existing ready-care threshold35. Four synchronized founders died at1160; the queen died1408. Other tended sites received intermittent meals and survived longer. This identifies a resource/task tradeoff, not proof that lowering the threshold is correct. No solver behavior or material was changed by this diagnostic.

## Multigeneration replacement diagnostic — before audit,2026-10-27

Diagnostic result: across twelve 2,400-hour coupled scenarios, zero steps met the proposed urgent queen/loaded ready adult/positive granary condition. No speculative priority change was made. Actual counts are in `artifacts/ant-food-capacity-urgency-before.json`.

Follow-up before any additional change: two mineral-tended cases gained workers but the queen died317–331h sooner. Measure whether she is critically hungry while a ready adult inside the nest holds food but the granary has a small positive stock; the existing direct-delivery rule currently only triggers with an almost empty granary. Compare actual carrier/queen states and subsequent transfer, not just aggregate deaths. If this condition does not occur, retain current behavior and the documented tradeoff; if it recurs, test a narrowly scoped urgent-queen priority without waiving worker hunger, real arrival or material accounting.

Result:185tests/typecheck/build and independent33checks/19,200matched coupled steps pass; max ledger error2.67e-14. Six mineral-tended2400h cases show2→4–5 actual births, but all queens still die; two die317–331h sooner, four8–319h later. No claim of universal improvement or stability. Native preserved A106+explicit rain/mineral/water actions: at355 queen75/gut.024, stores.006/no brood; at356 queen72/gut.018 and a funded egg appeared. It hatched370, grew.0039→.0295 by406, pupated by436, emerged as pale followed worker8 at457. GUI counts/ages agree with a separately reconstructed pure replay; no full native-export equivalence claim. Screenshot `ant-replacement-native-worker8.png`. Browser console errors[]; physical iPad remains untested.

Previous cycled mature-plot controls explicitly supplied water and minerals: six tended cases retained a queen and one worker at1440h after founding-worker senescence; controls with nutrient depletion lost food and colonies. Extend these exact coupled scenarios to2400h with separately named reports, record worker ages/food loads and every real egg/birth/death alongside seed supply and total retained inputs. Distinguish finite source collapse, poor access, age structure and overly strict reproductive eligibility before considering any change. No hidden food grants/rate changes/extra saved fields. If a reproducible behavioral gate prevents a funded egg despite the queen's actual food/reserve and continuing forager supply, scope a minimal decision adjustment before editing; test full material ledger, foodless controls, body-funded maturation, deterministic save continuation and the actual game. Otherwise document the genuine ecological limit rather than force survival.

Before edit: six tended controls all retain seed food yet queen and workforce expire by1693–1809. Example at849: queen reserve90, gut.0158, six workers, >38 producer seed-stock units, but stores.018 and no brood; no egg after tick32. Add failing-first reproduction tests for actually funded queen/carry, low queen reserves, insufficient available adults, absent real load, existing brood and no-brood starvation; verify queen's gut→egg/soil/metabolism, exact continuation and no false birth. Preserve `ant-food-capacity-replacement-before.json`, compare2400h/three seeds/two sites and six water-only controls. Then test actual compiled native progression and repeat full gates/second-model review.

## Trace remains refinement — before edit,2026-10-27

Native baseline: actual B812rain0→1758larval death atdepth.44,100%body/age0correct handoff; wet+1h1759old absolute cutoff clears entire tiny pool. Add failing-first dry/wet/partial/full tiny-ant decay tests with exact local material return, old unrecorded/non-ant equivalence and continued snapshots. Preserve existing worker decay/death gates and historical no-ant hashes. Re-run full tests/typecheck/build/review, repeat native B812natural death and wetting with new fractional cleanup, observe gradual body loss/soil return and final completion. Orphaned larva copy must identify absent carers while leaving funded-pupa emergence and wet/dry stage conditions accurate. Do not inject a browser World or overwrite A/B.
## Seed supply / root-pocket care — before UI edit,2026-10-27

Use actual paused plant inspection in a played colony. Eligible mature high-cover plants show the solver's real available material; low-cover/maturing plants explain both gates; fern/moss/tree/aquatics must not be mislabeled seed hosts. Tend root soil must select the same `selectedPatch` used by plant growth, clear close camera, and leave time/resources unchanged; an explicit Mineral feed recipe must change only that pocket and be observable after returning to the plant. Test the actual modal with literal Escape and portrait/landscape controls, then tests/typecheck/build. This is a small UI extension of the scoped food/soil intervention loop; existing food-stock tests remain authoritative.

## Colony food longevity — before audit/edits,2026-10-27

Baseline180tests. Reuse the scoped needs audit in SPEC: compare complete coupled habitat worlds and matched no-colony controls, plus explicitly imported mature food plots with cyclical light and bounded real water inputs. Run at least720–1440steps across several seeds/placements, log source availability, real harvest/delivery, nurse/forager travel, queen/worker gut/load/reserve and death context. Preserve before reports under new names. First distinguish ecological food collapse from workers failing to collect/transport usable food or reach a starving queen. Correct demonstrated decision/path/continuation defects without free resources or blind rate changes. Relevant changes must conserve the ant material ledger, keep physical stride/graph bounds and old save compatibility, preserve no-ant trajectories, and receive regression tests/full tests/typecheck/build/independent review. Verify actual behavior in the compiled game and portrait/touch-facing controls before expanding further. No new schema/dependency is planned.

Continue the previously open native cohort-death gate using existing QA B812: select its real unfed larva, turn rainfall off with the literal slider Home key, and advance its real dry ecology. Observe selection moving to actual larval remains and subsequent local decay; never inject/alter browser World or force death. Preserve A/B, bound step batches and inspect near death so the visual event is not skipped. No new implementation is planned for this test unless a real defect appears.

## Spatial chamber resources — before edit,2026-10-27

Result:180tests, typecheck and build pass; independent66focused checks plus24boundary scenarios/7,680coupled steps pass (38births/79excavation events, exact continuation/unchanged source/valid hulls, maxledgererror1.66e-14). Native boundary colony nursery70/face60, globalinput→88/78, selected local pocket3 water→nursery100/face78, paused8. At26egg11developmenth/nursery98/face76. Direct chamber/cohort tending native A106selects actual pocket4, no step; explicit water63→81 reflected in nursery/cohort, phone handoff retains106/81. No user snapshots replaced. Production client1,374.77KB/391.88KB gzip; CSS30.53KB/7.70KB; worker76.43KB. This closes the spatial allocation increment, not release/Safari gates.

Final native checks: B812microfollow#6→nest→surface returns a real wide island view; Watch next selects actual#7(age11days/energy19), Stop retains inspection/time and exits following. Prior direct pond return also passed. Final no-profile compiled A106/pupa actual rendered and inspected at1016×714: panelbottom510.85/docktop538.43, no horizontal overflow, no runtime errors. `ant-soil-final-observation.png` is actual game evidence. Independent final Tend callback review found no selection ordering/resource/camera blocker. Exact final compiled entry/JS/CSS/worker and private HTTPS entry/current colony module/springtail GLB/credits return200. QA tab54paused106preserved for continuation; original user tab38not explicitly operated. Browser visibility returned to background. No hardware/Safari benchmark claim.

Baseline175tests/typecheck/build. Use real connected nests straddling soil-column boundaries: wet entrance/dry nursery must pause ontogeny while dry entrance/wet nursery develops; newborn hydration must withdraw only nursery water after accounting for adult uptake. Isolate nursery feeding/maintenance returns, queen reproduction waste and granary spoilage to their actual columns with exact material accounting. Demonstrate a real advancing excavation face halts in dry/saturated local soil, not an unrelated entrance. Check no mutation, strict old-v3 parsing, exact continued futures and unchanged no-ant fixtures. Run full tests/typecheck/build plus bounded independent read-only review. Play actual nursery/room inspection and local tending in compiled browser at portrait/landscape; preserve native QA A106/B812 and user private world. No claim of calibrated subterranean water/temperature mechanics.

Native refinement before UI edit: actual boundary colony shows nursery70%/face60%; global input then local soil selection changes nursery88→100% while face remains78%, still paused8. Add a direct chamber/cohort “Tend soil above” action into the existing local soil panel, without changing stocks/time. Verify correct pocket and surface camera, then a real local input and room return on phone/desktop. This is an observation/tending affordance within the scoped local-resource increment, no separate saved state or solver change.

## Recovery feedback — before edit,2026-10-27

Result: actual B812(0plants/2recyclers) opens nursery with no stock/time grant; one explicit fern spore progresses from.55stored mass toseedling18%(1day),27%(2days),growing39%(4days), localwater99→89 withpeak40/rain0. Old springtails die naturally from age/energy; overview becomes quiet producer world. Landscape1016×571panel/dock overlap fixed (bottom390vsdock514); tablet818×1178/phone389×841no horizontal overflow/visiblebuttons≥44px within zoom rounding/touch-action:none. Evidence `recovery-native-fern-day4.png`. A106/B812remain intact, no physicalSafari/smoothFPS claim.

Retain actual QA B at812(0plants/2springtails/queen-workers lost) and A at106(6plants/3workers/pupa), both owned disposable localhost snapshots. Overview must show different real conditions on phone/desktop; survivors are not declared dead, severe water/O2stress is not hidden by colony flavor, and recovery CTA opens existing nursery without a simulation step/resource grant. Perform a real propagule placement with visible count/cost and paused+1h continuation; preserve A/B and run tests/typecheck/build. No new test-only UI or dependency for this small presentational correction.

Native short-landscape finding before CSS repair:1016×571, new overview panel103.49→609.33and dock514.15→666.00,95pxoverlap. Bound all desktop panel heights using the existing view-relative limit and allow internal scroll, keep phone panels in normal scroll flow. Verify actual panel/dock separation, reachable recovery CTA/44px buttons and no horizontal overflow on landscape/tablet/phone after build.

## Springtail source/scale — before adaptation,2026-10-27

Native refinement before camera repair: actual4179springtail introduced through nursery, close observed on389×841.3×play from136to812retained individual#6, fungal feeding/rest/energy responses and additional springtail; measured native snapshots remain in-frame. Independent real solver/installed OrbitControls/source-bound replay found slower gain3camera trailed gain10body (up to126/180frames off-screen at3×); sharedgain10corrected it:0/720offscreen frames over1/3×portrait/desktop, worst boundNDC.5066. Native directmicro→pond→surface then exposed a second defect: micro pose had overwritten the normal surface return pose, producing a near1.7green close view with no subject. Before repair, preserve ordinary pre-micro surface pose for subsurface returns while restoring the normal near plane. Test direct micro→pond/nest→surface plus stop/next/new/load and literal keys. Do not change world stocks or invent collision avoidance; props remain presentation geometry.

- Preserve the downloaded1,580,443byte source/hash644e711f…028b254, exact museum/creator license metadata. Inspect actual topology/components, source/static status and proportions, then adapt only original geometry. Test three leg pairs/antennae, independent bounded state-driven gait/pause/grounding and no false jumps/eyes. Keep existing14production hashes unchanged; aim≤3,000tri/≤200KB/no textures/decoder for the new source.
- Verify normalized adult/juvenile envelope at0.022target/identity variation and independent28CSSpx targets. Simulation trajectories/materials/saves must remain exact. Close micro follow should frame the measured tiny body across desktop/portrait without near-plane loss, and restore normal/surface/pond/nest camera projection/controls afterward.
- Run tests/typecheck/build and independent read-only asset/camera review. Actual compiled game must show tiny organism selected/followed, walking/feeding only with simulation, paused poses, input/picking, native UI world replacement/storage and actual desktop/tablet/phone layouts. Do not retry the declined4181file transfer; create any needed organisms through actual nursery in the already authorized game. Record actual performance/HTTP signals and no physicalSafari claim. If the source proves unsuitable, retain working art and report why.

## Observable generations — before edits,2026-10-27

Result:173tests/typecheck/build, independent13+6focused tests/review pass after correcting proxy center and camera identity. Actual native pupa9.6→21.2→23.9h→pale worker#5(auto-follow) at122, thenegg#1→larva#1 across14+1hsteps; near-mesh28px selection, paused time and389×841layout verified. Measured transformed source center gap≤2.37px after correction. A/B106/136were explicit disposable localhost QA snapshots; no import workaround or native download. Full cohort-death camera handoff is source/test-reviewed but not separately played yet. Continue asset-first refinement.

- Baseline172checks/typecheck/build pass. Add a real funded pupal emergence assertion that transient source-cohort IDs identify all its offspring, never enter snapshots and do not alter source state/resources. Existing egg/larva/pupa thresholds and material/continuation checks must remain unchanged.
- Native current live colony at106has a real pupa: inspect its actual stage/age/food state, follow through actual+1h emergence into a pale worker, then keep individual following across nest/surface. Verify direct anatomy and minimum-pixel picking, pause, Escape/arrow controls, room/organism handoff and portrait layout. Native imports into the separate4181QAorigin were declined; do not retry or bypass that transfer. Preserve current world and user A/B. Run tests/typecheck/build and bounded independent review after changes.
- Current remains result:172checks/typecheck/build, independent24+9focused checks and480brood-death continuation steps pass. Native true-depth worker death, direct queen→corpse body tapping after removing front room proxies,100→60→13→complete decay by106and safe colony-panel return verified. Actual389×841layout has no overflow/undersized visible buttons and canvas touch-action:none. Native failure-file QA subsequently passed through file-free actual nursery/simulation/same-origin snapshot440: corpse-only503→literalRetry→200, unchanged paused world. The declined file transfer was never retried. Frame intervals from a hidden IAB can be throttled~1s and are not a gameplay/Safari benchmark.

## Autonomous continuation — written before edits,2026-10-26

Ant remains refinement plan (before edit): baseline167checks. Verify death material exactly once, true depth/source/form/body/count, old v3 migration unchanged, strict ant-only metadata validation, nonmutation and next-step continuation through decay. At record cap preserve pool stocks and discard misleading individual metadata on aggregation. Measure actual fallen source meshes/grounding/paused poses, same biological scale and shared geometry. Actual game must show selected/followed ant->corpse at the recorded depth, remaining material declining with local moisture/fungi and complete return to soil; corpse picking must not be swallowed by chamber targets. Legacy underground coordinates must not be guessed. Run tests/typecheck/build and native inspect before further expansion.

Safer native failure QA, before play2026-10-27: the4181file upload remains declined and must not be retried through any alternate transfer. A file-free alternative is to create a colony through the actual nursery on the disposable localhost failure server, play its real ecology until workers die, and save a native local snapshot. Reset only that QA server's one-shot failure and reopen its own stored world; corpse-only worker GLB must show Retry and recover to the original model. No files, user snapshot transfers, account, production asset rename or external transmission. If the naturally played world cannot supply this case in bounded play, record the incomplete native gate instead of forcing browser state.

Needs/food increment result:167tests/typecheck/build pass, independent30focused checks and7,920coupled steps pass. Native actual food-source map and day/night reproduction observed;159export matches complete World/next step from8. Preserved before/after full reports; no long-run stability claim. One native download call blocked~50min; avoid further download operations while other UI QA remains usable. Continue next scoped lifecycle/recycling increment.

- Baseline159checks. Record multi-seed meadow/mixed/woodland, cycle on/off and near/far/shore colony sites,480-960hour full ecology trajectories with no-ant controls. Track harvest/delivery/nursing/birth/death, accessible mature source biomass, stores/gut/carried food, worker task/time fractions and soil. Preserve pre-change report/checkpoints.
- Reproduce specific defects before correction: hungry worker with actual carried food, urgent queen versus larval care, full/dry/empty-food cases and bank navigation. Tests must prove actual transfers/material conservation, paid movement, immutability, distinct failed/supported scenarios and exact native save continuation. No free stocks or rate changes solely to force survival.
- After coherent edits run tests/typecheck/build, a bounded independent review for complex behavior changes, and actual compiled/private nursery->foraging->return->care->generation observation. Exercise pause/+1h/follow/orbit/room/pond and save/load with actual keys. Profile only changed rendering at stated actual host dimensions; physical iPad remains unverified.
- Repeat development after evidence is recorded. Update current progress/map; stop only for actual execution limits or full release criteria, preserving working code/user data.

## Ant contact correction — before implementation2026-10-26

- Reproduce actual granary adult/newborn coincidence. Test six fixed sorted-ID sweeps, physical chamber/tunnel/land/soil bounds,≤0.04correction, queen fixed, immutable inputs, resources/IDs/RNG unchanged and order-independent physical results. Offset departure pays actual travel before edge progress;≤0.14combined travel/contact/hour. Missing v3 offsets remain loadable; malformed/oversized offsets rejected and repeated snapshots continue exactly.
- Keep material-ledger/lifecycle tests and148current tests; preserve no-colony hashes and historical native prebirth files. Run tests/typecheck/build and actual prebirth→pale worker observation again, follow/tiny selection, transit/nursing/food use and paused poses. Record any changed colony timings honestly. Current native test already saw worker#5emerge/stay pale and nurse; it does not establish collision correctness.

## Approved ant colony — plan written before implementation; v3 approved2026-10-26

- First extract existing land navigation without changing zero-clearance behavior; all128checks/twelve contact hashes must stay exact. Then introduce optional in-memory colony and explicit-null v3 envelope; old worlds gain no ants. Refine ant ontogeny to larval growth→pupa→fixed-size teneral/adult, with transport-funded nursing. Record primary sources and model limitations before claiming scientific validity.

- Inspect/adapt actual CC0 ant source anatomy, all relevant rig poses, foot contact, body dimensions excluding antennae, material/animation cost and exact licensing. Render local GLB candidates before selecting; preserve source bytes and current nine shipped assets. Embedded blend scripts remain disabled.
- After approval only: strict bounded v3 graph/actor/cohort validation and v1/v2 migration with no automatic colony, monotonic identity, no A/B key loss, native portable roundtrip and exact future continuation. Invalid graph/stock/location references fail safely.
- Deterministic colony material invariant through every transfer; collecting/depositing cannot duplicate biomass, and remains export/decomposition cannot double-count. Brood must be funded, time/nursing-limited and release juveniles; starvation/heat/drying and long food trips can defeat a colony. Test zero/low resources and caps, queen/worker death and removal; retain current ecological checks.
- Tests/typecheck/build plus independent review. Actual compiled/private play must show seed collection, carried material, route/chamber travel, food use and brood growth, individual selection/follow and surface/soil camera transitions, pause, saves and tablet/phone controls. Profile actual capacity; do not claim physical Safari validation. No simulated scientific precision or full ant biology.

## Woodlouse contact — before implementation,2026-10-26

- Retain actual before histories/screenshots and quantify close overlap in woodland2217. Test coincident and mixed-mass pairs, crowded four actors, courtship allowance, bank/island boundaries, bounded correction, identity/order determinism and source immutability. Only positions may change in the isolated contact pass; assert every material/energy/age/life/ID field and seed remains identical.
- Simulated food access/pairing/funded brood/juvenile→adult/death remain possible, with no unexplained material grant. Preserve old trajectory fixtures and record intentional new ones only after meaningful relational tests pass. Exercise repeated native-save continuation and food-poor/dry cases; keep all124existing tests except explicitly changed historical trajectory expectations.
- Tests/typecheck/build plus independent review. Actual compiled mother/child at the same litter patch must separate while still feeding and following, pause and native restore work, art/hit targets unchanged. Check renderer cost, final1024/820/390UI and exact compiled/private responses, no physical Safari claim. Continue the master loop after validation.

## Imported woodlouse — before adaptation,2026-10-26

- Record the exact public AR source, linked creator/license, original bytes and static/no-rig status. Inspect original components/anatomy before reducing detail. Keep existing nine production files byte-identical. Added gait must move original leg geometry and remain bounded/contact-safe; idle/pause must not continue walking.
- Measure body/appendage dimensions with the actual Three loader/production normalizer at newborn/adult mass and all animated poses. Preserve existing growth/position/selection/feeding/brood behavior and ecology trajectories. Independent materials/animation, shared immutable geometry; no dependency or persistent-format extension.
- Run tests/typecheck/build and actual compiled world observation: adult/juvenile, resting/walking/feeding, pause/follow/picking, brood cue and asset-failure fallback. Inspect compatible palette with existing vegetation/fauna, anatomy/ground contact and measured renderer cost. Verify exact private asset/credits responses and runtime errors. Physical Safari remains pending. Obtain independent review for rig/animation integration if it requires a complex custom adapter.

Result:124tests/typecheck/build passed, independent2asset tests/review passed after correcting jaw-side grouping. Actual compiled source anatomy/rest/feed, native live mother→juvenile→adult and lineage handoff, imported prebirth→live birth, byte-identical settled pause crops and missing-asset fallback observed. Original QA GLB restored/hash-checked; model/credits/private requests200. Brood state/pouch cue remains; shared litter-center overlap is a separately recorded next defect, not claimed fixed by the artwork. Capacity281draws/86,295tri/225geometries; host timings are not physical-device proof.

## Native touch ownership correction — before edit,2026-10-26

- Retain actual before signal: computed canvas touchAction auto after compiled world replacement; installed OrbitControls.dispose resets inline style. Check authoritative canvas-only none after initial load, replacement, pond/surface swaps and responsive layouts, while document/UI scroll remains possible. Check44px button width/height at1024/820/390, real scroll/open/time/follow controls and no horizontal overflow or overlapping controls. Exercise real drag, wheel and literal arrow events; no simulated pinch or physical Safari claim. Run tests/typecheck/build after the coherent asset/control changes.

- Phone follow: before edit actual selected woodlouse canvas top-233.8/bottom120.7 at390×844. After effect reuse, normal follow and next/offspring handoffs must settle with the whole canvas visible, retain selected identity, paused time and independent geometry. Manual document scrolling must remain usable. Do not mistake a smooth-scroll transition for its settled result.

Result: actual compiled390/820 layouts have no undersized visible buttons and no horizontal overflow; canvas computed none survives world replacement and pond/surface swaps, surrounding body overflow remains visible. Native follow/Enter-next on390settles atscrollY0 with canvas75→429.5px, full paused scene visible. Physical Safari remains unverified. Final1024layout/key smoke and runtime check continue with the next increment.

## Close plant observation — written before implementation,2026-10-26

- Test camera framing against actual imported lily/reed/tree/flower bounds at small/full growth, portrait/landscape aspects and seeds, without changing simulation input or picking dimensions. Use separate plant/animal identities.
- Keep native controls/probe priority and all120 current tests; run tests/typecheck/build. Actual browser: select plant, literal Enter Look closer/Return, orbit/zoom, switch to animal follow and back, remove/focus/death cleanup, resize and enter/return pond. Check fitted canopy and small flowers, same immutable world/paused clock, layouts/runtime errors and exact private requests. No physical Safari claim.

Result:122tests/typecheck/build pass, focused projection tests and independent review passed. Actual compiled focus/return/orbit/wheel, plant removal/death cleanup, animal handoff, responsive frames/phone scrolling and44px controls verified. Native keyboard checks discovered a real key-listener disposal race; repaired after installed-source inspection, then measured actual surface/focused/submerged key-pan targets. See progress/artifacts for exact observations and limits. No save or ecological change in this camera increment.

## Recruitment correction — written before implementation,2026-10-26

- Retain the actual before-change32-case recruitment report. Compare new nursery seedlings through a full first night under suitable conditions and resource deprivation; no free biomass, no dark uptake/growth, positive turnover/material transfer. Check original source immutability and deterministic restore continuation.
- Preserve mature/growing fluxes and constant-mode trajectory evidence; if recruited-offspring paths intentionally differ, record which and why instead of silently overwriting historical hashes. Exercise at least clover/fern/moss/lily/reed plus existing tree/grass/bloom over multiple days. No success claim from a single favorable seed.
- Run full tests/typecheck/build and real compiled nursery introduction→growth/decline, inspect stage/flower gating, pond inputs, pause and native orbit/underwater. Continue the development loop; this does not establish long-run stable biodiversity.

Result:120tests/typecheck/build passed; independent review found no confirmed model/asset defect.24seeded guild cases establish, deprivation still kills, dark turnover pays from existing mass and light0 blocks all producers.10,800community steps passed bounds/repeated restore continuation. Actual native nursery seedling→first night→mature flower observed in the compiled game, plus literal stress controls and underwater rooted stems. Historical hashes preserved, twelve explicit corrected trajectories pass. Details/evidence in progress. Close plant observation is the next active increment.

## Aquatic asset refinement — written before implementation,2026-10-26

- Inspect source GLB mesh/material/bounds/triangle metadata and included license; record rejected as well as selected candidates. Preserve source bytes. Inspect installed Blender APIs before using import/export operators. Keep existing seven models byte-identical.
- Measure adapted asset with the installed Three loader and production normalizer: expected envelope, water anchor at minimum/maximum growth, pads retained before flowering, underside visibility, local health materials and shared immutable geometry. Test actual source parts, not a replacement primitive or guessed bounds.
- Run tests/typecheck/build. Inspect surface/underwater renders in the compiled game, seedling/mature/declining transitions, picking, pause and real placement. Verify asset/credits HTTP200 and no runtime errors, capacity renderer cost and tablet layout. No physical Safari claim; continue the master development loop after verification.

## Portable experiments — written before implementation,2026-10-25

- Test valid native File/Blob text roundtrip and next-step identity for rich v2 lifecycle/photoperiod state and compatible v1. Reject malformed/unsupported/oversized files; check size before reading. Keep109 existing checks and A/B keys/envelope unchanged.
- Reason through readA/readB/close/apply ordering: only latest validated preview may apply, closing cancels its epoch, and apply can call onLoad once. No implicit load on file selection. Export validates through the same parser before native download; failure leaves live world intact.
- Run tests/typecheck/build, inspect actual download bytes and reopen through the real file chooser, preview/explicit apply/literal Enter/Escape, invalid/oversized/cancel paths, current world/time and A/B preservation. Use only disposable localhost QA inputs/snapshots. Check actual tablet/phone UI and runtime errors, built/private requests. Continue development after these pass.

Result2026-10-26:113tests/typecheck/build pass. Native download bytes equal the source wetland world and next step; actual file chooser/preview/Enter, invalid/oversized rejection, Keep/Escape, same-file reselection and legacy constant-mode restore passed without A/B changes. Desktop/tablet/phone previews inspected, controls≥44px/no horizontal overflow; no final runtime errors. Compiled/private exact requests200. Physical Safari remains pending; see progress/evidence.

## Submerged pond observation — written before implementation,2026-10-25

- Pure camera tests: finite constrained eye/target, bed/ceiling/circular bank bounds, no camera-body overlap, minimum safe distance at all headings/edge targets, no change to input positions. Exercise pan/zoom/resize and surface-pose restoration. Retain106 simulation/asset/scale tests unchanged.
- Inspect installed OrbitControls types/source before using its methods. Keep mode out of saves/solver; test only aquatic picking/culling and no hidden land-target interception. Return safely from drying, new world and restore. Check control lifecycle and original fov/near/pose recovery.
- Run tests/typecheck/build, then independent read-only review for this camera integration. Use actual compiled UI to enter a real underwater camera, orbit/pan/zoom, inspect/follow native fish/fleas, observe a meal/rest, return to the prior surface view, pause and use literal keyboard events. Verify errors, exact compiled/private requests, actual1024×768/820×1180/390×844 layouts and host renderer samples; no physical Safari claim.
- Preserve original private world/A/B snapshots. Only disposable localhost QA worlds may be replaced. Log actual evidence and limitations, fix concrete findings, then continue the development loop.
- For a real dry-exit check without waiting hours or injecting browser state, extend the existing opt-in capacity fixture with `?profile=1&stress=1&dry=1`: water8.05/oxygen6.44, paused. One actual simulation step should cross the exploration threshold; ordinary play must never use it.

Result:109tests/typecheck/build pass. Independent3camera tests/25,000seeded cases passed; findings fixed. Actual UI covered native fish/flea, feeding, night rest, literal keys/orbit/wheel, empty QA save/reload, new/restore, and one-step dry return with near.1/fov38/no follow. Panned surface return matched reported pose and a byte-identical600×350world crop. Portrait/landscape/phone checked with real DOM dimensions and44px return control. Full island fits after rotating underwater then returning. Compiled/private HTTP200 and actual private inputs/rendering verified after repairing a real missing5173listener/502. See latest progress/artifacts; physical Safari remains unverified.

## Aquatic body-clearance verification — written before correction, 2026-10-25

- Keep existing center-only save acceptance, resource stocks and body scale. Reject new fish/flea placement that crosses their conservative physics hull; aquatic plants retain the original domain. Test nonfinite inputs.
- At multiple headings and both activity schedules, verify swimming, prey flight, predation and birth cannot put the hull outside water. Legacy shore positions must recover on the next step without a boundary-specific stock/energy/ID grant; sources remain immutable and saves continue deterministically.
- Measure the shipped native animated fish geometry at the maximum adult identity scale and rotation, not a guessed point body. Assert its full horizontal bounds fit inside the physics clearance and pond opening. Preserve the pre-change terrestrial trajectory hashes; report any deliberate aquatic trajectory changes explicitly.
- Run tests/typecheck/build, inspect real compiled aquatic placement/follow/movement/rest, exact HTTP files and browser errors. No new dependency/schema; no physical Safari claim. This narrow collision correction does not require another complex-system review; the earlier independent photoperiod follow-up already hit its actual usage limit.

### Aquatic correction result — latest checkpoint

106 tests/typecheck/build pass. Native animated fish measured across720 pose/headings at maximum adult variation clears the whole bank. Placement/rest/recovery/flight/hunt/funded-birth bounds and unchanged nose contact range are tested. Nine terrestrial baseline hashes remain exact; wetland futures intentionally change after fixing center-only collision. Original hashes are retained. Additional4,320 wetland steps passed full-body/resource/energy/O₂/caps and repeated save continuation; some eventual extinctions remain. Real compiled UI rejected a shore tap, accepted a deeper fish/flea, followed fish reserve58→70 with prey removal, rotated/orbited, and showed night rest at20:00. No final compiled/private errors; final page/JS/CSS/private pond modules/fish returned200. No private world or A/B replacement. See `PROGRESS.md` for exact artifacts/build sizes and unfinished gates.

## Photoperiod verification — written before implementation, 2026-10-25

- Preserve89 baseline tests and exact constant-mode snapshots. Test optional v2 climate boolean validation, missing-field/v1 migration, enabled/disabled deterministic continuation and unchanged A/B keys. No automatic conversion of legacy worlds.
- Test one24-hour solar period, exact discrete daily integral, sunrise/noon/sunset/night and bounded lagged temperature without setpoint drift. Verify current inspection uses the same forcing as the next solver step.
- Isolate established producers: no nighttime biomass creation/root uptake, explicit gross daylight uptake and turnover; no free stock from switching modes. Verify low nutrients/water cap growth and midnight algae stop photosynthesis while oxygen costs continue. Test developmental growth and age continue.
- Test diurnal/nocturnal movement/feeding/rest differences, ongoing energy costs, emergency hunger/threat/hydration overrides, resting beetle/fish cannot capture, and woodlouse digestion/brood progression while resting. Run multiple seeds/habitats over repeated days with finite/nonnegative stock, caps, navigation and snapshot continuation checks.
- Run tests/typecheck/build, obtain independent review, fix findings. In the compiled/private browser use real cycle toggle, literal Enter/Escape/range keys, observe actual day/night light and needs/feeding, pause the scene, and inspect landscape/portrait layouts. Save/reload only an explicitly empty isolated test origin. Check actual compiled/private requests and maximum-capacity renderer cost; keep physical-device limitations explicit.

### Photoperiod result — before the aquatic correction

101 tests, typecheck/build pass. Twelve pre-change constant trajectories match exactly. An additional17,280 fixed steps across12 communities passed bounds and repeated snapshot continuation; some extinctions remain a balance limitation. Actual compiled UI showed woodland2217 mating/brood/birth and a selectable0.055-body juvenile with maternal link, plus literal cycle Enter, warmth arrow keys, Escape, pause and isolated A/B save/reload/restore. Latest tablet/portrait/phone dimensions were measured from DOM; clock/help overlap and night hover contrast were fixed and visually rechecked. Two settled paused night-capacity PNGs matched (84,209bytes). Capacity:315draws/66,692triangles/268geometries, host samples6.1/6.9ms and6.4/8.9ms mean/p95 at1280×720. Final compiled JS/CSS/credits and private page/solver-lighting modules/fish returned200; no final browser errors/warnings. Main independent review completed and its findings were fixed; final rest-cost follow-up hit reviewer usage limits and is not claimed as independently completed. Private New world replacement was rejected by automatic approval review; cancelled it and inspected the existing world, preserving snapshots. Physical Safari remains unverified. Details and limitations are in `PROGRESS.md`.

### Asset-first result — previous checkpoint

89 tests, typecheck/build, independent review and actual compiled/private play completed. Critical review findings were corrected; old/new native and fallback assets were rendered, real beetle/fish feeding and projected selection observed, keyboard pan/follow recovery and Escape exercised. A real missing-file test retained the old interactive beetle; production file restored and hash checked. Separate paused PNG captures matched byte-for-byte. Actual landscape/portrait tablet views and private phone view were inspected; all seven compiled models/credits and private route returned HTTP200. Capacity: 315 draws/66,692 triangles/268 geometries, 8.6/10.7ms mean/p95 host interval at1280×720. No physical Safari/native-touch claim; finite-body shoreline clipping and remaining authored organisms are open. The phone observation-gap correction was visually rechecked and the final89-test/typecheck/build passed; final compiled JS/CSS requests returned200. `PROGRESS.md` has current evidence/limits.

## Asset-first integration verification — 2026-10-25, written before edits

- Audit actual GLB nodes, bounds, clips, material/texture cost and source permissions. Export adapted self-contained GLBs with a reproducible Python script and recorded hashes. Compare original/adapted in real lighting; reject inferior anatomy or broken clips. No new dependency or persisted schema.
- Add targeted tests of shipped GLB metadata/scale envelopes and independent rig/clip behavior with installed Three.js. Retain all 83 ecological/save/scale checks; test screen-space hit math at multiple view sizes without modifying ecological ranges.
- Run tests, typecheck and production build. Request an independent read-only review of loader/mixer lifecycle, disposal, scaling and picking; fix concrete findings.
- Play compiled game: place/inspect/follow hunter and fish, movement/meal/rest/pause transitions, juvenile size, panning/orbit/close zoom, private route, actual asset HTTP and failed-file fallback. Do not overwrite user snapshots. Inspect 1280×720, 1024×768 and 820×1180, runtime errors and maximum-capacity draw/triangle/frame measurements. Physical iPad Safari remains a separate pending gate.

Written before implementation, following `/verify`.

## Automated

- Run `npm run typecheck` and `npm run build` after edits.
- Run `npm test` against the pure simulation module. Check determinism, resource interventions, moisture and light response, decomposition, and creature grazing.

## Browser play check

- Start Vite and open the actual page. Confirm the 3D world and UI appear without console errors.
- Drag the terrarium and zoom it with browser input. At tablet width, test touch-style pointer interaction where available.
- Pause and verify the day/time label stays fixed; resume at 3× and verify it advances faster.
- Add water and compost; inspect the displayed stocks and wait for plants/creatures to change. Change sunlight and verify plant health response after simulation steps.
- Check desktop, 1024×768, and narrow mobile layout for clipping, horizontal overflow, and reachable controls.
- Inspect the actual image for art direction and readability. Fix visible defects, then rerun affected checks.

## Performance signal

- During normal play and orbit, inspect browser errors and gross rendering responsiveness. Keep geometry and materials small and reuse them where practical. Avoid continuous React updates at render-frame frequency.

## Known model limit to disclose

The model is deliberately coarse. It tracks a few stocks and organisms in arbitrary units, not calibrated species or validated environmental predictions.

## Tailnet access check

Before changing the Vite host setting, verify the installed Vite type/source supports `server.allowedHosts`. After the change, run tests, typecheck, and build. Request the exact Tailscale HTTPS URL and a served source asset through the tailnet route; both must return successfully. Finally, open the page in a browser and confirm the game renders without console errors. Keep the existing Tailscale Serve routes unchanged.

## Milestone 2 verification plan

Written before implementation, following `/verify`.

- Record the baseline ten-day headless trajectory, then compare food-rich and food-poor trajectories after the change. Expect the population to respond rather than remain fixed with saturated energy.
- Add focused tests for birth thresholds and costs, starvation, seeded determinism, and no regression in water/compost/plant effects. Assert useful fluxes where the existing stocks permit it; do not claim a closed carbon budget.
- Run `npm test`, `npm run typecheck`, and `npm run build` after edits.
- Open the actual page and inspect an initial and progressed scene. Use the time control, water/compost actions, orbit, and plant inspection. Confirm visible creature count and feeding cues match state, with no console errors.
- Check desktop and 1024×768 layout. Compare responsiveness during orbit and 3× play with the prior browser pass; report any performance caveat rather than inventing an FPS measurement.

## Milestone 3 verification plan

Written before implementation, following `/verify`.

- First verify the existing eight tests and record baseline trajectories for drought, shade, compost, and long-run grazer counts.
- After approved state changes, test deterministic seed/action replay; patch-summary consistency; nonnegative patch stocks; plant species rank changes across wet shade versus dry sun; local competition; fungal substrate dependence and decline; and existing grazer behavior.
- Run `npm test`, `npm run typecheck`, and `npm run build` after every coherent editing pass and at the end.
- Open the actual game in a browser. Inspect a fresh and progressed world, change light/water/compost using real controls, orbit and select organisms, and confirm moss/mushrooms correspond to simulation values. Check desktop, 1024×768, and narrow phone layouts plus console errors.
- Profile simulation-step time and browser rendering signals before making performance optimizations. Keep the visual and ecological scope within what can be verified on this machine; real iPad Safari FPS remains a separate device check.

## Milestone 4 verification plan

Written before implementation, following `/verify`.

- Add a pure test that selects one patch for water/compost, asserts other patches stay unchanged, and checks derived world summaries. Retain the full deterministic ecology suite.
- Run `npm test`, `npm run typecheck`, and `npm run build` after the increment.
- In the live browser, tap bare soil, observe its focus values, add a local input, inspect moss and a grazer, clear focus, and verify an unfocused whole-world input. Drag to orbit and verify it does not select a patch.
- Inspect desktop and tablet screenshots, horizontal layout, and console errors. Real iPad Safari input and frame time remain an external device check.

## Milestone 5 verification plan

Written before implementation, following `/verify`.

- Test imports/exports of organisms as explicit player interventions: valid placement, spacing/pond/edge/cap rejection, unchanged input objects, unique IDs, and subsequent ecological response.
- Test a grazer navigating around the pond toward food and repeated seeded runs remaining deterministic and within land bounds.
- Run all simulation tests, TypeScript checking, and a production build.
- Play the nursery flow in the actual browser: choose a species, tap ground, see it appear, return to inspect it, remove it, and test an invalid placement. Check that orbit drag creates nothing.
- Inspect desktop, 820×1180 tablet, and 390×844 phone layouts; inspect overflow and console errors. Request the exact private Tailscale URL and served source after final edits.
- Obtain one independent review of the final simulation/UI changes per `/verify`; resolve material findings before reporting completion of the increment.

## Milestone 6 verification plan

Written before implementation, following `/verify`.

- Add snapshot serialization/validation tests, including deterministic continuation and malformed/unsupported inputs. Check that one slot's state cannot mutate the other through a loaded run.
- Run the full test suite, typecheck, and production build.
- In a live browser, pause, save A, alter life/resources, save B, restore A, then reload and inspect both cards. Open/close with actual buttons and a literal Escape key. Verify restored population changes do not emit death/birth notices.
- Inspect the native dialog at 820×1180 and 390×844; check reachable controls, overflow, and console errors. Verify the exact private Tailscale route still serves the final client.
- Record storage and device limitations honestly; do not claim iPad Safari performance from a desktop viewport check.

## Milestone 7 verification plan

Written before implementation, following `/verify`.

- Test stressed extinction with local litter return, seeded establishment under suitable conditions, and parent-to-offspring biomass conservation against an otherwise equal non-recruiting step.
- Re-run determinism, local stocks, grazer dynamics, placement/navigation, save validation, and snapshot-continuation checks with changing plant populations.
- Run tests, typecheck, and build; inspect a live progressed world at 3× and verify plant count/notes. Restore a saved branch to confirm that resets do not masquerade as ecological events.
- Check final scene/control layout and browser errors; record a host simulation benchmark and keep real-device Safari performance as a remaining gate.

## Recorded result — 2026-10-24

Milestones 3–7 are implemented. Final tests passed 26/26; typecheck and production build passed. Actual dev and production-preview browser checks passed, including local tending, nursery, orbit/zoom, native snapshots, reload persistence, Escape/focus, extinction/recovery, and selection clearing on death. Screens inspected at desktop, tablet portrait/landscape, and phone dimensions. The exact Tailscale page/source returned 200 and the HTTPS game rendered without console errors. Independent review findings were fixed. See `PROGRESS.md` for the benchmark and remaining real iPad Safari/scientific/release gates; no release-candidate claim is made.

## Milestone 8 verification plan

Written before implementation, following `/verify`; baseline 26 tests passed before edits.

- Verify the woodlouse's litter-only diet and local nutrient/fecal partition against a no-animal control, movement to moist food, starvation/desiccation, birth reserve/body costs, role-specific caps, and deterministic mixed populations. Keep all existing grazer/plant tests.
- Test missing-kind migration to grazer, rejection of unknown/coerced animal kinds and over-cap populations, and mixed-species snapshot continuation. No saved world receives default new species on load.
- Run tests and typecheck, then production build. Request one independent code review after the coherent increment and resolve concrete findings.
- In the actual browser, inspect both animal forms, place/remove a woodlouse, add local litter/water, observe a progressed scene, restore the existing legacy snapshots, and check native experiment counts. Inspect tablet/phone layouts and errors.
- Use an opt-in renderer probe to record actual draw calls, triangle count, mean/p95 frame time at a stated host viewport. Optimize only a measured bottleneck, then remeasure. Record that this is host browser evidence, not iPad Safari evidence.

### Measured rendering follow-up

At 1280×720, the mixed initial world reports 263 draw calls, 263 geometries, 11,786 triangles and approximately 6.2–6.6 ms mean host frame time. Static grass uses 54 separate cone meshes. Instance those identical cones with per-instance color/transform to reduce call/geometry overhead for future biodiversity growth; compare the same paused state before/after and verify the grass appearance and terrain picking remain correct. This is a draw-call/memory change, with no promised Safari FPS gain.

Also measure the existing capacity envelope with an isolated `?profile=1&stress=1` fixture: populate through the real placement functions to 32 plants, 7 grazers, and 4 woodlice, start paused, and inspect measured renderer cost. Normal games and saves do not enter this fixture. Keep it small and reusable for later biodiversity capacity checks.

### Milestone 8 result

Final 35 tests, typecheck, and production build passed. Live dev/production checks covered the new animal, litter/tending, role counts, legacy/mixed snapshots, persistence, and tablet/phone layout; no console errors were observed. Independent review's transform-ownership issue was fixed. Static grass reduced the same-state reported calls/geometries 263 → 210 with unchanged triangles. Maximum-capacity host fixture reported 496 calls and ~6.4 ms mean frame time. Exact Tailscale page/source returned 200. See `PROGRESS.md` for measured conditions, corrected population observations, screenshots, and the still-pending physical iPad gate.

## Milestone 9 verification plan

Written before implementation, following `/verify`. Baseline 35 tests passed.

- Baseline control: seeds 17/183/2217, six grazers, water added below mean 45, compost every 72 ticks, 360 steps. Final producer biomass 9.96/9.87/9.85, consumed biomass 121.88/121.09/122.28, seven grazers/four woodlice. Compare unchanged controls with one/two introduced beetles under the same interventions.
- Focused pure tests: hungry pursuit/contact, finite detection, resting, prey flight and stopped feeding, predation-versus-energy death ordering, no double consumption or posthumous births, body partition/newborn reserve costs, empty-food starvation, per-role caps, nonnegative stocks, and seeded events.
- Retain the old World-only step API and all producer/detritivore checks. Test old/new snapshot continuation and absence of persisted transient events.
- Run tests and typecheck, then production build. Request one independent review of simulation/event flow and UI integration; fix concrete findings.
- Play the real game: introduce/inspect a beetle; see prey react and a real capture note/morsel; pause/resume; save/load without false events. Inspect seven-option nursery and native snapshots at desktop, tablet portrait/landscape, and phone widths.
- Measure the updated maximum fixture and check console errors. Verify the compiled client and exact private Tailscale route. Physical Safari samples remain pending; do not infer them from host results.

## Milestone 10 verification plan

Written before the model refresh, following `/verify`, in response to the user's explicit request. Milestone 9's pure ecology tests pass 44/44; its browser validation continues alongside this visual increment.

- Capture the same paused initial/capacity worlds before/after. Verify clover/fern/bloom/moss and both prior animal silhouettes, ground contact, selection hit areas, real growth/decline, and moving/feeding cues.
- Read actual source-pack licensing and record curated file provenance. Inspect local model geometry/material structure, bounds, and file sizes; use installed loaders, no new dependency. Exercise the fallback on an actual failed local asset request where assets are used.
- Run all tests, typecheck, and production build after source edits. Check actual production assets over HTTP, plus live gameplay/save compatibility.
- Inspect 1280×720, 1024×768, 820×1180, and 390×844 views. Seven nursery options and dialog controls must remain reachable with no horizontal page overflow.
- Profile the final capacity fixture, orbit and run at 3×, inspect console errors, and record host results separately from the pending physical iPad check. Independent review was requested for M9 but hit an actual reviewer quota; record that limitation rather than claiming a review passed.

### Player visual correction

Before finalizing M10, compare flowers/grass beside the unchanged fern in the actual terrarium. Check rounded petals, arching blades, palette, height, and detail at normal game zoom. Remove rejected flower assets from production/provenance, rerun gates, and remeasure the capacity scene. The earlier asset-flower screenshots are intermediate evidence, not final visual acceptance.

## Milestones 9–10 recorded result

Working implementation: 44 tests, typecheck, and final production build passed; 50,000 additional seeded mixed-web steps passed bounds/caps/stocks/material/snapshot checks. Controlled comparisons and scientific boundaries are in `ECOLOGY.md`. Actual dev/private/compiled scenes, predator feedback, snapshot persistence/restore, literal Escape, responsive layouts, a missing-asset fallback, and exact HTTP responses were checked. Final compiled capacity sample: 326 draws, 45,802 triangles, ~6.1/6.3 ms mean/p95 host frame interval at 1280×720. The rejected cups/cones are replaced by rounded flowers/curved blades in the fern's visual language. See `PROGRESS.md` and `ART_DIRECTION.md`.

Not a completed release gate: independent review was attempted but the reviewer hit an actual usage quota. Physical iPad Safari remains unverified. No claim of an exact capture-frame mouth screenshot, GPU-duration timing, complete material conservation, or release-candidate completion is made.

## Milestone 11 verification plan

Written before implementation using `/verify`. Baseline on the resumed run: 44/44 tests passed; the existing private game was visually inspected at 1280×720.

- Test deterministic starters across seeds, placement/land/cap constraints, patch-summary equality, object isolation, unchanged mixed default, unchanged snapshot envelope, and identical snapshot continuation.
- Compare identical plant communities under shaded/damp versus sunny/moderate conditions. Confirm functional-group rank changes rather than a named-habitat bonus. Record multi-seed starter trajectories with an explicit tending schedule and model limits.
- Compare plant-inspection outlook to the solver's actual no-consumer, one-plant change; test moisture/light/nutrient constraints. Retain the existing ecology/event/material/save suite.
- Run tests, typecheck, and production build after coherent edits. Independent read-only review of the previous predator/art systems is underway; request review of the final increment and resolve concrete defects.
- Play the actual compiled UI: open a start dialog, choose a card, cancel/Escape, verify no reset, then explicitly begin. Check pause, selection/tool/event clearing, changed community/conditions, and preserved snapshot cards. Use literal keys for Escape and range-control behavior. Test real planting, tending, inspection, and 3× progression.
- Inspect 1280×720, 1024×768, 820×1180, and 390×844 layouts including dialog reachability/overflow, console errors, and profile the heaviest starter plus existing capacity fixture. Verify final page and client through the exact existing Tailscale route; do not alter Serve routes. Record host-browser results separately from physical Safari.

### M11 verification so far

49 tests/typecheck/build passed. 60,000 additional starter steps passed stock/land/cap/save checks. Independent review completed, identified stale animal transforms across whole-world replacement, and confirmed the UI-revision fix. Actual compiled browser checked cancel/Escape/focus, Keep-first ordering, shaded/sunny starts, diagnosis, literal range arrows, saved A/B persistence and paused restore, local tending, nursery validation/placement, orbit and 3× progression. All planned responsive sizes inspected; no errors/overflow. `PROGRESS.md` records exact samples. Final capacity sample and final post-polish build remain to be recorded at the end of this pass; physical Safari is still pending.

## Milestone 12 verification plan

Written before implementation using `/verify`.

- Keep all 49 baseline checks. Assert exact compatibility of old water/compost actions, one/four pocket targeting, nonmutation, derived means, and receipt accounting (retained water + overflow equals imported water; organic/nutrients exactly match imports). Invalid recipes/targets change nothing.
- Run controlled organic-versus-mineral trajectories with and without detritivores, testing real substrate processing/direct nutrient effects rather than UI labels. Verify snapshot continuation and deterministic repeated recipes.
- Run tests, typecheck, production build; independent review of transfers, validation and dialog/UI state.
- In the compiled game use real controls: open/close/Escape, choose recipes, literal Arrow/Home/End for amount sliders, check zero-dose disabled action, add a local blend, see patch values and receipt, then check quick inputs and untargeted pocket. Inspect responsive dialog/control layout at all four sizes, errors, final paused capacity profile, and actual private HTTP source.

## Final resumed-pass result — M11–12

Implemented and independently reviewed. 56/56 tests, typecheck and production build passed after source edits; no final runtime errors observed. Compiled browser exercised starting/cancelling habitats, correct modal focus/order, snapshots/reload/paused restore, environmental inspection, local tending/nursery/orbit/3×, mixture recipes, literal range keys, disabled empty input, actual local/global stocks and saturated-water receipts. All planned layout sizes were inspected across the pass; final private panel's actual1144×690 dimensions are recorded separately. Final capacity profile at1280×720 CSS /1600×900 canvas reported326 draws,45,802 triangles,247 geometries,7.7/8.8ms mean/p95 host interval. Exact private/compiled requests returned200. `PROGRESS.md` records detailed evidence/artifacts and limitations. Physical iPad Safari and the full release-candidate criteria remain open; no complete material/chemistry/biome claim is made.

## Sustained full-game pass — verification written before implementation

- Baseline56 tests. M13 checks: no-tree trajectories unchanged; canopy sunlight decreases with actual tree biomass/distance and improves shade-specialist performance while reducing sunny competitors; shade conserves existing soil water; tree/grass recruitment/death/caps; springtail fungal-only diet, partition, dryness/starvation, material/reserve birth costs, prey capture, deterministic mixed worlds and legacy snapshots. Record multi-seed long runs.
- M14 checks: scenario goals derive from actual world/events; progress cannot complete from clock alone; checkpoint/completion ordering and reset/restore behavior; bounded journal only records real events. Play onboarding, a fieldwork task, guide→nursery→placement→inspection, cancellation and sandbox continuation. Validate seed and bare-ground creation.
- M15 checks: actual file export and validated import/preview/load; malformed/oversized/unsupported files preserve world/slots; restored branch continues deterministically. Dispatch literal keys for form/range/dialog behavior. Test native file UI and failure handling through available browser tools.
- At each coherent checkpoint run tests/typecheck/build and inspect a real render before extending. Obtain independent code review; fix findings. At the end inspect compiled/private game at desktop, tablet landscape/portrait and phone; exercise orbit/zoom/3×, all dialogs, placement/removal, actual ecological responses and file/snapshot workflows. Profile the updated capacity fixture, inspect errors, and request the exact existing private route. Report physical Safari and any unapproved persistent-model work as still open.

Approved v2 extension checks: strict climate/pond/age/stage/material-reserve validation, v1 migration without unsolicited organisms, v2 continuation, aquatic/land placement and navigation, algal food dependence, oxygen depletion/recovery, temperature/rain effects, juvenile maturation/birth gating, fish retained-body accounting and starvation/death returns. Compare oxygen under high organic load with a clean control and high-nutrient algae with a low-nutrient control. Long seeded mixed runs must keep all stocks finite/nonnegative, oxygen within water capacity, and both habitat domains valid. Inspect actual pond plants/animals, climate controls and snapshot workflows in the browser before calling them verified.

Living-organism plan (before implementation): test development under identical wet/dry conditions, seeded/established migration, plant maturation/recruitment/senescence, real mate contact and courtship, no unpaired brood, gestation/body/reserve costs, juvenile growth from fungal/litter food, moisture-seeking/resting, brood/corpse mass on parent death, gradual decay to the correct habitat stock, caps/IDs/save continuation. Inspect actual seed/sprout/young/adult/brood/death forms and follow camera on the live compiled game. Independently review new material reservoirs and lifecycle ordering.
# Scale pass verification — 2026-10-25

Written before scale implementation using `/verify`. Capture the current paused mixed/forest/pond scenes. Measure installed authored geometry bounds and establish a dimension table. Test presentation scales across species, maturity and mass, finite/bounded variation, and preserve pure simulation behavior. Finish the pending digestion/lifecycle conservation checks. Run full tests, typecheck, build; independently review lifecycle/scale integration. Play the actual compiled game: select small animals/propagules, observe juvenile growth and feeding, follow an individual, inspect a forest canopy and wetland, orbit/zoom, test time and save continuation. Inspect desktop and tablet portrait/landscape, check overflow/errors and compare measured maximum-capacity renderer cost. Report host measurements separately from physical iPad Safari, which is unavailable here.
# Living organisms / Scale Bible result — 2026-10-25

83 tests, typecheck and production build pass. Additional24,000 multi-seed steps passed bounds and deterministic snapshot continuation. Independent read-only review identified four concrete lifecycle/scale defects, all corrected with targeted tests or actual rendering checks. Actual compiled and private clients were played: forest/pond/maximum fixture, small animal picking, individual/offspring follow, real brooding/juvenile identity, original-slot preservation, isolated v2 save/reload/restore, literal End/Escape, orbit/time and tablet orientations. Host capacity413draws/45,592triangles/344geometries; stable1024×768 sample8.2/10.7ms mean/p95. Physical iPad Safari, complete game/release gates, and cross-device storage remain unverified/unfinished. Current details and artifacts are in PROGRESS.md; older sections below are historical evidence, not current feature descriptions.

## Asset shortlist review — user selection first, 2026-10-25

Scope is research and a separate candidate viewer only. Do not replace any game organism before the user sees/selects the assets. Read original license declarations; record creator, source, redistribution/commercial terms, file hashes and actual GLB geometry/animation metadata. Render downloaded candidate models with the installed Three.js runtime under matched light/background and inspect them in a real browser, including mobile/tablet readability. Clearly label native color/animation and distinguish a visually related insect from a biologically correct replacement. Keep candidates under artifacts, outside production assets and simulation. No dependency or save-format change. Show the user actual model previews and links, then wait for selection.
## Remaining asset review — personal/non-commercial scope

User clarified the game is personal/non-commercial. Broaden the search to compatible non-commercial licenses; commercial permission is not an acceptance requirement. Continue preview-first selection without game replacements. Cover woodlouse, springtail, water flea, freshwater fish and vegetation families; distinguish downloaded/rendered models from creator reference previews and missing/unsuitable files. Read exact source metadata, verify links/images in the actual board and state adaptation/performance limits. Preserve every earlier candidate; add no dependency or persistent gameplay format.
# Evolving spatial nest verification — before implementation, 2026-10-26

Final result:159/159tests, explicit typecheck and production build pass. Final client1,360.79KB/387.39KB gzip; native worker76.43KB, chunk warning remains. Independent29focused tests and2,000extra seeded steps/four refuges passed after fixing tip advection/caps/labels/picking. Two real worker-handler transfer tests matched direct geometry without input mutation. Native compiled and exact private Tailscale play verified placement,3D orbit, room/individual taps, follow across surface->nest with four literal+1h keys, expansion pause/resume control, compatible pond/surface/soil transitions, actual worker execution and no recorded runtime errors. Private page/worker and compiled page returned200. Native299download exactly replays all World fields and next step; material residual-6.05e-15.

Actual UI cases: funded rain0.55/imported-food2 experiment opens first refuge at221 and live native run reaches299 with8graphpoints/5workers/new branch. Untended maximum fixture colony instead runs out of food and loses queen/workers bytick429, with unfinished46%tunnel retained. Added explicit real-condition/queen-loss explanation; do not present this failure as long-run balance success. Soil displacement remains a proxy. Actual phone389x841/tablet818x1178CSS checks have no horizontal overflow, visible controls>=44px and touchAction:none. Native private1280x720 literalArrowRight changes target2.279/-.386/-.033->2.297/-.388/-.042 and releases room auto-framing. Full-angle orbit and room margin/highlight refined after actual rendering; in-world room/queen taps work. The full native system follows a carried0.012seed through its entrance, then restores the pond and nest without stale worker geometry.

Host observations: worker meshing22.1-57.6ms off the render thread across sampled graphs; steady frames~6.1mean/6.2-7.0p95ms in small scenes, tablet6.4/9.2ms. During view/model transitions sampled p95 reached24.8-27.5ms. These are host frame intervals with other QA tabs, not GPU timings or physical iPad benchmarks. Physical Safari, native pinch and browser worker failure/teardown under device pressure remain unverified. Original user tab/data/A/B were not replaced; all edits/imports were isolated QA tabs/artifacts. Native filechooser automation sometimes returned slowly; that is not a game-frame benchmark.

- Preserve the152-test baseline and existing old saves/A/B. Test new graph non-coplanarity (tetrahedral volume), connected real3D routes, bounded land clearance and immutable fixed-step continuation.
- Excavation: no growth without a capable worker, actual arrival, adequate reserve/food/demand or suitable soil; positive reserve cost, monotonic paid progress, no use of unopened rooms; completed connections remain routable. Save/load midway must produce identical next steps and close the existing material ledger. Validate malformed jobs and out-of-bounds graph data.
- Geometry: sample real3D voids and outside soil, test continuous open junctions, finite bounded triangles, normals and bounds. Cache by graph revision, not worker movement. Actual orbit must expose independent depth branches rather than a projected diagram.
- Run tests/typecheck/build; use compiled native UI to place, explore, inspect rooms, follow a builder, step/run into visible expansion, pause and save/reopen. Measure draw/triangle/frame intervals at stated host viewport; check tablet/phone controls, real keys and errors. Physical iPad remains a separate unavailable gate. Obtain a second-model read-only review under /verify for this complex build.


## Cavity support result — 2026-10-31

197 tests/typecheck/build pass. Independent240 valid contact-offset states have zero skin vertices in soil; minimal recovery preserves nonzero pair separation. Actual queen follow clipping found and fixed through shared rendered centers. Native pause/step/live/orbit/picking checked before final recovery refinement. Final compiled scene rendered, but final input repeat is incomplete due changed host input mapping and unavailable viewport capability. See PROGRESS for evidence and limitations.
