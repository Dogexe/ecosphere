import { useEffect, useRef, useState } from 'react'
import { Terrarium } from './scene/Terrarium'
import { ExperimentBook } from './ExperimentBook'
import { Observatory } from './Observatory'
import { SealPanel } from './SealPanel'
import { sealOutcome, sealWorld, unsealWorld, airJar, fogLevel } from './sim/seal'
import { recordSample } from './sim/observatory'
import type { ObservationSample } from './sim/observatory'
import { WorldStart } from './WorldStart'
import { JarBuilder } from './JarBuilder'
import { pocketWetness } from './sim/substrate'
import type { SavedSubstrate, Substrate } from './sim/substrate'
import { SoilMixture } from './SoilMixture'
import { Environment } from './Environment'
import { ColonyPanel } from './ColonyPanel'
import { RemainsPanel } from './RemainsPanel'
import { antFoodSources, colonyPlacementIssue, exportColony, introduceColony, seedMaterialAvailable } from './sim/colony'
import { beginDaylitWorld, environmentAt, scheduledRest } from './sim/climate'
import { defaultPond, isAquatic } from './sim/pond'
import { plantStage, woodlouseLife } from './sim/life'
import { createHabitatWorld, habitatStarts } from './sim/habitats'
import type { HabitatStart } from './sim/habitats'
import { createStressWorld } from './dev/stressWorld'
import { paperLook } from './scene/PaperCritter'
import { autosaveInterval, browserStore, readAutosave, writeAutosave } from './sim/autosave'
import { applySoilInput, beetleIsHunting, dominantLimit, createWorld, creatureCounts, creatureIsFeeding, creatureKind, introduceLife, intervene, interveneAt, nearestSoil, placementIssue, plantOutlook, predatorThreat, removeLife, simulateStep, vitality } from './sim/ecosystem'
import type { Intervention, Lifeform, PlantKind, SoilInput, StepResult, World } from './sim/ecosystem'

type Speed = 0 | 1 | 3

const plantNames: Record<PlantKind, string> = { bloom: 'Meadow bloom', fern: 'Soft fern', clover: 'Clover mound', moss: 'Moss cushion', grass: 'Meadow grass', tree: 'Broadleaf tree', lily: 'Water lily', reed: 'Pond reed' }
const plantNotes: Record<PlantKind, string> = {
  bloom: 'Flowers thrive in bright, fertile ground. Grazers eat their leaves when food is close.',
  fern: 'Ferns prefer damp, shaded ground. Their fronds offer little food to grazers.',
  clover: 'Clover handles drier ground and gives grazers a dependable meal.',
  moss: 'Moss stays low in moist shade and uses few nutrients. Grazers mostly pass it by.',
  grass: 'Fast-growing blades favor open sun. They provide food for grazers and compete for soil nutrients.',
  tree: 'A growing crown shades nearby plants and slows evaporation. Its roots still compete for local resources.',
  lily: 'Floating leaves use nutrients in the pond. Growth supplies oxygen; fallen material feeds microbial oxygen demand.',
  reed: 'A rooted aquatic producer. It competes with algae and lily for pond nutrients and responds to drying water.',
}
const nursery: { kind: Lifeform; name: string; niche: string }[] = [
  { kind: 'clover', name: 'Clover', niche: 'Sun · grazer food' },
  { kind: 'fern', name: 'Fern', niche: 'Damp · shade' },
  { kind: 'bloom', name: 'Bloom', niche: 'Sun · fertile soil' },
  { kind: 'moss', name: 'Moss', niche: 'Wet · shade' },
  { kind: 'grass', name: 'Grass', niche: 'Sun · fast grazer food' },
  { kind: 'tree', name: 'Tree', niche: 'Makes local shade' },
  { kind: 'grazer', name: 'Grazer', niche: 'Eats living leaves' },
  { kind: 'woodlouse', name: 'Woodlouse', niche: 'Moist · fallen leaves' },
  { kind: 'beetle', name: 'Ground beetle', niche: 'Hunts grazers & woodlice' },
  { kind: 'springtail', name: 'Springtail', niche: 'Moist · eats fungi' },
  { kind: 'lily', name: 'Water lily', niche: 'Pond · floating producer' },
  { kind: 'reed', name: 'Reed', niche: 'Pond · rooted producer' },
  { kind: 'flea', name: 'Water flea', niche: 'Pond · eats algae' },
  { kind: 'fish', name: 'Fish', niche: 'Pond · hunts water fleas' },
]

function statusFor(world: World) {
  const environment = environmentAt(world)
  const counts = creatureCounts(world.creatures)
  const grazers = world.creatures.filter((creature) => creatureKind(creature) === 'grazer')
  const colonyAnimals = (world.colony?.workers.length ?? 0) + (world.colony?.queen ? 1 : 0)
  if (counts.fish + counts.flea > 0 && world.pond.oxygen / Math.max(1, world.pond.water) < 0.25) return { label: 'The pond needs a breath', detail: 'Low oxygen is costing aquatic animals energy. Organic decay competes with them for oxygen.' }
  if (world.plants.length === 0 && counts.woodlouse + counts.springtail > 0) return { label: 'Life after the leaves', detail: 'The remaining litter and fungal food are finite. New producers can restart the green food web.' }
  if (world.plants.length === 0) return { label: 'Room for a new beginning', detail: 'Introduce a few plants to start the food web.' }
  if (world.water < 22) return { label: 'Thirsty roots', detail: 'The soil is drying. A little water would help.' }
  if (world.creatures.length + colonyAnimals === 0) return { label: 'A quiet world of plants', detail: 'Introduce a forager when there are leaves to spare.' }
  if (world.colony?.workers.length) return { label: 'Life beneath the roots', detail: 'Seed harvesters gather food, raise young and excavate when the colony needs room.' }
  if (environment.cycling && environment.solar === 0) return { label: 'The night shift', detail: 'Photosynthesis pauses. Maintenance and oxygen use continue; hunger can wake resting animals.' }
  if (counts.fish + counts.flea > 0) return { label: 'Life above and below', detail: 'Algae feed water fleas; fish hunt them. Plant growth, decay and oxygen connect the pond.' }
  if (world.light < 0.5 && world.plants.some((plant) => plant.kind === 'fern' || plant.kind === 'moss')) return { label: 'Life in the soft light', detail: 'Damp shade suits fern and moss. Sun-loving leaves may struggle here.' }
  if (world.light < 0.35) return { label: 'Seeking sunlight', detail: 'The sun-loving plants have little light to grow.' }
  if (grazers.length && grazers.reduce((sum, creature) => sum + creature.energy, 0) / grazers.length < 24) return { label: 'Hungry foragers', detail: 'The grazers need living plants to feed on.' }
  if (counts.grazer >= 5 && vitality(world) < 0.42) return { label: 'More mouths, fewer leaves', detail: 'The plants are under grazing pressure.' }
  if (counts.grazer >= 5) return { label: 'A busy patch of ground', detail: 'The grazers are sharing the available leaves.' }
  if (counts.grazer === 0 && counts.woodlouse > 0) return { label: 'The forest floor is busy', detail: 'Woodlice turn fallen matter into resources for new growth.' }
  if (vitality(world) < 0.42) return { label: 'A delicate balance', detail: 'The plants need time and better conditions.' }
  if (vitality(world) > 0.72) return { label: 'Full of green', detail: 'The plants hold a full canopy of leaves.' }
  return { label: 'Finding its rhythm', detail: 'The little world is settling into its own pace.' }
}

