/** Domain shim — voice. */
export * from '../../lib/voiceConversation'

// src/lib/chat/voice has no index.ts — selective concrete exports
export { createVoiceSession, stripMarkdownForSpeech } from '../../lib/chat/voice/voiceSession'
export { createSpeechToTextProvider, createTextToSpeechProvider } from '../../lib/chat/voice/voiceProviderFactory'
export { subscribeMicrophonePermission } from '../../lib/chat/voice/microphonePermission'
export type {
  VoiceInputMode,
  VoiceLocale,
  VoiceSessionStatus,
  SpeechToTextProvider,
  TextToSpeechProvider,
} from '../../lib/chat/voice/voiceTypes'
