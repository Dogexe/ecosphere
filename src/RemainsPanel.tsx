import type { Remains } from './sim/life'

export function RemainsPanel({ remains, onBack }: { remains: Remains; onBack: () => void }) {
  const ant = remains.ant!
  const returned = remains.initial - remains.material
  const name = ant.form === 'queen' ? 'The queen' : ant.form === 'worker' ? `Worker #${ant.sourceId}` : `${ant.form === 'larva' ? 'Larval' : ant.form === 'pupa' ? 'Pupal' : 'Egg'} cohort #${ant.sourceId}`
  return <div className="focus-view colony-panel">
    <div className="panel-kicker">LIFE RETURNS TO THE SOIL</div>
    <h2>{name}<br />at rest.</h2>
    <p>This life has ended. Its remaining body and food now belong to the soil food web. Moisture and local fungi determine how quickly the material returns.</p>
    <div className="patch-litter">{Math.round(remains.material / remains.initial * 100)}% of the material remains<br />{remains.age < 24 ? `${remains.age} model hours` : `${Math.floor(remains.age / 24)} model days`} since death<br />{ant.y < 0 ? `Depth ${(-ant.y).toFixed(2)} world units` : 'On the surface'}<br />{ant.count > 1 ? `${ant.count} organisms in this cohort` : 'One individual'}</div>
    <p className="colony-note">{returned === 0 ? 'No material has returned to the local soil yet.' : returned < 0.001 ? 'A trace of material has returned to the local soil.' : `${returned.toFixed(3)} material has returned to the local soil.`} Dry soil slows the process; decomposition continues while you observe other lives.</p>
    <button className="back-link" type="button" onClick={onBack}>← Return to observing</button>
  </div>
}
