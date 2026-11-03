import { useEffect, useRef, useState } from 'react'
import { dominantLimit } from './sim/ecosystem'
import type { World } from './sim/ecosystem'
import { co2Ppm, fogLevel, heldWater, o2Percent, sealGoals, sealOutcome } from './sim/seal'
import { environmentAt } from './sim/climate'

type Props = { open: boolean; world: World; onClose: () => void; onSeal: (goalDays: number) => void; onUnseal: () => void; onAir: () => void; onObserve: () => void }

const limitWords = {
  water: 'Water is what the plants are shortest of.',
  light: 'Light is what the plants are shortest of.',
  nutrients: 'Root nutrients are what the plants are shortest of.',
  temperature: 'Temperature is what holds the plants back most. Bright light heats a sealed jar.',
  co2: 'The plants have used up the CO2 in the jar air. They can only grow as fast as soil life breathes it back, or when you air the jar.',
  rot: 'Some roots sit in waterlogged soil and are rotting. Open the seal for a while to let the jar dry.',
} as const

export function SealPanel({ open, world, onClose, onSeal, onUnseal, onAir, onObserve }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [goal, setGoal] = useState<number>(30)

  useEffect(() => {
    if (!open) { dialog.current?.close(); return }
    dialog.current?.showModal()
  }, [open])

  const outcome = sealOutcome(world, dominantLimit)
  const held = heldWater(world)
  const airings = world.sealed?.airings ?? 0
  const fog = fogLevel(world)
  const headline = !outcome ? 'Close the lid. Watch what lasts.'
    : outcome.status === 'collapsed' ? `The jar collapsed on day ${outcome.day + 1}.`
      : outcome.status === 'survived' ? `Your jar lasted ${outcome.goalDays} days.`
        : `Sealed · day ${outcome.day + 1} of ${outcome.goalDays}`

  return (
    <dialog ref={dialog} className="experiment-dialog seal-dialog" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }} aria-labelledby="seal-title">
      <div className="experiment-content">
        <div className="experiment-heading"><span className="eyebrow">SEAL MODE</span><form method="dialog"><button className="dialog-close" autoFocus type="submit" aria-label="Close seal mode">×</button></form></div>
        <h2 id="seal-title">{headline}</h2>
        {!outcome ? <>
          <p className="experiment-intro">Sealing closes the jar. You can no longer add water, soil, compost or life, rain stops, and nothing can be moved out. Water condenses on the glass and runs back. Fallen leaves rot back into nutrients and CO2, and plants turn that CO2 back into leaves and oxygen. Light still gets in, and bright light heats the jar.</p>
          <div className="observatory-tabs" role="group" aria-label="Goal">
            {sealGoals.map((days) => <button key={days} type="button" aria-pressed={goal === days} className={goal === days ? 'active' : ''} onClick={() => setGoal(days)}>{days} days</button>)}
          </div>
          <p className="storage-note">The jar survives if producers (plants or pond algae) are still alive after {goal} days. Opening the seal ends the experiment early.</p>
          <div className="import-actions"><button className="load-experiment" type="button" onClick={() => onSeal(goal)}>Seal the jar for {goal} days</button></div>
        </> : <>
          <div className="seal-progress" role="progressbar" aria-valuemin={0} aria-valuemax={outcome.goalDays} aria-valuenow={Math.min(outcome.day, outcome.goalDays)} aria-label="Days sealed"><i style={{ width: `${Math.min(100, outcome.day / outcome.goalDays * 100)}%` }} className={outcome.status} /></div>
          <dl className="seal-readout">
            <div><dt>Plants</dt><dd>{world.plants.length}</dd></div>
            <div><dt>Animals</dt><dd>{world.creatures.length + (world.colony?.workers.length ?? 0) + (world.colony?.queen ? 1 : 0)}</dd></div>
            <div><dt>Pond algae</dt><dd>{world.pond.algae.toFixed(1)}</dd></div>
            <div><dt>Jar temperature</dt><dd>{Math.round(environmentAt(world).temperatureC)} °C</dd></div>
            <div><dt>Oxygen</dt><dd>{o2Percent(world.sealed?.o2 ?? 0).toFixed(1)}%</dd></div>
            <div><dt>CO2</dt><dd>{Math.round(Math.max(0, co2Ppm(world.sealed?.co2 ?? 0))).toLocaleString()} ppm</dd></div>
            <div><dt>Water held</dt><dd>{Math.round(held)}</dd></div>
            <div><dt>Fog on the glass</dt><dd>{fog < 0.2 ? 'Clear' : fog < 0.6 ? 'Light' : 'Heavy'}</dd></div>
            <div><dt>Soil nutrients</dt><dd>{Math.round(world.nutrients)}</dd></div>
          </dl>
          <p className="experiment-intro">{outcome.status === 'collapsed' ? 'No plants or algae remain to capture light, so nothing can rebuild the food web.' : outcome.status === 'survived' ? 'Producers are still alive. You can keep watching, or open the seal to tend it again.' : 'Producers are alive. Time keeps running until the goal.'} {outcome.limiting ? limitWords[outcome.limiting] : ''}</p>
          <p className="storage-note">{airings ? `Aired ${airings} ${airings === 1 ? 'time' : 'times'}. Airing swaps the jar air for room air, as keepers do for fresh CO2.` : 'Never aired. Everything inside is the jar\'s own.'} Normal air is about 21% oxygen and 420 ppm CO2.</p>
          <div className="import-actions">
            <button className="save-experiment" type="button" onClick={onObserve}>See the graphs</button>
            <button className="save-experiment" type="button" onClick={onAir}>Air it for a moment</button>
            <button className="load-experiment" type="button" onClick={onUnseal}>Open the seal</button>
          </div>
        </>}
      </div>
    </dialog>
  )
}
