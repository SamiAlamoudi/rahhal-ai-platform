/**
 * Decision Center design tokens — Material 3–inspired premium chrome.
 */

export const DECISION_TOKENS = {
  layout: {
    contentMax: '70rem',
    cardRadius: '1.1rem',
  },
  motion: {
    enterMs: 220,
    meterMs: 700,
    transition: '180ms ease',
  },
} as const

export function decisionTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-dc-max': DECISION_TOKENS.layout.contentMax,
    '--rahhal-dc-radius': DECISION_TOKENS.layout.cardRadius,
    '--rahhal-dc-anim-enter': `${DECISION_TOKENS.motion.enterMs}ms`,
    '--rahhal-dc-anim-meter': `${DECISION_TOKENS.motion.meterMs}ms`,
    '--rahhal-dc-transition': DECISION_TOKENS.motion.transition,
    '--rahhal-dc-bg': dark
      ? 'linear-gradient(165deg, #020617 0%, #0b1220 48%, #042f2e 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #ecfeff 42%, #eef2ff 100%)',
    '--rahhal-dc-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-dc-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-dc-panel': dark
      ? 'rgba(15, 23, 42, 0.74)'
      : 'rgba(255, 255, 255, 0.92)',
    '--rahhal-dc-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-dc-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
    '--rahhal-dc-risk': dark ? '#fbbf24' : '#d97706',
  }
}
