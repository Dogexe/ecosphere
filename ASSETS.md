# Asset provenance

## UC Davis Daphnia —2026-10-27

Original by **ucdavisterc / UC Davis Tahoe Environmental Research Center**: https://sketchfab.com/3d-models/daphnia-4f27bcd63caf4dae837cfaeb70e1bf3a . Licensed **CC BY 4.0**, https://creativecommons.org/licenses/by/4.0/ ; commercial use, modification and redistribution permitted with credit, license link and indication of changes. No endorsement implied. Retrieved through the creator's official https://tahoe.ucdavis.edu/Tahoe-Species → https://arurl.co/vhtc6t public AR exhibit (thing317), not an authenticated viewer extraction. Creator metadata and embedded GLB extras agree on author, source and license. Original `artifacts/candidates/UC_Davis_Daphnia.glb`:2,058,460bytes, SHA256 `6741bbc253e922e53a97b885b0af341ae7e710b51f33c0f9a1d620078fdcb5da`.

`scripts/adapt_daphnia.py` retains the original eight anatomical meshes, reduces33,044→5,707triangles and190→64bones, merges fine-hair weights into retained parents, replaces source maps with muted materials, and bakes source motion relative to the body so ecological movement owns displacement. The `eat` clip reuses the bounded source appendage cycle; it is a visual feeding cue, not a calibrated filtration model. Static idle freezes the pose. Authored idle node transforms correct Blender's collapsed default bind pose without advancing time. Adapted398,196byte self-contained GLB, hash in production manifest, total16models2,684,316bytes. Candidate PNG was actually rendered and inspected; in-game validation is recorded separately in PROGRESS. Existing15models unchanged. Original permissions and attribution travel with `public/assets/organisms/CREDITS.txt`.

## Water-flea follow-up search —2026-10-27, unresolved

