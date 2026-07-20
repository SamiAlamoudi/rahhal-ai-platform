import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../auth/AuthContext'
import { sessionRepository } from '../repositories/sessionRepository'
import {
  createEmptyTravelSession,
  mergeTravelSession,
  type TravelSession,
} from '../../utils/travelSession'

export function useSessionPersistence() {
  const { user, loading: authLoading } = useAuth()
  const [session, setSessionState] = useState<TravelSession>(createEmptyTravelSession())
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setSessionState(createEmptyTravelSession())
      setSessionId(null)
      setLoading(false)
      return
    }
    (async () => {
      try {
        const rows = await sessionRepository.listByUser(1)
        if (rows.length > 0) {
          const latest = rows[0]
          const restored = sessionRepository.dataToSession(latest.session_data)
          setSessionState(restored)
          setSessionId(latest.id)
        } else {
          setSessionState(createEmptyTravelSession())
          setSessionId(null)
        }
      } catch {
        setSessionState(createEmptyTravelSession())
      } finally {
        setLoading(false)
      }
    })()
  }, [user, authLoading])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  const saveSession = useCallback((updated: TravelSession) => {
    setSessionState(updated)
    if (!user) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      try {
        if (sessionId) {
          await sessionRepository.update(sessionId, updated)
        } else if (updated.destination || updated.departureCity || updated.adults) {
          const row = await sessionRepository.create(updated)
          if (row) setSessionId(row.id)
        }
      } catch { }
    }, 800)
  }, [user, sessionId])

  const mergeSession = useCallback((newData: string | Partial<TravelSession>): TravelSession => {
    const updated = mergeTravelSession(session, newData)
    saveSession(updated)
    return updated
  }, [session, saveSession])

  const clearSession = useCallback(() => {
    setSessionState(createEmptyTravelSession())
    setSessionId(null)
  }, [])

  return {
    session,
    sessionId,
    loading,
    saveSession,
    mergeSession,
    clearSession,
    setSession: setSessionState,
  }
}
