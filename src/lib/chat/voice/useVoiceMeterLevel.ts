import { useSyncExternalStore } from 'react'
import { getVoiceMeterLevel, subscribeVoiceMeter } from './voiceMeterStore'

/** Subscribe to mic level without owning ChatPage state (Sprint 80 P1-5). */
export function useVoiceMeterLevel(): number {
  return useSyncExternalStore(subscribeVoiceMeter, getVoiceMeterLevel, () => 0)
}