Inspected [nicolamoo's waterflea + guts + eye](https://sketchfab.com/3d-models/waterflea-guts-eye-2c84a31e3bd847988ccf27efcfb4c89a): creator metadata says 9,812 faces, downloadable, CC BY 4.0 (credit required; commercial use and adaptation allowed under the license). Its actual creator preview shows recognizable antennae and eye; source materials would need adaptation. The official download opened a login dialog, so no model, topology, rig, or animation was obtained or integrated. `artifacts/candidates/nicolamoo-waterflea-preview.png` is a creator-page screenshot, not the model. Continue seeking an accessible source.

Searched actual Daphnia sources before replacing the provisional water flea. Museo Nacional de Historia Natural de Chile's [exhibit Daphnia](https://sketchfab.com/3d-models/daphnia-b605ff408ce347b2a690152efbe6aa2f) has public creator metadata declaring CC0/downloadable/216,988faces, but the mesh download requires authenticated access; no mesh was obtained or viewer-cache extraction attempted. [Mieke Roth's animated Daphnia](https://sketchfab.com/3d-models/animated-daphnia-361a99c7afdd470d99fc1269ebf56044) is159,798faces and explicitly not downloadable with no reuse license in its public metadata; it is a reference only. Both exact metadata records are retained under candidates.

[Horstmann, Weiss and Tollrian's original research datasets](https://doi.org/10.6084/m9.figshare.14269625.v1) are CC BY4.0. Downloaded the actual19,868,120byte D.magna archive (MD5c5b81b053cf2c7be635247f982533d3b matching publisher metadata) and inspected its contents: individual XYZ coordinate text point clouds, no mesh topology/material/rig. This is research shape data, not a suitable direct animated animal asset. No reconstruction or replacement is claimed. Keep the existing working water-flea presentation provisional; obtaining a complete legally reusable Daphnia source remains an art gate. No new primitive replacement was silently generated.

## Springtail source adaptation —2026-10-27

Museum [Mesaphorura macrochaeta page](https://vr-bodenleben.senckenberg.de/tiere/porenraum/springschwanz/) links [the exact.hapto publication](https://sketchfab.com/3d-models/mesaphorura-macrochaeta-34561f36da8e4c728e9f4ebb144803ee). Its public creator metadata saved alongside the source confirms CC BY4.0, credit required, commercial use allowed; modification/redistribution follow that license. Source is the museum's public AR glTF endpoint`https://vr-bodenleben.senckenberg.de/api/assets/animals/a978d403-c0e8-4d25-871c-07c580c27566/model/gltf/8fe667e7-30a5-48cb-9bd3-2b94f998d268`, HTTP200,1,580,443bytes, SHA256`644e711f9e3c68a6026c38dac587484d5f2c14c59b59fcbec1e7779ea028b254`. Retained`Senckenberg_springtail.gltf`, creator JSON and museum page under`artifacts/candidates/`. The older86k-triangle generic Springtail publication is a different candidate; this exact source is10,776triangles/static/no rig. Source inspection rendered the actual segmented, eyeless soil-adapted hexapod/short antennae/three leg pairs; no source gait exists. Planned material/decimation and bounded artistic gait must retain that anatomy. The museum lists0.7mm and reduced jumping apparatus; game remains a generic fungal-feeding guild, not a calibrated named-species model. The completed adaptation and native results follow below; candidate/native gates are in VERIFY.

Adapted/integrated actual file`springtail.glb`:113,584bytes/2,585triangles/10weighted bones, SHA256`12829dfbf1c8c99f2e3b38851bc94fd022fdb83e74c71d736fd78278a124ce55`. Matte ivory/sage, photographic textures removed, source segmentation retained; idle/walk/eat clips are added artistic gait, no root hopping. Both actual source and adapted diagnostic PNGs inspected. Rig inspection confirms all six legs and two antennae have real source vertices. Existing14files stayed byte-identical;15files total2,286,120bytes. Required creator/cooperation/license/change notice ships in CREDITS. Tests cover actual measured bounds/grounded gait/paused bones/shared geometry/independent skins; native nursery introduction/close observation/rest/feeding and3×multi-day survival observed. No physicalSafari/GPU benchmark claim.

## Observable ant remains —2026-10-26

Asset-first inspection found the already shipped mujtaba-io CC0 worker/queen and adapted CC0 larva/pupa are the appropriate anatomy for their own carcasses. Reuse those exact files/shared immutable geometry; no substitute primitive ant or unrelated animal download. Renderer-only fallen orientation/grounding and health/decay appearance are modifications, not a source death animation or rigid-body simulation. Existing ant-egg oval exception also covers damaged egg cohorts. Actual source bounds/paused poses and in-game worker death→decay→complete disappearance passed; isolated native missing-file recovery also passed using a safer file-free actual nursery/simulation/same-origin snapshot at440: corpse-only worker load503→Retry→200, paused world unchanged. The earlier declined QA file transfer was never retried. Cohort inspection also reuses the unchanged source files, measuring model-local bounds before chamber transforms for touch targets/highlights. All original provenance/attribution remains in the manifest/CREDITS below.

## Evolving nest asset search — 2026-10-26

Rechecked existing ant caste assets and searched ant-nest/soil/GLTF libraries before this replacement. Nexprint's HEzaO Ant nest (`https://www.nexprint.com/en/models/G3753951`) explicitly prohibits hosting/redistribution/derivatives, including personal non-commercial digital redistribution; not acquired. CGTrader's scanned Ant Nest Log is a paid textured exterior log, not connected internal cavities; no purchase. Cults/Thingiverse formicaria are fixed printable enclosures with planar chambers, not a saved evolving colony graph. No new external nest mesh was downloaded or falsely claimed imported. Preserve all four adapted CC0 ant assets. Procedural union of authoritative3D tunnel/chamber volumes is specifically appropriate and user-authorized for this dynamic nest; no primitive animal substitution.

Scientific references for the simplified need/soil-dependent construction: [Römer & Roces2014](https://pmc.ncbi.nlm.nih.gov/articles/PMC4022738/) experimentally link relocated brood/fungus to excavation in leaf-cutters; [Scientific Reports2021](https://www.nature.com/articles/s41598-021-02491-w) measures plastic temperature responses. These support qualitative design only, not species-calibrated seed-harvester rates or architecture. No reference figure or paper mesh is redistributed.

## Woodlouse adaptation — 2026-10-26

**Trachelipus ratzeburgii**, .hapto GmbH, developed with Senckenberg Museum für Naturkunde Görlitz / museum4punkt0. The museum's [species/AR page](https://vr-bodenleben.senckenberg.de/tiere/laubstreu/landassel/) links the exact [creator publication](https://sketchfab.com/3d-models/trachelipus-ratzeburgii-c33d55eda92846fea8021051829ee282), which specifies **CC BY4.0**. This permits commercial use, modification and redistribution with attribution/license link/change notice. No endorsement is implied. Its rights differ from the CC BY-NC-ND photographs on the museum's separate project article; those photos were not used as game assets.

Actual public AR source: `https://vr-bodenleben.senckenberg.de/api/assets/animals/feca3a11-1c91-4226-a830-850691ba1a0a/model/gltf/dbfa84bc-e8ac-4d14-94d5-c5941aac122f`, retrieved HTTP200 without login. Preserved`artifacts/candidates/Senckenberg_woodlouse.gltf`:5,557,195bytes, SHA-256`3154df476a0580fa8d161f266d1d6046baa8106879688b2f77499363aa90fdda`. Exact creator/license and public-page captures are alongside it. This is a different, lighter source than the229,440-triangle woodlouse preview from the earlier audit.

`scripts/inspect_woodlouse.py` records142original connected components. `adapt_woodlouse.py` reduces the actual57,360triangles to5,354, retains shell plates/seven leg pairs/antennae/jaws, replaces photographic maps with four matte sage/grey materials and adds a20-bone rig. Idle is static; added walk/eat are artistic approximations, **not museum-validated motion**. Independent review corrected the original main-jaw/tip side grouping before integration. Smooth normals inside disconnected parts preserve soft silhouettes without exporting a separate vertex for every flat face. No decoder, new texture, dependency or primitive organism. Newborn/adult size uses existing funded woodlouse mass; imported animation never controls ecological decisions. Source bytes and existing nine assets remain unchanged.

`public/assets/organisms/woodlouse.glb`:258,204bytes, SHA-256`b0c21a8c79d92a6434570fb2dc993beabdf2b13dac80df478bf531a984861c7c`, clips idle/walk/eat. Ten production models total1,796,628bytes. Required credit/license/change notice ships in`CREDITS.txt`, linked from Experiments. Source/adapted comparison at`artifacts/candidates/woodlouse.html`; actual game integration still requires the verification recorded in VERIFY/PROGRESS.

Verified/retrieved 2026-10-24–25. No paid assets, asset service, or runtime third-party request is used. The permanent asset-first/modification-first policy is in `AGENTS.md`.

## Aquatic adaptation — 2026-10-26

Creator/publisher: **Pixor library / Frakassets**. Actual source pages:[Water lily](https://pixor.art/library/plants/water-lily/), [Reeds](https://pixor.art/library/plants/reeds/). The publisher's [library license](https://pixor.art/library/license/) dedicates every library model/Blender file/sprite under **CC0 1.0**, explicitly allowing commercial use, editing and asset redistribution; credit optional. No app purchase/account/EULA acceptance was required to retrieve the GLBs. Exact license-page capture remains at`artifacts/candidates/pixor-library-license.html`; credit/license links ship locally.

| Production file | Actual source URL | Source SHA-256 | Triangles / bytes |
| --- | --- | --- | --- |
| `lily.glb` | https://pixor.art/library/files/water-lily/pixor-library-water-lily.glb | `cd3c23aab725f90531db54debb36740a168a19dd2f07cb678801fd05f729fef3` | 940 /33,604 |
| `reed.glb` | https://pixor.art/library/files/reeds/pixor-library-reeds.glb | `df22d4169de637b96e4d29a36ee3cd889e45fdcb0e27a97ba5d20284b1f61fc8` | 920 /29,788 |

Originals remain as`Pixor_water-lily.glb`/`Pixor_reeds.glb` under candidates. `scripts/adapt_aquatic_assets.py` uses the installed **Blender5.1** at`D:/Blender/blender.exe` (discovered after the earlier PATH-only audit). It preserves source faces, changes sage/dusty-pink/ochre material factors to matte, removes unused UVs/morph/animation and separates existing material groups. Reproductive meshes follow actual maturity. No decorative bob/sway is played. Runtime normalization retains the Scale Bible and floating pad anchor; local health tint blends source colors toward the shared dry tone rather than discarding their healthy palette. The existing reed functional group now uses a cattail silhouette; complete cattail physiology/root geometry is not claimed. No texture/external buffer/decoder was added. Nine production models total1,538,424bytes; exact hashes are in the manifest.

Rejected sources: actual Kenney lily_large/lily_small files had coarse thick pad/star-flower shapes inferior to the selected layered blossom. `hanging_moss` is a vertical drape, unsuitable for terrestrial moss. Source hashes and diagnostic renders/mesh reports remain under`artifacts/candidates/`; `scripts/inspect_aquatic_assets.py` creates inspection scenes only and exports no diagnostic geometry to the game. Preserved fern and existing seven imported files remain unchanged.

## Ant source review — 2026-10-26, integrated

Developmental adaptation search2026-10-26: natural queen results at Cults3D`ant-queen`/CGTrader`queen-ant-queen-termites` were paid resin/fantasy or ant/termite mixed offerings; free`stylyzed-ant-queen-female-character` is humanoid, and Fab's Red Ant Queen Throne is furniture. None was acquired. Dedicated larva searches produced photos/stock footage/fantasy NPCs rather than a suitable openly retrievable mesh. The Innerscene CC0 chicken-egg page was evaluated but its pointed/speckled bird anatomy is unsuitable. Static formicarium STLs at ArtStation`3d-model-ant-nest-formicarium-quatform-modular-diy-auto-wet-for-ant-stl-file-for-all-3d-printers` cannot match a live saved graph; no file was acquired. These are evaluated search results, not downloaded production assets.

`adapt_ant_life.py` therefore modifies mujtaba-io's actual ant for a dealate queen (gaster/mesosoma proportions) and naked pupa (original appendages folded, pale matte material). It adapts the actual CC0 Gobkit BeetleGrub source from`https://gobkit.com/freebies/insect001/BeetleGrub.glb`: removes all six legs and both eye components, reduces/joins the head/jaws, lays the original segmented C-curve on its side and removes unrelated animations. This is an artistic legless ant-larval adaptation, never a claim that an unmodified beetle is an ant. Native review caught and corrected detached head and unfolded pupal limbs. Worker/queen1,080tri each, larva460tri, pupa1,080tri; no textures. Original files remain preserved.

**Explicit custom exceptions for this colony only:** tiny untextured oval eggs/seed-load markers represent actual bounded brood/carry/store stocks; the smooth egg silhouette has no useful retrievable ant-egg asset above. A graph-matched soil cutaway must be generated from live node/edge coordinates, since static formicaria/cast models would display false connections. These exceptions do not permit replacing significant animals/plants with primitive models. No fabricated roots, burrows or decorative underground organisms are added.

- **Ant**, mujtaba-io:[creator release](https://opengameart.org/content/ant-3d-model-rigging-animated-low-poly-ish), [actual blend](https://opengameart.org/sites/default/files/ant.blend). Explicit CC0/public domain, credit optional; modification/commercial use/redistribution permitted. Local`OGA_ant.blend`, SHA-256`6f4de1451333964f8ffffe6ca9d15aaf6ef01fd089a8185b0268bd0d032fb662`. Actual inspection:542vertices/1,080triangle faces,38bones, walk/bite actions. Better generic ant anatomy; thin legs/dark palette and body posture need adaptation/animation inspection.
- **LeafcutterAnt**, Gobkit:[publisher/catalogue](https://gobkit.com/api/free), [actual GLB](https://gobkit.com/freebies/insect001/LeafcutterAnt.glb). Publisher CC0 terms above; local`Gobkit_LeafcutterAnt.glb`, SHA-256`3e12ba83cfa5d0a46961f903ab8f00b5143292914823fe44f64bd07b81835e37`. Actual rig16bones and named clips; stronger cartoon proportions and attached leaf. A leafcutter must not be silently relabeled as a seed harvester; its fungus-farming niche would need a different food model.

`scripts/inspect_aquatic_assets.py --ants` appended original blend data with installed library API and`--disable-autoexec`; no embedded scripts were run. Diagnostic render/metadata:`artifacts/candidates/ants-aquatic-inspection.*`. The awkward filename is inspection history, not an aquatic-ant claim. Historical source inspection preceded integration. Four adapted worker/queen/larva/pupa files now ship; originals remain distinct from production.

## Adapted organism library — 2026-10-25

Production files live in `public/assets/organisms/`. Original downloads remain under `artifacts/candidates/`. `scripts/adapt_assets.py` reproducibly exports the actual source meshes using the bundled Python/Pillow runtime; Blender was not found on PATH in that earlier audit. No package was installed. Exact output byte sizes and SHA-256 hashes are in `public/assets/organisms/manifest.json`; deployed attribution/changes are in `CREDITS.txt`, linked from Experiments → Art credits.

| File | Original / creator | Triangles | Animation / adaptation |
| --- | --- | ---: | --- |
| `tiger-beetle.glb` | TigerBeetle / Gobkit | 756 | Independent original rig, idle/walk/eat; muted baked vertex colors |
| `pond-fish.glb` | Archerfish / Gobkit | 646 | Independent original rig, idle/walk; width ×.68/height ×.8, original length; muted vertex colors |
| `leaf-grazer.glb` | Caterpillar / Poly by Google | 784 | Original mesh, muted256px source texture, added subtle crawl morphs |
| `clover.glb` | Clover_1 / Quaternius | 379 | Matte, muted leaf texture; source wind vertex mask removed |
| `grass.glb` | Grass_Common_Short / Quaternius | 155 | Same foliage adaptation |
| `bloom.glb` | Flower_3_Group / Quaternius | 755 | Muted pink flowers; blooms hidden until actual maturity |
| `tree.glb` | CommonTree_1 / Quaternius | 6,265 | Muted foliage/bark, no normal map; same canopy scale |

- Gobkit source/license: https://gobkit.com/freebies explicitly declares CC0 1.0, modification/commercial/redistribution permitted, attribution optional. Exact source files: https://gobkit.com/freebies/insect001/TigerBeetle.glb and https://gobkit.com/freebies/animal009/Archerfish.glb. The downloaded catalogue/source hashes are preserved in the candidate inspection record.
- Caterpillar: https://poly.pizza/m/64T47O5VHAB, creator **Poly by Google**, **CC BY 3.0** (https://creativecommons.org/licenses/by/3.0/). Modification/commercial use/redistribution permitted with attribution and indication of changes, provided in the deployed credits. Original source SHA-256 is retained in `artifacts/candidates/inspection.json`.
- Quaternius official pack: https://quaternius.com/packs/stylizednaturemegakit.html; free archive obtained through https://quaternius.itch.io/stylized-nature-megakit. Archive SHA-256: `298f6732b872e4cf7b30e6e7abf9641c7f6dc6b326df37ac089533ed7e3d58c9`. Its included `License_Standard.txt` explicitly declares **CC0 1.0** and 68/116 free models. A copy ships as `License_Quaternius.txt`. Only the four curated models above ship; no paid Pro/Source content. Plants retain alpha-cutout silhouettes with maximum512px textures and128px bark; source geometry is not replaced by primitives.

Geometry/textures are cached and shared; each animated individual owns bones/mixer and local health materials. Loading has a six-second fetch limit and retains the existing interactive fallback on failure. Named clips follow interpolated ecological travel, actual feeding events and simulation speed; Pause freezes imported animation. The new grazer's morphs are an authored presentation adaptation of an existing mesh, not a new biological behavior. The fish remains the existing simplified aquatic predator functional group; archerfish shooting and complete caterpillar metamorphosis are not claimed.

Exceptions at the original audit: the existing light fern was preserved as good art; moss/lily/reed, woodlouse/springtail/water-flea and props were provisional authored geometry. Lily/reed are superseded by the2026-10-26 adaptation above. Candidate woodlouse/springtail files were not obtained (only creator previews; high-poly originals); silverfish/grub are biologically unsuitable replacements. Do not fabricate a successful import or silently relabel a taxon. The exact solver-anchored pond cutout is custom terrain because evaluated kits do not provide that opening. No new primitive organism was generated in either pass.

## Kenney Nature Kit 2.1

- Creator: Kenney, https://kenney.nl
- Official pack and license declaration: https://kenney.nl/assets/nature-kit
- Official source archive: https://kenney.nl/media/pages/assets/nature-kit/37ac38a37b-1677698939/kenney_nature-kit.zip
- License: **CC0 1.0 Universal**, https://creativecommons.org/publicdomain/zero/1.0/. The included `License.txt` confirms personal, educational, and commercial use, with optional credit. CC0 permits redistribution and modification. The original license is shipped at `public/assets/kenney/License.txt`.
- Source archive SHA-256: `fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d`.
- Only the unmodified mushroom GLB is shipped; source ZIP and inspection thumbnails under `artifacts/` are development evidence, not production assets. Evaluated flowers were rejected after player feedback about consistency.

| Local file under `public/assets/kenney/` | Archive path | Bytes | Triangles | SHA-256 |
| --- | --- | ---: | ---: | --- |
| `mushroom_tan.glb` | `Models/GLTF format/mushroom_tan.glb` | 5,804 | 48 | `455cbacdcdac82cc20420c3f21eaba3ff2fbceadb2e13d35a39d52130dba5a80` |

The shipped GLB was parsed with the installed Three.js GLTFLoader. It contains two opaque color meshes and embedded geometry, no images, animation, external buffers, or external URI requests. Binary payload: 5,804 bytes.

Runtime modifications: normalize the base and scale, limit excessive width, set a soft ecological palette, remove the source metallic appearance, and apply rough flat-shaded materials/shadows. Mushroom count/size follow the fungal stock. These are stylized functional groups, not accurate species reconstructions. Source mesh bytes remain unchanged.

## Authored models

Terrain, rocks, water, litter, curved grass dressing, fern, moss, aquatic invertebrates and woodlice retain authored geometry in`src/scene/`. Earlier clover/grass/flower/tree/lily/reed/grazer/beetle/fish geometry remains as a loading-failure fallback. Decorative grass/logs do not add simulated biomass or ecological species.

Kenney flower variants A/B/C remain excluded. Original GLB source hashes for rejected C variants, retained only as evaluation evidence: purple `beb85b66766c9943a89a5ee27114d3befe22569db9a6f0b5f8366b687f9c1e42`, yellow `4115c017390b3e157466a8719e9e2af6c5385505135e7012982b9410760ba9f3`.

## Paper-look scanned plants (2026-11-03)

Poly Haven CC0 models in `public/assets/lab/polyhaven/` (see its `manifest.json`): `calathea_orbifolia_01` (tree kind, a young Calathea), `shrub_sorrel_01` (clover kind, Oxalis), `fern_02` (fern kind). Downloaded at 1k; the diffuse JPG was merged with Poly Haven's 1k alpha map into an RGBA PNG so the leaf cutouts work. Used by `src/scene/ScanPlant.tsx`, scaled to `plantDimensions` in `src/scene/scale.ts`.
Mushrooms (Mycena-like bonnets), floating pads (frogbit-like, lily kind), hairgrass (reed kind) and fallen leaflets in the paper look are modelled in code with canvas-painted textures (`src/scene/paperNature.tsx`); no third-party files.

## Image 12 plant parts (2026-11-07)

`public/assets/paper/plants/{tree,bloom,clover,grass,mushroom}` were repainted to match concept round 3 image 12 (owner: "plant models don't match the cover"). Three part sheets were generated with Codex's built-in image generation, with image 12 attached as the style reference; prompts, sheets and the cut pieces are in `artifacts/image12-plants-r1/` and the previous parts are kept in `artifacts/image12-plants-r1/replaced/`. Cut with a canvas script (white background flood-filled from the edges, connected pieces cropped, WebP 0.9, longest side 512 px); violet leaves flipped so stalks point down. The `tree` kind's art is now a pink-veined Fittonia (nerve plant) instead of Calathea; simulation kind and ecology unchanged. Personal, non-commercial game; generated images, no third-party licence.

`public/assets/paper/plants/moss-cushion/` (2026-11-07): six drawn moss cushions from a Codex image_gen sheet with image 12 as reference (`artifacts/image12-plants-r1/moss*`), cut the same way; drawn on three crossed cards per cushion.

## 3D pond crew and moss (2026-11-07)

Owner asked for bushy things and animals in 3D. Paper-look animals now use the existing 3D organism GLBs (woodlouse, springtail, tiger beetle, leaf grazer, daphnia); `?animals=drawn` restores the paper sheets. No CC0/CC-BY ramshorn snail or cherry shrimp model was found (web/CGTrader search 2026-11-07: paid or unlicensed only), so `src/scene/PondCrew3D.tsx` builds both procedurally from their anatomy (planispiral shell, foot, tentacles; carapace, six abdominal segments, five-blade tail fan, antennae, five leg pairs). Moss cushions (`src/scene/Moss3D.tsx`) and grass tufts are procedural 3D geometry; the drawn cushion art stays in the repo but is no longer placed in the default jar.

## Natural look assets (2026-11-07)

Owner's new direction (Stylized 3D Naturalism / Soft Organic Low-poly). From Poly Pizza, unmodified GLBs in `public/assets/organisms/` (sources and credits in `artifacts/natural-assets/CREDITS.md`):
- `natural-clover.glb`: "Clover" by Quaternius, CC0 (https://poly.pizza/m/u5SOgBFiut).
- `natural-mushroom.glb`: "Mushroom" by jeremy, CC BY 3.0 (https://poly.pizza/m/2DAaKHD48ZP). Credit required.
- `natural-hollow-log.glb`: "Log with Fungus" by sirkitree, CC BY 3.0 (https://poly.pizza/m/32czhZtc7oY). Credit required; decor only, not a sim object.
The broadleaf (Fittonia), violets and fern reuse the painted leaves as thin 3D leaves without ink outlines; moss is procedural instanced 3D.
