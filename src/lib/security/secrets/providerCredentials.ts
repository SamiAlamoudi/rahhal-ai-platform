/**
 * Sprint 14 — provider credential facade.
 * Every provider should obtain credentials here (not via import.meta.env).
 */

import { getSecretManager, type SecretManagerOptions } from './SecretManager'
import { isSecretManagerEnabled } from './feature'
import type { ProviderCredentialSet, SecretProviderId } from './types'

export function resolveProviderCredentials(
  providerId: SecretProviderId,
  options?: SecretManagerOptions & { caller?: string },
): ProviderCredentialSet {
  const manager = getSecretManager({
    enabled: options?.enabled,
    provider: options?.provider,
    providers: options?.providers,
    caller: options?.caller ?? `resolveProviderCredentials:${providerId}`,
  })
  return manager.getProviderCredentials(providerId, { caller: options?.caller })
}

/**
 * Canonical secret read for provider adapters.
 * When SecretManager flag is OFF, still uses EnvironmentSecretProvider through SecretManager
 * instance APIs when `force` is set — otherwise callers may keep legacy paths.
 */
export function readSecretViaManager(
  key: string,
  options?: { enabled?: boolean; caller?: string; force?: boolean },
): string | null {
  if (!options?.force && !isSecretManagerEnabled({ enabled: options?.enabled })) {
    return null
  }
  return getSecretManager({ enabled: options?.enabled ?? true }).get(key, {
    caller: options?.caller ?? 'readSecretViaManager',
  })
}

export function hasProviderCredentials(
  providerId: SecretProviderId,
  options?: SecretManagerOptions,
): boolean {
  return resolveProviderCredentials(providerId, options).complete
}
