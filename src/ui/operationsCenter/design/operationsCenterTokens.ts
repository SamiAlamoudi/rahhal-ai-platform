/**
 * Operations Center design tokens — Material 3–inspired premium chrome.
 */

export const OPERATIONS_CENTER_TOKENS = {
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

export function operationsCenterTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-oc-max': OPERATIONS_CENTER_TOKENS.layout.contentMax,
    '--rahhal-oc-radius': OPERATIONS_CENTER_TOKENS.layout.cardRadius,
    '--rahhal-oc-anim-enter': `${OPERATIONS_CENTER_TOKENS.motion.enterMs}ms`,
    '--rahhal-oc-anim-bar': `${OPERATIONS_CENTER_TOKENS.motion.barMs}ms`,
    '--rahhal-oc-transition': OPERATIONS_CENTER_TOKENS.motion.transition,
    '--rahhal-oc-bg': dark
      ? 'linear-gradient(165deg, #020617 0%, #0f172a 48%, #042f2e 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #ecfeff 42%, #eef2ff 100%)',
    '--rahhal-oc-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-oc-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-oc-panel': dark
      ? 'rgba(15, 23, 42, 0.74)'
      : 'rgba(255, 255, 255, 0.92)',
    '--rahhal-oc-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-oc-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
    '--rahhal-oc-danger': dark ? '#fca5a5' : '#b91c1c',
  }
}
