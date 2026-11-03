# Verification plan — first playable slice

## Autosave — before implementation, 2026-11-03

Unit: encode → decode gives the same world (deep equal) and history within 0.005; a restored world's next 48 hours equal the original's; history over the limit is trimmed and the text stays under 1 MB; non-ascending or future history ticks drop the history but keep the world; history without jar-air columns fills room air; null, throwing, damaged and full storage all return safely (full → world without history); a damaged save is not deleted; A/B slots untouched. Browser (desktop and phone): run a few hours, reload, same day and history appear paused with the notice; Observatory shows the old line continuing; no console errors.

## Living jar — before implementation, 2026-11-03

Unit: minerals and carbon (including jar CO2) conserved to 1e-8 relative for 60 sealed days in garden, woodland, wetland and colony worlds; O2 change equals minus CO2 change; CO2 never meaningfully negative; open woodland still loses minerals; seedlings are born inside a sealed jar; zero CO2 means no growth; sealed noon is >8 °C warmer at meadow light and night is unchanged; thin air lowers woodlouse energy and leaves more litter; waterlogged sealed soil reports rot and raises loss; airing resets air, halves vapour and counts; old seal saves without air load with fresh air. Benchmark: a moss and fern jar at light 0.45 survives 365 untouched days with ≥10 plants. Existing tests whose numbers change from bacterial decay and new lifespans are re-baselined (litter baseline, lifespan constant, new trajectory fixture; old fixtures kept). Full suite, typecheck, build; browser seal → run → report → air, desktop and phone, no console errors.

## Seal Mode — before implementation, 2026-11-03

Unit: every refused input returns the identical world; light/temperature still apply; jar water constant to 1e-9 relative over 720 sealed hours in garden, woodland, meadow, wetland and colony worlds, vapour never negative, soil water within 0..100; open meadow loses >20% held water in 10 days while the sealed copy keeps more; save round trip mid-run continues identically; sealed save with rain or a future `since` is rejected; outcome running/survived/collapsed. Full suite, typecheck, build. Browser: seal a world, confirm inputs disabled, run to the goal, see the report, unseal, desktop and phone.

## Observatory — before implementation, 2026-11-03

Unit: sample values match the world; recorder appends one sample per new tick, ignores repeats, resets on backwards time and caps length; projection equals manual `stepWorld` replay, does not mutate its input, and is identical across runs. Full `npm test`, typecheck and build. Browser: open Observatory on a running world, switch metrics, compare two saved slots at desktop and 390px phone width with no horizontal overflow or console errors.

## Nursery and granary support — before implementation, 2026-10-31

Test the pure world-down placement using real imported larva/pupa bounds, existing rotation, egg dimensions, cohort stacking and supported food grains. Require finite offsets, nonmutation, preserved scale/count and actual vertices within the cavity. Keep adult support/contact regressions. Run all tests/typecheck/build. Reopen the compiled game, verify current adult follow and nursery/chamber picking, step real development, inspect floors from multiple angles and collect current errors/profile. If native input remains unreliable, record that gate as incomplete and do not expand to another visual feature.

## Cavity-supported ant presentation —before implementation,2026-10-29

Measure imported worker/queen bounds and check all support samples against the existing cavity field at rooms and transit fractions/headings. Require finite bounded offsets, nonmutation, safe fallback when the box cannot fit, and no jump across disconnected voids. Evaluate actual animated caste vertices against the selected support margin. Keep surface anchor and scale unchanged. Run tests/typecheck/build and inspect actual paused/live nest, selection and follow. Cache prepared field per graph and skip unchanged poses; measure native scene cost. This is rigid-body support, not per-foot IK or a solver correction.

## Final Daphnia integration and responsive continuation —2026-10-29

Re-run all tests/typecheck/build after final export and documentation edits. Restart only the disposable local preview if unavailable. Inspect current compiled capacity world and actual pond interaction; obtain real viewport dimensions before claiming phone/tablet QA. Preserve snapshots and private route. Record current verified results and limitations; no dependency/schema/solver change.

Result:194tests/typecheck/build passed. Actual compiled capacity world and pond inspected. Phone width measured390CSSpx, document378px, height844; selected/followed fish and imported water flea, literal Right dispatched; console errors[]. Exported static idle and body-relative gait passed independent vertex/pose review. Screenshot `daphnia-phone-390.png`. Browser controls require host-scale compensation for viewport dimensions; physical Safari remains unverified.

> Older entries are archived verbatim in `docs/archive/VERIFY-history-to-2026-10-29.md`. Read them only when a task needs that history.

