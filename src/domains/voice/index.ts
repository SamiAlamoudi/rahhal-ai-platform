/** Domain shim — production voice (STT → chatEngine → TTS). */

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
