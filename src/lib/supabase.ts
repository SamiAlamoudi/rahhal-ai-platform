import { createClient } from '@supabase/supabase-js'

function readRequiredEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY' | 'VITE_SUPABASE_PUBLISHABLE_KEY'): string | undefined {
  const value = import.meta.env[name]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const supabaseUrl = readRequiredEnv('VITE_SUPABASE_URL')
const supabaseAnonKey =
  readRequiredEnv('VITE_SUPABASE_ANON_KEY')
  ?? readRequiredEnv('VITE_SUPABASE_PUBLISHABLE_KEY')

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. '
    + 'Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY '
    + '(or VITE_SUPABASE_PUBLISHABLE_KEY) in .env.local.',
  )
}

/**
 * Shared browser Supabase client (Auth + Postgres via PostgREST).
 * Singleton — import this module; do not call `createClient` elsewhere.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
