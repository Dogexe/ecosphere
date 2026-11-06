# Asset hunt round 1: licences

Everything here may legally be used, modified and redistributed in ECOSPHERE. CC0 needs no credit (credit given anyway as courtesy). CC-BY items **require** the credit line shown. Scale reminder: 1 game unit ≈ 19 mm; jar ≈ 14 cm across.

## Textures (`textures/<id>/`, 1k JPG: diffuse, nor_gl, rough, ao, plus disp)

| Folder | Use in the jar | Source | Licence | Author | Real tile size |
|---|---|---|---|---|---|
| farm_soil | fine crumbly garden soil (primary soil) | https://polyhaven.com/a/farm_soil | CC0 1.0 | Amal Kumar | 2.0 m × 2.0 m |
| mud_forest | darker moist soil with small litter bits (alt soil / top layer) | https://polyhaven.com/a/mud_forest | CC0 1.0 | eye-candy.xyz | 2.3 m × 2.3 m |
| clean_pebbles | fine pale gravel / aquarium gravel | https://polyhaven.com/a/clean_pebbles | CC0 1.0 | Dario Barresi, Charlotte Baglioni | 2.0 m × 2.0 m |
| ganges_river_pebbles | mixed rounded river pebbles (drainage layer, pond bed; raise wetness with lower roughness) | https://polyhaven.com/a/ganges_river_pebbles | CC0 1.0 | Amal Kumar | 2.2 m × 2.2 m |
| forest_leaves_02 | mossy ground with litter | https://polyhaven.com/a/forest_leaves_02 | CC0 1.0 | Rob Tuytel | 3.0 m × 3.0 m |
| gravel_stones | black angular grit: reads as horticultural charcoal layer | https://polyhaven.com/a/gravel_stones | CC0 1.0 | Amal Kumar | 2.0 m × 2.0 m |

## Models (`models/<name>/`, each has a README line)

| Folder | What / use | Source | Licence | Author | Size on disk |
|---|---|---|---|---|---|
| namaqualand_rocks_01 | row of small quartz/sandstone rocks; individual pebbles | https://polyhaven.com/a/namaqualand_rocks_01 | CC0 1.0 | Greg Zaal (Photography), Jenelle van Heerden (modeling) | 4.8 MB (glTF 1k) |
| namaqualand_stones_01 | set of small stones (each ~8-11 cm real, scale down to 0.5-3 cm) | https://polyhaven.com/a/namaqualand_stones_01 | CC0 1.0 | Greg Zaal (Photography), Jenelle van Heerden (modeling) | 4.2 MB (glTF 1k) |
| stone_01 | single 15 cm stone; hero pebble / rock | https://polyhaven.com/a/stone_01 | CC0 1.0 | Dario Barresi (Photography), Rico Cilliers (photography, processing) | 3.7 MB (glTF 1k) |
| rock_moss_set_02 | set of mossy rocks (large real scale; shapes for pebbles) | https://polyhaven.com/a/rock_moss_set_02 | CC0 1.0 | Kless Gyzen (All) | 1.9 MB (glTF 1k) |
| moon_rock_01 | porous grey lump; recolour as a charcoal chunk | https://polyhaven.com/a/moon_rock_01 | CC0 1.0 | Greg Zaal (Photography), Rico Cilliers (Photography), Jenelle van Heerden (Processing), Dario Barresi (Processing) | 1.7 MB (glTF 1k) |
| dry_branches_medium_01 | dry twigs / branch pieces | https://polyhaven.com/a/dry_branches_medium_01 | CC0 1.0 | Rico Cilliers (All) | 3.3 MB (glTF 1k) |
| dry_quiver_leaf | curled dry leaf (leaf litter) | https://polyhaven.com/a/dry_quiver_leaf | CC0 1.0 | Greg Zaal (photography), Rico Cilliers (modeling) | 4.5 MB (glTF 1k) |
| moss_01 | moss clump (photo-real; reference only, game draws living things) | https://polyhaven.com/a/moss_01 | CC0 1.0 | Rob Tuytel (All) | 0.9 MB (glTF 1k) |
| si_macrobrachium_prawn | freshwater prawn scan, anatomical reference for the cherry shrimp (Draco GLB) | https://3d.si.edu, USNM 1699485, ark:/65665/321476eb1-d01f-4ee9-bcad-ccda57044eb6 | CC0 1.0 (Smithsonian Open Access) | Smithsonian NMNH Invertebrate Zoology | 1.1 MB |
| polypizza_shrimp_lowpoly | low-poly whole shrimp blockout | https://poly.pizza/m/fZwM-PXohV6 | **CC-BY 3.0**: credit "shrimp by angelo raffaele Catalano, CC-BY 3.0, via Poly Pizza" | angelo raffaele Catalano | 0.5 MB |

## Creature designs (`designs/`)

Six images (snail-a, snail-b, snail-r1, shrimp-a, shrimp-b, shrimp-r1), generated with Codex `image_gen` for this project on 2026-11-06. They are original AI-generated images, with no third-party artwork inside; the round-3 concept image was attached as a style reference only. Under OpenAI's terms, ownership of the output is assigned to the user. Review: `designs/review.md`.

## Not found / not used
- **Ramshorn snail 3D model:** none under CC0 or CC-BY with a no-login download. Smithsonian 3D has no Planorbidae (it only has marine shells and freshwater mussels). Senckenberg Bodenleben covers soil microfauna only. Poly Pizza's snails are low-poly garden snails with the wrong (helical) anatomy. The shell is a simple planispiral, so building it procedurally from the design sheet is the sensible route.
- **Neocaridina 3D model:** no species-accurate free model. Using the Smithsonian Macrobrachium (CC0) as the anatomy reference instead.
- **Kenney:** the Nature Kit is CC0, but downloads only through a JavaScript donation page (no direct link), and its flat low-poly style clashes with the photographic real-world look, so nothing was taken.
- **Sketchfab** and other hosts need a login to download, so they were skipped as the brief required.
- **Charcoal:** no texture is actually tagged charcoal on Poly Haven. `gravel_stones` (black angular grit) plus the recoloured `moon_rock_01` lumps are the stand-in.
