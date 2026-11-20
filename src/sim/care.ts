import { creatureKind, plantStress, simulateStep, type CreatureKind, type PlantKind, type World } from './ecosystem.ts'
import { environmentAt } from './climate.ts'
import { defaultPond, isAquatic } from './pond.ts'
import { co2Ppm, o2Percent } from './seal.ts'

/**
 * Early warnings (systems pass item 2, 2026-11-20). A real keeper notices a jar
 * going wrong from small signs a day or two ahead: soil pulling away from the
 * glass, yellowing leaves, stale-smelling air. The game has no such slow cues
 * yet, so it looks ahead instead: it runs the unchanged simulation forward on a
 * copy, with no player action, and reports what would die or fail and why, with
 * the one action that answers it. It never changes the world it is given.
 */

export type CareCause =
  | 'dry' | 'soggy' | 'dim' | 'bright' | 'cold' | 'hot' | 'hungry-soil' | 'stale-air'
  | 'pond-low' | 'pond-oxygen' | 'hungry-animals' | 'colony'
export type CareAdvice = 'water' | 'compost' | 'shade' | 'brighten' | 'air' | 'unseal' | 'refill-pond' | 'pond-litter' | 'climate' | 'hold-water' | 'none'

export interface CareAlert {
  id: CareCause
  severity: 'urgent' | 'soon'
  /** Model hours from now until the first loss or threshold, in the forecast. */
  inHours: number
  title: string
  detail: string
  advice: CareAdvice
  plants: number[]
  creatures: number[]
}

export const forecastHours = 48
/** Within this many model hours a warning is urgent. */
export const urgentHours = 24
/** A plant that would lose this share of its biomass counts as failing even if it lives. */
export const declineShare = 0.45
export const drySoil = 18
export const lowPond = 10
export const pondOxygenFloor = 0.3
export const staleCO2 = 30000
export const lowO2 = 16
export const heatC = 33

const plantName: Record<PlantKind, [string, string]> = {
  clover: ['clover', 'clover plants'], fern: ['fern', 'ferns'], bloom: ['violet', 'violets'], moss: ['moss', 'moss cushions'],
  grass: ['grass tuft', 'grass tufts'], tree: ['tree', 'trees'], lily: ['lily pad', 'lily pads'], reed: ['reed', 'reeds'],
}
const animalName: Record<CreatureKind, [string, string]> = {
  grazer: ['grazer', 'grazers'], woodlouse: ['woodlouse', 'woodlice'], beetle: ['beetle', 'beetles'], springtail: ['springtail', 'springtails'],
  flea: ['water flea', 'water fleas'], fish: ['fish', 'fish'], snail: ['snail', 'snails'], shrimp: ['shrimp', 'shrimp'],
}
const named = (names: [string, string], count: number) => `${count === 1 ? 'a' : count} ${names[count === 1 ? 0 : 1]}`

function list(kinds: string[], names: Record<string, [string, string]>) {
  const counts = new Map<string, number>()
  for (const kind of kinds) counts.set(kind, (counts.get(kind) ?? 0) + 1)
  const parts = [...counts].sort((a, b) => b[1] - a[1]).map(([kind, count]) => named(names[kind], count))
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
}

function plantCause(limit: string, side: 'low' | 'high'): CareCause {
  if (limit === 'water') return side === 'high' ? 'soggy' : 'dry'
  if (limit === 'rot') return 'soggy'
  if (limit === 'light') return side === 'high' ? 'bright' : 'dim'
  if (limit === 'temperature') return side === 'high' ? 'hot' : 'cold'
  if (limit === 'co2') return 'stale-air'
  return 'hungry-soil'
}

function adviceFor(cause: CareCause, sealed: boolean, hot: boolean): CareAdvice {
  switch (cause) {
    case 'dry': return sealed ? 'unseal' : 'water'
    case 'soggy': return sealed ? 'air' : 'hold-water'
    case 'dim': return 'brighten'
    case 'bright': return 'shade'
    case 'hot': return sealed || hot ? 'shade' : 'climate'
    case 'cold': return 'climate'
    case 'hungry-soil': return sealed ? 'unseal' : 'compost'
    case 'stale-air': return 'air'
    case 'pond-low': case 'pond-oxygen': return sealed ? 'unseal' : 'refill-pond'
    case 'hungry-animals': return sealed ? 'none' : 'compost'
    case 'colony': return 'none'
  }
}

