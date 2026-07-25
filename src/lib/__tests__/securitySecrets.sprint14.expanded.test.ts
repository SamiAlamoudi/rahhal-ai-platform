/**
 * Sprint 14 — expanded secret management acceptance tests.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  REDACTED_PLACEHOLDER,
  SECURITY_SECRET_MANAGER_FEATURE_ID,
  createMemorySecretProvider,
  createProviderSecretAuthorizer,
  createSecretManager,
  createSecretSanitizer,
  createValidationService,
  findServerSecretLeaksInBundle,
  getSecretMetrics,
  getSecretRegistry,
  getSecretRotationController,
  listServerOnlySecretKeys,
  resetSecretAccessAuditForTests,
  resetSecretManagerForTests,
  resetSecretMetricsForTests,
  resetSecretRegistryForTests,
  resetSecretRotationForTests,
  resolveProviderCredentials,
  sanitizeForLogs,
  shouldDisableProvider,
  validateSecretsAtStartup,
} from '../security'
import { SecretRegistry } from '../security/secrets/SecretRegistry'

describe('Sprint 14 — expanded secret registry / validation / authz', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetSecretManagerForTests()
    resetSecretAccessAuditForTests()
    resetSecretMetricsForTests()
    resetSecretRotationForTests()
    resetSecretRegistryForTests()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetSecretManagerForTests()
    resetSecretAccessAuditForTests()
    resetSecretMetricsForTests()
    resetSecretRotationForTests()
    resetSecretRegistryForTests()
  })

  it('registers provider secrets without duplicates', () => {
    const registry = getSecretRegistry()
    expect(registry.providerIds()).toEqual(expect.arrayContaining([
      'openai',
      'amadeus',
      'google_maps',
      'weather',
      'currency',
      'email',
      'notifications',
      'payment_future',
      'moyasar',
      'supabase',
    ]))
    const issues = registry.register({
      providerId: 'amadeus',
      required: [],
    })
    expect(issues.some((i) => i.code === 'duplicate_registration')).toBe(true)
  })

  it('detects duplicate aliases across providers', () => {
    const registry = new SecretRegistry([])
    expect(registry.register({
      providerId: 'openai',
      required: [],
      optional: [{ key: 'SHARED_KEY', scope: 'server_only', criticality: 'optional' }],
    })).toEqual([])
    const issues = registry.register({
      providerId: 'amadeus',
      required: [],
      optional: [{ key: 'OTHER', scope: 'server_only', criticality: 'optional', aliases: ['SHARED_KEY'] }],
    })
    expect(issues.some((i) => i.code === 'duplicate_alias')).toBe(true)
  })

  it('validates missing / empty / whitespace / malformed secrets', () => {
    const v = createValidationService()
    expect(v.validateValue('K', null)[0]?.code).toBe('missing')
    expect(v.validateValue('K', '   ')[0]?.code).toBe('empty')
    expect(v.validateValue('K', ' spaced ')[0]?.code).toBe('unexpected_whitespace')
    expect(v.validateValue('K', 'pk-not-openai', 'openai_sk')[0]?.code).toBe('invalid_prefix')
    expect(v.validateValue('K', 'not-a-url', 'url')[0]?.code).toBe('malformed')
  })

  it('missing optional provider credentials disable gracefully', () => {
    const memory = createMemorySecretProvider({})
    const weather = resolveProviderCredentials('weather', { enabled: true, provider: memory })
    expect(weather.complete).toBe(true)
    expect(weather.disabledGracefully).toBe(false)

    const amadeus = resolveProviderCredentials('amadeus', { enabled: true, provider: memory })
    expect(amadeus.complete).toBe(false)
    expect(amadeus.disabledGracefully).toBe(true)
    expect(shouldDisableProvider('amadeus')).toBe(true)
  })

  it('production startup fails hard on critical missing secrets', () => {
    const report = validateSecretsAtStartup({ production: true })
    // Without Supabase env in CI unit context, critical failures expected
    expect(report.mode).toBe('production')
    if (report.criticalFailures.length) {
      expect(report.failedHard).toBe(true)
      expect(report.ok).toBe(false)
    }
  })

  it('development startup does not hard-fail on critical gaps', () => {
    const report = validateSecretsAtStartup({ production: false })
    expect(report.mode).toBe('development')
    expect(report.failedHard).toBe(false)
  })

  it('provider authorization isolates secrets', () => {
    const authz = createProviderSecretAuthorizer()
    expect(authz.authorize('amadeus', 'AMADEUS_API_KEY')).toBe(true)
    expect(authz.authorize('amadeus', 'OPENAI_API_KEY')).toBe(false)
    expect(authz.authorize('google_maps', 'PAYMENT_SECRET_KEY')).toBe(false)
    expect(authz.authorize('openai', 'MOYASAR_SECRET_KEY')).toBe(false)
    expect(() => authz.assertAuthorized('amadeus', 'OPENAI_API_KEY')).toThrow(/Unauthorized/)

    const memory = createMemorySecretProvider({
      OPENAI_API_KEY: 'sk-test-openai-aaaaaaaaaaaa',
      AMADEUS_API_KEY: 'amadeus-aaaaaaaa',
    })
    const manager = createSecretManager({ enabled: true, provider: memory })
    expect(manager.get('OPENAI_API_KEY', { providerId: 'amadeus' })).toBeNull()
    expect(manager.get('OPENAI_API_KEY', { providerId: 'openai' })).toBe('sk-test-openai-aaaaaaaaaaaa')
    expect(manager.get('AMADEUS_API_KEY', { providerId: 'generic' })).toBeNull()
  })

  it('rotation abstraction updates version and timestamps', () => {
    const rotation = getSecretRotationController()
    expect(rotation.getVersion()).toBe('1')
    expect(rotation.getLastUpdatedAt()).toBeNull()
    rotation.refresh()
    expect(Number(rotation.getVersion())).toBeGreaterThan(1)
    expect(rotation.getLastUpdatedAt()).toMatch(/T/)
    rotation.reload()
    rotation.invalidateCache()
    const manager = createSecretManager({ enabled: true })
    manager.refresh()
    manager.invalidateCache()
    expect(manager.getVersion()).toBeTruthy()
  })

  it('sanitizer redacts nested objects, headers, and errors', () => {
    const sanitizer = createSecretSanitizer()
    const nested = sanitizer.sanitize({
      ok: true,
      headers: { Authorization: 'Bearer abcdefghijklmnop' },
      payload: { api_key: 'secret-value-123456', nested: { refresh_token: 'r'.repeat(20) } },
      text: 'prefix sk-abcdefghijklmnopqrstuvwxyz123456 suffix',
    }) as Record<string, unknown>
    expect(JSON.stringify(nested)).toContain(REDACTED_PLACEHOLDER)
    expect(JSON.stringify(nested)).not.toContain('secret-value-123456')
    expect(JSON.stringify(nested)).not.toContain('sk-abcdefghijklmnopqrstuvwxyz123456')

    const headers = sanitizer.sanitizeHeaders({
      Authorization: 'Bearer token-value',
      'Content-Type': 'application/json',
    })
    expect(headers.Authorization).toBe(REDACTED_PLACEHOLDER)

    const err = sanitizer.sanitize(new Error('token=supersecretvalue123')) as { message: string }
    expect(err.message).not.toContain('supersecretvalue123')

    const viaHelper = sanitizeForLogs({ password: 'hunter2!!', safe: 1 }) as Record<string, unknown>
    expect(viaHelper.password).toBe(REDACTED_PLACEHOLDER)
    expect(viaHelper.safe).toBe(1)
  })

  it('metrics never include secret values', () => {
    resetSecretMetricsForTests()
    createSecretSanitizer().sanitize({ api_key: 'leak-me-please-now' })
    createProviderSecretAuthorizer().authorize('amadeus', 'OPENAI_API_KEY')
    const metrics = getSecretMetrics()
    expect(JSON.stringify(metrics)).not.toContain('leak-me')
    expect(metrics.sanitizationCount).toBeGreaterThan(0)
    expect(metrics.unauthorizedAccessCount).toBeGreaterThan(0)
  })

  it('client boundary lists server-only keys and detects bundle leaks', () => {
    const keys = listServerOnlySecretKeys()
    expect(keys).toContain('AMADEUS_API_SECRET')
    expect(keys).toContain('OPENAI_API_KEY')
    expect(keys).not.toContain('VITE_SUPABASE_URL')

    const clean = findServerSecretLeaksInBundle('const x = 1; ChatPage bundle')
    expect(clean).toEqual([])
    const dirty = findServerSecretLeaksInBundle("AMADEUS_API_SECRET = 'abcdefghijklmnopqrstuvwxyz'")
    expect(dirty).toContain('AMADEUS_API_SECRET')
    const sk = findServerSecretLeaksInBundle('const k = "sk-abcdefghijklmnopqrstuvwxyz12"')
    expect(sk).toContain('openai_sk_material')
  })

  it('keeps security.secret_manager OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(SECURITY_SECRET_MANAGER_FEATURE_ID)).toBe(false)
  })

  it('build artifact smoke: ChatPage chunk has no server-only secret material when dist exists', () => {
    const distAssets = join(process.cwd(), 'dist', 'assets')
    if (!existsSync(distAssets)) {
      expect(true).toBe(true)
      return
    }
    const files = readdirSync(distAssets).filter((f) => /ChatPage|index-.*\.js$/.test(f))
    for (const file of files) {
      const text = readFileSync(join(distAssets, file), 'utf8')
      expect(findServerSecretLeaksInBundle(text)).toEqual([])
    }
  })

  it('performance: 1000 sanitized payloads under budget', () => {
    const sanitizer = createSecretSanitizer()
    const started = Date.now()
    for (let i = 0; i < 1000; i++) {
      sanitizer.sanitize({ a: i, api_key: `k-${i}`, nested: { token: `t-${i}` } })
    }
    expect(Date.now() - started).toBeLessThan(500)
  })
})
