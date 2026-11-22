# Visual rubric

One fixed set of questions for every visual check, so scores from different days compare. The target look is in the
Claude Doc "ECOSPHERE หน้าตาสุดท้ายและแผนไปถึง" (https://claude.ai/artifact/LJzqi2CEzjpdSdWJ7TfPbt) and
`ART_DIRECTION.md`: Stylized 3D Naturalism, soft organic low-poly, warm window light.

## How to run a check

1. `npm run build:pages`
2. `npm run visual -- --label <name> [--models woodlouse,ant-worker] [--lineup]`
3. Open `artifacts/visual/<name>/sheet.png`, score each row below 1 to 5, and add a row to the score log.
4. Phase gates (end of each phase in the plan) also get a Codex review of the same sheet against this rubric,
   asking for concrete fixes as well as scores. Between gates, score it yourself to save Codex quota.

The sheet always shows the same shots: UI at 10:00, overview 10:00, three-quarter, macro, underground cutaway,
underwater, overview 22:00, then six views of each `--models` GLB and one three-quarter view of every organism
GLB with `--lineup`. Captions carry draw calls and triangles per frame; `stats.json` keeps the numbers.

## Scores

1 = broken or clearly wrong. 2 = works, but reads as placeholder. 3 = acceptable, style partly consistent.
4 = good, consistent with the target. 5 = could be a store screenshot.

| Row | Shots | What earns a 4 |
|---|---|---|
| Jar glass | overview day/night | Clear glass, one long soft highlight, thick rim, nothing hard-edged or milky |
| Room and light | overview day/night | Warm key light clearly from the window, soft contact shadow under the jar, readable night |
| Soil and stones | three-quarter, macro | Rolling surface, 3+ soil tones, litter and pebbles, no jagged or flat-colour edges |
| Cutaway | underground | Clean cut face with soft dark edge, readable strata, roots and tunnels |
| Water | overview, underwater | Soft glints, tinted water, caustics or similar life under the surface, wet bank |
| Plants | three-quarter, macro | All true 3D, one soft low-poly language, no painted cards, no hard flat-shaded facets |
| Animals | macro, model views | Recognizable at a glance, real proportions, soft shading, same material language |
| Cohesion | whole sheet | Every element looks made by one hand with one palette |
| UI | UI shot | Cream and forest green, compact, never covers the subject |

## Budgets (from stats.json)

| Measure | Target | Phase 1 (2026-11-22) |
|---|---|---|
| Draw calls per frame, overview | ≤ 300 | 543 |
| Triangles per frame, overview | ≤ 400k | 667k |
| Triangles per frame, macro | ≤ 600k | 820k |
| Triangles per frame, underwater | ≤ 600k | 878k |
| One animal GLB | ≤ 6k tris, ≤ 4 materials | woodlouse 5.4k / 4, daphnia 5.7k / 8 |

Counts are `renderer.info` averaged over five frames (all passes: shadow, scene, AO and finishing).
The first baseline sheet counted about two frames and is not comparable.

## Score log

| Date | Label | Glass | Room | Soil | Cutaway | Water | Plants | Animals | Cohesion | UI | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-22 | baseline-2026-11-22 | 3 | 3 | 2 | 2 | 2 | 2 | 3 | 2 | 4 | Not representative: under software rendering most plant and animal GLBs timed out at 6 s and stayed on their hard-faceted fallbacks |
| 2026-11-22 | phase1-final | 3 | 3 | 2 | 2 | 2 | 3 | 3 | 3 | 4 | Models now load (retry), clover/fern smooth-shaded, shadow pass every other frame. Still: painted Fittonia/violet cards, flat soil, underwater reads as brown murk, underground floats on a pale backdrop |
