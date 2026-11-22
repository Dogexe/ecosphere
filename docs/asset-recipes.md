# Asset recipes

Problems already solved, written as recipes so the next asset goes faster. Add one entry each time a fix works.
Keep entries short: the symptom, the cause, the fix, and where it lives.

## Pipeline

- **Order of work.** Search existing assets first (Quaternius, Poly Haven, Kenney, Sketchfab CC0/CC-BY, .hapto),
  adapt in Blender, export GLB, record provenance in `ASSETS.md`. Build custom only with a recorded reason.
- **Blender on the owner's PC.** `D:/Blender/blender.exe`; adapt scripts live in `scripts/adapt_*.py` and run
  headless (`blender -b -P script.py`). BlenderMCP lets Claude drive the same Blender interactively.
- **One step, one look.** When driving Blender, render or screenshot after every operation, not after a batch:
  a wrong step is caught immediately. Start each model from a clean scene so data from the last model does not
  leak in (Kossarev, https://dev.to/aleksandr_kossarev_e23623/ai-orchestrated-3d-asset-pipeline-from-jpeg-to-game-ready-glb-without-touching-blender-1akf).
- **Check every asset with the sheet.** `npm run visual -- --label <name> --models <glb names>` gives six views
  plus triangle and material counts, next to the in-jar shots. See `docs/visual-rubric.md`.
- **Stray "Icosphere" after a GLB import into Blender.** The glTF importer adds an unparented icosphere as the
  bone display shape for rigged models. It is not in the GLB (woodlouse.glb has one mesh node); ignore it when
  measuring bounds or triangles in Blender.
- **Textures.** Keep at 1k to 2k; large downloads block Blender's main thread.

## Geometry

- **Thin spiky wings from a Shape.** `quadraticCurveTo` with two-value points made spikes. Use
  `shape.splineThru(points)` then `closePath()` (`src/scene/Pierid3D.tsx`).
- **Mirrored parts.** Build the right side once and mirror the group with `scale x = side`; put markings on
  both faces (±0.002 offset) so they show from either side.
- **Rig collapses when paused.** The exporter's bind pose can fold antennae; author the static idle in the
  default GLB node TRS (`scripts/adapt_daphnia.py`).
- **Thin geometry skins badly.** Where automatic weights fail on thin parts, use Gaussian weights.

## Look

- **Plants stuck on their hard-faceted fallback.** A GLB fetch past its timeout left the fallback up for good,
  with no Retry label for plants. Timeout is now 15 s and `OrganismAsset` retries by itself 3 times.
- **Quaternius low-poly plants look hard under the toon ramp.** Average normals by position, ignoring UV and
  colour seams (`smoothNormalsByPosition` in `OrganismAsset.tsx`, list in `softShaded`). `mergeVertices` does
  not weld them because seams differ.

- **Soft, not faceted.** Use smooth normals on low-poly meshes; `flatShading` reads as harsh facets (clover,
  lily). Keep roughness high and colours from the shared palette.
- **Moss far away.** Alpha-tested cards defeat early-z; keep opaque near LODs and one shared cutout material
  for far LODs (`MossTuftAsset.tsx`).
- **Per-pixel loops in shaders.** Segment loops per pixel cost +61% GPU at iPad resolution; bake into a canvas
  texture once when inputs change (`soilRoots.ts`).

- **Fog does not reach custom shaders.** Scene fog skipped the soil/gravel shader, so underwater looked like
  dry bank under a black sky. Do water haze as a depth-based post effect (`UnderwaterEffect.tsx`) instead.

- **Vertex colours look washed out.** Vertex colour values are linear, not sRGB: 0.46 renders pale cream. Write
  linear values (roughly the sRGB value squared), as in the nest walls (`nestGeometry.ts`).
- **Marching-cube walls look stair-stepped.** Unshared vertices give per-face normals; average normals by
  position after `computeVertexNormals` (`smoothByPosition` in `nestGeometry.ts`).
- **Background vanishes when swapping views.** Two `<color attach="background">` swapped in R3F clear it (old
  detach runs after new attach). Set `scene.background` in `useFrame` instead (`UndergroundBackdrop`).

## Testing and deploy

- **Clicks fail in scripts.** Buttons with emoji spans do not match `getByText` exactly. Give buttons a
  `data-testid` (view buttons: `view-surface`, `view-underground`, `view-underwater`).
- **"model unavailable" labels in software rendering.** GLB fetches time out at 6 s when SwiftShader starves
  the page. The capture script presses Retry up to three times and reports only what still fails.
- **Blank page on GitHub Pages.** Build with `npm run build:pages` (relative base), never plain `npm run build`.

## Room props

- **Kenney downloads from a script.** The asset page answers 403 without a browser User-Agent; with one, read
  `data-download-id` from the page, GET `https://kenney.nl/download-link/<id>` (same cookies, Referer = page),
  and fetch the returned `url` (`scripts/adapt_room_props.py` header lists the kits).
- **All faces end up on material 0 after a recolour.** `mesh.materials.clear()` resets polygon material indices;
  record the target index per polygon, rebuild the slots, then assign (`remap` in `adapt_room_props.py`).
- **Leaf islands merge into one.** Leaves that touch at one point share a vertex; group islands by shared edges.
