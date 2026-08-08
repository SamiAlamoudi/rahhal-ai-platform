/**
 * QUARANTINED — superseded by BilamoConversationExperience + shared VoiceSession.
 *
 * Product Home (`/`) and Conversation (`/chat`) use useBilamoVoiceSession only.
 * This stub remains so accidental imports fail closed without spawning a second
 * mic / WebRTC / TTS stack. Classic fallback lives in classicTransport via
 * BilamoVoiceTransport — not here.
 */

export interface HomeVoiceConsultantProps {
  /** @deprecated Unused — component is quarantined. */
  className?: string
  onTripCommitted?: (payload: unknown) => void
  autoStart?: boolean
}

/**
 * @deprecated Use BilamoConversationExperience / useBilamoVoiceSession.
 * Renders nothing and never opens microphone or realtime sessions.
 */
export function HomeVoiceConsultant(_props: HomeVoiceConsultantProps = {}) {
  // Quarantined: never mount. Product voice = BilamoConversationExperience only.
  if (import.meta.env.DEV) {
    console.warn(
      '[bilamo] HomeVoiceConsultant is quarantined. Use BilamoConversationExperience.',
    )
  }
  return null
}
