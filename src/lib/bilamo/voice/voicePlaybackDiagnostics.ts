/**
 * Developer-safe voice playback diagnostics — never include transcripts or secrets.
 */

export type VoicePlaybackDiagEvent =
  | 'remoteTrackReceived'
  | 'remoteTrackMuted'
  | 'remoteTrackUnmuted'
  | 'remoteTrackEnded'
  | 'audioPlayRequested'
  | 'audioPlaybackStarted'
  | 'audioPlaybackFailed'
  | 'audioPlaybackEnded'
  | 'silentRealtimeTimeout'
  | 'classicFallback'
  | 'watchdogIdleRecovery'

export type VoicePlaybackDiagnostics = {
  remoteTrackReceived: boolean
  remoteTrackMuted: boolean | null
  audioPlayRequested: boolean
  audioPlaybackStarted: boolean
  audioPlaybackFailed: boolean
  audioPlaybackEnded: boolean
  lastEvent: VoicePlaybackDiagEvent | null
  lastSafeErrorCode: string | null
  audioContextState: string | null
  peerConnectionState: string | null
  iceConnectionState: string | null
}

export function emptyVoicePlaybackDiagnostics(): VoicePlaybackDiagnostics {
  return {
    remoteTrackReceived: false,
    remoteTrackMuted: null,
    audioPlayRequested: false,
    audioPlaybackStarted: false,
    audioPlaybackFailed: false,
    audioPlaybackEnded: false,
    lastEvent: null,
    lastSafeErrorCode: null,
    audioContextState: null,
    peerConnectionState: null,
    iceConnectionState: null,
  }
}

export function readAudioContextState(): string | null {
  if (typeof window === 'undefined') return null
  try {
    const w = window as Window & {
      webkitAudioContext?: typeof AudioContext
      __bilamoAudioCtx?: AudioContext
    }
    const Ctx = window.AudioContext || w.webkitAudioContext
    if (!Ctx) return 'unsupported'
    const existing = w.__bilamoAudioCtx
    if (existing) return existing.state
    return 'unknown'
  } catch {
    return null
  }
}
