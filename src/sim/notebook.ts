import type { Lifeform, SimulationEvent, World } from './ecosystem'
import { environmentAt } from './climate.ts'
import { plantFlowering } from './life.ts'
import { fogLevel } from './seal.ts'

/**
 * The field notebook (2026-11-04, owner-approved progression: "a notebook
 * filled by observing real events"). Pages fill when the thing actually
 * happens in the jar: a species is present, the solver reports an event, or
 * the jar reaches a state. Nothing is scripted or granted, and the notebook
 * only reads the world; it never changes it.
 *
 * The notebook belongs to the player, not to one jar: it lives in its own
 * browser key beside the autosave and survives starting a new world.
 */
export const notebookKey = 'ecosphere.notebook'
/** The journal keeps this many recent lines (oldest dropped first). */
export const journalLimit = 300

export type PageKind = 'species' | 'behaviour' | 'jar'
export type Source = { label: string; url: string }
export type Page = {
  id: string
  kind: PageKind
  title: string
  /** Scientific name of the real species the paper/scanned art is sized from. */
  latin?: string
  /** Real size used for the jar's 19 mm-per-unit scale. */
  size?: string
  /** Shown on a blank page: where to look. */
  hint: string
  /** The real-world note, written as a naturalist would. */
  note: string
  /** Where the game simplifies, said plainly. */
  inJar?: string
  sources: Source[]
}

