/**
 * Where the open water is. The pond is 6 cm across (radius 1.58 units at
 * about 19 mm per unit) and about 2 cm deep, big enough for water fleas,
 * snails and other small aquatic life. It grew from 3.5 cm on 2026-11-03;
 * see widePond.ts for how older saves are moved onto the bank.
 * Kept in its own module so land.ts can read it without an import cycle.
 */
export const pondCenter = { x: -1.1, z: 0.72, radius: 1.58 }
