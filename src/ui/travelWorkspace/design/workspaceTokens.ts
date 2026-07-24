/**
 * Travel Workspace design tokens — premium executive presentation.
 */

export const WORKSPACE_TOKENS = {
  layout: {
    sidebarGap: '1rem',
    cardRadius: '1.1rem',
    contentMax: '72rem',
  },
  motion: {
    cardEnterMs: 240,
    progressMs: 500,
    transition: '200ms ease',
  },
  theme: {
    lightBg: 'linear-gradient(165deg, #f8fafc 0%, #eef2ff 45%, #ecfeff 100%)',
    darkBg: 'linear-gradient(165deg, #020617 0%, #0f172a 48%, #042f2e 100%)',
  },
} as const

export function workspaceTokenCssVariables(
  theme: 'light' | 'dark' = 'light',
): Record<string, string> {
  const dark = theme === 'dark'
  return {
    '--rahhal-tw-content-max': WORKSPACE_TOKENS.layout.contentMax,
    '--rahhal-tw-card-radius': WORKSPACE_TOKENS.layout.cardRadius,
    '--rahhal-tw-anim-card': `${WORKSPACE_TOKENS.motion.cardEnterMs}ms`,
    '--rahhal-tw-anim-progress': `${WORKSPACE_TOKENS.motion.progressMs}ms`,
    '--rahhal-tw-transition': WORKSPACE_TOKENS.motion.transition,
    '--rahhal-tw-bg': dark
      ? WORKSPACE_TOKENS.theme.darkBg
      : WORKSPACE_TOKENS.theme.lightBg,
    '--rahhal-tw-ink': dark ? '#e2e8f0' : '#0f172a',
    '--rahhal-tw-muted': dark ? '#94a3b8' : '#64748b',
    '--rahhal-tw-panel': dark
      ? 'rgba(15, 23, 42, 0.72)'
      : 'rgba(255, 255, 255, 0.9)',
    '--rahhal-tw-accent': dark ? '#2dd4bf' : '#0f766e',
    '--rahhal-tw-line': dark
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(15, 23, 42, 0.08)',
  }
}
