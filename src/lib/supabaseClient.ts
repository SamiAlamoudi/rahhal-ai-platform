import { createClient } from '@supabase/supabase-js'

/** Strip trailing slashes so auth/rest paths do not become `//auth/v1`. */
export function normalizeSupabaseUrl(url: string): string {
  return String(url ?? '').trim().replace(/\/+$/, '')
}

export function resolveSupabaseEnv(env: {
  VITE_SUPABASE_URL?: string
  VITE_SUPABASE_ANON_KEY?: string
} = {
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
}): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl = normalizeSupabaseUrl(env.VITE_SUPABASE_URL ?? '')
  const supabaseAnonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing required auth env: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set',
    )
  }
  if (!/^https?:\/\//i.test(supabaseUrl)) {
    throw new Error('VITE_SUPABASE_URL must be an absolute http(s) URL')
  }

  return { supabaseUrl, supabaseAnonKey }
}

const { supabaseUrl, supabaseAnonKey } = resolveSupabaseEnv()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
