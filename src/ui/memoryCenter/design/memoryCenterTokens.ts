/**
 * Memory & Knowledge Center design tokens — Material 3–inspired premium chrome.
 */

export const MEMORY_CENTER_TOKENS = {
  layout: {
    contentMax: '72rem',
    cardRadius: '1.1rem',
  },
  motion: {
    enterMs: 220,
    meterMs: 650,
    transition: '180ms ease',
  },
} as const

export function memoryCenterTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-mc-max': MEMORY_CENTER_TOKENS.layout.contentMax,
    '--rahhal-mc-radius': MEMORY_CENTER_TOKENS.layout.cardRadius,
    '--rahhal-mc-anim-enter': `${MEMORY_CENTER_TOKENS.motion.enterMs}ms`,
    '--rahhal-mc-anim-meter': `${MEMORY_CENTER_TOKENS.motion.meterMs}ms`,
    '--rahhal-mc-transition': MEMORY_CENTER_TOKENS.motion.transition,
    '--rahhal-mc-bg': dark
      ? 'linear-gradient(165deg, #020617 0%, #0f172a 48%, #042f2e 100%)'
      : 'linear-gradient(165deg, #f8fafc 0%, #ecfeff 42%, #eef2ff 100%)',
    '--rahhal-mc-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-mc-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-mc-panel': dark
      ? 'rgba(15, 23, 42, 0.74)'
      : 'rgba(255, 255, 255, 0.92)',
    '--rahhal-mc-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-mc-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
  }
}
