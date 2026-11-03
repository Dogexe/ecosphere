# ECOSPHERE

A small playable 3D ecosystem prototype for the browser.

## Play locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Drag to orbit, scroll/pinch to zoom, and use two fingers or right-drag to pan. Follow an animal for a close view. Add water and compost, change sunlight, and pause or speed up time.

When vegetation is lost, field notes explain which recyclers remain and offer **Introduce new producers**. Recovery needs actual planted propagules and suitable conditions. Inside an ant nest, inspect a chamber or developing cohort to see its local water; **Tend soil above** opens that surface pocket for local care. Tiny springtails have a close observation camera while keeping their biological mesh size.

With a colony present, plant inspection explains its actual seed-bearing supply: maturity and leaf cover both matter. **Tend this plant's soil** selects its root pocket. Compost must decompose before nutrients become available; the existing **Mineral feed** recipe directly adds root-accessible nutrients. Empty stores send unloaded workers foraging; ready food carriers can provision needy young or the queen through real chamber travel. This is a simplified generic colony policy, not a calibrated species model.

- Tap a plant or animal to inspect it. Plants explain their current environmental constraint and growth outlook before grazing. **Look closer** frames a selected plant as it grows; **Return to overview** leaves the close view. Tap bare ground to focus a soil patch; inputs then affect that patch. Return to “Whole ecosystem” for whole-world inputs.
- Open **Introduce life**, choose from eight plant and six animal roles, then tap suitable land or water. Plants arrive as propagules and develop. The nursery describes each role. Inspected organisms can be moved out of the terrarium.
- Open **New world** to choose a mixed garden, shaded floor, sunny meadow, bare ground, or living pond, with a reproducible seed. They use the same solver. Cancel keeps the old world; Begin replaces only the unsaved run and starts paused.
- Use **Watch an animal**, **Watch next animal**, or tap a creature to inspect/follow individuals. Woodlice have sex, hydration, digestion, resource-funded broods and growing young with maternal identity. The shaded-floor start can produce a visible new generation without special scripted events.
- New worlds begin at **08:00 with day & night enabled**. Light, temperature, photosynthesis and animal activity share the model clock. Diurnal animals rest at night; woodlice and springtails tend to forage after dark. Hunger or danger can interrupt rest. Rest still costs energy, and digestion, aging and brooding continue.
- **Environment** controls the day/night cycle, baseline temperature, rain and pond inputs. With the cycle on, the light slider sets peak daylight and temperature gently varies around the baseline. Algae feed water fleas, fish hunt them, and decay/respiration continue using pond oxygen in darkness. Stocks and rates are simplified game quantities. Existing saves without a cycle flag keep their original constant conditions until you enable it.
- Open **Soil mixture** to combine water, organic matter, and available nutrients. Amounts apply per targeted pocket. Organic matter feeds the litter web; mineral nutrients go directly into the root-accessible pool. The receipt reports retained imports and any excess water leaving the modeled tray.
- Choose **Explore the pond** for below-surface orbit, zoom, pan and aquatic follow. **Return to surface** restores the previous view. The camera stays in the shallow basin; algae/organic stocks and daylight affect visibility. Surface life keeps simulating. Introduce water fleas before their fish predators.
- Introduce **Ant colony** on open land with mature clover/grass/flowers. **Inside the nest** opens a full3D soil view; orbit, zoom, inspect chambers or follow a tiny individual. Workers collect seeds, nurse funded young and excavate refuges when crowded and supplied. Food and soil conditions can stop expansion. **+1h** advances exactly once while paused. Old colonies keep their saved graph; use **Allow nest expansion** to enable construction.
- **Show food patches** marks actual available seed-bearing material in green; gold patches need growth or recovery. Inspect developing ant cohorts to watch egg→larva→pupa and follow an actually emerged pale worker. A followed ant's death retains its real location and opens its remains; the body shrinks as local decomposition returns its material.
- Choose **Seal** to close the jar for 10, 30 or 60 days. No water, soil, rain or life can be added or removed; light and warmth still pass. Evaporated water condenses back, fallen leaves rot into nutrients and CO2, and the jar has its own air: watch oxygen, CO2, heat and fog, and lift the lid for a moment if you must. When the goal arrives or every producer is gone, time pauses and a report explains what happened.
- Open **Observatory** to chart this run hour by hour (plants, leaf cover, soil, pond, each animal role), or compare experiments A and B projected 3, 7 or 14 days forward with no tending.
- Open **Experiments** to pause and keep two independent snapshots. Restore either one to explore another outcome. A/B stay in the current browser/address; **Download current world** makes a portable JSON backup. **Open world file** checks and previews a file before explicit restore, paused. v1/v2/v3 files up to200KB are supported. Starting/importing a world does not erase A/B. No cloud sync is involved.

