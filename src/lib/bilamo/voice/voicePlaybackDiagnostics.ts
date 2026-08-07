/**
 * Developer-safe voice playback / turn diagnostics — never include transcripts or secrets.
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
  | 'speechDetected'
  | 'endOfSpeechDetected'
  | 'inputCommitted'
  | 'finalTranscriptReceived'
  | 'assistantResponseCreated'
  | 'playRequested'
  | 'playResolved'
  | 'playRejected'
  | 'interruptAcknowledged'
  | 'finalizeListening'

export type VoicePlaybackDiagnostics = {
  remoteTrackReceived: boolean
  remoteTrackMuted: boolean | null
  remoteTrackReadyState: string | null
  audioElementAttached: boolean
  audioPlayRequested: boolean
  audioPlaybackStarted: boolean
  audioPlaybackFailed: boolean
  audioPlaybackEnded: boolean
  speechDetected: boolean
  endOfSpeechDetected: boolean
  inputCommitted: boolean
  finalTranscriptReceived: boolean
  assistantResponseCreated: boolean
  classicFallbackInvoked: boolean
  interruptAcknowledged: boolean
  lastEvent: VoicePlaybackDiagEvent | null
  lastSafeErrorCode: string | null
  lastFsmTransition: string | null
  stuckWatchdogCount: number
  audioContextState: string | null
  peerConnectionState: string | null
  iceConnectionState: string | null
  playResult: 'pending' | 'resolved' | 'rejected' | null
}

export function emptyVoicePlaybackDiagnostics(): VoicePlaybackDiagnostics {
  return {
    remoteTrackReceived: false,
    remoteTrackMuted: null,
    remoteTrackReadyState: null,
    audioElementAttached: false,
    audioPlayRequested: false,
    audioPlaybackStarted: false,
    audioPlaybackFailed: false,
    audioPlaybackEnded: false,
    speechDetected: false,
    endOfSpeechDetected: false,
    inputCommitted: false,
    finalTranscriptReceived: false,
    assistantResponseCreated: false,
    classicFallbackInvoked: false,
    interruptAcknowledged: false,
    lastEvent: null,
    lastSafeErrorCode: null,
    lastFsmTransition: null,
    stuckWatchdogCount: 0,
    audioContextState: null,
    peerConnectionState: null,
    iceConnectionState: null,
    playResult: null,
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
