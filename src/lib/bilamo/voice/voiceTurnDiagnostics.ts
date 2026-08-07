/**
 * Re-exports turn diagnostic helpers (single source: voicePlaybackDiagnostics).
 */
export {
  emptyVoicePlaybackDiagnostics as emptyVoiceTurnDiagnostics,
  newVoiceCorrelationId,
  safeHttpErrorCode,
  speechRecognitionSupported,
  type VoicePlaybackDiagnostics as VoiceTurnDiagnostics,
  type VoiceTurnStage,
} from './voicePlaybackDiagnostics'
