/**
 * Sprint 14 — secret rotation abstraction (architecture only — no cloud vaults).
 */

import { incrementRotationAttempt, incrementRotationFailure } from './metrics'

export interface SecretRotationState {
  version: string
  lastUpdatedAt: string | null
  cacheGeneration: number
}

export class SecretRotationController {
  private version = '1'
  private lastUpdatedAt: string | null = null
  private cacheGeneration = 0

  getVersion(): string {
    return this.version
  }

  getLastUpdatedAt(): string | null {
    return this.lastUpdatedAt
  }

  invalidateCache(): void {
    this.cacheGeneration += 1
  }

  refresh(): void {
    incrementRotationAttempt()
    try {
      this.version = String(Number(this.version) + 1)
      this.lastUpdatedAt = new Date().toISOString()
      this.invalidateCache()
    } catch {
      incrementRotationFailure()
      throw new Error('Secret rotation refresh failed')
    }
  }

  reload(): void {
    incrementRotationAttempt()
    try {
      this.lastUpdatedAt = new Date().toISOString()
      this.invalidateCache()
    } catch {
      incrementRotationFailure()
      throw new Error('Secret rotation reload failed')
    }
  }

  snapshot(): SecretRotationState {
    return {
      version: this.version,
      lastUpdatedAt: this.lastUpdatedAt,
      cacheGeneration: this.cacheGeneration,
    }
  }
}

let defaultRotation: SecretRotationController | null = null

export function getSecretRotationController(): SecretRotationController {
  if (!defaultRotation) defaultRotation = new SecretRotationController()
  return defaultRotation
}

export function resetSecretRotationForTests(): void {
  defaultRotation = null
}
