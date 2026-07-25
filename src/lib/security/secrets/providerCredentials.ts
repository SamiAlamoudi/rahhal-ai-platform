/**
 * Sprint 14 — provider credential facade.
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

export function readSecretViaManager(
  key: string,
  options?: { enabled?: boolean; caller?: string; force?: boolean; providerId?: SecretProviderId },
): string | null {
  if (!options?.force && !isSecretManagerEnabled({ enabled: options?.enabled })) {
    // Still allow managed reads through EnvironmentSecretProvider for migration
    return getSecretManager().get(key, {
      caller: options?.caller ?? 'readSecretViaManager',
      providerId: options?.providerId,
    })
  }
  return getSecretManager({ enabled: options?.enabled ?? true }).get(key, {
    caller: options?.caller ?? 'readSecretViaManager',
    providerId: options?.providerId,
  })
}

export function hasProviderCredentials(
  providerId: SecretProviderId,
  options?: SecretManagerOptions,
): boolean {
  return resolveProviderCredentials(providerId, options).complete
}
