/**
 * Journey Timeline design tokens — Material 3–inspired premium motion.
 */

export const JOURNEY_TOKENS = {
  layout: {
    contentMax: '68rem',
    cardRadius: '1.1rem',
  },
  motion: {
    enterMs: 220,
    progressMs: 600,
    transition: '180ms ease',
  },
} as const

export function journeyTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-jt-max': JOURNEY_TOKENS.layout.contentMax,
    '--rahhal-jt-radius': JOURNEY_TOKENS.layout.cardRadius,
    '--rahhal-jt-anim-enter': `${JOURNEY_TOKENS.motion.enterMs}ms`,
    '--rahhal-jt-anim-progress': `${JOURNEY_TOKENS.motion.progressMs}ms`,
    '--rahhal-jt-transition': JOURNEY_TOKENS.motion.transition,
    '--rahhal-jt-bg': dark
      ? 'linear-gradient(165deg, #020617 0%, #0f172a 48%, #042f2e 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #ecfeff 45%, #eef2ff 100%)',
    '--rahhal-jt-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-jt-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-jt-panel': dark
      ? 'rgba(15, 23, 42, 0.74)'
      : 'rgba(255, 255, 255, 0.92)',
    '--rahhal-jt-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-jt-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
    '--rahhal-jt-current': dark ? '#38bdf8' : '#0284c7',
    '--rahhal-jt-delayed': dark ? '#fbbf24' : '#d97706',
    '--rahhal-jt-cancelled': dark ? '#f87171' : '#b91c1c',
  }
}
