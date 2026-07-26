import type { DataProvenance } from './models'

export function mockProvenance(
  provider: string,
  confidence = 0.72,
  estimated = true,
  now = new Date().toISOString(),
): DataProvenance {
  return {
    confidence: clamp01(confidence),
    lastUpdated: now,
    provider,
    estimated,
  }
}

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}
