/**
 * Sprint 119 — Conversation UI architecture (presentation only).
 */

import type { CSSProperties, FormEvent, ReactNode } from 'react'
import { UiButton, UiStack, UiSurface } from '../common'
import {
  animation,
  componentSize,
  iconSize,
  radius,
  spacing,
  typography,
} from '../tokens'

export type ConversationRole = 'user' | 'assistant' | 'system' | 'thinking' | 'streaming' | 'suggestion'

export interface MessageBubbleProps {
  children?: ReactNode
  role?: ConversationRole
  className?: string
  style?: CSSProperties
}

export function MessageBubble({
  children,
  role = 'assistant',
  className,
  style,
}: MessageBubbleProps) {
  return (
    <div
      className={className}
      data-ui-bubble={role}
      style={{
        maxWidth: componentSize.bubbleMaxWidth.md,
        borderRadius: radius.lg,
        padding: spacing.md,
        fontFamily: typography.family.body,
        fontSize: typography.size.md,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function AssistantBubble(props: Omit<MessageBubbleProps, 'role'>) {
  return <MessageBubble role="assistant" {...props} />
}

export function UserBubble(props: Omit<MessageBubbleProps, 'role'>) {
  return <MessageBubble role="user" {...props} />
}

export function ThinkingBubble(props: Omit<MessageBubbleProps, 'role'>) {
  return <MessageBubble role="thinking" {...props} />
}

export function StreamingBubble(props: Omit<MessageBubbleProps, 'role'>) {
  return <MessageBubble role="streaming" {...props} />
}

export function SuggestionBubble(props: Omit<MessageBubbleProps, 'role'>) {
  return <MessageBubble role="suggestion" {...props} />
}

export interface TypingIndicatorProps {
  label?: string
  className?: string
}

export function TypingIndicator({
  label = 'Typing',
  className,
}: TypingIndicatorProps) {
  return (
    <div
      className={className}
      data-ui="typing-indicator"
      aria-live="polite"
      style={{
        display: 'inline-flex',
        gap: spacing.xs,
        alignItems: 'center',
        fontFamily: typography.family.body,
        fontSize: typography.size.sm,
        animationDuration: `${animation.duration.slow}ms`,
      }}
    >
      <span aria-hidden>•</span>
      <span aria-hidden>•</span>
      <span aria-hidden>•</span>
      <span className="sr-only">{label}</span>
    </div>
  )
}

export interface ConversationInputProps {
  value?: string
  placeholder?: string
  disabled?: boolean
  onChange?: (value: string) => void
  onSubmit?: (value: string) => void
  className?: string
}

export function ConversationInput({
  value,
  placeholder,
  disabled,
  onChange,
  onSubmit,
  className,
}: ConversationInputProps) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (value != null) onSubmit?.(value)
  }

  return (
    <form
      className={className}
      data-ui="conversation-input"
      onSubmit={handleSubmit}
      style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}
    >
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
        aria-label="Message"
        style={{
          flex: 1,
          height: componentSize.controlHeight.md,
          borderRadius: radius.md,
          paddingInline: spacing.md,
          fontFamily: typography.family.body,
          fontSize: typography.size.md,
        }}
      />
      <UiButton type="submit" disabled={disabled} aria-label="Send">
        Send
      </UiButton>
    </form>
  )
}

/** Voice control placeholder — no media / API wiring in Phase 1. */
export function VoiceButton({
  disabled,
  className,
}: {
  disabled?: boolean
  className?: string
}) {
  return (
    <UiButton
      className={className}
      disabled={disabled}
      aria-label="Voice input (placeholder)"
      style={{ width: componentSize.controlHeight.md, paddingInline: spacing.sm }}
    >
      <span style={{ fontSize: iconSize.md }} aria-hidden>
        ◯
      </span>
    </UiButton>
  )
}

/**
 * Attachment control — hidden by default (Recovery Phase 2.2).
 * Only render when Conversation Brain explicitly requests a document/image.
 */
export function AttachmentButton({
  disabled,
  className,
  visible = false,
  label = 'إرفاق',
  onClick,
}: {
  disabled?: boolean
  className?: string
  /** Permanent attach chrome is removed; must be opted in per request. */
  visible?: boolean
  label?: string
  onClick?: () => void
}) {
  if (!visible) return null
  return (
    <UiButton
      className={className}
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
      style={{ width: 'auto', minWidth: componentSize.controlHeight.md, paddingInline: spacing.sm }}
    >
      <span style={{ fontSize: typography.size.sm, fontWeight: typography.weight.medium }}>
        {label}
      </span>
    </UiButton>
  )
}

export interface ConversationScreenProps {
  messages?: ReactNode
  input?: ReactNode
  header?: ReactNode
  footer?: ReactNode
  className?: string
}

export function ConversationScreen({
  messages,
  input,
  header,
  footer,
  className,
}: ConversationScreenProps) {
  return (
    <UiSurface
      className={className}
      elevated
      data-testid="conversation-screen"
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: 320,
        gap: spacing.lg,
      }}
    >
      {header}
      <div data-ui="conversation-messages" style={{ flex: 1 }}>
        <UiStack gap="md">{messages}</UiStack>
      </div>
      {input}
      {footer}
    </UiSurface>
  )
}

export const CONVERSATION_UI_PARTS = [
  'ConversationScreen',
  'MessageBubble',
  'AssistantBubble',
  'UserBubble',
  'ThinkingBubble',
  'StreamingBubble',
  'SuggestionBubble',
  'TypingIndicator',
  'ConversationInput',
  'VoiceButton',
  'AttachmentButton',
] as const
