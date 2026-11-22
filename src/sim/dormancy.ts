import type { Creature, PlantKind, SimulationEvent, World } from './ecosystem'
import { introduceLife, placementIssue, nearestSoil } from './ecosystem.ts'
import { isLand } from './land.ts'
import { isAquatic, pondMiddle } from './pond.ts'

/**
 * Resting eggs (closed-jar pass, 2026-11-20). The smallest animals in a jar do not
 * vanish when food runs short: water fleas leave tough resting eggs (ephippia) in the
 * sediment, and springtail eggs lie in damp soil until fungi grow back. When a
 * generation dies out, the eggs it left hatch later, once there is food again.
 * That is how a real closed jar keeps its micro-fauna through booms and busts.
 *
 * - Daphnia ephippia survive drying and freezing and hatch when conditions return
 *   (https://en.wikipedia.org/wiki/Ephippium).
 * - Springtail eggs are laid in moist soil and hatch in days to weeks
 *   (https://en.wikipedia.org/wiki/Springtail).
 *
 * - Earthworm cocoons (Eisenia fetida) lie in the soil and hatch in about three weeks, later if it is
 *   dry or cold (https://en.wikipedia.org/wiki/Eisenia_fetida).
 * - Caterpillars pupate at the end of larval life; the moth lays eggs on leaves in the
 *   same jar before it dies, so the next brood hatches there (the moth is not drawn).
 * - Land plants leave a soil seed bank: seeds of Viola, clover and grasses stay viable in
 *   soil for years (https://en.wikipedia.org/wiki/Soil_seed_bank), so a kind that died back
 *   comes up again when a gap opens. This is how a real terrarium keeps its species.
 *
 * - Water lilies keep a rhizome in the pond mud that sends up new leaves after the old plant dies back,
 *   and they also seed into the mud (https://en.wikipedia.org/wiki/Nymphaea). Without that reserve a pond
 *   whose lilies all died stayed bare, and its snails and shrimp starved after them (2026-11-22).
 *
 * The eggs and seeds carry no material of their own: as with any birth, the newcomer's
 * body is paid from food at the spot (algae, fungi, leaf, or soil organic matter).
 */
export const dormantKinds = ['flea', 'springtail', 'worm', 'grazer', 'clover', 'grass', 'bloom', 'fern', 'moss', 'tree', 'lily'] as const
export type DormantKind = typeof dormantKinds[number]
export type DormantBank = Partial<Record<DormantKind, number>>
const seedBankKinds = ['clover', 'grass', 'bloom', 'fern', 'moss', 'tree'] as const satisfies readonly PlantKind[]
/** At most this many resting eggs of each kind wait in the jar. */
export const dormantCap = 4
/** Hatchlings appear only while fewer than this many of the kind are alive. */
const hatchBelow = 2
/** Food that must be there before an egg hatches, and what the hatchling's body takes from it. */
const fleaHatch = { algae: 0.45, body: 0.04 }
const springtailHatch = { fungi: 0.6, body: 0.08, moisture: 0.6 }
/** A worm hatchling's body comes from the litter its cocoon lies in (bodyMaterial.worm). */
const wormHatch = { organic: 1.0, body: 0.3, moisture: 0.6 }
/** A hatching caterpillar's body comes from the leaf it hatched on (bodyMaterial.grazer). */
const grazerHatch = { body: 0.42, cover: 0.6, leaves: 2 }
/** A seedling from the seed bank, paid from the soil's organic matter where it comes up. */
const seedlingBody = 0.55
/** A lily shoot from the rhizome, paid from the pond's organic mud; it needs standing water. */
const lilyShoot = { body: 0.55, water: 25 }
/** Plant slots in the jar (as in the solver). */
const plantSlots = 32

const isDormantKind = (kind: string): kind is DormantKind => kind === 'flea' || kind === 'springtail' || kind === 'worm' || kind === 'grazer' || kind === 'lily' || (seedBankKinds as readonly string[]).includes(kind)

/**
 * Every adult flea or springtail that dies leaves a resting egg; a caterpillar that reaches the
 * end of its larval life (age) leaves the eggs of its moth; every land plant that dies leaves seed.
 */
