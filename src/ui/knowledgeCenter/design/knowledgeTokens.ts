/**
 * Knowledge Center design tokens — UI architecture only.
 */

export const KNOWLEDGE_TOKENS = {
  layout: {
    sidebarWidth: '17rem',
    readerMax: '56rem',
    cardGap: '0.75rem',
  },
  animation: {
    panelEnterMs: 220,
    readerZoomMs: 160,
    transition: '180ms ease',
  },
} as const

export function knowledgeTokenCssVariables(): Record<string, string> {
  return {
    '--rahhal-kc-sidebar-width': KNOWLEDGE_TOKENS.layout.sidebarWidth,
    '--rahhal-kc-reader-max': KNOWLEDGE_TOKENS.layout.readerMax,
    '--rahhal-kc-card-gap': KNOWLEDGE_TOKENS.layout.cardGap,
    '--rahhal-kc-anim-panel': `${KNOWLEDGE_TOKENS.animation.panelEnterMs}ms`,
    '--rahhal-kc-anim-zoom': `${KNOWLEDGE_TOKENS.animation.readerZoomMs}ms`,
    '--rahhal-kc-transition': KNOWLEDGE_TOKENS.animation.transition,
  }
}
