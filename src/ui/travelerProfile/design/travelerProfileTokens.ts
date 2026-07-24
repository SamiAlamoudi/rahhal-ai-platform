/**
 * Traveler Profile Center design tokens — Material 3–inspired premium chrome.
 */

export const TRAVELER_PROFILE_TOKENS = {
  layout: {
    contentMax: '72rem',
    cardRadius: '1.1rem',
  },
  motion: {
    enterMs: 220,
    ringMs: 700,
    transition: '180ms ease',
  },
} as const

export function travelerProfileTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-tp-max': TRAVELER_PROFILE_TOKENS.layout.contentMax,
    '--rahhal-tp-radius': TRAVELER_PROFILE_TOKENS.layout.cardRadius,
    '--rahhal-tp-anim-enter': `${TRAVELER_PROFILE_TOKENS.motion.enterMs}ms`,
    '--rahhal-tp-anim-ring': `${TRAVELER_PROFILE_TOKENS.motion.ringMs}ms`,
    '--rahhal-tp-transition': TRAVELER_PROFILE_TOKENS.motion.transition,
    '--rahhal-tp-bg': dark
      ? 'linear-gradient(165deg, #020617 0%, #0f172a 48%, #042f2e 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #ecfeff 42%, #eef2ff 100%)',
    '--rahhal-tp-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-tp-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-tp-panel': dark
      ? 'rgba(15, 23, 42, 0.74)'
      : 'rgba(255, 255, 255, 0.92)',
    '--rahhal-tp-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-tp-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
  }
}
