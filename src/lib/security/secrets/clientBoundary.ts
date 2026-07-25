/**
 * Sprint 14 — client / server secret boundary helpers + build artifact checks.
 */

import { getSecretRegistry } from './SecretRegistry'
import type { SecretScope } from './types'

export function classifySecretScope(key: string): SecretScope {
  const reg = getSecretRegistry()
  for (const provider of reg.list()) {
    for (const def of [...provider.required, ...(provider.optional ?? [])]) {
      if (def.key === key || def.aliases?.includes(key)) return def.scope
    }
  }
  if (key.startsWith('VITE_')) return 'public_config'
  return 'server_only'
}

/** Keys that must never appear in frontend bundles. */
export function listServerOnlySecretKeys(): string[] {
  const keys: string[] = []
  for (const provider of getSecretRegistry().list()) {
    for (const def of [...provider.required, ...(provider.optional ?? [])]) {
      if (def.scope === 'server_only') {
        keys.push(def.key, ...(def.aliases ?? []))
      }
    }
  }
  return [...new Set(keys)]
}

/**
 * Scan a built asset string for server-only secret *names assigned values*
 * or obvious secret material. Used by tests against dist/ assets.
 */
export function findServerSecretLeaksInBundle(bundleText: string): string[] {
  const leaks: string[] = []
  // Obvious live key material
  if (/\bsk-[A-Za-z0-9]{20,}\b/.test(bundleText)) {
    leaks.push('openai_sk_material')
  }
  if (/\bBearer\s+[A-Za-z0-9\-._~+/]{20,}=*/.test(bundleText)) {
    leaks.push('bearer_token_material')
  }
  // Server env names should not be embedded next to assignment of long secrets in client
  for (const key of listServerOnlySecretKeys()) {
    if (key.startsWith('VITE_')) continue
    const re = new RegExp(`${key}\\s*[:=]\\s*['"][^'"]{16,}['"]`)
    if (re.test(bundleText)) leaks.push(key)
  }
  return leaks
}