const reasonText: Record<CareCause, string> = {
  dry: 'the soil is drying out',
  soggy: 'the soil is waterlogged',
  dim: 'there is too little light',
  bright: 'the light is too strong for them',
  cold: 'it is too cold',
  hot: 'the jar is overheating',
  'hungry-soil': 'the soil has run short of nutrients',
  'stale-air': 'the air inside the jar is stale',
  'pond-low': 'the pond is drying up',
  'pond-oxygen': 'the pond is running out of oxygen',
  'hungry-animals': 'there is too little food',
  colony: 'the colony cannot gather enough food',
}

export const adviceText: Record<CareAdvice, string> = {
  water: 'Add water',
  compost: 'Add compost',
  shade: 'Move into shade',
  brighten: 'Give more light',
  air: 'Lift the lid',
  unseal: 'Open the seal',
  'refill-pond': 'Refill the pond',
  'pond-litter': 'Add pond litter',
  climate: 'Adjust warmth',
  'hold-water': 'Hold off watering',
  none: '',
}

const adviceDetail: Record<CareAdvice, string> = {
  water: 'A splash of water now will help.',
  compost: 'Compost feeds the soil and the animals that recycle it.',
  shade: 'Slide the light down a little.',
  brighten: 'Slide the light up a little.',
  air: 'A moment of fresh room air resets the jar.',
  unseal: 'A sealed jar cannot take water or food; open it to tend, then seal it again.',
  'refill-pond': 'Fresh water tops it up and carries oxygen.',
  'pond-litter': 'Litter feeds the pond floor.',
  climate: 'Change the room temperature in Environment.',
  'hold-water': 'Let it dry out for a day or two, with a bit more light.',
  none: 'It may pass on its own; watch how it goes.',
}

type Loss = { hour: number; cause: CareCause; plant?: { id: number; kind: PlantKind }; creature?: { id: number; kind: CreatureKind } }

/**
 * Run the jar forward `hours` model hours on a copy, untouched, and collect the
 * troubles that a player can still do something about. Ageing out is natural
 * and never warned about. Sorted: urgent first, then soonest.
 */
