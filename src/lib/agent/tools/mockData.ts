/** Deterministic helpers for mock travel tools (no network). */

export function stableHash(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function pick<T>(items: T[], seed: string): T {
  return items[stableHash(seed) % items.length]
}

export function moneyFromSeed(seed: string, base: number, spread = 80): number {
  return base + (stableHash(seed) % spread)
}
