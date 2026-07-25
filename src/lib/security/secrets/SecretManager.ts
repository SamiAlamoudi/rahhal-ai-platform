/**
 * Sprint 14 — SecretManager (central configuration layer).
 */

import { isSecretManagerEnabled } from './feature'
import { createEnvironmentSecretProvider } from './EnvironmentSecretProvider'
import { createFutureVaultSecretProvider } from './FutureVaultSecretProvider'
import { recordSecretAccess } from './audit'
import { redactSecret } from './redact'
import {
  expandKeyCandidates,
  getSecretRegistry,
} from './SecretRegistry'
import { createProviderSecretAuthorizer } from './authorization'
import { getSecretRotationController } from './rotation'
import { createValidationService } from './ValidationService'
import { incrementProviderAuthFailure } from './metrics'
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
  provider?: SecretProvider
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
      this.providers = [
        createEnvironmentSecretProvider(),
        createFutureVaultSecretProvider(),
      ]
    }
  }

  isEnabled(): boolean {
    return isSecretManagerEnabled({ enabled: this.enabledOverride })
  }

  get(key: string, options?: { caller?: string; providerId?: SecretProviderId }): string | null {
    this.accessCount += 1
    const providerId = options?.providerId
    let authorized = true
    if (providerId) {
      authorized = createProviderSecretAuthorizer().authorize(providerId, key)
      if (!authorized) {
        incrementProviderAuthFailure()
        recordSecretAccess({
          key,
          present: false,
          caller: options?.caller ?? this.defaultCaller,
          providerId,
          authorized: false,
          value: null,
        })
        return null
      }
    }

    let value: string | null = null
    for (const provider of this.providers) {
      const raw = provider.get(key)
      const resolved = raw instanceof Promise ? null : raw
      if (resolved != null && String(resolved).trim()) {
        value = String(resolved)
        break
      }
    }
    recordSecretAccess({
      key,
      present: Boolean(value),
      caller: options?.caller ?? this.defaultCaller,
      providerId: providerId ?? null,
      authorized,
      value,
    })
    return value
  }

  has(key: string, options?: { caller?: string; providerId?: SecretProviderId }): boolean {
    return Boolean(this.get(key, options))
  }

  presence(key: string): SecretPresence {
    const value = this.get(key, { caller: `${this.defaultCaller}.presence` })
    return {
      key,
      present: Boolean(value),
      scope: key.startsWith('VITE_') ? 'client_safe' : 'server_only',
      source: value ? this.providers[0]?.providerId ?? null : null,
    }
  }

  getFirst(keys: string[], options?: { caller?: string; providerId?: SecretProviderId }): string | null {
    for (const key of keys) {
      const value = this.get(key, options)
      if (value) return value
    }
    return null
  }

  getProviderCredentials(
    providerId: SecretProviderId,
    options?: { caller?: string },
  ): ProviderCredentialSet {
    const reg = getSecretRegistry().get(providerId)
    if (!reg) {
      return {
        providerId,
        keys: [],
        values: {},
        complete: false,
        missing: ['unknown_provider'],
        invalid: [],
        disabledGracefully: true,
      }
    }

    const values: Record<string, string | null> = {}
    const missing: string[] = []
    const invalid: string[] = []
    const keys: string[] = []
    const validator = createValidationService()

    for (const entry of reg.required) {
      const candidates = expandKeyCandidates(entry)
      keys.push(...candidates)
      const value = this.getFirst(candidates, {
        caller: options?.caller ?? `provider:${providerId}`,
        providerId,
      })
      values[entry.key] = value
      if (!value) missing.push(entry.key)
      else {
        const issues = validator.validateValue(entry.key, value, entry.format)
        if (issues.length) invalid.push(entry.key)
      }
    }
    for (const entry of reg.optional ?? []) {
      const candidates = expandKeyCandidates(entry)
      keys.push(...candidates)
      values[entry.key] = this.getFirst(candidates, {
        caller: options?.caller ?? `provider:${providerId}:optional`,
        providerId,
      })
    }

    const complete = missing.length === 0 && invalid.length === 0
    return {
      providerId,
      keys: [...new Set(keys)],
      values,
      complete,
      missing,
      invalid,
      disabledGracefully: !complete && reg.required.every((r) => r.criticality === 'optional'),
    }
  }

  refresh(): void {
    for (const p of this.providers) p.refresh?.()
  }

  reload(): void {
    for (const p of this.providers) p.reload?.()
  }

  getVersion(): string {
    return getSecretRotationController().getVersion()
  }

  getLastUpdatedAt(): string | null {
    return getSecretRotationController().getLastUpdatedAt()
  }

  invalidateCache(): void {
    for (const p of this.providers) p.invalidateCache?.()
  }

  diagnostics(): SecretManagerDiagnostics {
    const primary = this.providers[0]
    const rotation = getSecretRotationController()
    return {
      version: SECURITY_SECRET_MANAGER_VERSION,
      enabled: this.isEnabled(),
      backend: primary?.providerId ?? 'none',
      liveBackend: Boolean(primary?.live),
      accessCount: this.accessCount,
      knownProviderIds: getSecretRegistry().providerIds(),
      rotationVersion: rotation.getVersion(),
      lastUpdatedAt: rotation.getLastUpdatedAt(),
    }
  }

  safeSummary(): {
    enabled: boolean
    backend: string
    redactedSample: string
    providers: string[]
  } {
    return {
      enabled: this.isEnabled(),
      backend: this.providers.map((p) => p.providerId).join('+'),
      redactedSample: redactSecret('sample_secret_value_0000') ?? '[REDACTED]',
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
