/**
 * Conversation Center design tokens — local to Chat UI architecture.
 * Complements Application Shell tokens; does not replace production CSS.
 */

export const CONVERSATION_TOKENS = {
  layout: {
    sidebarWidth: '17.5rem',
    sidebarCollapsedWidth: '4.5rem',
    composerMaxWidth: '48rem',
    threadMaxWidth: '48rem',
    messageGap: '0.75rem',
    bubbleRadius: '1rem',
  },
  animation: {
    messageAppearMs: 220,
    typingPulseMs: 900,
    cardExpandMs: 280,
    scrollSmooth: 'smooth' as const,
    transition: '180ms ease',
  },
  role: {
    traveler: 'var(--rahhal-shell-color-primary, #0f766e)',
    assistant: 'var(--rahhal-shell-color-surface, #f8fafc)',
    system: 'var(--rahhal-shell-color-muted, #64748b)',
    error: 'var(--rahhal-shell-color-danger, #b91c1c)',
    warning: 'var(--rahhal-shell-color-warning, #b45309)',
    success: 'var(--rahhal-shell-color-success, #15803d)',
  },
} as const

export function conversationTokenCssVariables(): Record<string, string> {
  return {
    '--rahhal-cc-sidebar-width': CONVERSATION_TOKENS.layout.sidebarWidth,
    '--rahhal-cc-composer-max': CONVERSATION_TOKENS.layout.composerMaxWidth,
    '--rahhal-cc-thread-max': CONVERSATION_TOKENS.layout.threadMaxWidth,
    '--rahhal-cc-message-gap': CONVERSATION_TOKENS.layout.messageGap,
    '--rahhal-cc-bubble-radius': CONVERSATION_TOKENS.layout.bubbleRadius,
    '--rahhal-cc-anim-appear': `${CONVERSATION_TOKENS.animation.messageAppearMs}ms`,
    '--rahhal-cc-anim-typing': `${CONVERSATION_TOKENS.animation.typingPulseMs}ms`,
    '--rahhal-cc-anim-expand': `${CONVERSATION_TOKENS.animation.cardExpandMs}ms`,
    '--rahhal-cc-transition': CONVERSATION_TOKENS.animation.transition,
  }
}
