/**
 * Command Palette design tokens — Material 3–inspired overlay chrome.
 */

export const PALETTE_TOKENS = {
  layout: {
    maxWidth: '40rem',
    radius: '1.15rem',
  },
  motion: {
    enterMs: 180,
    transition: '160ms ease',
  },
} as const

export function paletteTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-cp-max': PALETTE_TOKENS.layout.maxWidth,
    '--rahhal-cp-radius': PALETTE_TOKENS.layout.radius,
    '--rahhal-cp-anim': `${PALETTE_TOKENS.motion.enterMs}ms`,
    '--rahhal-cp-transition': PALETTE_TOKENS.motion.transition,
    '--rahhal-cp-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-cp-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-cp-panel': dark
      ? 'rgba(15, 23, 42, 0.92)'
      : 'rgba(255, 255, 255, 0.96)',
    '--rahhal-cp-accent': dark ? '#5eead4' : '#0f766e',
    '--rahhal-cp-line': dark
      ? 'rgba(255, 255, 255, 0.12)'
      : 'rgba(15, 23, 42, 0.1)',
    '--rahhal-cp-scrim': dark
      ? 'rgba(2, 6, 23, 0.72)'
      : 'rgba(15, 23, 42, 0.45)',
    '--rahhal-cp-highlight': dark
      ? 'rgba(94, 234, 212, 0.22)'
      : 'rgba(15, 118, 110, 0.14)',
  }
}
