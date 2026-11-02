import { useEffect, useRef, useState } from 'react'
import type { SoilInput } from './sim/ecosystem'

type Props = { open: boolean; patchId: number | null; onClose: () => void; onApply: (input: SoilInput) => void }
const recipes: { name: string; input: SoilInput }[] = [
  { name: 'Water', input: { water: 18, organic: 0, nutrients: 0 } },
  { name: 'Litter', input: { water: 0, organic: 16, nutrients: 0 } },
  { name: 'Mineral feed', input: { water: 0, organic: 0, nutrients: 10 } },
]
const components = [
  { key: 'water', label: 'Water', detail: 'Moisture for roots and the litter web.', tone: 'blue' },
  { key: 'organic', label: 'Organic matter', detail: 'Food for fungi and woodlice; nutrients need processing.', tone: 'green' },
  { key: 'nutrients', label: 'Available nutrients', detail: 'Directly available to roots. This does not feed recyclers.', tone: 'gold' },
] as const

export function SoilMixture({ open, patchId, onClose, onApply }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [input, setInput] = useState<SoilInput>({ water: 8, organic: 8, nutrients: 0 })
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  const empty = input.water + input.organic + input.nutrients === 0
  return (
    <dialog ref={dialog} className="experiment-dialog mixture-dialog" onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close() }} aria-labelledby="mixture-title">
      <div className="experiment-content">
        <div className="experiment-heading"><span className="eyebrow">SOIL EXPERIMENT</span><form method="dialog"><button className="dialog-close" autoFocus type="submit" aria-label="Close soil mixture">×</button></form></div>
        <h2 id="mixture-title">What will you put back?</h2>
        <p className="experiment-intro">Mix the resources, then watch who uses them. Amounts are relative model units per soil pocket.</p>
        <div className="mixture-target">APPLY TO <strong>{patchId === null ? 'All four soil pockets' : `Soil pocket ${String(patchId + 1).padStart(2, '0')}`}</strong><span>{patchId === null ? 'Each pocket receives the amounts below.' : 'The other three pockets stay unchanged.'} Time is paused.</span></div>
        <div className="recipe-buttons" role="group" aria-label="Soil recipes">{recipes.map((recipe) => <button type="button" key={recipe.name} aria-pressed={components.every(({ key }) => input[key] === recipe.input[key])} onClick={() => setInput({ ...recipe.input })}>{recipe.name}</button>)}</div>
        <div className="mixture-components">{components.map(({ key, label, detail, tone }) => (
          <label className={`mixture-component ${tone}`} key={key}>
            <span className="control-label"><span>{label}</span><output>{input[key]} units</output></span>
            <input type="range" min="0" max="20" step="1" value={input[key]} aria-label={`${label} dose`} onChange={(event) => setInput((current) => ({ ...current, [key]: Number(event.target.value) }))} />
            <small>{detail}</small>
          </label>
        ))}</div>
        <div className="mixture-foot"><p>Water above a pocket's capacity leaves the modeled tray. These three stocks do not represent complete chemistry.</p><button className="load-experiment" type="button" disabled={empty} onClick={() => onApply(input)}>{empty ? 'Choose an amount' : 'Add mixture'}<span aria-hidden="true">＋</span></button></div>
      </div>
    </dialog>
  )
}
