import { useMemo, useSyncExternalStore } from 'react'
import type { VoiceEvent, VoiceSession, VoiceTimelineEntry } from '../lib/voiceConversation'

export type UseVoiceEventsOptions = {
  session: VoiceSession
}

export type UseVoiceEventsReturn = {
  events: VoiceEvent[]
  timeline: VoiceTimelineEntry[]
  lastEvent: VoiceEvent | null
  errors: VoiceEvent[]
  interruptions: VoiceEvent[]
}

/**
 * Subscribe to voice event log + timeline for a session.
 */
export function useVoiceEvents(options: UseVoiceEventsOptions): UseVoiceEventsReturn {
  const { session } = options
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getSnapshot,
  )

  return useMemo(() => {
    const events = session.listEvents()
    return {
      events,
      timeline: snapshot.timeline,
      lastEvent: events[events.length - 1] ?? null,
      errors: events.filter((e) => e.type === 'error'),
      interruptions: events.filter((e) => e.type === 'interrupted'),
    }
  }, [session, snapshot])
}
