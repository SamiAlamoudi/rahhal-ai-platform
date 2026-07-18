import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { isAdminUser } from './adminAccess'
import {
  clearDemoSession,
  isDemoAuthEnabled,
  readDemoSession,
} from './demoAuth'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  /** True when the active session is the local demo session. */
  isDemoSession: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isAuthenticated: false,
  isAdmin: false,
  isDemoSession: false,
})

function isDemoToken(session: Session | null): boolean {
  return session?.access_token === 'demo-access-token'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const applySession = (next: Session | null) => {
      if (cancelled) return
      setSession(next)
      setUser(next?.user ?? null)
      setLoading(false)
    }

    // Prefer an active local demo session when the flag is on.
    if (isDemoAuthEnabled()) {
      const demo = readDemoSession()
      if (demo) {
        applySession(demo)
      }
    }

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      // Do not clobber an active demo session with an empty Supabase result.
      if (isDemoAuthEnabled() && readDemoSession() && !data.session) {
        applySession(readDemoSession())
        return
      }
      applySession(data.session)
    }).catch(() => {
      if (isDemoAuthEnabled()) {
        applySession(readDemoSession())
      } else {
        applySession(null)
      }
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      (async () => {
        if (cancelled) return
        if (!newSession && isDemoAuthEnabled() && readDemoSession()) {
          applySession(readDemoSession())
          return
        }
        if (newSession) {
          clearDemoSession()
        }
        applySession(newSession)
      })()
    })

    const onDemoAuthChanged = () => {
      if (!isDemoAuthEnabled()) return
      applySession(readDemoSession())
    }
    window.addEventListener('rahhal:demo-auth', onDemoAuthChanged)

    return () => {
      cancelled = true
      authListener.subscription.unsubscribe()
      window.removeEventListener('rahhal:demo-auth', onDemoAuthChanged)
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isAuthenticated: !!user,
        isAdmin: isAdminUser(user),
        isDemoSession: isDemoToken(session),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
