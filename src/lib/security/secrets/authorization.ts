/**
 * Sprint 14 — provider secret authorization (isolation).
 */

import { getSecretRegistry } from './SecretRegistry'
import { incrementUnauthorizedAccess } from './metrics'
import type { SecretProviderId, SecretScope } from './types'

function scopeOfKey(key: string): SecretScope {
  const registry = getSecretRegistry()
  for (const provider of registry.list()) {
    for (const def of [...provider.required, ...(provider.optional ?? [])]) {
      if (def.key === key || def.aliases?.includes(key)) return def.scope
    }
  }
  if (key.startsWith('VITE_')) return 'public_config'
  return 'server_only'
}

export class ProviderSecretAuthorizer {
  /**
   * Returns true when `providerId` is allowed to read `key`.
   * - Owning provider may always read its keys.
   * - `generic` may read unregistered keys and non-server_only shared config.
   * - Server-only secrets are never readable by other providers.
   */
  authorize(providerId: SecretProviderId, key: string): boolean {
    const registry = getSecretRegistry()
    const owner = registry.ownerOf(key)
    if (!owner) {
      return providerId === 'generic'
    }
    if (owner === providerId) return true

    const scope = scopeOfKey(key)
    if (
      providerId === 'generic'
      && (scope === 'client_safe'
        || scope === 'public_config'
        || scope === 'ephemeral_client')
    ) {
      return true
    }

    incrementUnauthorizedAccess()
    return false
  }

  assertAuthorized(providerId: SecretProviderId, key: string): void {
    if (!this.authorize(providerId, key)) {
      throw new Error(
        `Unauthorized secret access: provider ${providerId} cannot read ${key}`,
      )
    }
  }
}

export function createProviderSecretAuthorizer(): ProviderSecretAuthorizer {
  return new ProviderSecretAuthorizer()
}
