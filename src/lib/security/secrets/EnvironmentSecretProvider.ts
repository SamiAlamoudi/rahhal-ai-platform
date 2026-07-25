/**
 * Sprint 14 — EnvironmentSecretProvider.
 * Sole approved reader of process / Vite env for secret material.
 */

import type { SecretProvider } from './types'

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
 * This is the only SecretProvider that touches env directly.
 */
export class EnvironmentSecretProvider implements SecretProvider {
  readonly providerId = 'environment'
  readonly live = true

  get(key: string): string | null {
    // Prefer server/process env for non-VITE keys; allow Vite for public/client keys.
    if (key.startsWith('VITE_')) {
      return readFromVite(key) ?? readFromProcess(key)
    }
    return readFromProcess(key) ?? readFromVite(key)
  }

  has(key: string): boolean {
    return Boolean(this.get(key))
  }
}

export function createEnvironmentSecretProvider(): EnvironmentSecretProvider {
  return new EnvironmentSecretProvider()
}
