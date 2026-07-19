import type { VoiceSessionTransitionReason, VoiceState } from './types'

/**
 * Deterministic voice conversation state machine.
 * Single source of truth for allowed transitions — no duplicated UI state.
 */

const ALLOWED: Record<VoiceState, Partial<Record<VoiceSessionTransitionReason, VoiceState>>> = {
  idle: {
    start: 'listening',
    disconnect: 'disconnected',
    error: 'error',
  },
  listening: {
    user_speech_end: 'thinking',
    pause: 'paused',
    stop: 'idle',
    interrupt: 'interrupted',
    disconnect: 'disconnected',
    error: 'error',
  },
  thinking: {
    assistant_ready: 'speaking',
    interrupt: 'interrupted',
    pause: 'paused',
    stop: 'idle',
    disconnect: 'disconnected',
    error: 'error',
  },
  speaking: {
    assistant_done: 'listening',
    interrupt: 'interrupted',
    pause: 'paused',
    stop: 'idle',
    disconnect: 'disconnected',
    error: 'error',
  },
  paused: {
    resume: 'listening',
    stop: 'idle',
    disconnect: 'disconnected',
    error: 'error',
  },
  interrupted: {
    // Barge-in: assistant stops → listening resumes immediately.
    start: 'listening',
    resume: 'listening',
    stop: 'idle',
    disconnect: 'disconnected',
    error: 'error',
  },
  disconnected: {
    reconnect: 'idle',
    start: 'listening',
    error: 'error',
  },
  error: {
    reset: 'idle',
    start: 'listening',
    disconnect: 'disconnected',
  },
}

export function canTransition(
  from: VoiceState,
  reason: VoiceSessionTransitionReason,
): boolean {
  return Boolean(ALLOWED[from]?.[reason])
}

export function nextVoiceState(
  from: VoiceState,
  reason: VoiceSessionTransitionReason,
): VoiceState | null {
  return ALLOWED[from]?.[reason] ?? null
}

export function assertTransition(
  from: VoiceState,
  reason: VoiceSessionTransitionReason,
): VoiceState {
  const to = nextVoiceState(from, reason)
  if (!to) {
    throw new Error(`Invalid voice transition: ${from} --(${reason})--> ?`)
  }
  return to
}

export function listAllowedReasons(from: VoiceState): VoiceSessionTransitionReason[] {
  return Object.keys(ALLOWED[from] ?? {}) as VoiceSessionTransitionReason[]
}
