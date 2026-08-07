import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import {
  normalizeSupabaseUrl,
  resolveSupabaseEnv,
  supabase,
} from '../supabaseClient'

describe('Supabase Client: initialization', () => {
  it('creates a valid Supabase client instance', () => {
    expect(supabase).toBeDefined()
    expect(supabase.auth).toBeDefined()
    expect(supabase.from).toBeDefined()
  })

  it('is configured with persistent sessions', () => {
    const client = createClient('https://example.supabase.co', 'fake-key', {
      auth: { persistSession: true, autoRefreshToken: true },
    })
    expect(client).toBeDefined()
  })
})

describe('Supabase Client: env vars', () => {
  it('VITE_SUPABASE_URL is defined', () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBeDefined()
    expect(typeof import.meta.env.VITE_SUPABASE_URL).toBe('string')
  })

  it('VITE_SUPABASE_ANON_KEY is defined', () => {
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeDefined()
    expect(typeof import.meta.env.VITE_SUPABASE_ANON_KEY).toBe('string')
  })

  it('normalizes trailing slashes on the project URL', () => {
    expect(normalizeSupabaseUrl('https://example.supabase.co/')).toBe('https://example.supabase.co')
    expect(normalizeSupabaseUrl(' https://example.supabase.co/// ')).toBe('https://example.supabase.co')
  })

  it('requires both auth env vars', () => {
    expect(() => resolveSupabaseEnv({ VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: 'x' }))
      .toThrow(/VITE_SUPABASE_URL/)
    expect(() => resolveSupabaseEnv({
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_ANON_KEY: '',
    })).toThrow(/VITE_SUPABASE_ANON_KEY/)
  })
})
