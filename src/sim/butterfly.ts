import type { Creature } from './ecosystem'
import { maturity } from './pond.ts'

/**
 * Cabbage white life cycle (owner's pick, 2026-11-22). The grazer is a Pieris rapae caterpillar; it now
 * pupates and comes out as a butterfly in the jar instead of quietly dying of age.
 * - Larval life is about 2-3 weeks, the pupa about 1-2 weeks, and adults live about 3 weeks; females lay
 *   single eggs on the undersides of cabbage-family leaves and feed on nectar
 *   (https://en.wikipedia.org/wiki/Pieris_rapae; UF/IFAS EDIS IN283).
 * The game's grazer lives 40 days in all (lifespan.grazer, 960 h), split here 20 / 10 / 10 days.
 * The phase is read from age alone, so saves need no new field.
 */
export const pupateAge = 480
export const emergeAge = 720
export type GrazerPhase = 'larva' | 'pupa' | 'butterfly'
export function grazerPhase(creature: Pick<Creature, 'age' | 'kind'>): GrazerPhase {
  const age = creature.age ?? maturity.grazer
  return age < pupateAge ? 'larva' : age < emergeAge ? 'pupa' : 'butterfly'
}
/** A chrysalis neither feeds nor moves; it breathes at a small share of a feeding larva's rate. */
export const pupalUpkeep = 0.12
/** A resting adult's upkeep per hour, before temperature and thin air. Nectar pays for it. */
export const butterflyUpkeep = 0.16
/** Energy a sip of nectar gives per hour at a flowering plant, and the plant sugar it costs. */
export const nectarSip = { energy: 2.2, biomass: 0.006 }
/** A female lays an egg only with this much energy in hand (a caterpillar needs 82 to breed in the old model). */
export const butterflyEggEnergy = 30
/** Butterflies flit: a hop across the jar takes a few hours, not a night. */
export const butterflyStride = 0.9
