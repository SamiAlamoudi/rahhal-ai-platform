/**
 * Sprint 119 — Timeline presentation architecture.
 */

import type { ReactNode } from 'react'
import { UiStack, UiText } from '../common'
import { radius, spacing } from '../tokens'

export type TimelineStatusKind =
  | 'pending'
  | 'running'
  | 'completed'
  | 'warning'
  | 'error'
  | 'skipped'

export interface TimelineStatusProps {
  status: TimelineStatusKind
  label?: string
  className?: string
}

export function TimelineStatus({ status, label, className }: TimelineStatusProps) {
  return (
    <span
      className={className}
      data-ui-timeline-status={status}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: spacing.xs,
        borderRadius: radius.pill,
        paddingInline: spacing.sm,
        paddingBlock: spacing.xxs,
      }}
    >
      <UiText as="span" size="xs" weight="medium">
        {label ?? status}
      </UiText>
    </span>
  )
}

export interface TimelineEventProps {
  children?: ReactNode
  timeLabel?: string
  status?: TimelineStatusKind
  className?: string
}

export function TimelineEvent({
  children,
  timeLabel,
  status,
  className,
}: TimelineEventProps) {
  return (
    <div className={className} data-ui="timeline-event">
      <UiStack gap="xs">
        {timeLabel ? <UiText size="xs">{timeLabel}</UiText> : null}
        {status ? <TimelineStatus status={status} /> : null}
        {children}
      </UiStack>
    </div>
  )
}

export interface TimelineItemProps {
  children?: ReactNode
  title?: string
  className?: string
}

export function TimelineItem({ children, title, className }: TimelineItemProps) {
  return (
    <li
      className={className}
      data-ui="timeline-item"
      style={{ listStyle: 'none', margin: 0, paddingBlock: spacing.sm }}
    >
      {title ? (
        <UiText as="h4" size="sm" weight="semibold">
          {title}
        </UiText>
      ) : null}
      {children}
    </li>
  )
}

export interface TimelineDayProps {
  children?: ReactNode
  dayLabel?: string
  className?: string
}

export function TimelineDay({ children, dayLabel, className }: TimelineDayProps) {
  return (
    <section className={className} data-ui="timeline-day">
      {dayLabel ? (
        <UiText as="h3" size="md" weight="semibold" style={{ marginBottom: spacing.sm }}>
          {dayLabel}
        </UiText>
      ) : null}
      <UiStack gap="sm">{children}</UiStack>
    </section>
  )
}

export interface TimelineProps {
  children?: ReactNode
  className?: string
}

export function Timeline({ children, className }: TimelineProps) {
  return (
    <ol
      className={className}
      data-ui="timeline"
      data-testid="ui-timeline"
      style={{ margin: 0, padding: 0 }}
    >
      {children}
    </ol>
  )
}

export const TIMELINE_UI_PARTS = [
  'Timeline',
  'TimelineItem',
  'TimelineDay',
  'TimelineEvent',
  'TimelineStatus',
] as const
