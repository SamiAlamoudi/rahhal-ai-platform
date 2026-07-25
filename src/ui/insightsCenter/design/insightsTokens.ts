/**
 * Insights Center design tokens — Material 3–inspired premium chrome.
 */

export const INSIGHTS_TOKENS = {
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

export function insightsTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-ic-max': INSIGHTS_TOKENS.layout.contentMax,
    '--rahhal-ic-radius': INSIGHTS_TOKENS.layout.cardRadius,
    '--rahhal-ic-anim-enter': `${INSIGHTS_TOKENS.motion.enterMs}ms`,
    '--rahhal-ic-anim-ring': `${INSIGHTS_TOKENS.motion.ringMs}ms`,
    '--rahhal-ic-transition': INSIGHTS_TOKENS.motion.transition,
    '--rahhal-ic-bg': dark
      ? 'linear-gradient(165deg, #020617 0%, #0f172a 48%, #042f2e 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #ecfeff 42%, #eef2ff 100%)',
    '--rahhal-ic-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-ic-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-ic-panel': dark
      ? 'rgba(15, 23, 42, 0.74)'
      : 'rgba(255, 255, 255, 0.92)',
    '--rahhal-ic-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-ic-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
  }
}
