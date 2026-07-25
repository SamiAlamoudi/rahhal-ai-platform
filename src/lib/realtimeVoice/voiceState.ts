/**
 * Phase 7 — VoiceState machine helpers
 */

import type { VoiceSessionState } from './types'

const ALLOWED: Record<VoiceSessionState, VoiceSessionState[]> = {
  idle: ['connecting', 'listening', 'disconnected'],
  connecting: ['listening', 'error', 'disconnected', 'reconnecting'],
  listening: ['transcribing', 'reasoning', 'interrupted', 'disconnected', 'idle'],
  transcribing: ['reasoning', 'listening', 'interrupted'],
  reasoning: ['speaking', 'listening', 'interrupted'],
  speaking: ['listening', 'interrupted', 'idle'],
  interrupted: ['listening', 'reasoning', 'idle'],
  reconnecting: ['listening', 'connecting', 'disconnected', 'error'],
  disconnected: ['connecting', 'idle'],
  error: ['idle', 'connecting', 'reconnecting'],
}

export function canTransition(from: VoiceSessionState, to: VoiceSessionState): boolean {
  if (from === to) return true
  return ALLOWED[from]?.includes(to) ?? false
}

export function transitionVoiceState(
  from: VoiceSessionState,
  to: VoiceSessionState,
): VoiceSessionState {
  return canTransition(from, to) ? to : from
}

export const VoiceState = {
  canTransition,
  transition: transitionVoiceState,
}
