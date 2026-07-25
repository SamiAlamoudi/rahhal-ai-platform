/**
 * Voice Center design / animation tokens — UI placeholders only.
 */

export const VOICE_TOKENS = {
  layout: {
    micSize: '9.5rem',
    waveHeight: '4.5rem',
    sidebarWidth: '18rem',
    contentMax: '52rem',
  },
  animation: {
    idleBreathMs: 2400,
    listeningPulseMs: 1100,
    thinkingOrbitMs: 1600,
    speakingWaveMs: 900,
    transition: '200ms ease',
  },
  stateColor: {
    idle: '#94a3b8',
    listening: '#14b8a6',
    processing: '#38bdf8',
    speaking: '#22d3ee',
    paused: '#fbbf24',
    muted: '#f87171',
    offline: '#64748b',
    permission_required: '#fb923c',
    noise_detected: '#f59e0b',
    disconnected: '#94a3b8',
  },
} as const

export function voiceTokenCssVariables(): Record<string, string> {
  return {
    '--rahhal-vc-mic-size': VOICE_TOKENS.layout.micSize,
    '--rahhal-vc-wave-height': VOICE_TOKENS.layout.waveHeight,
    '--rahhal-vc-sidebar-width': VOICE_TOKENS.layout.sidebarWidth,
    '--rahhal-vc-content-max': VOICE_TOKENS.layout.contentMax,
    '--rahhal-vc-anim-idle': `${VOICE_TOKENS.animation.idleBreathMs}ms`,
    '--rahhal-vc-anim-listen': `${VOICE_TOKENS.animation.listeningPulseMs}ms`,
    '--rahhal-vc-anim-think': `${VOICE_TOKENS.animation.thinkingOrbitMs}ms`,
    '--rahhal-vc-anim-speak': `${VOICE_TOKENS.animation.speakingWaveMs}ms`,
    '--rahhal-vc-transition': VOICE_TOKENS.animation.transition,
  }
}
