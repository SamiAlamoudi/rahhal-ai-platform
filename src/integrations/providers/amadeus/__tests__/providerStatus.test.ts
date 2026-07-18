import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  fetchProvidersHealth,
  formatAmadeusStatusLabel,
  isAmadeusConnected,
  PROVIDERS_HEALTH_PATH,
} from '../providerStatus'
import {
  missingCredentialsResponse,
  probeAmadeusConnection,
  readAmadeusCredentials,
} from '../../../../../api/_lib/amadeusEnv.js'

describe('readAmadeusCredentials', () => {
  it('detects missing credentials', () => {
    const result = readAmadeusCredentials({})
    expect(result.hasCredentials).toBe(false)
    expect(result.clientId).toBeNull()
    expect(result.clientSecret).toBeNull()
  })

  it('detects present credentials', () => {
    const result = readAmadeusCredentials({
      AMADEUS_CLIENT_ID: 'key',
      AMADEUS_CLIENT_SECRET: 'secret',
      AMADEUS_BASE_URL: 'https://test.api.amadeus.com/',
    })
    expect(result.hasCredentials).toBe(true)
    expect(result.host).toBe('https://test.api.amadeus.com')
  })
})

describe('probeAmadeusConnection', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('returns missing_credentials without secrets', async () => {
    const health = await probeAmadeusConnection({})
    expect(health).toMatchObject({
      amadeus: 'missing_credentials',
      fallback: true,
    })
    expect(missingCredentialsResponse().amadeus).toBe('missing_credentials')
  })

  it('returns connected when OAuth succeeds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'tok', expires_in: 1800 }),
    }))

    const health = await probeAmadeusConnection({
      AMADEUS_CLIENT_ID: 'key',
      AMADEUS_CLIENT_SECRET: 'secret',
      AMADEUS_BASE_URL: 'https://test.api.amadeus.com',
    })
    expect(health.amadeus).toBe('connected')
    expect(health.fallback).toBe(false)
  })

  it('returns invalid_credentials on 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({}),
    }))

    const health = await probeAmadeusConnection({
      AMADEUS_CLIENT_ID: 'bad',
      AMADEUS_CLIENT_SECRET: 'bad',
    })
    expect(health.amadeus).toBe('invalid_credentials')
    expect(health.fallback).toBe(true)
  })
})

describe('providerStatus client helpers', () => {
  it('formats connected and mock labels', () => {
    expect(formatAmadeusStatusLabel({
      amadeus: 'connected',
      fallback: false,
      checkedAt: new Date().toISOString(),
    })).toBe('✓ Amadeus Connected')

    expect(formatAmadeusStatusLabel({
      amadeus: 'missing_credentials',
      fallback: true,
      checkedAt: new Date().toISOString(),
    })).toBe('⚠ Running in Mock Mode')

    expect(isAmadeusConnected({
      amadeus: 'connected',
      fallback: false,
      checkedAt: new Date().toISOString(),
    })).toBe(true)
  })

  it('fetches /api/health/providers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        amadeus: 'missing_credentials',
        fallback: true,
        checkedAt: '2026-07-18T00:00:00.000Z',
      }),
    })

    const health = await fetchProvidersHealth(fetchImpl as unknown as typeof fetch)
    expect(fetchImpl).toHaveBeenCalledWith(
      PROVIDERS_HEALTH_PATH,
      expect.objectContaining({ method: 'GET' }),
    )
    expect(health.amadeus).toBe('missing_credentials')
    expect(health.fallback).toBe(true)
  })
})
