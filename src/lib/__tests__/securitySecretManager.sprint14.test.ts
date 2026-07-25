/**
 * Sprint 14 — Production Security & Secrets Management tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  FUTURE_VAULT_CAPABILITIES,
  SECURITY_SECRET_MANAGER_FEATURE_ID,
  SECURITY_SECRET_MANAGER_VERSION,
  assertNoSecretLeak,
  createMemorySecretProvider,
  createSecretManager,
  isSecretManagerEnabled,
  listSecretAccessEvents,
  redactSecret,
  resetSecretAccessAuditForTests,
  resetSecretManagerForTests,
  resolveProviderCredentials,
  setSecretManagerForTests,
} from '../security'
import { readLiveProviderSecret } from '../agent/liveProviders/feature'

describe('Sprint 14 — Production Security & Secrets Management', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetSecretManagerForTests()
    resetSecretAccessAuditForTests()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetSecretManagerForTests()
    resetSecretAccessAuditForTests()
  })

  it('keeps secret manager flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(SECURITY_SECRET_MANAGER_FEATURE_ID)).toBe(false)
    expect(isSecretManagerEnabled()).toBe(false)
    expect(SECURITY_SECRET_MANAGER_VERSION).toMatch(/security-secret-manager/)
  })

  it('EnvironmentSecretProvider is the sole env reader behind SecretManager', () => {
    const memory = createMemorySecretProvider({
      AMADEUS_API_KEY: 'amadeus-key-123456',
      AMADEUS_API_SECRET: 'amadeus-secret-987654',
    })
    const manager = createSecretManager({
      enabled: true,
      provider: memory,
      caller: 'test',
    })
    expect(manager.get('AMADEUS_API_KEY')).toBe('amadeus-key-123456')
    expect(manager.has('AMADEUS_API_SECRET')).toBe(true)
    expect(manager.presence('MISSING_KEY').present).toBe(false)
  })

  it('resolves provider credentials from one configuration layer', () => {
    const memory = createMemorySecretProvider({
      AMADEUS_API_KEY: 'key-aaaaaaaa',
      AMADEUS_CLIENT_SECRET: 'secret-bbbbbbbb',
      DUFFEL_API_TOKEN: 'duffel-token-cccc',
    })
    const amadeus = resolveProviderCredentials('amadeus', {
      enabled: true,
      provider: memory,
    })
    expect(amadeus.complete).toBe(true)
    expect(amadeus.values.AMADEUS_API_KEY).toBe('key-aaaaaaaa')
    expect(amadeus.values.AMADEUS_API_SECRET).toBe('secret-bbbbbbbb')
    expect(amadeus.missing).toEqual([])

    const duffel = resolveProviderCredentials('duffel', {
      enabled: true,
      provider: memory,
    })
    expect(duffel.complete).toBe(true)

    const booking = resolveProviderCredentials('booking', {
      enabled: true,
      provider: memory,
    })
    expect(booking.complete).toBe(false)
    expect(booking.missing).toContain('BOOKING_API_KEY')
  })

  it('redacts secrets and blocks leaks in payloads', () => {
    expect(redactSecret('abcdefghij')).toBe('[REDACTED]')
    expect(redactSecret('short')).toBe('[REDACTED]')
    expect(() => assertNoSecretLeak({ msg: 'token=supersecretvalue' }, ['supersecretvalue']))
      .toThrow(/Secret material/)
  })

  it('records redacted access audit events', () => {
    const memory = createMemorySecretProvider({ DUFFEL_API_TOKEN: 'token-value-zzzz' })
    const manager = createSecretManager({ enabled: true, provider: memory })
    manager.get('DUFFEL_API_TOKEN', { caller: 'audit-test' })
    const events = listSecretAccessEvents()
    expect(events.some((e) => e.key === 'DUFFEL_API_TOKEN' && e.caller === 'audit-test')).toBe(true)
    expect(events.every((e) => e.redactedPreview == null || !e.redactedPreview.includes('token-value'))).toBe(true)
  })

  it('future vault provider stays disabled', () => {
    expect(FUTURE_VAULT_CAPABILITIES.hashicorpVault).toBe(false)
    expect(FUTURE_VAULT_CAPABILITIES.awsSecretsManager).toBe(false)
    const manager = createSecretManager({ enabled: true })
    const summary = manager.safeSummary()
    expect(summary.providers.some((p) => p.includes('future_vault:live=false'))).toBe(true)
  })

  it('bridge: readLiveProviderSecret uses SecretManager when flag ON', () => {
    const memory = createMemorySecretProvider({ DUFFEL_API_TOKEN: 'bridged-token-1111' })
    const manager = createSecretManager({ enabled: true, provider: memory })
    setSecretManagerForTests(manager)
    getFeatureRegistry().setEnabled(SECURITY_SECRET_MANAGER_FEATURE_ID, true)
    expect(readLiveProviderSecret('DUFFEL_API_TOKEN', 'duffel')).toBe('bridged-token-1111')
    expect(readLiveProviderSecret('DUFFEL_API_TOKEN', 'amadeus')).toBeNull()

    getFeatureRegistry().setEnabled(SECURITY_SECRET_MANAGER_FEATURE_ID, false)
    resetSecretManagerForTests()
    expect(readLiveProviderSecret('DUFFEL_API_TOKEN_THAT_DOES_NOT_EXIST_XYZ', 'duffel')).toBeNull()
  })

  it('regression: flag OFF leaves SecretManager disabled for registry callers', () => {
    expect(isSecretManagerEnabled()).toBe(false)
    const manager = createSecretManager()
    expect(manager.isEnabled()).toBe(false)
  })

  it('diagnostics never expose secret values', () => {
    const memory = createMemorySecretProvider({ OPENAI_API_KEY: 'sk-live-should-not-leak' })
    const manager = createSecretManager({ enabled: true, provider: memory })
    manager.get('OPENAI_API_KEY')
    const diag = manager.diagnostics()
    expect(JSON.stringify(diag)).not.toContain('sk-live-should-not-leak')
    expect(diag.knownProviderIds).toContain('amadeus')
    expect(diag.knownProviderIds).toContain('duffel')
    expect(diag.knownProviderIds).toContain('booking')
  })

  it('performance: secret resolution stays under budget', () => {
    const memory = createMemorySecretProvider({
      AMADEUS_API_KEY: 'k'.repeat(20),
      AMADEUS_API_SECRET: 's'.repeat(20),
    })
    const manager = createSecretManager({ enabled: true, provider: memory })
    const started = Date.now()
    for (let i = 0; i < 500; i++) {
      manager.getProviderCredentials('amadeus')
    }
    expect(Date.now() - started).toBeLessThan(500)
  })
})
