import { describe, expect, it } from 'vitest'
import {
  pickCorsAllowOrigin,
  resolveEdgeAllowedOrigins,
  resolveEdgeDeployTarget,
} from '../ops/security/edgeCorsAllowlist'
import { validateEnvironment } from '../ops/security/envValidation'

/** Secrets that must never appear as VITE_* in the SPA bundle. */
const FORBIDDEN_CLIENT_SECRETS = [
  'VITE_OPENAI_API_KEY',
  'VITE_AGENT_OPENAI_API_KEY',
  'VITE_RAPIDAPI_KEY',
  'VITE_BOOKING_API_KEY',
  'VITE_RENTAL_API_KEY',
  'VITE_HOTEL_API_KEY',
  'VITE_OPENWEATHER_API_KEY',
  'VITE_GOOGLE_MAPS_API_KEY',
  'VITE_MOYASAR_SECRET_KEY',
  'VITE_MOYASAR_SECRET',
  'VITE_AMADEUS_CLIENT_SECRET',
  'VITE_AMADEUS_CLIENT_ID',
] as const

describe('EDGE_ALLOWED_ORIGINS configurability', () => {
  it('resolves local/development as permissive when allowlist empty', () => {
    for (const target of ['local', 'development'] as const) {
      const resolved = resolveEdgeAllowedOrigins({
        target,
        env: {},
      })
      expect(resolved.permissiveEmpty).toBe(true)
      expect(pickCorsAllowOrigin('http://localhost:5173', resolved)).toBe('*')
    }
  })

  it('fail-closes staging/production when allowlist empty', () => {
    for (const target of ['staging', 'production'] as const) {
      const resolved = resolveEdgeAllowedOrigins({ target, env: {} })
      expect(resolved.permissiveEmpty).toBe(false)
      expect(pickCorsAllowOrigin('https://evil.example', resolved)).toBe('null')
    }
  })

  it('uses EDGE_ALLOWED_ORIGINS_PRODUCTION override', () => {
    const resolved = resolveEdgeAllowedOrigins({
      env: {
        EDGE_DEPLOY_TARGET: 'production',
        EDGE_ALLOWED_ORIGINS: 'https://fallback.example',
        EDGE_ALLOWED_ORIGINS_PRODUCTION: 'https://app.rahhal.sa,https://www.rahhal.sa',
      },
    })
    expect(resolved.target).toBe('production')
    expect(resolved.source).toBe('EDGE_ALLOWED_ORIGINS_PRODUCTION')
    expect(pickCorsAllowOrigin('https://app.rahhal.sa', resolved)).toBe('https://app.rahhal.sa')
    expect(pickCorsAllowOrigin('https://evil.example', resolved)).toBe('https://app.rahhal.sa')
  })

  it('uses EDGE_ALLOWED_ORIGINS_STAGING for staging/preview', () => {
    const resolved = resolveEdgeAllowedOrigins({
      env: {
        VITE_DEPLOY_TARGET: 'staging',
        EDGE_ALLOWED_ORIGINS_STAGING: 'https://staging.rahhal.sa',
      },
    })
    expect(resolved.target).toBe('staging')
    expect(pickCorsAllowOrigin('https://staging.rahhal.sa', resolved)).toBe(
      'https://staging.rahhal.sa',
    )
  })

  it('uses EDGE_ALLOWED_ORIGINS_LOCAL for local tooling', () => {
    const resolved = resolveEdgeAllowedOrigins({
      env: {
        EDGE_DEPLOY_TARGET: 'local',
        EDGE_ALLOWED_ORIGINS_LOCAL: 'http://127.0.0.1:5173,http://localhost:5173',
      },
    })
    expect(resolved.origins).toEqual([
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ])
    expect(pickCorsAllowOrigin('http://localhost:5173', resolved)).toBe(
      'http://localhost:5173',
    )
  })

  it('EDGE_CORS_PERMISSIVE unlocks * on production empty allowlist', () => {
    const resolved = resolveEdgeAllowedOrigins({
      env: {
        EDGE_DEPLOY_TARGET: 'production',
        EDGE_CORS_PERMISSIVE: 'true',
      },
    })
    expect(resolved.permissiveEmpty).toBe(true)
    expect(pickCorsAllowOrigin(null, resolved)).toBe('*')
  })

  it('resolveEdgeDeployTarget maps aliases', () => {
    expect(resolveEdgeDeployTarget({ EDGE_DEPLOY_TARGET: 'prod' })).toBe('production')
    expect(resolveEdgeDeployTarget({ DEPLOY_TARGET: 'stage' })).toBe('staging')
    expect(resolveEdgeDeployTarget({ VITE_DEPLOY_TARGET: 'dev' })).toBe('development')
  })
})

describe('zero SPA client secrets', () => {
  it('hard-fails every forbidden VITE_* secret on all deploy targets', () => {
    for (const target of ['development', 'preview', 'staging', 'production'] as const) {
      for (const key of FORBIDDEN_CLIENT_SECRETS) {
        const result = validateEnvironment({
          target,
          env: {
            VITE_PAYMENT_PROVIDER: 'mock',
            VITE_SUPABASE_URL: 'https://example.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'anon',
            [key]: 'leaked-secret',
          },
        })
        expect(result.ok).toBe(false)
        expect(result.errors.some((e) => e.includes(key))).toBe(true)
      }
    }
  })

  it('accepts proxy URL / model env without treating them as secrets', () => {
    const result = validateEnvironment({
      target: 'production',
      env: {
        VITE_PAYMENT_PROVIDER: 'mock',
        VITE_SUPABASE_URL: 'https://example.supabase.co',
        VITE_SUPABASE_ANON_KEY: 'anon',
        VITE_OPENAI_PROXY_URL: 'https://example.supabase.co/functions/v1/openai-proxy',
        VITE_BOOKING_PROXY_URL: 'https://example.supabase.co/functions/v1/booking-proxy',
        VITE_AGENT_OPENAI_MODEL: 'gpt-4o-mini',
        VITE_AGENT_LLM_PROVIDER: 'openai',
      },
    })
    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])
  })
})
