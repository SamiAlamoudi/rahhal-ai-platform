/**
 * Sprint 14 — managed access facade.
 * The only approved way for modules to read env-backed configuration/secrets.
 * Backed exclusively by EnvironmentSecretProvider via SecretManager.
 */

import { createProviderSecretAuthorizer } from './authorization'
import { getSecretManager } from './SecretManager'
import type { SecretProviderId } from './types'

/**
 * Read any managed env value (secrets + public config) through SecretManager.
 * Never call process.env / import.meta.env from feature modules.
 */
export function readManagedEnv(
  key: string,
  options?: { caller?: string; providerId?: SecretProviderId },
): string | null {
  const providerId = options?.providerId ?? 'generic'
  if (options?.providerId) {
    const authz = createProviderSecretAuthorizer()
    if (!authz.authorize(providerId, key)) {
      return null
    }
  }
  return getSecretManager().get(key, {
    caller: options?.caller ?? `readManagedEnv:${providerId}`,
  })
}

/** Public / non-secret configuration (feature toggles, provider mode strings). */
export function readManagedConfig(
  key: string,
  options?: { caller?: string },
): string | null {
  return readManagedEnv(key, {
    caller: options?.caller ?? 'readManagedConfig',
    providerId: 'generic',
  })
}

export function readManagedSecret(
  key: string,
  providerId: SecretProviderId,
  options?: { caller?: string },
): string | null {
  const authz = createProviderSecretAuthorizer()
  authz.assertAuthorized(providerId, key)
  return getSecretManager().get(key, {
    caller: options?.caller ?? `readManagedSecret:${providerId}`,
    providerId,
  })
}
