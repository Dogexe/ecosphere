# Art direction

## Paper look (current, owner decision 2026-11-03; `?look=paper`)

- **Creatures:** 2D paper-sticker cut-out sprites, side view facing right, rigged in code.
- **Environment and plants:** realistic 3D from photo scans (Poly Haven CC0, HDRI, photo textures), in a glass jar on a windowsill with a tilt-shift diorama feel. Plants use scans scaled to real sizes (`src/scene/ScanPlant.tsx`, `src/scene/scale.ts`); cite a real-world size for each.
- **UI:** cozy notebook game HUD, not a web page.

The section below is the earlier classic look, kept for the non-paper view.

## Classic look: Soft Organic Low-poly

One miniature world, with distinct organisms in the same visual language. Player feedback rejected the blocky imported flower cups and original cone grass; do not reintroduce them merely to use external assets.

- **Shape:** rounded, gently folded or arched silhouettes. Ferns retain paired leaflets, clover has three heart leaflets, flowers have radial rounded petals, and grass uses thin curved blades. Different biology shares a comparable level of geometric detail. Avoid thick polygon cups and cone-shaped vegetation.
- **Color:** restrained sage/forest foliage, warm soil/stone, cream and dusty pink flowers, muted ochre pollen. The common foliage family lives in `Terrarium.tsx`'s `leafPalette` and adapted texture palette. Poor habitat shifts plants toward the shared dry-leaf tone. Animals use muted sage, cream/ochre and slate blue; source stripes/spots remain recognizable without fluorescent accents.
- **Surface:** matte low-poly solids/leaf folds. Adapted Quaternius plants use muted small alpha-cutout textures (not photoreal foliage); imported animals use a restrained source palette. Remove source shader/wind color masks and metallic/normal effects. Water alone uses translucent blending. Use soft directional shadows consistently.
- **Scale:** details must read at normal orbit distance, with roots and feet on the tray. Flowers grow above ground-cover clover/moss; arching ferns remain light rather than solid blocks. Round-eyed animals share similar eye/head proportions and small segmented or jointed anatomy.
- **Motion:** interpolate real movement, use gait only while moving, show a meal only from actual feeding/capture events. Growth/decline follows biomass/habitat state. Do not invent extra ecological life for visual density.

Review the composed terrarium at default zoom and a closer orbit before accepting individual models. Check plants, animals, mushrooms, dressing, lighting, and terrain together. Profile shared/baked geometry at full capacity. External assets must fit these rules and have documented redistribution rights; permission to use assets does not waive art direction.

The asset-first adaptation pass imports Quaternius clover/grass/bloom/tree, Gobkit tiger beetle/pond fish and Poly by Google caterpillar; the light authored fern is preserved. Later passes add Pixor aquatic plants, actual.hapto/Senckenberg woodlouse/springtail anatomy and licensed adapted ant castes. All mature biological envelopes remain in the Scale Bible. No enlarged animal mesh for tapping. Source files and reproducible adaptation are documented in `ASSETS.md`. Water-flea/moss models remain provisional pending suitable actual files; do not substitute unrelated species. Eyeless soil fauna retain their real anatomy instead of receiving decorative cartoon eyes.
