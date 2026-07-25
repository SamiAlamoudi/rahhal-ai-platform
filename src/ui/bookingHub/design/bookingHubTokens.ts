/**
 * Booking Hub design tokens — Material 3–inspired premium chrome.
 */

export const BOOKING_HUB_TOKENS = {
  layout: {
    contentMax: '72rem',
    cardRadius: '1.1rem',
  },
  motion: {
    enterMs: 220,
    barMs: 600,
    transition: '180ms ease',
  },
} as const

export function bookingHubTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-bh-max': BOOKING_HUB_TOKENS.layout.contentMax,
    '--rahhal-bh-radius': BOOKING_HUB_TOKENS.layout.cardRadius,
    '--rahhal-bh-anim-enter': `${BOOKING_HUB_TOKENS.motion.enterMs}ms`,
    '--rahhal-bh-anim-bar': `${BOOKING_HUB_TOKENS.motion.barMs}ms`,
    '--rahhal-bh-transition': BOOKING_HUB_TOKENS.motion.transition,
    '--rahhal-bh-bg': dark
      ? 'linear-gradient(165deg, #020617 0%, #0f172a 48%, #042f2e 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #ecfeff 42%, #eef2ff 100%)',
    '--rahhal-bh-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-bh-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-bh-panel': dark
      ? 'rgba(15, 23, 42, 0.74)'
      : 'rgba(255, 255, 255, 0.92)',
    '--rahhal-bh-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-bh-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
  }
}
