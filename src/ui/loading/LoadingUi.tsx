/**
 * Sprint 119 — Loading / empty / error presentation system.
 */

import type { ReactNode } from 'react'
import { UiButton, UiStack, UiSurface, UiText } from '../common'
import { animation, radius, spacing } from '../tokens'

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  className?: string
}

export function Skeleton({ width = '100%', height = 16, className }: SkeletonProps) {
  return (
    <div
      className={className}
      data-ui="skeleton"
      aria-hidden
      style={{
        width,
        height,
        borderRadius: radius.sm,
        animationDuration: `${animation.duration.deliberate}ms`,
      }}
    />
  )
}

export interface ProgressIndicatorProps {
  value?: number
  label?: string
  className?: string
}

export function ProgressIndicator({
  value = 0,
  label,
  className,
}: ProgressIndicatorProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={className} data-ui="progress" role="progressbar" aria-valuenow={clamped}>
      {label ? <UiText size="xs">{label}</UiText> : null}
      <div
        style={{
          height: spacing.xs,
          borderRadius: radius.pill,
          overflow: 'hidden',
          marginTop: spacing.xs,
        }}
      >
        <div style={{ width: `${clamped}%`, height: '100%' }} />
      </div>
    </div>
  )
}

export interface StreamingPlaceholderProps {
  lines?: number
  className?: string
}

export function StreamingPlaceholder({
  lines = 3,
  className,
}: StreamingPlaceholderProps) {
  const count = Math.max(1, lines)
  return (
    <div className={className} data-ui="streaming-placeholder">
      <UiStack gap="sm">
        {Array.from({ length: count }, (_, i) => (
          <Skeleton key={i} height={12} width={`${90 - i * 10}%`} />
        ))}
      </UiStack>
    </div>
  )
}

export interface EmptyStateProps {
  title?: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <UiSurface className={className} data-ui="empty-state">
      <UiStack gap="sm">
        <UiText as="h3" size="md" weight="semibold">
          {title}
        </UiText>
        {description ? <UiText size="sm">{description}</UiText> : null}
        {action}
      </UiStack>
    </UiSurface>
  )
}

export interface ErrorStateProps {
  title?: string
  description?: string
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  className,
}: ErrorStateProps) {
  return (
    <UiSurface className={className} data-ui="error-state">
      <UiStack gap="sm">
        <UiText as="h3" size="md" weight="semibold">
          {title}
        </UiText>
        {description ? <UiText size="sm">{description}</UiText> : null}
      </UiStack>
    </UiSurface>
  )
}

export interface RetryStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function RetryState({
  title = 'Try again',
  description,
  onRetry,
  retryLabel = 'Retry',
  className,
}: RetryStateProps) {
  return (
    <UiSurface className={className} data-ui="retry-state">
      <UiStack gap="md">
        <UiText as="h3" size="md" weight="semibold">
          {title}
        </UiText>
        {description ? <UiText size="sm">{description}</UiText> : null}
        <UiButton onClick={onRetry} aria-label={retryLabel}>
          {retryLabel}
        </UiButton>
      </UiStack>
    </UiSurface>
  )
}

export const LOADING_UI_PARTS = [
  'Skeleton',
  'ProgressIndicator',
  'StreamingPlaceholder',
  'EmptyState',
  'ErrorState',
  'RetryState',
] as const
