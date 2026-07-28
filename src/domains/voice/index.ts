/** Domain shim — production voice (STT → chatEngine → TTS). */

export { createVoiceSession, stripMarkdownForSpeech } from '../../lib/chat/voice/voiceSession'
export { createSpeechToTextProvider, createTextToSpeechProvider } from '../../lib/chat/voice/voiceProviderFactory'
export { subscribeMicrophonePermission } from '../../lib/chat/voice/microphonePermission'
export {
  loadVoiceExperiencePrefs,
  saveVoiceExperiencePrefs,
  DEFAULT_VOICE_PREFS,
  ARABIC_DIALECT_OPTIONS,
  OPENAI_TTS_VOICES,
} from '../../lib/chat/voice/voiceExperiencePrefs'
export type {
  VoiceInputMode,
  VoiceLocale,
  VoiceSessionStatus,
  SpeechToTextProvider,
  TextToSpeechProvider,
} from '../../lib/chat/voice/voiceTypes'
export type {
  VoiceExperiencePrefs,
  ArabicDialectPreference,
  OpenAiTtsVoiceId,
} from '../../lib/chat/voice/voiceExperiencePrefs'
