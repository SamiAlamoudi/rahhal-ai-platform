import { isVoiceCenterEnabled } from '../voiceCenterRegistry'
import type {
  VoiceCenterLocale,
  VoiceCenterUiState,
  VoiceHistoryBucket,
  VoiceSessionState,
  VoiceSessionSummary,
  VoiceTranscriptEntry,
} from '../types'
import { VOICE_CENTER_ISOLATION } from '../types'

export function createDefaultPersonality(
  locale: VoiceCenterLocale = 'ar',
): VoiceCenterUiState['personality'] {
  return {
    voiceId: null,
    language: locale,
    accent: null,
    speechSpeed: 1,
    style: 'natural',
  }
}

export function createDefaultVoiceSettings(): VoiceCenterUiState['settings'] {
  return {
    noiseSuppression: false,
    echoCancellation: false,
    autoPunctuation: false,
    autoLanguageDetection: false,
  }
}

export function createInitialVoiceCenterState(options?: {
  locale?: VoiceCenterLocale
  enabled?: boolean
  sessions?: VoiceSessionSummary[]
  transcript?: VoiceTranscriptEntry[]
  activeSessionId?: string | null
  sessionState?: VoiceSessionState
}): VoiceCenterUiState {
  const locale = options?.locale ?? 'ar'
  return {
    locale,
    sessionState: options?.sessionState ?? 'idle',
    speakerOn: true,
    headphonesOn: false,
    muted: false,
    showSettings: false,
    searchQuery: '',
    historyBucket: 'recent',
    sessions: options?.sessions ?? [],
    activeSessionId: options?.activeSessionId ?? options?.sessions?.[0]?.id ?? null,
    transcript: options?.transcript ?? [],
    currentTravelerText: '',
    currentAssistantText: '',
    personality: createDefaultPersonality(locale),
    settings: createDefaultVoiceSettings(),
    featureEnabled: isVoiceCenterEnabled({ enabled: options?.enabled }),
  }
}

export function filterSessionsByBucket(
  sessions: VoiceSessionSummary[],
  bucket: VoiceHistoryBucket,
): VoiceSessionSummary[] {
  switch (bucket) {
    case 'favorites':
      return sessions.filter((s) => s.favorite && !s.archived)
    case 'archived':
      return sessions.filter((s) => s.archived)
    case 'recent':
    default:
      return sessions.filter((s) => !s.archived)
  }
}

export function searchSessions(
  sessions: VoiceSessionSummary[],
  query: string,
): VoiceSessionSummary[] {
  const q = query.trim().toLowerCase()
  if (!q) return sessions
  return sessions.filter(
    (s) =>
      s.title.toLowerCase().includes(q) || s.preview.toLowerCase().includes(q),
  )
}

export function createDemoTranscriptEntry(
  partial: Partial<VoiceTranscriptEntry> &
    Pick<VoiceTranscriptEntry, 'id' | 'role' | 'text'>,
): VoiceTranscriptEntry {
  return {
    createdAt: partial.createdAt ?? new Date().toISOString(),
    confidence: partial.confidence ?? null,
    expanded: partial.expanded ?? false,
    ...partial,
  }
}

/** UI-only state transitions — no speech engine. */
export function applyVoiceControl(
  state: VoiceCenterUiState,
  control: import('../types').VoiceControlId,
): VoiceCenterUiState {
  switch (control) {
    case 'start':
      return { ...state, sessionState: state.muted ? 'muted' : 'listening', muted: state.muted }
    case 'pause':
      return { ...state, sessionState: 'paused' }
    case 'resume':
      return {
        ...state,
        sessionState: state.muted ? 'muted' : 'listening',
      }
    case 'stop':
      return {
        ...state,
        sessionState: 'idle',
        currentTravelerText: '',
        currentAssistantText: '',
      }
    case 'mute':
      return {
        ...state,
        muted: !state.muted,
        sessionState: !state.muted ? 'muted' : 'listening',
      }
    case 'speaker':
      return { ...state, speakerOn: !state.speakerOn, headphonesOn: false }
    case 'headphones':
      return { ...state, headphonesOn: !state.headphonesOn, speakerOn: false }
    case 'voice_settings':
      return { ...state, showSettings: !state.showSettings }
    case 'replay':
      return { ...state, sessionState: 'speaking' }
    case 'clear_session':
      return {
        ...state,
        transcript: [],
        currentTravelerText: '',
        currentAssistantText: '',
        sessionState: 'idle',
      }
    default:
      return state
  }
}

export function assertVoiceCenterIsolation(): typeof VOICE_CENTER_ISOLATION & {
  ownDestination: boolean
  notInsideChat: boolean
} {
  return {
    ...VOICE_CENTER_ISOLATION,
    ownDestination: !VOICE_CENTER_ISOLATION.embeddedInChat,
    notInsideChat: !VOICE_CENTER_ISOLATION.embeddedInChat,
  }
}
