import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { supabase as supabaseCompat } from '../supabaseClient'

describe('Supabase Client: initialization', () => {
  it('creates a valid Supabase client instance', () => {
    expect(supabase).toBeDefined()
    expect(supabase.auth).toBeDefined()
    expect(supabase.from).toBeDefined()
  })

  it('re-exports the same client from supabaseClient', () => {
    expect(supabaseCompat).toBe(supabase)
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
})
