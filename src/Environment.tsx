import { useEffect, useRef } from 'react'
import type { Intervention, World } from './sim/ecosystem'
import { defaultClimate, defaultPond } from './sim/pond'
import { environmentAt } from './sim/climate'

type Props = { open: boolean; world: World; onClose: () => void; onAct: (action: Intervention) => void }
export function Environment({ open, world, onClose, onAct }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { if (open) dialog.current?.showModal(); else dialog.current?.close() }, [open])
  const climate = world.climate ?? defaultClimate()
  const pond = world.pond ?? defaultPond()
  const oxygen = pond.oxygen / Math.max(1, pond.water) * 100
  const environment = environmentAt(world)
  return <dialog ref={dialog} className="experiment-dialog mixture-dialog" onClose={onClose} aria-labelledby="environment-title">
    <div className="experiment-content">
      <div className="experiment-heading"><span className="eyebrow">CONDITIONS & WATER</span><form method="dialog"><button className="dialog-close" autoFocus type="submit" aria-label="Close environment">×</button></form></div>
      <h2 id="environment-title">Change the conditions.</h2>
      <p className="experiment-intro">Warmth changes metabolism and evaporation. Rain is an external water supply to soil and pond. Time is paused.</p>
      <div className="cycle-control"><div><strong>Day & night</strong><p>Daytime leaves, nighttime litter life. Hungry animals can wake to forage.</p></div><button type="button" aria-pressed={environment.cycling} onClick={() => onAct({ type: 'day-night', value: environment.cycling ? 0 : 1 })}>{environment.cycling ? 'Cycle on' : 'Cycle off'}</button></div>
      {environment.cycling && <p className="cycle-now">{String(environment.hour).padStart(2, '0')}:00 · {environment.phase} · {environment.temperatureC.toFixed(1)}°C now · {Math.round(environment.light * 100)}% light</p>}
      <div className="mixture-components">
        <label className="mixture-component gold"><span className="control-label"><span>{environment.cycling ? 'Baseline warmth' : 'Temperature'}</span><output>{climate.temperatureC}°C</output></span><input type="range" min="0" max="40" step="1" aria-label="Temperature" value={climate.temperatureC} onChange={(event) => onAct({ type: 'temperature', value: Number(event.target.value) })} />{environment.cycling && <small>Gentle daily variation around this setting; warmest after midday.</small>}</label>
        <label className="mixture-component blue"><span className="control-label"><span>Rainfall</span><output>{Math.round(climate.rainfall * 100)}%</output></span><input type="range" min="0" max="1" step="0.05" aria-label="Rainfall" value={climate.rainfall} onChange={(event) => onAct({ type: 'rain', value: Number(event.target.value) })} /><small>At 0%, only your water inputs replace evaporation.</small></label>
      </div>
      <div className="pond-readout"><strong>Your pond</strong><span>{Math.round(pond.water)} water · {pond.algae.toFixed(1)} algae · {Math.round(oxygen)}% oxygen</span><p>{oxygen < 30 ? 'Oxygen is scarce. Organic breakdown and animal respiration consume it.' : environment.cycling && environment.solar === 0 ? 'Darkness pauses photosynthetic oxygen supply. Respiration and decay continue; air exchange can still replenish some oxygen.' : 'Algae and plants supply oxygen. Too much decaying matter can put animals under pressure.'}</p></div>
      <div className="recipe-buttons pond-inputs"><button type="button" onClick={() => onAct({ type: 'pond-water' })}>Refill pond +18</button><button type="button" onClick={() => onAct({ type: 'pond-nutrients' })}>Nutrients +8</button><button type="button" onClick={() => onAct({ type: 'pond-organic' })}>Organic +12</button></div>
      <p className="storage-note">Relative stocks and simplified oxygen cycling. No calibrated water chemistry or atmospheric carbon budget.</p>
    </div>
  </dialog>
}
