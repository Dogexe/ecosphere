import type { AntColony } from './sim/colony'
import { antLimits, antSoilAt } from './sim/colony'
import type { Plant, SoilPatch } from './sim/ecosystem'
import { digRequired } from './sim/excavation'
import { excavationSite, nestCrowded } from './sim/excavation'

export function ColonyPanel({ colony, soil, foodSources, foodVisible, selected, following, underground, chamber, selectedBrood, onSelectBrood, onSelect, onFollow, onView, onBrood, onExport, onChamber, onConstruction, onFood, onTendSoil, sealed = false }: { colony: AntColony; sealed?: boolean; soil: SoilPatch[]; foodSources: Plant[]; foodVisible: boolean; selected: number | null; following: number | null; underground: boolean; chamber: number | null; selectedBrood: number | null; onSelectBrood: (id: number) => void; onSelect: (id: number) => void; onFollow: (id: number | null) => void; onView: () => void; onBrood: () => void; onExport: () => void; onChamber: (id: number) => void; onConstruction: (enabled: boolean) => void; onFood: () => void; onTendSoil: (id: number) => void }) {
  const ants = [colony.queen, ...colony.workers].filter((ant) => ant !== null)
  const ant = ants.find((item) => item.id === selected)
  const room = colony.nodes.find((node) => node.id === chamber)
  const cohort = colony.brood.find((item) => item.id === selectedBrood)
  const stageName = cohort?.stage === 'egg' ? 'Egg' : cohort?.stage === 'larva' ? 'Larval' : 'Pupal'
  const larvalFood = cohort ? Math.max(0, (cohort.count * 0.039 - cohort.material) / 0.75) : 0
  const unattendedLarva = cohort?.stage === 'larva' && larvalFood > 0 && colony.workers.length === 0
  const roomName = (role: string) => role === 'food' ? 'Granary' : role === 'brood' ? 'Nursery' : role === 'rest' ? 'Rest chamber' : 'Queen chamber'
  const job = colony.construction?.job
  const digWater = antSoilAt(soil, excavationSite(colony)).water
  const nurserySoil = antSoilAt(soil, colony.nodes.find((node) => node.role === 'brood')!)
  const nurseryWater = nurserySoil.water
  const workNote = !colony.queen ? 'The queen is lost. No more eggs will be laid, and construction has stopped.'
    : colony.workers.length < 3 ? 'Too few workers to build. Feeding and tending young come first.'
    : !colony.construction?.enabled ? 'Nest expansion is paused.'
    : digWater <= 20 ? 'The excavation face is too dry. Moisten the soil above it.'
    : digWater >= 88 ? 'The excavation face is saturated. Work waits for it to drain.'
    : colony.food <= 0.12 ? 'Food is too scarce to build. Workers need mature seed-bearing clover, grass or flowers.'
    : !nestCrowded(colony) ? 'There is enough refuge space for this generation.'
    : 'Workers balance construction with feeding, nursing and their own reserves.'
  return <div className="focus-view colony-panel">
    <div className="panel-kicker">ONE COLONY · SEED HARVESTERS</div>
    <h2>{ant ? ant.caste === 'queen' ? 'The queen' : `Worker #${ant.id}` : cohort ? `${stageName} cohort #${cohort.id}` : room ? `${roomName(room.role)} · #${room.id}` : 'A world below.'}</h2>
    {cohort && <div className="brood-observation">
      <div className="panel-kicker">A GENERATION TAKING SHAPE</div>
      <p>{cohort.stage === 'egg' ? 'The queen funded this egg with digested material. It develops in the nursery, then hatches into a hungry larva.' : cohort.stage === 'larva' ? 'A nurse must bring food here. Digested deliveries build the larval body; time alone cannot turn an underfed larva into a worker.' : 'The funded larval body is changing into a worker. Pupae do not eat; a newly emerged worker will be pale and stay inside the nest while its cuticle matures.'}</p>
      <div className="patch-litter">{cohort.count} {cohort.count === 1 ? 'individual' : 'individuals'} · queen #{cohort.parentId}<br />{cohort.age.toFixed(1)} development hours in this stage<br />{(cohort.material / cohort.count).toFixed(4)} body material per individual<br />{cohort.stage === 'larva' ? `${larvalFood.toFixed(4)} more delivered food needed for pupation` : 'No feeding at this stage'}</div>
      <p className="colony-note">Nursery soil water {Math.round(nurseryWater)}%. {unattendedLarva ? `No workers are available to deliver food. This larva needs a nurse before it can pupate; body maintenance continues.${nurseryWater / 55 <= 0.25 ? ' Dry soil has also paused its developmental clock.' : ''}` : nurseryWater / 55 <= 0.25 ? 'Dry nursery soil has paused development; body maintenance still uses material.' : cohort.stage === 'larva' && larvalFood > 0 ? 'Waiting for enough nurse-delivered food and at least 24 development hours.' : cohort.stage === 'pupa' && colony.workers.length + cohort.count > antLimits.workers ? 'Worker capacity is full. Development can continue, but emergence must wait; maintenance still uses material.' : `Needs ${cohort.stage === 'egg' ? '12' : '24'} development hours in this stage and suitable moisture. Temperature sets the pace.`} {!unattendedLarva && 'Keep observing to follow the first worker that emerges.'}</p>
      <button className="back-link" type="button" onClick={() => onTendSoil(nurserySoil.id)}>Tend soil above the nursery →</button>
    </div>}
    <div className="plant-outlook"><strong>{!colony.queen ? 'A colony without its queen' : colony.food <= 0.12 ? 'The granary needs food' : 'Life shapes the nest'}</strong><span>{workNote}</span></div>
    <p className="colony-note">{foodSources.length ? `${foodSources.length} mature food ${foodSources.length === 1 ? 'patch' : 'patches'} near the entrance. Workers must collect and carry its seed-bearing material home.` : 'No seed-bearing patches near the entrance right now. Clover, grass and flowers need mature, well-grown foliage; grazing and shade can leave too little.'}</p>
    <button className="back-link" type="button" aria-pressed={foodVisible} onClick={onFood}>{foodVisible ? 'Hide food patches' : 'Show food patches on the surface'}</button>
    {foodVisible && <p className="colony-note">Green rings have food now. Gold rings mark compatible plants that need growth or recovery. Tap a plant to inspect its conditions.</p>}
    {room && <div className="patch-litter">Depth {(-room.y).toFixed(2)} world units<br />Nearby soil water {Math.round(antSoilAt(soil, room).water)}%<br />{room.role === 'food' ? `${colony.food.toFixed(3)} stored food material. Workers must visit to eat and load nursery meals.` : room.role === 'brood' ? 'Eggs develop here; larval growth needs a visiting nurse with food.' : room.role === 'rest' ? 'A worker refuge. Resting adults use this space instead of crowding the granary.' : 'The queen receives carried meals here and pays for each egg.'}<br />{colony.edges.filter(([a, b]) => a === room.id || b === room.id).length} connected passages</div>}
    {room && <button className="back-link" type="button" onClick={() => onTendSoil(antSoilAt(soil, room).id)}>Tend soil above this chamber →</button>}
    <p>{ant ? ant.activity === 'excavating' ? 'Working at the connected tunnel face. Each piece of displaced soil costs reserve; colony crowding and soil moisture decide whether work can continue.' : ant.activity === 'nursing' ? 'Carrying food to the queen or growing larvae. When stores are empty, a ready returning forager can bring its harvest directly. Only food delivered in their chamber can nourish them.' : ant.activity === 'carrying' ? 'Bringing collected reproductive material back into the nest.' : ant.activity === 'foraging' ? 'Seeking seeds from mature clover, grass and flowers. Young plants and spores cannot feed this colony.' : ant.activity === 'brooding' ? 'A fertile introduced queen. Eggs cost her digested food and reserve; workers must replenish her meals.' : ant.activity === 'feeding' ? 'Going to the granary for a meal. Digestion supplies reserve and returns waste to the soil.' : 'Conserving reserve or moving within the nest. Food, age, moisture and daylight set the next task.' : 'Watch workers gather seeds, stock their granary and nourish a new generation. A colony needs mature seed-bearing plants and moist soil.'}</p>
    {ant && <>
      <div className="patch-litter">{ant.stage} · {Math.floor(ant.age / 24)} model days old<br />{ant.location.kind === 'surface' ? 'On the surface' : 'Inside the nest'} · {ant.activity}<br />Reserve {Math.round(ant.energy)}% · Hydration {Math.round(ant.hydration)}%<br />Gut {ant.gut.toFixed(3)} · Carrying {ant.carried.toFixed(3)} material</div>
      <button className="back-link" type="button" onClick={() => onFollow(following === ant.id ? null : ant.id)}>{following === ant.id ? 'Stop following ant' : 'Follow this ant'}</button>
    </>}
    <div className="patch-litter">{colony.queen ? 'Queen alive' : 'Queen lost'} · {colony.workers.length} workers<br />Granary {colony.food.toFixed(3)} material<br />{['egg', 'larva', 'pupa'].map((stage) => `${colony.brood.filter((cohort) => cohort.stage === stage).reduce((sum, cohort) => sum + cohort.count, 0)} ${stage === 'larva' ? 'larvae' : stage === 'pupa' ? 'pupae' : 'eggs'}`).join(' · ')}</div>
    <div className="ant-roster" role="group" aria-label="Colony individuals">{ants.map((item) => <button key={item.id} type="button" aria-label={item.caste === 'queen' ? 'Inspect queen' : `Inspect worker ${item.id}`} aria-pressed={selected === item.id} onClick={() => onSelect(item.id)}>{item.caste === 'queen' ? 'Queen' : `#${item.id}`}<small>{item.stage === 'teneral' ? 'new' : item.location.kind === 'surface' ? 'outside' : 'nest'}</small></button>)}</div>
    {colony.brood.length > 0 && <div className="ant-roster" role="group" aria-label="Developing ant cohorts">{colony.brood.map((item) => <button key={item.id} type="button" aria-label={`Inspect ${item.stage} cohort ${item.id}`} aria-pressed={selectedBrood === item.id} onClick={() => onSelectBrood(item.id)}>{item.stage === 'egg' ? 'Egg' : item.stage === 'larva' ? 'Larva' : 'Pupa'} #{item.id}<small>{item.count} · {item.age.toFixed(0)} h</small></button>)}</div>}
    <div className="ant-roster" role="group" aria-label="Nest chambers">{colony.nodes.filter((node) => node.role !== 'entrance' && node.role !== 'junction').map((node) => <button key={node.id} type="button" aria-label={`Inspect ${node.role} chamber ${node.id}`} aria-pressed={chamber === node.id} onClick={() => onChamber(node.id)}>{roomName(node.role)}<small>depth {(-node.y).toFixed(2)}</small></button>)}</div>
    <div className="patch-litter">{colony.nodes.length} connected spaces · {colony.edges.length} tunnels<br />{job ? `New refuge · ${Math.floor(job.work / digRequired(colony, job) * 100)}% excavated` : 'Expansion follows colony crowding and food reserves.'}<br />{(colony.construction?.removed ?? 0).toFixed(4)} soil volume displaced</div>
    <button className="back-link" type="button" onClick={() => onConstruction(!colony.construction?.enabled)}>{colony.construction?.enabled ? 'Pause nest expansion' : 'Allow nest expansion'}</button>
    <p className="colony-note">Excavation soil water {Math.round(digWater)}%. Builders spend reserve at the face. Hungry workers feed first; dry or saturated soil and low stores suspend work.</p>
    <button className="back-link" type="button" onClick={onView}>{underground ? '↑ Return to surface' : '↓ Look inside the nest'}</button>
    {colony.brood.length > 0 && <button className="back-link" type="button" onClick={onBrood}>Observe developing young →</button>}
    <p className="colony-note">Development takes compressed model time. Larvae grow from delivered food; newly emerged workers stay the same body size.</p>
    <button className="remove-link" type="button" disabled={sealed} onClick={onExport}>Move colony and stores out</button>
  </div>
}
