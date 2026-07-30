/**
 * Canonical microphone session states for Home voice UX logging.
 * Idle after Stop must never auto-transition to Listening.
 */

export type MicSessionState =
  | 'IDLE'
  | 'LISTENING'
  | 'PROCESSING'
  | 'SPEAKING'
  | 'STOPPED'

import { logPipeline } from '../pipelineDiagnostics'

let lastLogged: MicSessionState | null = null

export function resetMicSessionStateLog(): void {
  lastLogged = null
}

export function logMicSessionState(
  next: MicSessionState,
  detail?: Record<string, unknown>,
): void {
  if (lastLogged === next) return
  const from = lastLogged
  lastLogged = next
  logPipeline({
    stage: 'voice',
    event: 'mic_state_transition',
    meta: {
      from,
      to: next,
      ...detail,
    },
  })
}

/** Map Realtime / VoiceSession statuses onto the five UX states. */
export function mapToMicSessionState(
  status: string,
  opts?: { hardStopped?: boolean },
): MicSessionState {
  if (opts?.hardStopped) return 'STOPPED'
  switch (status) {
    case 'listening':
      return 'LISTENING'
    case 'thinking':
    case 'responding':
    case 'processing':
    case 'reconnecting':
    case 'requesting_permission':
    case 'connecting':
      return 'PROCESSING'
    case 'speaking':
      return 'SPEAKING'
    case 'error':
      return 'IDLE'
    case 'idle':
    default:
      return 'IDLE'
  }
}
