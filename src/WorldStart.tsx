import { useEffect, useRef, useState } from 'react'
import { habitatStarts } from './sim/habitats'
import type { HabitatStart } from './sim/habitats'

type Props = { open: boolean; onClose: () => void; onBegin: (start: HabitatStart, seed: number) => void; onKeep: () => void }

export function WorldStart({ open, onClose, onBegin, onKeep }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [chosen, setChosen] = useState<HabitatStart>('garden')
  const [seed, setSeed] = useState('2217')
  const validSeed = /^\d+$/.test(seed) && Number(seed) <= 4294967295
  const selected = habitatStarts.find((start) => start.id === chosen)!
  useEffect(() => {
    if (!open) { dialog.current?.close(); return }
    setChosen('garden')
    dialog.current?.showModal()
  }, [open])

  return (
    <dialog ref={dialog} className="experiment-dialog world-dialog" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }} aria-labelledby="world-title">
      <div className="experiment-content">
        <div className="experiment-heading"><span className="eyebrow">A NEW POSSIBILITY</span><form method="dialog"><button className="dialog-close" autoFocus type="submit" aria-label="Close new world">×</button></form></div>
        <h2 id="world-title">Where will life begin?</h2>
        <p className="experiment-intro">Choose the conditions. Let the living world find its way. Every start uses the same ecological rules.</p>
        <div className="habitat-choices" role="group" aria-label="Starting habitat">
          {habitatStarts.map((start) => (
            <button key={start.id} className={`habitat-card ${start.id} ${chosen === start.id ? 'chosen' : ''}`} aria-pressed={chosen === start.id} type="button" onClick={() => setChosen(start.id)}>
              <span className="habitat-vignette" aria-hidden="true"><span className="habitat-ground" />{start.icons.map((kind, index) => <span className={`life-icon ${kind} habitat-sprout sprout-${index}`} key={index}><i /></span>)}<span className="habitat-check">✓</span></span>
              <span className="habitat-copy"><small>{start.subtitle}</small><strong>{start.name}</strong><span>{start.description}</span></span>
            </button>
          ))}
        </div>
        <div className="habitat-details" aria-live="polite"><span className="slot-label">{selected.residents}</span><p><strong>Something to try</strong>{selected.experiment}</p></div>
        <label className="seed-field">World seed<input aria-label="World seed" inputMode="numeric" maxLength={10} value={seed} onChange={(event) => setSeed(event.target.value)} /><small>{validSeed ? 'The same seed and actions follow the same path.' : 'Use a whole number from 0 to 4294967295.'}</small></label>
        <div className="world-start-actions"><button className="save-experiment" type="button" onClick={onKeep}>Keep current world first</button><button className="load-experiment" type="button" disabled={!validSeed} onClick={() => onBegin(chosen, Number(seed))}>Begin {selected.name.toLowerCase()} <span aria-hidden="true">↗</span></button></div>
        <p className="storage-note">Beginning replaces the unsaved world. Your two saved experiments stay in the field book. Time is paused.</p>
      </div>
    </dialog>
  )
}