export function careForecast(world: World, hours = forecastHours): CareAlert[] {
  const sealed = !!world.sealed
  const losses: Loss[] = []
  const thresholds = new Map<CareCause, number>()
  const mark = (cause: CareCause, hour: number) => { if (!thresholds.has(cause)) thresholds.set(cause, hour) }
  const startPond = (world.pond ?? defaultPond()).water
  const start = new Map(world.plants.map((plant) => [plant.id, plant]))
  const stress = new Map<number, CareCause>()
  let hot = false
  let w = world
  // Already past a line: warn now (hour 0) rather than never.
  const soilLife = world.plants.some((plant) => !isAquatic(plant.kind)) || world.creatures.some((creature) => !isAquatic(creatureKind(creature)))
  if (world.soil.length && soilLife && world.water < drySoil) mark('dry', 0)
  if (world.creatures.some((creature) => isAquatic(creatureKind(creature))) && startPond < lowPond) mark('pond-low', 0)
  for (let hour = 1; hour <= hours; hour++) {
    // The cause of a plant's decline, read before the step that could kill it.
    if (hour === 1 || hour % 3 === 0) for (const plant of w.plants) {
      if (plant.biomass > plant.capacity * 0.8) continue
      const { limit, side } = plantStress(w, plant)
      stress.set(plant.id, plantCause(limit, side))
    }
    const { world: next, events } = simulateStep(w)
    for (const event of events) {
      if (event.type === 'death' && event.reason !== 'age') {
        const plantBefore = w.plants.find((plant) => plant.id === event.id && plant.kind === event.kind)
        if (plantBefore) losses.push({ hour, cause: stress.get(plantBefore.id) ?? plantCause(plantStress(w, plantBefore).limit, plantStress(w, plantBefore).side), plant: { id: plantBefore.id, kind: plantBefore.kind } })
        else {
          const creature = w.creatures.find((item) => item.id === event.id)
          const kind = creature ? creatureKind(creature) : event.kind as CreatureKind
          losses.push({ hour, cause: event.reason === 'desiccation' ? 'dry' : 'hungry-animals', creature: { id: event.id, kind } })
        }
      } else if (event.type === 'ant' && event.action === 'death') {
        const ant = w.colony?.queen?.id === event.id ? w.colony.queen : w.colony?.workers.find((item) => item.id === event.id)
        if (ant && ant.age < (ant.caste === 'queen' ? 80000 : 4000)) losses.push({ hour, cause: 'colony' })
      }
    }
    w = next
    const env = environmentAt(w)
    if (w.soil.length && soilLife && w.water < drySoil) mark('dry', hour)
    const pond = w.pond ?? defaultPond()
    if (startPond >= lowPond && pond.water < lowPond) mark('pond-low', hour)
    const aquaticLife = w.creatures.some((creature) => isAquatic(creatureKind(creature)))
    if (aquaticLife && pond.water > 1 && pond.oxygen / pond.water < pondOxygenFloor) mark('pond-oxygen', hour)
    if (w.sealed && (co2Ppm(w.sealed.co2) > staleCO2 || o2Percent(w.sealed.o2) < lowO2)) mark('stale-air', hour)
    if (env.temperatureC >= heatC) { mark('hot', hour); hot = true }
  }
  // Plants that live but shrink badly.
  for (const plant of w.plants) {
    const before = start.get(plant.id)
    if (!before || before.biomass < before.capacity * 0.2 || plant.biomass > before.biomass * (1 - declineShare)) continue
    if (losses.some((loss) => loss.plant?.id === plant.id)) continue
    losses.push({ hour: hours, cause: stress.get(plant.id) ?? 'hungry-soil', plant: { id: plant.id, kind: plant.kind } })
  }

  const causes = new Set<CareCause>([...losses.map((loss) => loss.cause), ...thresholds.keys()])
  const alerts: CareAlert[] = []
  for (const cause of causes) {
    const mine = losses.filter((loss) => loss.cause === cause)
    const first = Math.min(thresholds.get(cause) ?? Infinity, ...mine.map((loss) => loss.hour))
    const plants = mine.flatMap((loss) => loss.plant ? [loss.plant] : [])
    const animals = mine.flatMap((loss) => loss.creature ? [loss.creature] : [])
    const ants = mine.filter((loss) => loss.cause === 'colony').length
    const recyclers = animals.filter((a) => a.kind === 'woodlouse' || a.kind === 'springtail').length
    const pondFloor = animals.filter((a) => a.kind === 'snail' || a.kind === 'shrimp').length
    const advice = cause !== 'hungry-animals' || sealed ? adviceFor(cause, sealed, hot)
      : recyclers * 2 > animals.length ? 'compost' : pondFloor * 2 > animals.length ? 'pond-litter' : 'none'
    const when = first <= 0 ? 'now' : first <= 12 ? 'within hours' : first <= urgentHours ? 'within a day' : 'in the next two days'
    const victims = [plants.length ? list(plants.map((p) => p.kind), plantName) : '', animals.length ? list(animals.map((a) => a.kind), animalName) : '', ants ? named(['ant', 'ants'], ants) : ''].filter(Boolean).join(' and ')
    const title = victims
      ? `${victims[0].toUpperCase()}${victims.slice(1)} ${first <= 0 ? 'will' : 'may'} ${plants.length && !animals.length && !ants && mine.every((loss) => loss.hour === hours) ? 'wither' : 'die'} ${when}`
      : cause === 'dry' ? first <= 0 ? 'The soil is dry' : `The soil will be dry ${when}`
      : cause === 'pond-low' ? first <= 0 ? 'The pond is nearly empty' : `The pond will be nearly empty ${when}`
      : cause === 'pond-oxygen' ? `Pond oxygen will run low ${when}`
      : cause === 'stale-air' ? `The jar air will turn stale ${when}`
      : cause === 'hot' ? `The jar will overheat ${when}` : `Trouble ${when}`
    alerts.push({
      id: cause,
      severity: first <= urgentHours && (victims || cause !== 'hot') ? 'urgent' : 'soon',
      inHours: first,
      title,
      detail: `${victims ? `Because ${reasonText[cause]}. ` : ''}${adviceDetail[advice]}`,
      advice,
      plants: plants.map((p) => p.id),
      creatures: animals.map((a) => a.id),
    })
  }
  return alerts.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'urgent' ? -1 : 1) || a.inHours - b.inHours || b.plants.length + b.creatures.length - a.plants.length - a.creatures.length)
}
