/**
 * Sprint 14 — SecretManager (central configuration layer).
 * All credential access should go through this manager.
 */

import { isSecretManagerEnabled } from './feature'
import { createEnvironmentSecretProvider } from './EnvironmentSecretProvider'
import { createFutureVaultSecretProvider } from './FutureVaultSecretProvider'
import { recordSecretAccess } from './audit'
import { redactSecret } from './redact'
import {
  expandKeyCandidates,
  getProviderRegistration,
  PROVIDER_SECRET_REGISTRY,
} from './registry'
import { SECURITY_SECRET_MANAGER_VERSION } from './types'
import type {
  ProviderCredentialSet,
  SecretManagerDiagnostics,
  SecretPresence,
  SecretProvider,
  SecretProviderId,
} from './types'

export interface SecretManagerOptions {
  enabled?: boolean
  /** Primary backend (default: EnvironmentSecretProvider). */
  provider?: SecretProvider
  /** Optional chain — first non-null wins. */
  providers?: SecretProvider[]
  caller?: string
}

export class SecretManager {
  private readonly providers: SecretProvider[]
  private readonly enabledOverride: boolean | undefined
  private readonly defaultCaller: string
  private accessCount = 0

  constructor(options: SecretManagerOptions = {}) {
    this.enabledOverride = options.enabled
    this.defaultCaller = options.caller ?? 'SecretManager'
    if (options.providers?.length) {
      this.providers = [...options.providers]
    } else if (options.provider) {
      this.providers = [options.provider]
    } else {
      // Environment is the production default; vault stub is chained but live=false.
      this.providers = [
        createEnvironmentSecretProvider(),
        createFutureVaultSecretProvider(),
      ]
    }
  }

  isEnabled(): boolean {
    return isSecretManagerEnabled({ enabled: this.enabledOverride })
  }

  /** Resolve a single secret key through the provider chain. */
  get(key: string, options?: { caller?: string }): string | null {
    this.accessCount += 1
    let value: string | null = null
    for (const provider of this.providers) {
      const raw = provider.get(key)
      const resolved = raw instanceof Promise ? null : raw
      // Sync path only for env/memory; async vault is future.
      if (resolved != null && String(resolved).trim()) {
        value = String(resolved)
        break
      }
    }
    recordSecretAccess({
      key,
      present: Boolean(value),
      caller: options?.caller ?? this.defaultCaller,
      value,
    })
    return value
  }

  has(key: string, options?: { caller?: string }): boolean {
    return Boolean(this.get(key, options))
  }

  /** Presence check that never returns secret values. */
  presence(key: string): SecretPresence {
    const value = this.get(key, { caller: `${this.defaultCaller}.presence` })
    return {
      key,
      present: Boolean(value),
      scope: key.startsWith('VITE_') ? 'client_public' : 'server',
      source: value ? this.providers[0]?.providerId ?? null : null,
    }
  }

  /** Resolve first present key among candidates (aliases). */
  getFirst(keys: string[], options?: { caller?: string }): string | null {
    for (const key of keys) {
      const value = this.get(key, options)
      if (value) return value
    }
    return null
  }

  /** Provider-facing credential bundle — single secure configuration entrypoint. */
  getProviderCredentials(
    providerId: SecretProviderId,
    options?: { caller?: string },
  ): ProviderCredentialSet {
    const reg = getProviderRegistration(providerId)
    if (!reg) {
      return {
        providerId,
        keys: [],
        values: {},
        complete: false,
        missing: ['unknown_provider'],
      }
    }

    const values: Record<string, string | null> = {}
    const missing: string[] = []
    const keys: string[] = []

    for (const entry of reg.required) {
      const candidates = expandKeyCandidates(entry)
      keys.push(...candidates)
      const value = this.getFirst(candidates, {
        caller: options?.caller ?? `provider:${providerId}`,
      })
      values[entry.key] = value
      if (!value) missing.push(entry.key)
    }
    for (const entry of reg.optional ?? []) {
      const candidates = expandKeyCandidates(entry)
      keys.push(...candidates)
      values[entry.key] = this.getFirst(candidates, {
        caller: options?.caller ?? `provider:${providerId}:optional`,
      })
    }

    return {
      providerId,
      keys: [...new Set(keys)],
      values,
      complete: missing.length === 0,
      missing,
    }
  }

  diagnostics(): SecretManagerDiagnostics {
    const primary = this.providers[0]
    return {
      version: SECURITY_SECRET_MANAGER_VERSION,
      enabled: this.isEnabled(),
      backend: primary?.providerId ?? 'none',
      liveBackend: Boolean(primary?.live),
      accessCount: this.accessCount,
      knownProviderIds: PROVIDER_SECRET_REGISTRY.map((r) => r.providerId),
    }
  }

  /** Safe summary — never includes secret values. */
  safeSummary(): {
    enabled: boolean
    backend: string
    redactedSample: string | null
    providers: string[]
  } {
    return {
      enabled: this.isEnabled(),
      backend: this.providers.map((p) => p.providerId).join('+'),
      redactedSample: redactSecret('sample_secret_value_0000'),
      providers: this.providers.map((p) => `${p.providerId}:live=${p.live}`),
    }
  }
}

let defaultManager: SecretManager | null = null

export function getSecretManager(options?: SecretManagerOptions): SecretManager {
  if (options) return new SecretManager(options)
  if (!defaultManager) defaultManager = new SecretManager()
  return defaultManager
}

export function setSecretManagerForTests(manager: SecretManager | null): void {
  defaultManager = manager
}

export function resetSecretManagerForTests(): void {
  defaultManager = null
}

export function createSecretManager(options?: SecretManagerOptions): SecretManager {
  return new SecretManager(options)
}
