# Codex art-director review: game vs concept image 12 (round 1)

Judged frame: `ingame-sealed.jpg` (current game) vs `12-sealed-condensation.png` (concept 12). UI panels ignored. One read-only `codex exec` run, 2026-11-06.

## Scores

| Area | Score | Judgment |
|---|---:|---|
| Jar shape and glass | 5/10 | The jar reads clearly, but its tall proportions, oversized lid and faint glass lack the concept’s squat, weighty vessel. |
| Condensation | 3/10 | Scattered pale dots read as surface noise rather than wet beads with bright edges, dark cores and downward trails. |
| Soil/gravel layers seen through the glass | 2/10 | A huge, nearly uniform brown block replaces the concept’s shallow, richly stratified soil and rounded gravel. |
| Pond and underwater side view | 3/10 | The pond resembles a tilted green sheet full of floating rubble, with little convincing depth or submerged structure. |
| Moss | 5/10 | There is useful ground coverage, but the scratchy, uniform foliage lacks the concept’s distinct rounded cushions and delicate branching. |
| Plants (density, size, drawn/painted style) | 4/10 | One oversized striped plant dominates sparse wiry stems, while inconsistent outlines and textures weaken the illustrated style. |
| Lighting and colour grade | 3/10 | The glaring cream background, yellow cast and blown water reflection flatten the scene instead of giving it the concept’s rich greens and controlled warmth. |
| Overall: “looks like a real game, not AI slop” | 4/10 | It reads as a functioning game scene, but mismatched asset styles, arbitrary rubble and weak material separation make the art direction feel unfinished. |

## Fixes ranked by visual impact

1. **Fix the proportions:** reduce the visible soil depth by 55–60%, widen the jar body by approximately 15%, and frame the complete vessel with 5% clearance above its lid and below its base.
2. **Build visible substrate layers:** allocate the bottom 20% of the substrate to rounded grey/brown gravel, add a thin sandy transition, and replace the uniform brown wall with dark soil containing small, irregular mineral inclusions.
3. **Rebuild the pond’s depth cues:** remove 70% of the exposed pale rocks, seat the remaining stones in a rounded pebble bed beneath transparent olive water, and reduce the white reflection intensity by approximately 65%.
4. **Recompose the planting:** shrink the striped plant by 30%, add two medium broadleaf clusters behind it, group purple flowers into three compact patches, and replace half the spindly stems with low foliage using the same painted shading and restrained outlines.
5. **Replace scratchy moss coverage:** assemble 12–18 distinct rounded cushions with fine fernlike edges, vary their height by roughly 2:1, and leave approximately 20% of the bank exposed as dark wet soil.
6. **Rework glass and illumination together:** give the jar a visible thick base and narrow edge reflections, concentrate condensation on its upper half with three bead sizes and 8–12 vertical trails, then lower background exposure by one stop and shift yellow foliage toward deeper olive green around `#667B32`.

---

## Exact prompt

Images attached with `-i`, in order: `compare.jpg`, `ingame-sealed.jpg`, `ingame-side.jpg`, `artifacts/paper-gen/concept-drawquarium/round3/12-sealed-condensation.png`. Command: `codex exec --skip-git-repo-check -s read-only -i ... -` (prompt on stdin).

```text
You are a strict, experienced game art director. Do not run any commands or edit any files; answer only from the attached images.

Attached images, in order:
1. compare.jpg - three panels: LEFT = concept image 12 (the target look), MIDDLE = the game before the latest changes, RIGHT = the game now.
2. ingame-sealed.jpg - the CURRENT game frame (sealed jar view). This is the frame you are judging.
3. ingame-side.jpg - the current game from a side angle (extra context).
4. 12-sealed-condensation.png - concept image 12 at full resolution (the target).

Compare the CURRENT game frame (ingame-sealed.jpg) against concept image 12. Ignore all UI panels, text, buttons and HUD; judge only the 3D scene.

Part 1 - Score each area 0-10 (10 = matches the concept's quality and intent), with one short sentence of justification each:
- Jar shape and glass
- Condensation
- Soil/gravel layers seen through the glass
- Pond and underwater side view
- Moss
- Plants (density, size, drawn/painted style)
- Lighting and colour grade
- Overall: "looks like a real game, not AI slop"

Part 2 - The 6 most important concrete fixes, ranked by visual impact (most impactful first). Each fix is ONE sentence a 3D developer can act on directly, with concrete quantities where possible (e.g. "make X 30% larger", "drop Y", "tint Z toward #hex"). No vague advice.

Output in Markdown with a score table and a numbered fix list. Be blunt.
```
