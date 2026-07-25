/**
 * Executive Dashboard design tokens — Material 3–inspired premium chrome.
 */

export const EXECUTIVE_TOKENS = {
  layout: {
    contentMax: '76rem',
    cardRadius: '1.15rem',
    gap: '0.85rem',
  },
  motion: {
    enterMs: 220,
    ringMs: 700,
    transition: '180ms ease',
  },
} as const

export function executiveTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-ed-max': EXECUTIVE_TOKENS.layout.contentMax,
    '--rahhal-ed-radius': EXECUTIVE_TOKENS.layout.cardRadius,
    '--rahhal-ed-gap': EXECUTIVE_TOKENS.layout.gap,
    '--rahhal-ed-anim-enter': `${EXECUTIVE_TOKENS.motion.enterMs}ms`,
    '--rahhal-ed-anim-ring': `${EXECUTIVE_TOKENS.motion.ringMs}ms`,
    '--rahhal-ed-transition': EXECUTIVE_TOKENS.motion.transition,
    '--rahhal-ed-bg': dark
      ? 'linear-gradient(160deg, #020617 0%, #0b1220 50%, #042f2e 100%)'
      : 'linear-gradient(160deg, #f8fafc 0%, #eef2ff 42%, #ecfeff 100%)',
    '--rahhal-ed-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-ed-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-ed-panel': dark
      ? 'rgba(15, 23, 42, 0.74)'
      : 'rgba(255, 255, 255, 0.92)',
    '--rahhal-ed-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-ed-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
    '--rahhal-ed-critical': dark ? '#f87171' : '#b91c1c',
  }
}
