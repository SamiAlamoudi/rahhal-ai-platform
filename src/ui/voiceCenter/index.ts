/**
 * Phase 4 Stage 3 — Premium Voice Conversation Center barrel.
 *
 * Isolated UI architecture package. Own destination — not inside Chat.
 * Not wired into production main.tsx, Runtime Coordinator, Conversation
 * Orchestrator, TTS, or STT. Gated by `ui.voice_center` (default OFF).
 */

export {
  VOICE_CENTER_FEATURE_ID,
  isVoiceCenterEnabled,
  VoiceCenterRegistry,
} from './voiceCenterRegistry'

export type {
  VoiceCenterLocale,
  VoiceSessionState,
  VoiceControlId,
  VoiceStyle,
  VoiceShortcutId,
  VoiceHistoryBucket,
  VoiceTranscriptRole,
  VoiceTranscriptEntry,
  VoiceSessionSummary,
  VoicePersonalityModel,
  VoiceSettingsPlaceholders,
  VoiceCenterUiState,
} from './types'

export {
  VOICE_SESSION_STATES,
  VOICE_CONTROLS,
  VOICE_SHORTCUTS,
  VOICE_STYLES,
  VOICE_HISTORY_BUCKETS,
  VOICE_CENTER_ISOLATION,
} from './types'

export { VOICE_TOKENS, voiceTokenCssVariables } from './design/voiceTokens'

export {
  createDefaultPersonality,
  createDefaultVoiceSettings,
  createInitialVoiceCenterState,
  filterSessionsByBucket,
  searchSessions,
  createDemoTranscriptEntry,
  applyVoiceControl,
  assertVoiceCenterIsolation,
} from './state/voiceCenterState'

export * from './components'

/** Architecture inventory for docs / tests. */
export const VOICE_CENTER_ARCHITECTURE = {
  version: '4.3.0-voice-center',
  featureId: 'ui.voice_center' as const,
  wiredIntoProductionRoutes: false,
  wiredIntoRuntimeCoordinator: false,
  wiredIntoConversationOrchestrator: false,
  wiredIntoTts: false,
  wiredIntoStt: false,
  embeddedInChat: false,
  ownDestination: true,
  speechEngines: false,
  aiCalls: false,
  networking: false,
  regions: ['session_history', 'microphone_stage', 'controls', 'transcript', 'personality'] as const,
  sessionStates: [
    'idle',
    'listening',
    'processing',
    'speaking',
    'paused',
    'disconnected',
    'offline',
    'permission_required',
    'noise_detected',
    'muted',
  ] as const,
  animations: ['idle', 'listening', 'thinking', 'speaking', 'wave'] as const,
} as const
