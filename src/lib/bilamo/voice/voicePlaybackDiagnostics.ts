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
  | 'emptyFinalizeIdle'
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
  | 'VOICE_REQUEST_CREATED'
  | 'VOICE_REQUEST_SENT'
  | 'VOICE_REQUEST_AUTHENTICATED'
  | 'VOICE_REQUEST_ACCEPTED'
  | 'REALTIME_CAPABILITY_OK'
  | 'REALTIME_CAPABILITY_FAILED'
  | 'GESTURE_RECEIVED'
  | 'SESSION_HTTP_OK'
  | 'MIC_PERMISSION_REQUESTED'
  | 'MIC_PERMISSION_GRANTED'
  | 'MIC_PERMISSION_FAILED'
  | 'MEDIASTREAM_ACTIVE'
  | 'PEER_CREATED'
  | 'LOCAL_TRACK_ADDED'
  | 'OFFER_CREATED'
  | 'REMOTE_DESCRIPTION_SET'
  | 'ICE_STATE_CHECKING'
  | 'ICE_STATE_CONNECTED'
  | 'ICE_STATE_FAILED'
  | 'ICE_STATE_DISCONNECTED'
  | 'CONNECTION_STATE_CONNECTING'
  | 'CONNECTION_STATE_CONNECTED'
  | 'CONNECTION_STATE_FAILED'
  | 'REMOTE_TRACK_RECEIVED'
  | 'AUDIO_ELEMENT_ATTACHED'
  | 'REALTIME_AUDIO_REQUESTED'
  | 'PLAY_CALLED'
  | 'ACTUAL_PLAYBACK_STARTED'
  | 'REALTIME_AUDIO_FAILED'
  | 'CLASSIC_TTS_REQUESTED'
  | 'CLASSIC_TTS_HTTP_OK'
  | 'CLASSIC_TTS_PLAYBACK_STARTED'
  | 'MODEL_RESPONSE_STARTED'
  | 'MODEL_RESPONSE_COMPLETED'
  | 'CLASSIC_FALLBACK_STARTED'
  | 'CLASSIC_FALLBACK_OK'
  | 'CLASSIC_FALLBACK_FAILED'
  | 'TURN_IDLE'
  | 'AUTH_PROBE'
  | 'AUTO_RELISTEN_TRIGGERED'
  | 'VOICE_SESSION_STARTED'
  | 'VOICE_SESSION_STOPPED'
  | 'VOICE_SESSION_RECOVERED'
  | 'VOICE_OUTPUT_FAILED'
  | 'PLAYBACK_ENDED'
  | 'LIFECYCLE_STALL'

export type VoiceTurnStage =
  | 'idle'
  | 'listening'
  | 'finalizing'
  | 'requesting'
  | 'response_ready'
  | 'playback_starting'
  | 'playing'
  | 'error'
  | 'done'

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
  /** Per-turn correlation (short, non-secret). */
  correlationId: string | null
  turnStage: VoiceTurnStage
  timestampMs: number | null
  authenticatedUser: boolean | null
  supabaseSessionAvailable: boolean | null
  mediaStreamActive: boolean | null
  speechRecognitionSupported: boolean | null
  requestDispatched: boolean
  httpRoute: string | null
  httpStatus: number | null
  safeServerErrorCode: string | null
  realtimeSessionCreated: boolean | null
  classicFallbackHttpStatus: number | null
  discardReason: string | null
  authProbeCode: string | null
  /** Detected reply language (ar|en|fr) — no transcript. */
  language: string | null
  /** Arabic dialect id when language=ar. */
  dialect: string | null
  /** 0–1 soft ASR/understanding confidence. */
  transcriptConfidence: number | null
  /** Safe intent code e.g. dest:Bali — never raw utterance. */
  normalizedIntent: string | null
  firstPartialLatencyMs: number | null
  finalTranscriptLatencyMs: number | null
  submitLatencyMs: number | null
  audible: boolean
  /** Hands-free session still active across turns. */
  voiceSessionActive: boolean
  /** User explicitly stopped the persistent session. */
  manuallyStopped: boolean
  /** Last auto-relisten after playback / idle recovery was armed. */
  autoRelistenTriggered: boolean
  /** Turn id / generation that was committed (no transcript). */
  turnId: number | null
  /** Last-turn ASR (staging diagnostics only — gated by /voice-diagnostics). */
  rawAsr: string | null
  normalizedAsr: string | null
  assistantNameMatch: boolean | null
  classicFallbackBytes: number | null
  classicFallbackMime: string | null
  realtimeAudioRequested: boolean
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
    correlationId: null,
    turnStage: 'idle',
    timestampMs: null,
    authenticatedUser: null,
    supabaseSessionAvailable: null,
    mediaStreamActive: null,
    speechRecognitionSupported: null,
    requestDispatched: false,
    httpRoute: null,
    httpStatus: null,
    safeServerErrorCode: null,
    realtimeSessionCreated: null,
    classicFallbackHttpStatus: null,
    discardReason: null,
    authProbeCode: null,
    language: null,
    dialect: null,
    transcriptConfidence: null,
    normalizedIntent: null,
    firstPartialLatencyMs: null,
    finalTranscriptLatencyMs: null,
    submitLatencyMs: null,
    audible: false,
    voiceSessionActive: false,
    manuallyStopped: false,
    autoRelistenTriggered: false,
    turnId: null,
    rawAsr: null,
    normalizedAsr: null,
    assistantNameMatch: null,
    classicFallbackBytes: null,
    classicFallbackMime: null,
    realtimeAudioRequested: false,
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

export function newVoiceCorrelationId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID().slice(0, 8)
    }
  } catch {
    /* fall through */
  }
  return `v${Date.now().toString(36).slice(-6)}`
}

export function safeHttpErrorCode(status: number, bodyCode?: string | null): string {
  if (bodyCode && /^[A-Z0-9_]{3,48}$/.test(bodyCode)) return bodyCode
  if (status === 401) return 'HTTP_401'
  if (status === 403) return 'HTTP_403'
  if (status === 429) return 'HTTP_429'
  if (status === 502) return 'HTTP_502'
  if (status === 503) return 'HTTP_503'
  if (status >= 500) return 'HTTP_5XX'
  if (status >= 400) return 'HTTP_4XX'
  return `HTTP_${status}`
}

export function speechRecognitionSupported(): boolean | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: unknown
    webkitSpeechRecognition?: unknown
  }
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition)
}