function Meter({ label, value, display, tone = 'green' }: { label: string; value: number; display: string; tone?: 'green' | 'blue' | 'gold' }) {
  return (
    <div className="meter">
      <div className="meter-top"><span>{label}</span><strong>{display}</strong></div>
      <div className="meter-track"><span className={`meter-fill ${tone}`} style={{ width: `${Math.max(2, Math.min(value, 100))}%` }} /></div>
    </div>
  )
}

export function App() {
  const query = new URLSearchParams(window.location.search)
  const stress = query.get('profile') === '1' && query.get('stress') === '1'
  // The last session comes back paused, with its Observatory history (never in the stress profile).
  const [resumed] = useState(() => stress ? null : readAutosave(browserStore()))
  const [session, setSession] = useState<StepResult>(() => ({ world: stress ? createStressWorld(query.get('dry') === '1') : resumed?.world ?? beginDaylitWorld(createWorld()), events: [] }))
  const { world, events } = session
  const [speed, setSpeed] = useState<Speed>(stress || resumed ? 0 : 1)
  const [selectedPlant, setSelectedPlant] = useState<number | null>(null)
  const [selectedCreature, setSelectedCreature] = useState<number | null>(null)
  const [selectedSoil, setSelectedSoil] = useState<number | null>(null)
  const [nurseryOpen, setNurseryOpen] = useState(false)
  // Cozy phone HUD: field notes sit in a pull-up sheet over the jar.
  const [sheetOpen, setSheetOpen] = useState(false)
  const [tool, setTool] = useState<Lifeform | 'colony' | null>(null)
  const [experimentsOpen, setExperimentsOpen] = useState(false)
  const [observatoryOpen, setObservatoryOpen] = useState(false)
  const [sealOpen, setSealOpen] = useState(false)
  const [history, setHistory] = useState<ObservationSample[]>(() => resumed?.history ?? [])
  const [worldStartOpen, setWorldStartOpen] = useState(false)
  const [building, setBuilding] = useState(false)
  const [worldRevision, setWorldRevision] = useState(0)
  const [mixtureOpen, setMixtureOpen] = useState(false)
  const [environmentOpen, setEnvironmentOpen] = useState(false)
  const [selectedPond, setSelectedPond] = useState(false)
  const [followCreature, setFollowCreature] = useState<number | null>(null)
  const [focusPlant, setFocusPlant] = useState<number | null>(null)
  const [underwater, setUnderwater] = useState(false)
  const [underground, setUnderground] = useState(false)
  const [selectedColony, setSelectedColony] = useState(false)
  const [selectedAnt, setSelectedAnt] = useState<number | null>(null)
  const [followAnt, setFollowAnt] = useState<number | null>(null)
  const [focusBrood, setFocusBrood] = useState(false)
  const [selectedBrood, setSelectedBrood] = useState<number | null>(null)
  const [focusChamber, setFocusChamber] = useState<number | null>(null)
  const [showAntFood, setShowAntFood] = useState(false)
  const [selectedRemains, setSelectedRemains] = useState<{ id: number; sourceId: number; form: string } | null>(null)
  const [notice, setNotice] = useState(resumed ? 'Welcome back. Your world is where you left it, paused. Press 1× to continue.' : '')
  const scene = useRef<HTMLElement>(null)

  useEffect(() => {
    if ((focusPlant !== null || followCreature !== null || followAnt !== null || focusBrood || focusChamber !== null || selectedRemains !== null) && window.matchMedia('(max-width: 760px)').matches) {
      scene.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }, [focusPlant, followCreature, followAnt, focusBrood, selectedBrood, focusChamber, selectedRemains])

  useEffect(() => {
    const ant = [world.colony?.queen, ...world.colony?.workers ?? []].find((item) => item?.id === followAnt)
    if (followAnt !== null && ant) { setUnderground(ant.location.kind === 'nest'); setUnderwater(false) }
    else if (followAnt !== null) {
      const body = world.remains.find((item) => item.age === 0 && item.ant?.sourceId === followAnt && ['queen', 'worker'].includes(item.ant.form))
      if (body) chooseRemains(body.id)
      else { setFollowAnt(null); setSelectedAnt(null) }
      setNotice('This ant has died. Its remaining body now returns material to the local soil food web.')
    }
    if (!world.colony && underground) setUnderground(false)
  }, [world.colony, world.remains, followAnt, underground])

  useEffect(() => {
    if (selectedRemains && !world.remains.some((item) => item.id === selectedRemains.id && item.ant?.sourceId === selectedRemains.sourceId && item.ant.form === selectedRemains.form)) {
      setSelectedRemains(null); setSelectedColony(!!world.colony && underground)
      setNotice(world.remains.some((item) => item.id === selectedRemains.id && !item.ant) ? 'These remains have joined nearby remains in the same soil pocket.' : 'These remains have finished returning their material to the local soil.')
    }
  }, [world.remains, selectedRemains, world.colony, underground])

  useEffect(() => {
    if (selectedBrood === null || world.colony?.brood.some((cohort) => cohort.id === selectedBrood)) return
    const birth = events.find((event) => event.type === 'ant' && event.action === 'birth' && event.broodId === selectedBrood)
    const body = world.remains.find((item) => item.age === 0 && item.ant?.sourceId === selectedBrood && ['egg', 'larva', 'pupa'].includes(item.ant.form))
    if (body) chooseRemains(body.id)
    else {
      clearSelection(); setSelectedColony(!!world.colony)
      if (birth?.type === 'ant') { setSelectedAnt(birth.id); setFollowAnt(birth.id); setUnderground(true); setUnderwater(false) }
    }
  }, [world.colony, world.remains, events, selectedBrood])

  function setWorld(update: World | ((current: World) => World)) {
    setSession((current) => ({ world: typeof update === 'function' ? update(current.world) : update, events: [] }))
  }

  // Observation only: one reading per model hour, never fed back into the world.
  useEffect(() => { setHistory((current) => recordSample(current, session.world)) }, [session.world])

  // Autosave: at most every few seconds while things change, and at once when the page is hidden or closed.
  const latest = useRef({ world: session.world, history })
  latest.current = { world: session.world, history }
  const lastAutosave = useRef(resumed ? Date.now() : 0)
  useEffect(() => {
    if (stress) return
    const save = () => { lastAutosave.current = Date.now(); writeAutosave(browserStore(), latest.current.world, latest.current.history) }
    const wait = autosaveInterval - (Date.now() - lastAutosave.current)
    if (wait <= 0) { save(); return }
    const timer = window.setTimeout(save, wait)
    return () => window.clearTimeout(timer)
  }, [session.world, history, stress])
  useEffect(() => {
    if (stress) return
    const flush = () => { lastAutosave.current = Date.now(); writeAutosave(browserStore(), latest.current.world, latest.current.history) }
    const hidden = () => { if (document.visibilityState === 'hidden') flush() }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', hidden)
    return () => { window.removeEventListener('pagehide', flush); document.removeEventListener('visibilitychange', hidden) }
  }, [stress])

  // Pause and show the report once when a sealed jar reaches its goal or collapses.
  const sealResult = session.world.sealed ? sealOutcome(session.world, () => null)?.status ?? null : null
  const lastSealResult = useRef(sealResult)
  useEffect(() => {
    if (sealResult && sealResult !== 'running' && lastSealResult.current === 'running') { setSpeed(0); setSealOpen(true) }
    lastSealResult.current = sealResult
  }, [sealResult])

  useEffect(() => {
    if (speed === 0) return
    const timer = window.setInterval(() => setSession((current) => simulateStep(current.world)), 480 / speed)
    return () => window.clearInterval(timer)
  }, [speed])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2700)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (selectedPlant !== null && !world.plants.some((plant) => plant.id === selectedPlant)) { setSelectedPlant(null); setFocusPlant(null) }
    if (selectedCreature !== null && !world.creatures.some((creature) => creature.id === selectedCreature)) { setSelectedCreature(null); setFollowCreature(null) }
  }, [world.plants, world.creatures, selectedPlant, selectedCreature])

  useEffect(() => {
    if (underwater && (world.pond ?? defaultPond()).water < 8) {
      setUnderwater(false)
      clearSelection()
      setNurseryOpen(false)
      setTool(null)
      setNotice('The pond is too shallow to explore. Refill it from the surface.')
    }
  }, [underwater, world.pond])

  useEffect(() => {
    const caught = events.find((event) => event.type === 'predation')
    const born = events.find((event) => event.type === 'birth')
    const died = events.find((event) => event.type === 'death')
    const mating = events.find((event) => event.type === 'mating')
    const newChamber = events.find((event) => event.type === 'ant' && event.action === 'chamber')
    const antBirth = events.find((event) => event.type === 'ant' && event.action === 'birth')
    const queenDied = events.find((event) => event.type === 'ant' && event.action === 'death' && event.id === 0)
    if (queenDied) setNotice('The ant queen has died. Egg production and nest construction stop; her remaining material returns to the soil food web.')
    else if (newChamber) setNotice('The workers opened a new resting chamber. Its tunnel is now part of their living nest.')
    else if (antBirth) setNotice('A pale worker emerges from its pupa. Larval food funded its body; its cuticle will mature in the nest.')
    else if (caught) setNotice(`A ${caught.predatorKind} caught a ${caught.preyKind === 'flea' ? 'water flea' : caught.preyKind}. Part of its meal returns to organic matter.`)
    else if (born) setNotice(born.kind === 'grazer' ? 'A new grazer has joined the world.' : born.kind === 'woodlouse' ? 'A mother releases a tiny woodlouse from her brood pouch.' : born.kind === 'springtail' ? 'Fungal food supports a new springtail.' : born.kind === 'beetle' ? 'A well-fed beetle funds a new generation.' : born.kind === 'fish' || born.kind === 'flea' ? 'A new aquatic generation begins.' : 'A propagule settles near its parent.')
    else if (mating) setNotice('Two woodlice paired. The female is carrying a funded brood.')
    else if (died) setNotice(died.reason === 'decline' ? 'A plant died; its remains slowly return to the soil.' : died.reason === 'age' ? `A ${died.kind} reached the end of its life; its remains begin to decay.` : died.reason === 'desiccation' ? 'A woodlouse dried out. Its remains can decompose when moisture returns.' : `A ${died.kind} ran out of energy; its remains begin to decay.`)
  }, [events])

  function act(action: Intervention, message: string) {
    setWorld((current) => selectedSoil !== null && (action.type === 'water' || action.type === 'compost') ? interveneAt(current, action.type, selectedSoil) : intervene(current, action))
    setNotice(selectedSoil !== null ? `${action.type === 'water' ? 'Water' : 'Compost'} settles into this patch.` : message)
  }

  function clearSelection() {
    setSelectedPlant(null)
    setSelectedCreature(null)
    setSelectedSoil(null)
    setSelectedPond(false)
    setFollowCreature(null)
    setFocusPlant(null)
    setSelectedAnt(null)
    setFollowAnt(null)
    setSelectedColony(false)
    setFocusBrood(false)
    setSelectedBrood(null)
    setFocusChamber(null)
    setShowAntFood(false)
    setSelectedRemains(null)
  }

  function toggleNursery() {
    clearSelection()
    setUnderground(false)
    setNurseryOpen(!nurseryOpen)
    setTool(nurseryOpen ? null : underwater ? 'lily' : 'clover')
  }

  function changeView() {
    clearSelection()
    setNurseryOpen(false)
    setTool(null)
    setUnderwater(!underwater)
    setSelectedPond(!underwater)
    setUnderground(false)
  }

  function changeNestView() {
    clearSelection(); setSelectedColony(true); setUnderwater(false)
    setUnderground(!underground); setNurseryOpen(false); setTool(null)
  }

  function chooseRemains(id: number) {
    const item = world.remains.find((remains) => remains.id === id)
    if (!item?.ant) return
    clearSelection(); setSelectedRemains({ id, sourceId: item.ant.sourceId, form: item.ant.form })
    setNurseryOpen(false); setTool(null)
    setUnderwater(false); setUnderground(item.ant.y < 0 && !!world.colony)
  }

  function chooseBrood(id: number) {
    if (!world.colony?.brood.some((cohort) => cohort.id === id)) return
    clearSelection(); setSelectedColony(true); setSelectedBrood(id); setFocusBrood(true)
    setNurseryOpen(false); setTool(null); setUnderwater(false); setUnderground(true)
  }

  function chooseTool(kind: Lifeform | 'colony') {
    setTool(kind)
    if (window.matchMedia('(max-width: 760px)').matches) {
      scene.current?.scrollIntoView({ block: 'center', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
    }
  }

  function place(x: number, z: number) {
    if (!tool) return
    if (tool === 'colony') {
      const issue = colonyPlacementIssue(world, x, z)
      if (issue) { setNotice(issue); return }
      setWorld((current) => introduceColony(current, x, z)); setSpeed(0)
      setTool(null); setNurseryOpen(false); clearSelection(); setSelectedColony(true)
      setNotice(antFoodSources(world.plants, x, z).length ? 'The colony arrives near a seed-bearing patch. Look inside, then press 1× to begin.' : 'The colony arrives with initial stores, but no seed-bearing patch is nearby yet. Inspect its food patches before starting.')
      return
    }
    const issue = placementIssue(world, tool, x, z)
    if (issue) { setNotice(issue); return }
    setWorld((current) => introduceLife(current, tool, x, z))
    setNotice(tool === 'grazer' ? 'A forager arrives, ready to explore.' : tool === 'woodlouse' ? 'A woodlouse arrives to forage in fallen leaves.' : tool === 'beetle' ? 'A ground beetle arrives. Nearby prey will keep their distance.' : tool === 'springtail' ? 'A springtail arrives. It needs living fungi and moist ground.' : tool === 'fish' ? 'A fish arrives. It needs oxygen and water fleas to hunt.' : tool === 'flea' ? 'A water flea arrives. Algae supply its meals.' : 'A propagule settles here. Moisture and suitable conditions let it develop.')
  }

  function remove(kind: 'plant' | 'creature', id: number) {
    setWorld((current) => removeLife(current, kind, id))
    clearSelection()
    setNotice('Moved out of the terrarium.')
  }

  function restore(snapshot: World) {
    setUnderwater(false)
    setUnderground(false)
    setHistory([])
    lastAutosave.current = 0
    setWorld(snapshot)
    setWorldRevision((revision) => revision + 1)
    setSpeed(0)
    clearSelection()
    setNurseryOpen(false)
    setTool(null)
    setExperimentsOpen(false)
    setNotice('Your experiment is restored.')
  }

  /** A jar the player built by hand: an empty world whose soil is as wet as they watered it. */
  function beginBuilt(substrate: SavedSubstrate, poured: Substrate) {
    const wet = pocketWetness(poured)
    const base = createHabitatWorld('bare', 2217)
    const soil = base.soil.map((patch) => ({ ...patch, water: wet[patch.id] }))
    begin('bare', 2217, { ...base, soil, water: soil.reduce((sum, patch) => sum + patch.water, 0) / soil.length, substrate })
    setBuilding(false)
    setNotice('Your jar is ready. Plant it, bring in life, and seal it when it feels right.')
  }

  function begin(start: HabitatStart, seed = 2217, prepared?: World) {
    setUnderwater(false)
    setUnderground(false)
    setHistory([])
    lastAutosave.current = 0
    setWorld(beginDaylitWorld(prepared ?? createHabitatWorld(start, seed)))
    setWorldRevision((revision) => revision + 1)
    setSpeed(0)
    clearSelection()
    setNurseryOpen(false)
    setTool(null)
    setWorldStartOpen(false)
    setNotice(`${habitatStarts.find((habitat) => habitat.id === start)!.name} begins. Press 1× when you are ready.`)
  }

  function mix(input: SoilInput) {
    const result = applySoilInput(world, input, selectedSoil ?? undefined)
    setWorld(result.world)
    setMixtureOpen(false)
    const { water, organic, nutrients, waterOutflow } = result.receipt
    const amount = (value: number) => Number(value.toFixed(1))
    setNotice(`${selectedSoil === null ? 'Tray total' : 'This pocket'}: +${amount(water)} water, +${amount(organic)} organic matter, +${amount(nutrients)} nutrients.${waterOutflow > 0 ? ` ${amount(waterOutflow)} excess water left the tray.` : ''}`)
  }

  const status = statusFor(world)
  const pond = world.pond ?? defaultPond()
  const populations = creatureCounts(world.creatures)
  const residents = underwater ? world.creatures.filter((creature) => isAquatic(creature.kind)) : world.creatures
  const selected = world.plants.find((plant) => plant.id === selectedPlant)
  const seedPhase = selected && ['seed', 'germinating'].includes(plantStage(selected))
  const selectedPatch = selected && world.soil?.length ? nearestSoil(world.soil, selected.x, selected.z) : null
  const selectedSeedMaterial = selected ? seedMaterialAvailable(selected) : 0
  const outlook = selected ? plantOutlook(world, selected) : null
  const focusedPatch = world.soil?.find((patch) => patch.id === selectedSoil)
  const focusedCreature = world.creatures.find((creature) => creature.id === selectedCreature)
  const focusedRemains = world.remains.find((item) => item.id === selectedRemains?.id && item.ant?.sourceId === selectedRemains.sourceId && item.ant.form === selectedRemains.form)
  const focusedKind = focusedCreature ? creatureKind(focusedCreature) : null
  const focusedLife = focusedCreature && focusedKind === 'woodlouse' ? woodlouseLife(focusedCreature) : null
  const offspring = focusedCreature ? world.creatures.find((creature) => creature.life?.parentId === focusedCreature.id) : undefined
  const creatureSoil = focusedCreature && world.soil?.length ? nearestSoil(world.soil, focusedCreature.x, focusedCreature.z) : null
  const focusedCreatureFeeding = focusedCreature ? creatureIsFeeding(world, focusedCreature, events) : false
  const fleeing = focusedCreature ? predatorThreat(world, focusedCreature) !== null : false
  const resting = focusedCreature ? scheduledRest(world, focusedCreature) && !fleeing && !focusedCreatureFeeding : false
  const environment = environmentAt(world)
  const plantVitality = Math.round(vitality(world) * 100)
  const sealed = !!world.sealed
  const sealStatus = sealed ? sealOutcome(world, dominantLimit) : null
  const day = String(Math.floor(world.tick / 24) + 1).padStart(2, '0')
  const hour = String(world.tick % 24).padStart(2, '0')

  return (
    <main className={`app-shell ${paperLook ? 'cozy' : ''} ${sheetOpen ? 'sheet-open' : ''} ${followCreature !== null || followAnt !== null || focusedRemains || focusPlant !== null || underwater || underground ? 'is-watching' : ''} ${underwater ? 'is-underwater' : ''} ${underground ? 'is-underground' : ''} ${environment.cycling && environment.solar < 0.3 ? environment.phase === 'night' ? 'is-night' : 'is-twilight' : ''}`}>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />

      <header className="site-header">
        <div className="brand" aria-label="Ecosphere">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>ECOSPHERE</span>
        </div>
        <div className="header-note"><span className="live-dot" /> A LIVING LITTLE WORLD</div>
        <div className="header-actions">
          <button className={`text-button ${sealed ? 'seal-badge' : ''}`} onClick={() => { setSpeed(0); setSealOpen(true) }} type="button">{sealStatus ? `Sealed · ${Math.min(sealStatus.day, sealStatus.goalDays)}/${sealStatus.goalDays}d` : 'Seal'}</button>
          <button className="text-button" onClick={() => { setSpeed(0); setObservatoryOpen(true) }} type="button">Observatory</button>
          <button className="text-button" onClick={() => { setSpeed(0); setExperimentsOpen(true) }} type="button">Experiments</button>
          <button className="text-button" onClick={() => { setSpeed(0); setWorldStartOpen(true) }} type="button">New world <span aria-hidden="true">↗</span></button>
        </div>
      </header>

      <section className="intro" aria-label="Welcome">
        <div className="eyebrow"><span className="eyebrow-line" /> THE TERRARIUM</div>
        <h1>A world that<br /><em>grows with you.</em></h1>
        <p>Give it water, light and something to feed on. Then watch life find its way.</p>
        <div className="status-line"><span className="status-orb" /><span><strong>{status.label}</strong><small>{status.detail}</small></span></div>
      </section>

      <section className="scene-wrap" ref={scene} aria-label="Interactive 3D terrarium">
        <div className="scene-halo" aria-hidden="true" />
        <Terrarium
          world={world} events={events} worldRevision={worldRevision} followCreature={followCreature} focusPlant={focusPlant} selectedPlant={selectedPlant} selectedCreature={selectedCreature} selectedSoil={selectedSoil} speed={speed} underwater={underwater}
          showAntFood={selectedColony && showAntFood} underground={underground} selectedAnt={selectedAnt} followAnt={followAnt} focusBrood={focusBrood} selectedBrood={selectedBrood} onSelectBrood={chooseBrood} focusChamber={focusChamber} focusedRemains={focusedRemains} onSelectRemains={chooseRemains}
          onSelectChamber={(id) => { clearSelection(); setSelectedColony(true); setFocusChamber(id); setUnderwater(false); setUnderground(true) }}
          onSelectAnt={(id) => { clearSelection(); setSelectedColony(true); setSelectedAnt(id) }}
          onSelectColony={() => { clearSelection(); setSelectedColony(true) }}
          placing={tool !== null} onPlace={place}
          onSelectPlant={(id) => { clearSelection(); setSelectedPlant(id) }}
          onSelectCreature={(id) => { clearSelection(); setSelectedCreature(id) }}
          onSelectSoil={(id) => { clearSelection(); setSelectedSoil(id) }}
          onSelectPond={() => { clearSelection(); setSelectedPond(true) }}
          onClearSelection={clearSelection}
        />
        {paperLook && !underwater && !underground && <><div className="diorama-blur top" aria-hidden="true" /><div className="diorama-blur bottom" aria-hidden="true" /><div className="window-light" aria-hidden="true" /></>}
        {sealed && !underwater && !underground && <div className="jar-fog" aria-hidden="true" style={{ opacity: fogLevel(world) * 0.6 }} />}
        <div className="scene-view-tools"><button className="scene-view-button" type="button" onClick={underground ? changeNestView : changeView} disabled={!underwater && !underground && pond.water < 8}>{underwater || underground ? '↑ Return to surface' : '↓ Explore the pond'}</button>{world.colony && !underwater && !underground && <button className="scene-view-button" type="button" onClick={changeNestView}>↓ Inside the nest</button>}</div>
        <div className={`scene-hint ${tool ? 'placing-hint' : ''}`}>{tool ? `PLACING ${tool.toUpperCase()} · TAP ${tool !== 'colony' && isAquatic(tool) ? 'WATER' : 'OPEN GROUND'}` : <>{underground ? 'SOIL CUTAWAY · DRAG TO LOOK' : underwater ? 'UNDER THE SURFACE · DRAG TO LOOK' : 'DRAG TO ORBIT'} <span>·</span> PINCH TO ZOOM <span>·</span> TWO FINGERS TO PAN</>}</div>
      </section>

      <aside key={`${selectedPlant}:${selectedCreature}:${selectedSoil}:${selectedPond}:${selectedAnt}:${selectedBrood}:${selectedRemains?.id}:${focusChamber}:${selectedColony}:${nurseryOpen}`} className={`pulse-panel ${nurseryOpen ? 'is-nursery' : selected ? 'has-plant' : selectedColony || selectedPond || underwater || focusedCreature || focusedRemains || focusedPatch ? 'is-focus' : ''}`} aria-label="Ecosystem state">
        {paperLook && <button className="sheet-handle" type="button" aria-expanded={sheetOpen} aria-label={sheetOpen ? 'Hide field notes' : 'Show field notes'} onClick={() => setSheetOpen(!sheetOpen)}><i aria-hidden="true" /></button>}
        <div className="panel-top"><span>FIELD NOTES</span><span className="panel-star" aria-hidden="true">✳</span></div>
        {nurseryOpen ? (
          <div className="nursery-view">
            <div className="panel-kicker">{world.plants.length} {world.plants.length === 1 ? 'PLANT' : 'PLANTS'} · {world.creatures.length} {world.creatures.length === 1 ? 'ANIMAL' : 'ANIMALS'}</div>
            <h2>Introduce life.</h2>
            <div className="nursery-grid" role="group" aria-label="Choose life to introduce">
              {nursery.filter(({ kind }) => !underwater || isAquatic(kind)).map(({ kind, name, niche }) => (
                <button key={kind} className={`nursery-card ${tool === kind ? 'chosen' : ''}`} onClick={() => chooseTool(kind)} type="button" aria-pressed={tool === kind}>
                  <span className={`life-icon ${kind}`} aria-hidden="true"><i /></span>
                  <span><strong>{name}</strong><small>{niche}</small></span>
                </button>
              ))}
              {!underwater && <button className={`nursery-card ${tool === 'colony' ? 'chosen' : ''}`} type="button" aria-pressed={tool === 'colony'} disabled={!!world.colony} onClick={() => chooseTool('colony')}><span className="colony-symbol" aria-hidden="true">♧</span><span><strong>Ant colony</strong><small>Queen · seed harvesters</small></span></button>}
            </div>
            <p className="nursery-help">Choose a lifeform, then tap {underwater || tool && tool !== 'colony' && isAquatic(tool) ? 'open water' : 'open ground'}. Its new life follows the conditions here.</p>
            <button className="back-link" onClick={toggleNursery} type="button">← Back to observing</button>
          </div>
        ) : focusedRemains ? <RemainsPanel remains={focusedRemains} onBack={() => { clearSelection(); setSelectedColony(!!world.colony && underground) }} /> : selectedColony && world.colony ? <ColonyPanel sealed={sealed}
          foodSources={antFoodSources(world.plants, world.colony.entrance.x, world.colony.entrance.z)} foodVisible={showAntFood}
          onFood={() => { clearSelection(); setSelectedColony(true); setUnderwater(false); setUnderground(false); setShowAntFood(!showAntFood) }}
          soil={world.soil}
          onTendSoil={(id) => { clearSelection(); setSelectedSoil(id); setUnderwater(false); setUnderground(false) }}
          onConstruction={(enabled) => setWorld({ ...world, colony: { ...world.colony!, construction: { enabled, removed: world.colony!.construction?.removed ?? 0, job: world.colony!.construction?.job ?? null } } })}
          chamber={focusChamber} onChamber={(id) => { clearSelection(); setSelectedColony(true); setFocusChamber(id); setUnderwater(false); setUnderground(true) }}
          colony={world.colony} selected={selectedAnt} following={followAnt} underground={underground}
          selectedBrood={selectedBrood} onSelectBrood={chooseBrood}
          onSelect={(id) => { clearSelection(); setSelectedColony(true); setSelectedAnt(id) }}
          onFollow={(id) => { setFocusChamber(null); setFocusBrood(false); setSelectedBrood(null); setFollowAnt(id) }}
          onView={changeNestView} onBrood={() => { const first = world.colony?.brood[0]; if (first) chooseBrood(first.id) }}
          onExport={() => { const receipt = exportColony(world); setWorld(receipt.world); clearSelection(); setUnderground(false); setNotice(`Colony and ${receipt.exported.toFixed(3)} material moved out. Existing remains stay in the soil.`) }}
        /> : focusedCreature ? (
          <div className="focus-view">
            <div className="panel-kicker">#{focusedCreature.id + 1} · {focusedCreature.stage ?? 'adult'} · {Math.floor((focusedCreature.age ?? 0) / 24)} model days old</div>
            <h2>{focusedKind === 'fish' ? 'Little fish' : focusedKind === 'flea' ? 'Water flea' : focusedKind === 'springtail' ? 'Little springtail' : focusedKind === 'woodlouse' ? 'Little woodlouse' : focusedKind === 'beetle' ? 'Ground beetle' : 'Little forager'}</h2>
            <p>{resting ? `${focusedKind === 'woodlouse' || focusedKind === 'springtail' ? 'Resting through the brighter hours.' : 'Resting through the dark hours.'} It still spends energy; severe hunger or danger can interrupt rest.` : focusedKind === 'fish' ? 'Hunts water fleas in the pond. Oxygen and a continuing prey population both matter.' : focusedKind === 'flea' ? 'Grazes the pond’s algae and is food for fish. Low oxygen or a dry pond can end its life.' : focusedKind === 'beetle'
              ? focusedCreatureFeeding ? 'Just caught a meal. Prey material supplies energy and a little returns to the litter.' : beetleIsHunting(world, focusedCreature) ? 'Searching nearby for grazers and woodlice. A catch must be close enough to touch.' : 'Resting after feeding, conserving energy until it needs another meal.'
              : fleeing ? 'Keeping away from a nearby beetle. Escape takes energy and time away from feeding.'
              : focusedKind === 'springtail' ? focusedCreatureFeeding ? 'Grazing living fungi and returning some material to litter and nutrients.' : 'Seeking fungi in moist ground. It cannot live on leaves or mineral nutrients alone.'
              : focusedKind === 'woodlouse'
              ? focusedLife?.activity === 'courting' ? 'Seeking a ready mate. Pairing needs close contact, reserves and a safe patch of ground.' : focusedLife?.activity === 'rehydrating' ? 'Moving toward wetter ground to replace lost body water.' : focusedLife?.activity === 'resting' ? focusedCreature.energy > 82 ? 'Resting with a full reserve, reducing the energy spent on movement.' : 'Pausing between movements. Food, moisture and possible mates shape its next choice.' : focusedLife?.brood ? 'Carrying young in a brood pouch. They need time and a moist litter refuge before release.' : creatureSoil && creatureSoil.water < 22 ? 'Dry ground raises its energy costs. It needs moisture and fallen leaves.' : focusedLife && focusedLife.gut > 0 ? 'Digesting leaf litter into energy, growing body material and waste returned to the soil.' : 'Searching the forest floor for moist leaf litter.'
              : focusedCreature.energy < 24 ? 'Running low on energy. It needs living plants to survive.' : focusedCreatureFeeding ? 'Nibbling nearby leaves and storing energy from its meal.' : 'Searching the terrarium for its next meal.'}</p>
            <Meter label="Energy" value={focusedCreature.energy} display={`${Math.round(focusedCreature.energy)}%`} tone="gold" />
            {focusedLife && <><div className="patch-litter">{focusedLife.sex} · {resting ? 'resting' : focusedLife.activity}{focusedLife.gut > 0 ? ' · digesting' : ''}<br />Body {focusedLife.mass.toFixed(3)} units{focusedLife.parentId !== null ? ` · Mother #${focusedLife.parentId + 1}` : ''}{focusedLife.brood > 0 ? ` · Brood ${focusedLife.gestation} h to release` : ''}</div><Meter label="Hydration" value={focusedLife.hydration} display={`${Math.round(focusedLife.hydration)}%`} tone="blue" /></>}
            {focusedKind === 'woodlouse' && creatureSoil && <Meter label="Nearby moisture" value={creatureSoil.water} display={`${Math.round(creatureSoil.water)}%`} tone="blue" />}
            <button className="back-link" type="button" onClick={() => setFollowCreature(followCreature === focusedCreature.id ? null : focusedCreature.id)}>{followCreature === focusedCreature.id ? 'Stop following' : 'Follow this animal'}</button>
            {offspring && <button className="back-link" type="button" onClick={() => { setSelectedCreature(offspring.id); setFollowCreature(offspring.id) }}>Observe offspring #{offspring.id + 1} →</button>}
            <button className="remove-link" disabled={sealed} onClick={() => remove('creature', focusedCreature.id)} type="button">Move out of terrarium</button>
            {residents.length > 1 && <button className="back-link" type="button" onClick={() => { const next = residents[(residents.findIndex((creature) => creature.id === focusedCreature.id) + 1) % residents.length]; clearSelection(); setSelectedCreature(next.id); setFollowCreature(next.id) }}>Watch next animal →</button>}
            <button className="back-link" onClick={clearSelection} type="button">← Whole ecosystem</button>
          </div>
        ) : selected ? (
          <div className="focus-view">
            <div className="panel-kicker">{plantStage(selected) === 'seed' && (selected.kind === 'moss' || selected.kind === 'fern') ? 'SPORE' : plantStage(selected).toUpperCase()} · {Math.floor((selected.age ?? 90) / 24)} DAYS</div>
            <h2>{plantNames[selected.kind]}</h2>
            {!underwater && <button className="back-link plant-focus-button" type="button" onClick={() => setFocusPlant(focusPlant === selected.id ? null : selected.id)}>{focusPlant === selected.id ? 'Return to overview' : 'Look closer'}</button>}
            <p>{plantNotes[selected.kind]}</p>
            {world.colony && <p className="colony-note">{selectedSeedMaterial > 0.00001 ? `${selectedSeedMaterial < 0.001 ? '<0.001' : selectedSeedMaterial.toFixed(3)} seed-bearing material is available here. Workers must reach this plant and carry it home.` : ['clover', 'grass', 'bloom'].includes(selected.kind) ? ['mature', 'senescent'].includes(plantStage(selected)) ? 'Mature, but not enough leaf cover for harvestable seed material. More than 70% cover is needed to supply the seed harvesters.' : 'Still developing. Once mature, this plant also needs more than 70% leaf cover before seed harvesters can use it.' : 'This plant does not supply the seed harvesters. Other roles in the food web can still use the habitat it creates.'}</p>}
            {selected.parentId !== null && selected.parentId !== undefined && <div className="patch-litter">From parent plant #{selected.parentId + 1}</div>}
            {seedPhase && <div className="plant-outlook"><strong>Living on stored material</strong><span>Moisture and temperature govern emergence. Stored material sustains this propagule until it can photosynthesize.</span></div>}
            {outlook && !seedPhase && <div className="plant-outlook"><strong>{outlook.dark ? 'Living through the night' : outlook.change > 0.001 ? 'Growing before grazing' : outlook.change < -0.001 ? 'Losing leaves before grazing' : 'Holding its leaves'}</strong><span>{outlook.dark ? 'No photosynthesis in darkness. Maintenance and leaf turnover continue until daylight returns.' : outlook.fit > 0.65 ? 'These conditions suit it; leaves still turn over.' : outlook.limiting === 'rot' ? 'Its roots sit in waterlogged soil and are rotting.' : outlook.limiting === 'co2' ? 'The sealed air is short of CO2 for photosynthesis.' : outlook.limiting === 'temperature' ? 'Temperature is limiting its growth.' : outlook.limiting === 'water' ? 'Moisture is furthest from its needs.' : outlook.limiting === 'light' ? 'Light is furthest from its preference.' : 'Available nutrients are its main constraint.'} Neighbors and grazers can change the outcome.</span></div>}
            <Meter label={seedPhase ? 'Stored material' : 'Leaf cover'} value={selected.biomass / selected.capacity * 100} display={seedPhase ? `${selected.biomass.toFixed(2)} units` : `${Math.round(selected.biomass / selected.capacity * 100)}%`} />
            {isAquatic(selected.kind) ? <Meter label="Pond water" value={pond.water} display={`${Math.round(pond.water)}%`} tone="blue" /> : selectedPatch && <Meter label="Nearby soil water" value={selectedPatch.water} display={`${Math.round(selectedPatch.water)}%`} tone="blue" />}
            {outlook && <div className="patch-litter">{Math.round(outlook.localLight * 100)}% local light after canopy shade</div>}
            {!isAquatic(selected.kind) && selectedPatch && <button className="back-link" type="button" onClick={() => { clearSelection(); setSelectedSoil(selectedPatch.id) }}>Tend this plant's soil →</button>}
            <button className="remove-link" disabled={sealed} onClick={() => remove('plant', selected.id)} type="button">Move out of terrarium</button>
            <button className="back-link" onClick={clearSelection} type="button">← Whole ecosystem</button>
          </div>
        ) : selectedPond || underwater ? <div className="focus-view">
          <div className="panel-kicker">THE AQUATIC FOOD WEB</div><h2>Life in the pond.</h2>
          <p>{populations.fish + populations.flea > 0 ? 'Producers, algae grazers and hunters share this water. Decay and respiration compete for oxygen.' : 'Algae already grow here. Introduce water fleas before a hungry fish to build a food web.'}</p>
          <Meter label="Water" value={pond.water} display={`${Math.round(pond.water)} units`} tone="blue" />
          <Meter label="Oxygen" value={pond.oxygen / Math.max(1, pond.water) * 100} display={`${Math.round(pond.oxygen / Math.max(1, pond.water) * 100)}%`} />
          <div className="patch-litter">{pond.algae.toFixed(1)} algae · {pond.nutrients.toFixed(1)} nutrients · {pond.organic.toFixed(1)} organic</div>
          {underwater && <p className="pond-visibility-note">Algae and decaying matter soften visibility. The same food web continues above and below.</p>}
          {underwater && residents.length > 0 && <button className="back-link" type="button" onClick={() => { const resident = residents.find((creature) => creature.kind === 'fish') ?? residents[0]; setSelectedCreature(resident.id); setFollowCreature(resident.id) }}>Watch pond life →</button>}
          {underwater && residents.length === 0 && <button className="back-link" type="button" onClick={toggleNursery}>Introduce pond life →</button>}
          <button className="back-link" type="button" onClick={() => { setSpeed(0); setEnvironmentOpen(true) }}>Tend pond & climate →</button>
          <button className="back-link" type="button" onClick={underwater ? changeView : clearSelection}>{underwater ? '↑ Return to surface' : '← Whole ecosystem'}</button>
        </div> : focusedPatch ? (
          <div className="focus-view">
            <div className="panel-kicker">SOIL POCKET {String(focusedPatch.id + 1).padStart(2, '0')}</div>
            <h2>A patch of ground.</h2>
            <p>Water or compost here to see what this corner of the world supports.</p>
            <div className="meter-stack">
              <Meter label="Soil water" value={focusedPatch.water} display={`${Math.round(focusedPatch.water)}%`} tone="blue" />
              <Meter label="Nutrients" value={focusedPatch.nutrients} display={`${Math.round(focusedPatch.nutrients)} units`} tone="gold" />
              <Meter label="Fungal life" value={focusedPatch.fungi * 12} display={`${focusedPatch.fungi.toFixed(1)} units`} />
            </div>
            <div className="patch-litter">{Math.round(focusedPatch.organic)} units of organic matter to recycle</div>
            <button className="back-link" onClick={() => setSelectedSoil(null)} type="button">← Whole ecosystem</button>
          </div>
        ) : (
          <>
            <div className="panel-kicker">RIGHT NOW IN YOUR WORLD</div>
            <h2>{status.label}</h2>
            <p className="overview-note">{status.detail}</p>
            {world.plants.length === 0 && <button className="back-link" type="button" onClick={toggleNursery}>Introduce new producers →</button>}
            <div className="meter-stack">
              <Meter label="Soil water" value={world.water} display={`${Math.round(world.water)}%`} tone="blue" />
              <Meter label="Leaf cover" value={plantVitality} display={`${plantVitality}%`} />
              <Meter label="Soil nutrients" value={world.nutrients} display={`${Math.round(world.nutrients)} units`} tone="gold" />
            </div>
            <div className="panel-foot"><span><b>{populations.grazer + populations.flea}</b> grazers · <b>{populations.woodlouse + populations.springtail}</b> recyclers</span><span><b>{populations.beetle + populations.fish}</b> hunters</span></div>
            {world.creatures.length > 0 && <button className="back-link" type="button" onClick={() => { const resident = world.creatures.find((creature) => creature.stage === 'juvenile') ?? world.creatures[0]; setSelectedCreature(resident.id); setFollowCreature(resident.id) }}>Watch an animal →</button>}
          </>
        )}
      </aside>

      <div className="day-indicator" aria-live="off"><span>DAY {day}</span><strong>{hour}:00</strong>{environment.cycling && <span className="phase-label">{environment.phase.toUpperCase()} · {environment.temperatureC.toFixed(1)}°</span>}<span className="day-separator">/</span><span>{speed === 0 ? 'PAUSED' : `${speed}× TIME`}</span>{speed === 0 && <button className="step-hour" type="button" aria-label="Advance one model hour" onClick={() => setSession((current) => simulateStep(current.world))}>+1h</button>}</div>

      <section className="control-dock" aria-label="Terrarium controls">
        <div className="dock-heading"><span>{sealed ? 'SEALED · LIGHT & WARMTH ONLY' : underwater ? 'TEND YOUR POND' : 'TEND YOUR WORLD'}</span><div className="dock-tools"><button className="mixture-toggle" type="button" onClick={() => { setSpeed(0); setEnvironmentOpen(true) }}>Environment</button>{!underwater && <button className="mixture-toggle" type="button" disabled={sealed} onClick={() => { setSpeed(0); setMixtureOpen(true) }}>Soil mixture</button>}<button className="nursery-toggle" disabled={sealed && !nurseryOpen} onClick={toggleNursery} aria-expanded={nurseryOpen} type="button">{nurseryOpen ? 'Close nursery −' : 'Introduce life +'}</button></div></div>
        <div className="dock-content">
          <div className="input-actions">
            <button className="action-button water-button" type="button" disabled={sealed} onClick={() => act({ type: underwater ? 'pond-water' : 'water' }, underwater ? 'Fresh water refills the pond.' : 'Fresh water soaks into the soil.')}>
              <span className="action-symbol water-symbol" aria-hidden="true">●</span><span><strong>{underwater ? 'Refill pond' : selectedSoil === null ? 'Add water' : 'Water this spot'}</strong><small>{underwater ? 'Support water life' : selectedSoil === null ? 'Moisten the soil' : 'Focus this patch'}</small></span><span className="action-plus">+</span>
            </button>
            <button className="action-button compost-button" type="button" disabled={sealed} onClick={() => act({ type: underwater ? 'pond-organic' : 'compost' }, underwater ? 'Pond litter begins to decompose. Decay uses oxygen.' : 'Organic matter begins to decompose.')}>
              <span className="action-symbol compost-symbol" aria-hidden="true">✳</span><span><strong>{underwater ? 'Add pond litter' : selectedSoil === null ? 'Add compost' : 'Feed this spot'}</strong><small>{underwater ? 'Decay uses oxygen' : selectedSoil === null ? 'Feed the ground' : 'Focus this patch'}</small></span><span className="action-plus">+</span>
            </button>
          </div>
          <div className="sun-control">
            <div className="control-label"><span>{environment.cycling ? 'Daylight' : 'Sunlight'}</span><strong>{environment.cycling ? `Peak ${Math.round(world.light * 100)}%` : world.light < 0.36 ? 'Shade' : world.light < 0.68 ? 'Dappled' : 'Bright'}</strong></div>
            <input type="range" min="0.18" max="1" step="0.01" value={world.light} aria-label="Sunlight" onChange={(event) => setWorld((current) => intervene(current, { type: 'light', value: Number(event.target.value) }))} />
            <div className="range-labels"><span>SHADE</span><span>FULL SUN</span></div>
          </div>
          <div className="time-control">
            <div className="control-label"><span>Time</span><strong>{speed === 0 ? 'Resting' : 'Flowing'}</strong></div>
            <div className="speed-buttons" role="group" aria-label="Simulation speed">
              {([0, 1, 3] as const).map((rate) => <button key={rate} className={speed === rate ? 'active' : ''} onClick={() => setSpeed(rate)} aria-pressed={speed === rate} type="button">{rate === 0 ? 'Ⅱ' : `${rate}×`}</button>)}
            </div>
          </div>
        </div>
      </section>
      {notice && <div className="notice" role="status">{notice}</div>}
      <SealPanel open={sealOpen} world={world} onClose={() => setSealOpen(false)} onSeal={(goalDays) => { setWorld((current) => sealWorld(current, goalDays)); setSealOpen(false); setNurseryOpen(false); setTool(null); setNotice(`Sealed for ${goalDays} days. Press 1× or 3× to let time run.`) }} onUnseal={() => { setWorld((current) => unsealWorld(current)); setSealOpen(false); setNotice('The seal is open. You can tend the world again.') }} onAir={() => { setWorld((current) => airJar(current)); setNotice('You lifted the lid for a moment. Fresh room air is inside; the seal is back on.') }} onObserve={() => { setSealOpen(false); setObservatoryOpen(true) }} />
      <Observatory open={observatoryOpen} history={history} onClose={() => setObservatoryOpen(false)} />
      <ExperimentBook open={experimentsOpen} world={world} onClose={() => setExperimentsOpen(false)} onLoad={restore} />
      <WorldStart open={worldStartOpen} onClose={() => setWorldStartOpen(false)} onBegin={(start, seed) => begin(start, seed)} onBuild={paperLook ? () => { setWorldStartOpen(false); setSpeed(0); setBuilding(true) } : undefined} onKeep={() => { setWorldStartOpen(false); setExperimentsOpen(true) }} />
      <SoilMixture open={mixtureOpen} patchId={selectedSoil} onClose={() => setMixtureOpen(false)} onApply={mix} />
      {building && <JarBuilder onFinish={beginBuilt} onCancel={() => setBuilding(false)} />}
      <Environment open={environmentOpen} world={world} sealed={sealed} onClose={() => setEnvironmentOpen(false)} onAct={(action) => { setWorld((current) => intervene(current, action)) }} />
    </main>
  )
}
