/**
 * Sprint 53 — deterministic helpers for mock live providers.
 */

export function hashSeed(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

export function pick<T>(seed: number, items: T[]): T {
  return items[seed % items.length]!
}

export function money(amount: number, currency = 'SAR'): { amount: number; currency: string } {
  return { amount: Math.round(amount), currency }
}

export function isoDay(base: Date, offsetDays: number): string {
  const d = new Date(base.getTime())
  d.setUTCDate(d.getUTCDate() + offsetDays)
  return d.toISOString().slice(0, 10)
}