export function layRestingEggs(bank: DormantBank | undefined, events: readonly SimulationEvent[]): DormantBank {
  const next: DormantBank = { ...(bank ?? {}) }
  for (const event of events) {
    // Some of each caterpillar brood pupate and wait (Pieris rapae overwinters as a pupa,
    // https://en.wikipedia.org/wiki/Pieris_rapae), so a line of caterpillars that later starves out still has a reserve.
    if (event.type === 'birth' && event.kind === 'grazer' && event.parentId >= 0) { next.grazer = Math.min(dormantCap, (next.grazer ?? 0) + 1); continue }
    if (event.type !== 'death' || !isDormantKind(event.kind)) continue
    if (event.kind === 'grazer' && event.reason !== 'age') continue
    next[event.kind] = Math.min(dormantCap, (next[event.kind] ?? 0) + (event.kind === 'grazer' ? 2 : 1))
  }
  return next
}

const litterMoisture = (water: number) => Math.max(0, Math.min(1, (water - 10) / 55))

/** Once a day at noon, one waiting egg of a kind that has died back hatches if its food has returned. */
export function hatchRestingEggs(world: World): { world: World; events: SimulationEvent[] } {
  const bank = world.dormant
  if (!bank || world.tick % 24 !== 12) return { world, events: [] }
  const events: SimulationEvent[] = []
  let { pond, soil, creatures } = world
  let nextId = world.nextCreatureId ?? creatures.reduce((highest, creature) => Math.max(highest, creature.id), -1) + 1
  const next: DormantBank = { ...bank }
  let plantsAfter = world.plants
  const alive = (kind: 'flea' | 'springtail' | 'grazer' | 'worm') => creatures.filter((creature) => creature.kind === kind).length
  const hatchling = (kind: 'flea' | 'springtail' | 'grazer' | 'worm', x: number, z: number): Creature => ({ id: nextId++, kind, x, z, heading: (nextId * 2.399) % (Math.PI * 2), energy: 50, age: 0, stage: 'juvenile', materialReserve: 0 })

  if ((next.flea ?? 0) > 0 && alive('flea') < hatchBelow && pond.algae >= fleaHatch.algae && pond.water >= 25) {
    const { x, z } = pondMiddle()
    {
      pond = { ...pond, algae: pond.algae - fleaHatch.body }
      const child = hatchling('flea', x, z)
      creatures = [...creatures, child]
      next.flea = (next.flea ?? 0) - 1
      events.push({ type: 'birth', id: child.id, kind: 'flea', parentId: -1 })
    }
  }
  if ((next.springtail ?? 0) > 0 && alive('springtail') < hatchBelow) {
    const patch = [...soil].filter((item) => isLand(item.x, item.z) && item.fungi >= springtailHatch.fungi && litterMoisture(item.water) >= springtailHatch.moisture).sort((a, b) => b.fungi - a.fungi)[0]
    if (patch) {
      soil = soil.map((item) => item.id === patch.id ? { ...item, fungi: item.fungi - springtailHatch.body } : item)
      const child = hatchling('springtail', patch.x, patch.z)
      creatures = [...creatures, child]
      next.springtail = (next.springtail ?? 0) - 1
      events.push({ type: 'birth', id: child.id, kind: 'springtail', parentId: -1 })
    }
  }
  if ((next.worm ?? 0) > 0 && alive('worm') < hatchBelow) {
    const patch = [...soil].filter((item) => isLand(item.x, item.z) && item.organic >= wormHatch.organic && litterMoisture(item.water) >= wormHatch.moisture).sort((a, b) => b.organic - a.organic)[0]
    if (patch) {
      soil = soil.map((item) => item.id === patch.id ? { ...item, organic: item.organic - wormHatch.body } : item)
      const child = hatchling('worm', patch.x, patch.z)
      creatures = [...creatures, child]
      next.worm = (next.worm ?? 0) - 1
      events.push({ type: 'birth', id: child.id, kind: 'worm', parentId: -1 })
    }
  }
  if ((next.grazer ?? 0) > 0 && alive('grazer') < hatchBelow) {
    // A resting pupa waits out a bare garden (Pieris rapae pupae can stay in diapause for months):
    // the moth comes out only once several food plants are leafy again. Hatching onto one leaf of a
    // grazed-down jar used up the whole reserve on caterpillars that starved (2026-11-22).
    const leaves = world.plants.filter((plant) => ['clover', 'grass', 'bloom'].includes(plant.kind) && plant.biomass >= plant.capacity * grazerHatch.cover)
      .sort((a, b) => b.biomass - a.biomass || a.id - b.id)
    const leaf = leaves.length >= grazerHatch.leaves ? leaves[0] : undefined
    if (leaf) {
      const child = hatchling('grazer', leaf.x, leaf.z)
      creatures = [...creatures, child]
      plantsAfter = plantsAfter.map((plant) => plant.id === leaf.id ? { ...plant, biomass: plant.biomass - grazerHatch.body } : plant)
      next.grazer = (next.grazer ?? 0) - 1
      events.push({ type: 'birth', id: child.id, kind: 'grazer', parentId: -1 })
    }
  }
  let sown: World | null = null
  for (const kind of seedBankKinds) {
    if ((next[kind] ?? 0) <= 0 || plantsAfter.length >= plantSlots || plantsAfter.some((plant) => plant.kind === kind)) continue
    // A gap and a seed: try spots round the jar, the first one the placement rules accept wins.
    // The jar's own seed: placement rules apply, but not the player's sealed-lid lock.
    const base = { ...world, pond, soil, creatures, plants: plantsAfter, sealed: null }
    for (let n = 0; n < 24 && !sown; n += 1) {
      const angle = n * 2.399 + world.tick * 0.0007, reach = 0.8 + (n % 4) * 0.6
      const x = Math.cos(angle) * reach, z = Math.sin(angle) * reach
      if (!isLand(x, z) || isAquatic(kind) || placementIssue(base, kind, x, z)) continue
      const patch = nearestSoil(soil, x, z)
      // Seeds germinate only in damp soil that has litter to feed the seedling.
      if (patch.organic < seedlingBody + 0.5 || patch.water < 25) continue
      const planted = introduceLife(base, kind, x, z)
      if (planted === base) continue
      soil = soil.map((item) => item.id === patch.id ? { ...item, organic: item.organic - seedlingBody } : item)
      sown = planted
      plantsAfter = planted.plants
      next[kind] = (next[kind] ?? 0) - 1
      events.push({ type: 'birth', id: planted.plants[planted.plants.length - 1].id, kind, parentId: -1 })
    }
    if (sown) break
  }
  if (!sown && (next.lily ?? 0) > 0 && plantsAfter.length < plantSlots && !plantsAfter.some((plant) => plant.kind === 'lily')
    && pond.water >= lilyShoot.water && pond.organic >= lilyShoot.body + 0.5) {
    const base = { ...world, pond, soil, creatures, plants: plantsAfter, sealed: null }
    const middle = pondMiddle()
    for (let n = 0; n < 12 && !sown; n += 1) {
      const angle = n * 2.399 + world.tick * 0.0007, reach = (n % 3) * 0.35
      const x = middle.x + Math.cos(angle) * reach, z = middle.z + Math.sin(angle) * reach
      if (placementIssue(base, 'lily', x, z)) continue
      const planted = introduceLife(base, 'lily', x, z)
      if (planted === base) continue
      pond = { ...pond, organic: pond.organic - lilyShoot.body }
      sown = planted
      plantsAfter = planted.plants
      next.lily = (next.lily ?? 0) - 1
      events.push({ type: 'birth', id: planted.plants[planted.plants.length - 1].id, kind: 'lily', parentId: -1 })
    }
  }
  if (!events.length) return { world, events }
  return { world: { ...world, pond, soil, creatures, plants: plantsAfter, ...(sown ? { nextPlantId: sown.nextPlantId } : {}), dormant: next, nextCreatureId: nextId }, events }
}