const src = (label: string, url: string): Source => ({ label, url })
const bmig = src('British Myriapod & Isopod Group: Porcellio scaber', 'https://bmig.org.uk/species/Porcellio-scaber')
const marsupium = src('Porcellio embryos in the marsupium (PMC3335405)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3335405/')
const daphnia = src('Animal Diversity Web: Daphnia pulex', 'https://animaldiversity.org/accounts/Daphnia_pulex/')
const harvesters = src('Tschinkel & Kwapich 2016, harvester ant seed stores', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5125654/')

export const pages: Page[] = [
  // ---------- Species ----------
  { id: 'clover', kind: 'species', title: 'Creeping wood sorrel', latin: 'Oxalis corniculata', size: 'leaflets 4–13 mm',
    hint: 'Plant clover, or start a jar that has it.',
    note: 'Three heart-shaped leaflets, often mistaken for clover. At night and on cloudy days the leaves and flowers fold up, and they open again when the sun returns.',
    inJar: 'The jar draws it from a scanned sorrel; in the simulation it is the dependable leaf food for foragers.',
    sources: [src('VicFlora: Oxalis corniculata', 'https://vicflora.rbg.vic.gov.au/flora/taxon/03e89a07-eece-441a-b2c5-ccdb949c862a'), src('Brooklyn Botanic Garden: yellow wood sorrel', 'https://bbg.org/news/weed_of_the_month_yellow_wood_sorrel')] },
  { id: 'fern', kind: 'species', title: 'Young fern', size: 'about 2 cm high in this jar',
    hint: 'Plant a fern in damp shade.',
    note: 'Ferns have no flowers. They make spores in small clusters called sori, usually on the underside of the fronds. Turn a frond over to look.',
    sources: [src('University of Maine Extension: ferns', 'https://extension.umaine.edu/blueberries/?p=6044')] },
  { id: 'bloom', kind: 'species', title: 'Meadow bloom',
    hint: 'Plant a bloom in bright, fertile soil.',
    note: 'An annual: it grows, flowers and dies within one season, so its seeds carry it on. Flowering waits until the plant has a full cover of leaves.',
    inJar: 'A general flowering annual, not one named species. It lives about 120 days.',
    sources: [src('Wikipedia: Annual plant', 'https://en.wikipedia.org/wiki/Annual_plant')] },
  { id: 'moss', kind: 'species', title: 'Moss cushion',
    hint: 'Plant moss somewhere wet and shady.',
    note: 'Moss has no true roots. Rhizoids hold it to the ground, and with no veins water passes from cell to cell. Some mosses hold about 20 times their weight in water.',
    sources: [src('University of Minnesota Extension: The wild world of moss', 'https://extension.umn.edu/node/167441')] },
  { id: 'grass', kind: 'species', title: 'Meadow grass',
    hint: 'Plant grass in open sun.',
    note: 'Grass grows from the base of the blade, not the tip, which is why it keeps growing after it is grazed.',
    inJar: 'A fast-growing sun grass; a general type, not one species.',
    sources: [src('Wikipedia: Poaceae (growth from the base)', 'https://en.wikipedia.org/wiki/Poaceae')] },
  { id: 'tree', kind: 'species', title: 'Young calathea', latin: 'Calathea orbifolia', size: 'about 5 cm in this jar',
    hint: 'Plant the tree. Its crown shades the plants below.',
    note: 'A tropical understorey plant of the prayer-plant family (Marantaceae). Look where the leaf meets its stalk: a swollen joint, the pulvinus.',
    inJar: 'Stands in for the "tree": its crown shades nearby plants and slows drying.',
    sources: [src('Wikipedia: Marantaceae', 'https://en.wikipedia.org/wiki/Marantaceae')] },
  { id: 'lily', kind: 'species', title: 'Floating frogbit', latin: 'Limnobium laevigatum', size: 'leaves 8–40 mm wide',
    hint: 'Float a water lily on the pond.',
    note: 'A floating rosette whose leaves rest on the water. It takes its nutrients from the water itself, competing with algae.',
    sources: [src('Plants of South Eastern NSW: Limnobium laevigatum', 'https://apps.lucidcentral.org/plants_se_nsw/text/entities/limnobium_laevigatum.htm')] },
  { id: 'reed', kind: 'species', title: 'Needle spikerush', latin: 'Eleocharis acicularis',
    hint: 'Plant a reed in the pond.',
    note: 'Fine, round, leafless-looking stems grow in tufts in shallow water. The stems themselves do the photosynthesis.',
    sources: [src('Wikipedia: Eleocharis acicularis', 'https://en.wikipedia.org/wiki/Eleocharis_acicularis')] },
  { id: 'grazer', kind: 'species', title: 'Cabbage white caterpillar', latin: 'Pieris rapae', size: '20–30 mm fully grown',
    hint: 'Introduce a forager.',
    note: 'A green caterpillar that chews leaves. Fully grown it is 20–30 mm long, then it pupates and becomes a white butterfly.',
    inJar: 'Real ones eat cabbage-family plants and turn into butterflies; this one eats any soft leaves and does not pupate.',
    sources: [src('Manaaki Whenua Landcare Research: Pieris rapae', 'https://www.landcareresearch.co.nz/tools-and-resources/identification/what-is-this-bug/cabbage-white-caterpillar')] },
  { id: 'woodlouse', kind: 'species', title: 'Rough woodlouse', latin: 'Porcellio scaber', size: 'up to 17 mm',
    hint: 'Introduce a woodlouse.',
    note: 'Not an insect but a land crustacean, with seven pairs of legs. It needs damp shelter because it loses water quickly through its body.',
    sources: [bmig, src('Cloudsley-Thompson: woodlouse rhythms and water', 'https://symposium.cshlp.org/content/25/345.full.pdf')] },
  { id: 'beetle', kind: 'species', title: 'Green tiger beetle', latin: 'Cicindela campestris', size: '12–17 mm',
    hint: 'Introduce a ground beetle.',
    note: 'A fast hunter of sunny ground. It runs down small prey in daylight on long legs, with big eyes and large jaws.',
    sources: [src('Atlas of Beetles of Russia: Cicindela campestris', 'https://www.zin.ru/ANIMALIA/COLEOPTERA/ENG/ciccaman.htm'), src('UC Riverside Entomology Museum', 'https://entmuseum.ucr.edu/bug-spotlight')] },
  { id: 'springtail', kind: 'species', title: 'Springtail', latin: 'Folsomia candida', size: 'about 3 mm',
    hint: 'Introduce a springtail on moist ground.',
    note: 'Tiny soil animals that graze fungi. Most springtails keep a forked jumping organ, the furcula, folded under the belly, and flick it to leap away.',
    inJar: 'Adults of this species live about 110–240 days; here, 180 days.',
    sources: [src('Wikipedia: Folsomia candida', 'https://en.wikipedia.org/wiki/Folsomia_candida'), src('The springtail jumping apparatus (PMC9336013)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9336013/')] },
  { id: 'flea', kind: 'species', title: 'Water flea', latin: 'Daphnia pulex', size: '0.2–3 mm',
    hint: 'Introduce a water flea to the pond.',
    note: 'A tiny crustacean that rows with its antennae. In summer the population is almost all female: unfertilised eggs grow into daughters.',
    sources: [daphnia] },
  { id: 'fish', kind: 'species', title: 'Small fish',
    hint: 'Introduce a fish to the pond.',
    note: 'A fish breathes oxygen dissolved in the water, so a pond full of rotting matter can leave it gasping.',
    inJar: 'A stand-in fish. It is meant to move to a future water-jar shape.',
    sources: [src('Daphnia and low oxygen (Water 14:3213)', 'https://www.mdpi.com/2073-4441/14/20/3213')] },
  { id: 'ants', kind: 'species', title: 'Seed-harvester ants',
    hint: 'Bring in an ant colony.',
    note: 'Harvester ants carry seeds underground and store them in granary chambers, then process them to feed their larvae.',
    inJar: 'A general seed-harvester colony, not a calibrated species.',
    sources: [harvesters] },

  // ---------- Behaviour ----------
  { id: 'shredding', kind: 'behaviour', title: 'Shredding fallen leaves',
    hint: 'Watch a woodlouse near fallen leaves, often at night.',
    note: 'Woodlice chew dead leaves into fragments and droppings, which bacteria and fungi then break down faster. They are recyclers, not pests of living plants.',
    sources: [src('Yang, Shao & Li 2020, Geoderma 114546', 'https://www.sciencedirect.com/science/article/pii/S0016706120300586'), src('Des Marteaux et al. 2020, Microbial Ecology', 'https://pubmed.ncbi.nlm.nih.gov/32440700/')] },
  { id: 'fungal-grazing', kind: 'behaviour', title: 'Grazing on fungi',
    hint: 'Watch a springtail on damp soil.',
    note: 'Springtails pick at the fungal threads in soil. Light grazing can keep fungi growing; heavy grazing uses them up.',
    sources: [src('Springtail grazing on fungi (PubMed 16175795)', 'https://pubmed.ncbi.nlm.nih.gov/16175795/')] },
  { id: 'leaf-chewing', kind: 'behaviour', title: 'Chewing living leaves',
    hint: 'Watch a forager feeding.',
    note: 'A herbivore turns leaves into body, droppings and heat. Only a small part of what it eats becomes caterpillar.',
    sources: [src('Wikipedia: Ecological efficiency', 'https://en.wikipedia.org/wiki/Ecological_efficiency')] },
  { id: 'filter-feeding', kind: 'behaviour', title: 'Filtering the water',
    hint: 'Watch water fleas in a pond with algae.',
    note: 'Daphnia beat their legs to keep water moving, and bristles on the legs catch algae, bacteria and fine debris.',
    sources: [daphnia] },
  { id: 'pairing', kind: 'behaviour', title: 'Woodlice pairing',
    hint: 'Keep a male and a female woodlouse well fed.',
    note: 'After mating, the female carries her eggs in a brood pouch of fluid under her body, the marsupium.',
    inJar: 'Gestation is compressed to game time.',
    sources: [marsupium] },
  { id: 'brood-pouch', kind: 'behaviour', title: 'Young from the brood pouch',
    hint: 'Wait for a carrying woodlouse to give birth.',
    note: 'Young woodlice, called mancae, leave the pouch looking like small pale adults but with one pair of legs missing. They add it at their first moult.',
    sources: [marsupium, src('Brooding and juvenile growth (PMC4525036)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4525036/')] },
  { id: 'beetle-hunt', kind: 'behaviour', title: 'A tiger beetle hunt',
    hint: 'A beetle needs prey nearby: foragers or woodlice.',
    note: 'Gut studies of woodland ground beetles find many prey groups, woodlice and caterpillars among them. Part of every catch ends as litter for the soil.',
    sources: [src('Šerić Jelaska et al. 2014, Eur. J. Entomol.', 'https://www.eje.cz/pdfs/eje/2014/05/06.pdf')] },
  { id: 'fish-hunt', kind: 'behaviour', title: 'A fish takes a water flea',
    hint: 'Keep a fish and water fleas in the same pond.',
    note: 'Fish eat the water fleas, the fleas eat algae. Take away the fish and the algae can be grazed down; add more and the water can turn green.',
    sources: [src('Experimental trophic cascades (PMC4237340)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4237340/')] },
  { id: 'new-generation', kind: 'behaviour', title: 'A new generation',
    hint: 'Let a well-fed animal raise young.',
    note: 'Every newborn is paid for: the parent first stores the material for a new body, so births follow food.',
    sources: [src('Wikipedia: Parental investment', 'https://en.wikipedia.org/wiki/Parental_investment')] },
  { id: 'seedling', kind: 'behaviour', title: 'A seed settles',
    hint: 'Let healthy plants grow to full cover.',
    note: 'A grown plant spends part of its growth on seeds or spores. Most never make it; the few that land somewhere damp and bright germinate.',
    sources: [src('Wikipedia: Seed dispersal', 'https://en.wikipedia.org/wiki/Seed_dispersal')] },
  { id: 'flowering', kind: 'behaviour', title: 'First flowers',
    hint: 'Grow a bloom to maturity with full leaves.',
    note: 'An annual flowers once it has built enough leaf, then puts its stores into seed. The flowers are for pollinators, the seeds for next year.',
    sources: [src('Wikipedia: Annual plant', 'https://en.wikipedia.org/wiki/Annual_plant')] },
  { id: 'dried-out', kind: 'behaviour', title: 'Dried out',
    hint: 'A woodlouse on dry ground, away from shelter.',
    note: 'Woodlice lose water through their cuticle much faster than insects. In dry air they shelter, cluster together, and come out at night.',
    sources: [src('Cloudsley-Thompson: woodlouse rhythms and water', 'https://symposium.cshlp.org/content/25/345.full.pdf'), bmig] },
  { id: 'end-of-life', kind: 'behaviour', title: 'Back to the soil',
    hint: 'Every life ends; watch long enough.',
    note: 'Remains are not waste. Bacteria and fungi break them down and return their nutrients to the soil for the next plants.',
    sources: [src('Wikipedia: Decomposition', 'https://en.wikipedia.org/wiki/Decomposition')] },
  { id: 'seed-harvest', kind: 'behaviour', title: 'Carrying seeds home',
    hint: 'Ants need seed-bearing plants near the nest.',
    note: 'Foragers bring seeds back to the granary. The colony keeps a store to live on when there is little to harvest.',
    sources: [harvesters] },
  { id: 'ant-egg', kind: 'behaviour', title: 'The queen lays',
    hint: 'A well-fed queen with stores in the nest.',
    note: 'Only the queen lays. Eggs become larvae that workers feed, then pupae, then new workers.',
    sources: [src('Juvenile hormone and larval nutrition (PMC10731321)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10731321/')] },
  { id: 'worker-emerges', kind: 'behaviour', title: 'A pale new worker',
    hint: 'Feed the larvae until one pupates and emerges.',
    note: 'A new worker comes out pale and soft (a callow) and darkens over the next days. Its adult size was set by the food it got as a larva.',
    sources: [src('Juvenile hormone and larval nutrition (PMC10731321)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10731321/')] },
  { id: 'new-chamber', kind: 'behaviour', title: 'Digging a new room',
    hint: 'A crowded, growing colony in moist soil.',
    note: 'Ants dig more nest as the brood grows, and how they dig changes with temperature.',
    sources: [src('Römer & Roces 2014 (PMC4022738)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4022738/'), src('Scientific Reports 2021, nest architecture and temperature', 'https://www.nature.com/articles/s41598-021-02491-w')] },

  // ---------- The jar ----------
  { id: 'night', kind: 'jar', title: 'The night shift',
    hint: 'Keep time running past 20:00 with day cycles on.',
    note: 'Photosynthesis stops in the dark, but breathing does not. Plants keep using stored sugar overnight, and woodlice and springtails come out.',
    sources: [src('Scialdone et al., starch use at night (PMC3691572)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3691572/')] },
  { id: 'fog', kind: 'jar', title: 'Mist on the glass',
    hint: 'Seal the jar and let the sun warm it.',
    note: 'In a closed jar, water evaporates from soil and leaves and condenses on the cooler glass. A little mist is normal; heavy fog all day means it is too wet.',
    sources: [src('Penn State Extension: creating a closed terrarium', 'https://extension.psu.edu/creating-a-closed-terrarium')] },
  { id: 'thirsty', kind: 'jar', title: 'Thirsty soil',
    hint: 'An open jar slowly loses water to the room.',
    note: 'An open jar loses water to the room every day through the soil surface and the leaves. Sealed jars recycle theirs.',
    sources: [src('Iowa State Extension: how to create and care for a terrarium', 'https://yardandgarden.extension.iastate.edu/how-to/how-create-and-care-terrarium')] },
  { id: 'low-oxygen', kind: 'jar', title: 'The pond needs a breath',
    hint: 'Too much rotting matter in the pond.',
    note: 'Bacteria rotting dead matter use up the oxygen in the water. Animals in the pond then have less to breathe.',
    sources: [src('Diel oxygen in freshwater communities (PMC7261829)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7261829/')] },
  { id: 'rain', kind: 'jar', title: 'Rain on the soil',
    hint: 'Let it rain from Environment.',
    note: 'Soil holds only so much water; the rest drains through. That is why the jar has gravel and charcoal at the bottom.',
    sources: [src('UVM Extension: terrarium gardening', 'https://www.uvm.edu/news/extension/terrarium-gardening')] },
  { id: 'sealed-goal', kind: 'jar', title: 'A jar that lives on its own',
    hint: 'Seal a jar and reach its goal.',
    note: 'A sealed bottle garden planted in 1960 was watered once, in 1972, and is still growing. Light is the only thing that goes in.',
    sources: [src('Wikipedia: Bottle garden', 'https://en.wikipedia.org/wiki/Bottle_garden')] },
]

export const pageById = new Map(pages.map((page) => [page.id, page]))

export type Found = { tick: number; at: number; away: boolean }
export type JournalEntry = { at: number; tick: number; kind: 'found' | 'event' | 'note' | 'away' | 'jar'; text: string; page?: string }
export type Notebook = { found: Record<string, Found>; journal: JournalEntry[] }

export const emptyNotebook = (): Notebook => ({ found: {}, journal: [] })

const creatureNames: Record<string, string> = { grazer: 'caterpillar', woodlouse: 'woodlouse', beetle: 'tiger beetle', springtail: 'springtail', flea: 'water flea', fish: 'fish' }
const plantKinds = new Set<Lifeform>(['clover', 'fern', 'bloom', 'moss', 'grass', 'tree', 'lily', 'reed'])

/** Which pages this step of the world shows. */
export function pagesShown(world: World, events: readonly SimulationEvent[]): string[] {
  const shown = new Set<string>()
  for (const plant of world.plants) shown.add(plant.kind)
  for (const creature of world.creatures) shown.add(creature.kind ?? 'grazer')
  if (world.colony && (world.colony.queen || world.colony.workers.length)) shown.add('ants')
  for (const event of events) {
    if (event.type === 'feeding') {
      if (event.kind === 'woodlouse' && event.source === 'litter') shown.add('shredding')
      else if (event.kind === 'springtail' && event.source === 'fungi') shown.add('fungal-grazing')
      else if (event.kind === 'grazer' && event.source === 'plant') shown.add('leaf-chewing')
      else if (event.kind === 'flea' && event.source === 'algae') shown.add('filter-feeding')
    } else if (event.type === 'mating') shown.add('pairing')
    else if (event.type === 'birth') shown.add(event.kind === 'woodlouse' ? 'brood-pouch' : plantKinds.has(event.kind) ? 'seedling' : 'new-generation')
    else if (event.type === 'predation') shown.add(event.predatorKind === 'beetle' ? 'beetle-hunt' : 'fish-hunt')
    else if (event.type === 'death') shown.add(event.reason === 'desiccation' ? 'dried-out' : 'end-of-life')
    else if (event.type === 'rain') shown.add('rain')
    else if (event.type === 'ant') {
      if (event.action === 'harvest') shown.add('seed-harvest')
      else if (event.action === 'egg') shown.add('ant-egg')
      else if (event.action === 'birth') shown.add('worker-emerges')
      else if (event.action === 'chamber') shown.add('new-chamber')
    }
  }
  if (world.plants.some((plant) => plant.kind === 'bloom' && plantFlowering(plant))) shown.add('flowering')
  if (environmentAt(world).phase === 'night') shown.add('night')
  if (fogLevel(world) >= 0.3) shown.add('fog')
  if (!world.sealed && world.water < 22) shown.add('thirsty')
  if (world.pond.water >= 8 && world.pond.oxygen / Math.max(1, world.pond.water) < 0.25) shown.add('low-oxygen')
  if (world.sealed && world.tick - world.sealed.since >= world.sealed.goalDays * 24 && (world.plants.length > 0 || world.pond.algae > 0.05)) shown.add('sealed-goal')
  return [...shown]
}

/** One plain journal line for an event worth remembering, or null. */
export function eventLine(event: SimulationEvent): string | null {
  if (event.type === 'predation') return `A ${creatureNames[event.predatorKind]} caught a ${creatureNames[event.preyKind] ?? event.preyKind}.`
  if (event.type === 'mating') return 'Two woodlice paired.'
  if (event.type === 'birth' && !plantKinds.has(event.kind)) return event.kind === 'woodlouse' ? 'A young woodlouse left its mother\'s brood pouch.' : `A new ${creatureNames[event.kind]} was born.`
  if (event.type === 'death' && !plantKinds.has(event.kind)) return event.reason === 'desiccation' ? `A ${creatureNames[event.kind]} dried out.` : event.reason === 'age' ? `A ${creatureNames[event.kind]} died of old age.` : `A ${creatureNames[event.kind]} starved.`
  if (event.type === 'death' && event.reason === 'age') return `An old ${event.kind === 'tree' ? 'calathea' : event.kind} died back.`
  if (event.type === 'ant' && event.action === 'birth') return 'A pale new ant worker emerged.'
  if (event.type === 'ant' && event.action === 'chamber') return 'The ants opened a new chamber.'
  if (event.type === 'ant' && event.action === 'death' && event.id === 0) return 'The ant queen died.'
  return null
}

function withEntries(journal: JournalEntry[], entries: JournalEntry[]) {
  if (entries.length === 0) return journal
  const next = [...journal, ...entries]
  return next.length > journalLimit ? next.slice(next.length - journalLimit) : next
}

/**
 * Notes one step. Returns the same notebook when nothing new happened, so
 * React can skip work. While away, only first finds are written down; the
 * away page sums up the rest.
 */
export function observe(notebook: Notebook, world: World, events: readonly SimulationEvent[], at: number, away = false): { notebook: Notebook; found: string[] } {
  const found = pagesShown(world, events).filter((id) => !notebook.found[id] && pageById.has(id))
  const entries: JournalEntry[] = found.map((id) => ({ at, tick: world.tick, kind: 'found', page: id, text: `${away ? 'While you were away: ' : ''}${pageById.get(id)!.title}.` }))
  if (!away) for (const event of events) {
    const text = eventLine(event)
    if (text) entries.push({ at, tick: world.tick, kind: 'event', text })
  }
  if (found.length === 0 && entries.length === 0) return { notebook, found }
  const foundNow = { ...notebook.found }
  for (const id of found) foundNow[id] = { tick: world.tick, at, away }
  return { notebook: { found: foundNow, journal: withEntries(notebook.journal, entries) }, found }
}

/** Adds a line the game writes (a new jar, an away summary) or the player's own note. */
export function writeEntry(notebook: Notebook, world: Pick<World, 'tick'>, kind: JournalEntry['kind'], text: string, at = Date.now()): Notebook {
  const clean = text.trim().slice(0, 500)
  if (!clean) return notebook
  return { ...notebook, journal: withEntries(notebook.journal, [{ at, tick: world.tick, kind, text: clean }]) }
}

export const entryDay = (entry: Pick<JournalEntry, 'tick'>) => Math.floor(entry.tick / 24) + 1
export const entryTime = (entry: Pick<JournalEntry, 'tick'>) => `${String(entry.tick % 24).padStart(2, '0')}:00`

export function progress(notebook: Notebook, kind?: PageKind) {
  const list = kind ? pages.filter((page) => page.kind === kind) : pages
  return { found: list.filter((page) => notebook.found[page.id]).length, total: list.length }
}

// ---------- Storage ----------

export function encodeNotebook(notebook: Notebook) {
  return JSON.stringify({ version: 1, found: notebook.found, journal: notebook.journal })
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const entryKinds = new Set(['found', 'event', 'note', 'away', 'jar'])

/** Reads a stored notebook. Unknown pages and damaged lines are dropped, never the whole book. */
export function decodeNotebook(text: string): Notebook {
  let source: unknown
  try { source = JSON.parse(text) } catch { return emptyNotebook() }
  if (!source || typeof source !== 'object' || (source as { version?: unknown }).version !== 1) return emptyNotebook()
  const raw = source as { found?: unknown; journal?: unknown }
  const notebook = emptyNotebook()
  if (raw.found && typeof raw.found === 'object') {
    for (const [id, value] of Object.entries(raw.found as Record<string, unknown>)) {
      const item = value as Partial<Found> | null
      if (pageById.has(id) && item && finite(item.tick) && finite(item.at)) notebook.found[id] = { tick: item.tick, at: item.at, away: item.away === true }
    }
  }
  if (Array.isArray(raw.journal)) {
    for (const value of raw.journal.slice(-journalLimit)) {
      const item = value as Partial<JournalEntry> | null
      if (!item || !finite(item.at) || !finite(item.tick) || typeof item.text !== 'string' || !entryKinds.has(item.kind as string)) continue
      notebook.journal.push({ at: item.at, tick: item.tick, kind: item.kind!, text: item.text.slice(0, 500), ...(typeof item.page === 'string' && pageById.has(item.page) ? { page: item.page } : {}) })
    }
  }
  return notebook
}

type Store = Pick<Storage, 'getItem' | 'setItem'>

export function readNotebook(store: Store | null): Notebook {
  try { const text = store?.getItem(notebookKey); return text ? decodeNotebook(text) : emptyNotebook() } catch { return emptyNotebook() }
}

export function writeNotebook(store: Store | null, notebook: Notebook): boolean {
  try { store?.setItem(notebookKey, encodeNotebook(notebook)); return !!store } catch { return false }
}
