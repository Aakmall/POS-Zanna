import type { Unit } from '../domain/product'

const stamp = '2026-10-20T00:00:00.000Z'
const definitions = [
  ['pcs', 'Pcs', 'count', 1, false], ['bungkus', 'Bungkus', 'count', 1, true],
  ['sachet', 'Sachet', 'count', 1, true], ['dus', 'Dus', 'count', 1, true],
  ['kg', 'Kilogram', 'mass', 1000, false], ['g', 'Gram', 'mass', 1, false],
  ['l', 'Liter', 'volume', 1000, false], ['ml', 'Mililiter', 'volume', 1, false],
  ['botol', 'Botol', 'count', 1, true], ['jeriken', 'Jeriken', 'count', 1, true],
] as const
export const builtinUnits: Unit[] = definitions.map(([code, name, dimension, factor, isPackaging], index) => ({
  id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
  code, name, dimension, factor, isPackaging, createdAt: stamp, updatedAt: stamp,
}))
