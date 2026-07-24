/**
 * Phase 4 Stage 3 — Premium Voice Conversation Center contracts.
 * UI architecture only. No STT/TTS, AI, networking, or speech engines.
 */

export type VoiceCenterLocale = 'ar' | 'en'

export type VoiceSessionState =
  | 'idle'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'paused'
  | 'disconnected'
  | 'offline'
  | 'permission_required'
  | 'noise_detected'
  | 'muted'

export type VoiceControlId =
  | 'start'
  | 'pause'
  | 'resume'
  | 'stop'
  | 'mute'
  | 'speaker'
  | 'headphones'
  | 'voice_settings'
  | 'replay'
  | 'clear_session'

export type VoiceStyle = 'natural' | 'professional' | 'executive'

export type VoiceShortcutId =
  | 'plan_trip'
  | 'ask_visa'
  | 'recommend_destination'
  | 'executive_travel'
  | 'budget_planning'
  | 'nearby_attractions'

export type VoiceHistoryBucket = 'recent' | 'favorites' | 'archived'

export type VoiceTranscriptRole = 'traveler' | 'assistant'

export interface VoiceTranscriptEntry {
  id: string
  role: VoiceTranscriptRole
  text: string
  createdAt: string
  confidence: number | null
  expanded: boolean
}

export interface VoiceSessionSummary {
  id: string
  title: string
  bucket: VoiceHistoryBucket
  favorite: boolean
  archived: boolean
  updatedAt: string
  preview: string
}

export interface VoicePersonalityModel {
  voiceId: string | null
  language: VoiceCenterLocale
  accent: string | null
  speechSpeed: number
  style: VoiceStyle
}

export interface VoiceSettingsPlaceholders {
  noiseSuppression: boolean
  echoCancellation: boolean
  autoPunctuation: boolean
  autoLanguageDetection: boolean
}

export interface VoiceAnimationKind {
  idle: true
  listening: true
  thinking: true
  speaking: true
  wave: true
}

export interface VoiceCenterUiState {
  locale: VoiceCenterLocale
  sessionState: VoiceSessionState
  speakerOn: boolean
  headphonesOn: boolean
  muted: boolean
  showSettings: boolean
  searchQuery: string
  historyBucket: VoiceHistoryBucket
  sessions: VoiceSessionSummary[]
  activeSessionId: string | null
  transcript: VoiceTranscriptEntry[]
  currentTravelerText: string
  currentAssistantText: string
  personality: VoicePersonalityModel
  settings: VoiceSettingsPlaceholders
  featureEnabled: boolean
}

export const VOICE_SESSION_STATES: readonly VoiceSessionState[] = [
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
] as const

export const VOICE_CONTROLS: readonly VoiceControlId[] = [
  'start',
  'pause',
  'resume',
  'stop',
  'mute',
  'speaker',
  'headphones',
  'voice_settings',
  'replay',
  'clear_session',
] as const

export const VOICE_SHORTCUTS: readonly VoiceShortcutId[] = [
  'plan_trip',
  'ask_visa',
  'recommend_destination',
  'executive_travel',
  'budget_planning',
  'nearby_attractions',
] as const

export const VOICE_STYLES: readonly VoiceStyle[] = [
  'natural',
  'professional',
  'executive',
] as const

export const VOICE_HISTORY_BUCKETS: readonly VoiceHistoryBucket[] = [
  'recent',
  'favorites',
  'archived',
] as const

/** Isolation: Voice Center is a separate destination — never embedded in Chat. */
export const VOICE_CENTER_ISOLATION = {
  embeddedInChat: false,
  speechRecognition: false,
  speechSynthesis: false,
  whisper: false,
  elevenLabs: false,
  openaiVoice: false,
  azureSpeech: false,
  googleSpeech: false,
  realtimeApi: false,
  streaming: false,
  backend: false,
  aiCalls: false,
  ttsConnected: false,
  sttConnected: false,
  runtimeCoordinator: false,
  conversationOrchestrator: false,
} as const
