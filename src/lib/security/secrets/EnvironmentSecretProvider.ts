/**
 * Sprint 14 — EnvironmentSecretProvider (sole approved env reader).
 */

import type { SecretProvider } from './types'
import { getSecretRotationController } from './rotation'

function readFromVite(key: string): string | null {
  try {
    const vite = (import.meta as { env?: Record<string, unknown> }).env?.[key]
    if (vite !== undefined && vite !== null && String(vite) !== '') return String(vite)
  } catch {
    /* ignore */
  }
  return null
}

function readFromProcess(key: string): string | null {
  try {
    const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    const value = proc?.env?.[key]
    if (value !== undefined && value !== null && value !== '') return String(value)
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Reads secrets from environment injection (.env, Vercel, GitHub Actions, etc.).
 * This is the ONLY SecretProvider that touches env directly.
 */
export class EnvironmentSecretProvider implements SecretProvider {
  readonly providerId = 'environment'
  readonly live = true
  private cache = new Map<string, string | null>()

  get(key: string): string | null {
    if (this.cache.has(key)) return this.cache.get(key) ?? null
    let value: string | null
    if (key.startsWith('VITE_')) {
      value = readFromVite(key) ?? readFromProcess(key)
    } else {
      value = readFromProcess(key) ?? readFromVite(key)
    }
    this.cache.set(key, value)
    return value
  }

  has(key: string): boolean {
    return Boolean(this.get(key))
  }

  refresh(): void {
    getSecretRotationController().refresh()
    this.invalidateCache()
  }

  reload(): void {
    getSecretRotationController().reload()
    this.invalidateCache()
  }

  getVersion(): string {
    return getSecretRotationController().getVersion()
  }

  getLastUpdatedAt(): string | null {
    return getSecretRotationController().getLastUpdatedAt()
  }

  invalidateCache(): void {
    this.cache.clear()
    getSecretRotationController().invalidateCache()
  }
}

export function createEnvironmentSecretProvider(): EnvironmentSecretProvider {
  return new EnvironmentSecretProvider()
}
