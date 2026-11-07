# Art direction

## Current: Stylized 3D Naturalism / Soft Organic Low-poly (owner decision 2026-11-07)

Supersedes the paper look and the concept-image-12 target. References: `artifacts/art-direction-2026-11-07/reference-main.png` and `reference-ui-thumbnails.png` (owner's concept). Inspiration: Sneaky Sasquatch's warmth and charm, Equilinox's ecological creativity, the intimacy of a real terrarium. A cohesive 3D indie game, not photoreal and not flat cartoon.

- **Geometry:** soft, rounded low-poly shapes with recognizable anatomy; no harsh angles, no generic primitives.
- **Materials:** stylized natural surfaces with subtle variation; plants, animals, soil, rocks and water share one artistic language (no mixing drawn sprites with photo scans).
- **Lighting:** warm sunlight, soft shadows, gentle ambient light, atmospheric depth; little post-processing.
- **Colour:** forest greens, earthy browns, warm creams, muted blues, restrained colourful accents.
- **Animals:** charming but biologically recognizable, real proportions, species-specific animation; tiny organisms stay real-size (zoom in, never enlarge).
- **Vegetation:** rich and layered: moss, ferns, grasses, flowering plants, shrubs, trees.
- **World:** genuine 3D with free orbit/zoom/pan; Surface, Underwater and Underground (evolving 3D ant tunnels, roots, soil layers) with seamless cutaway and X-ray modes.
- **UI:** minimal cream-and-forest-green rounded panels, clean type, contextual inspection and field notes, Surface/Underground/Underwater/X-ray navigation, unobtrusive environment and speed controls, collapsible; the terrarium stays the centrepiece.
- **Assets (mandatory):** asset-first, modification-first: search high-quality, commercially usable low-poly models first and adapt them with Blender/Python for consistent proportions, materials and animation. Procedural geometry for dynamic things (terrain, ant tunnels, growth). No inferior primitive substitutes when a suitable asset can be legally adapted.
- **Performance:** desktop browsers and iPad Safari with Three.js: optimized geometry, instancing, efficient materials, restrained transparency, light lighting, LOD. Polished handcrafted indie quality through efficient real-time rendering, not cinematic effects.

"Beautiful from afar. Fascinating up close. Alive at every scale."

## Earlier: paper look (owner decision 2026-11-03, superseded 2026-11-07; `?look=paper`)

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