Clover, fern, bloom, moss, grass, trees, lilies and reeds have different niches. Trees cast real local ecological shade and reduce evaporation. Mature plants transfer biomass to propagules; age and stress can kill them. Springtails eat fungi, woodlice digest litter, grazers eat leaves, and beetles hunt land prey. Pond producers compete with algae; water fleas graze algae and fish hunt them. Dead organisms leave material-backed remains which decay into their home compartment. Population collapse is possible.

Place aquatic animals far enough inside the pond for their entire body to clear the bank. Their swimming and offspring obey the same boundaries. Old shore positions remain loadable and recover inward on the next simulation step; this navigation correction can change a saved aquatic experiment's future without changing its format or initial contents.

On this PC's tailnet, while Vite is running, an iPad connected to the same Tailscale network can open `https://josh.tail5425f0.ts.net:8447/`. This private route is provided by Tailscale Serve and forwards to local port 5173.

## Verify

```sh
npm test
npm run typecheck
npm run build
```

The ecological model lives in `src/sim/` and runs in fixed, seeded steps. Each step is one model hour; rates are compressed game parameters. Four soil pockets and a separate pond provide coarse resource compartments. Material-funded growth covers woodlice and ant larvae; the other animals use simplified age stages/reserve reproduction. Functional groups are uncalibrated; atmospheric carbon/oxygen, hydrological transport, disease, complete chemistry and a common-unit mass ledger remain absent. Primary references and explicit limits are in `ECOLOGY.md`. Static grass tufts and terrain details are set dressing. Snapshots write version3 and read v1/v2/v3; existing A/B slots are preserved. The world and its Observatory history autosave in this browser and come back paused on the next visit (separate from the A/B slots); there is no cloud sync.

For host-browser profiling, append `?profile=1` to the play URL. The optional overlay reports 120-frame mean/p95 samples, renderer draw calls, triangles, and live geometry count. Add `&stress=1` for a paused maximum-capacity fixture built through the real placement rules. These are measurements of that browser/device, not a prediction for iPad Safari.

Fifteen adapted local models include actual.hapto/Senckenberg woodlouse and tiny springtail anatomy plus four ant castes/stages, alongside the Kenney mushroom and preserved authored organisms. Art credits are available in Experiments. Their original museum AR files are static; added gaits are artistic modifications. Springtails retain their tiny relative scale and use micro follow for inspection. Adaptation scripts preserve originals under `artifacts/candidates/` with installed Python/Blender. `SCALE_BIBLE.md`/`src/scene/scale.ts` own measured dimensions and growth; independent28px animal targets never enlarge meshes. Water-flea and moss models still need an asset/proportion audit. Shallow underwater exploration and a graph-driven evolving3D ant nest are playable. Colony food viability, deeper soil physics and broader life histories remain unfinished. Shared photoperiod rules live in `src/sim/climate.ts`; rates and activity schedules are explicit design approximations. See `ASSETS.md`, `ART_DIRECTION.md`, `SPEC.md`, `VERIFY.md`, and `PROGRESS.md` for provenance, actual checks and unfinished release gates. This is a playable development build, not a release candidate. Physical iPad Safari remains unverified.
