/**
 * Sprint 119 — reusable card UI models (presentation props only).
 */

import type { ReactNode } from 'react'
import { UiStack, UiSurface, UiText } from '../common'
import { spacing } from '../tokens'

export interface CardModelBase {
  id?: string
  title?: string
  subtitle?: string
  children?: ReactNode
  className?: string
  footer?: ReactNode
}

function CardShell({
  title,
  subtitle,
  children,
  footer,
  className,
  kind,
}: CardModelBase & { kind: string }) {
  return (
    <UiSurface
      className={className}
      elevated
      data-ui-card={kind}
      style={{ minWidth: 0 }}
    >
      <UiStack gap="sm">
        {title ? (
          <UiText as="h3" size="md" weight="semibold">
            {title}
          </UiText>
        ) : null}
        {subtitle ? (
          <UiText size="sm" weight="regular">
            {subtitle}
          </UiText>
        ) : null}
        {children}
        {footer ? <div style={{ marginTop: spacing.sm }}>{footer}</div> : null}
      </UiStack>
    </UiSurface>
  )
}

export interface FlightCardProps extends CardModelBase {
  airline?: string
  route?: string
  priceLabel?: string
}

export function FlightCard({ airline, route, priceLabel, ...rest }: FlightCardProps) {
  return (
    <CardShell kind="flight" {...rest}>
      {airline ? <UiText size="sm">{airline}</UiText> : null}
      {route ? <UiText size="sm">{route}</UiText> : null}
      {priceLabel ? <UiText size="md" weight="semibold">{priceLabel}</UiText> : null}
    </CardShell>
  )
}

export interface HotelCardProps extends CardModelBase {
  city?: string
  starsLabel?: string
  priceLabel?: string
}

export function HotelCard({ city, starsLabel, priceLabel, ...rest }: HotelCardProps) {
  return (
    <CardShell kind="hotel" {...rest}>
      {city ? <UiText size="sm">{city}</UiText> : null}
      {starsLabel ? <UiText size="sm">{starsLabel}</UiText> : null}
      {priceLabel ? <UiText size="md" weight="semibold">{priceLabel}</UiText> : null}
    </CardShell>
  )
}

export interface PackageCardProps extends CardModelBase {
  totalLabel?: string
  nightsLabel?: string
}

export function PackageCard({ totalLabel, nightsLabel, ...rest }: PackageCardProps) {
  return (
    <CardShell kind="package" {...rest}>
      {nightsLabel ? <UiText size="sm">{nightsLabel}</UiText> : null}
      {totalLabel ? <UiText size="md" weight="semibold">{totalLabel}</UiText> : null}
    </CardShell>
  )
}

export interface ItineraryCardProps extends CardModelBase {
  dayLabel?: string
}

export function ItineraryCard({ dayLabel, ...rest }: ItineraryCardProps) {
  return (
    <CardShell kind="itinerary" {...rest}>
      {dayLabel ? <UiText size="sm">{dayLabel}</UiText> : null}
    </CardShell>
  )
}

export interface ActivityCardProps extends CardModelBase {
  timeLabel?: string
}

export function ActivityCard({ timeLabel, ...rest }: ActivityCardProps) {
  return (
    <CardShell kind="activity" {...rest}>
      {timeLabel ? <UiText size="sm">{timeLabel}</UiText> : null}
    </CardShell>
  )
}

export interface RecommendationCardProps extends CardModelBase {
  reason?: string
}

export function RecommendationCard({ reason, ...rest }: RecommendationCardProps) {
  return (
    <CardShell kind="recommendation" {...rest}>
      {reason ? <UiText size="sm">{reason}</UiText> : null}
    </CardShell>
  )
}

export interface WarningCardProps extends CardModelBase {
  severity?: 'info' | 'warning' | 'critical'
}

export function WarningCard({ severity = 'warning', ...rest }: WarningCardProps) {
  return (
    <CardShell kind="warning" {...rest}>
      <UiText size="xs">severity={severity}</UiText>
    </CardShell>
  )
}

export interface SavingsCardProps extends CardModelBase {
  savingsLabel?: string
}

export function SavingsCard({ savingsLabel, ...rest }: SavingsCardProps) {
  return (
    <CardShell kind="savings" {...rest}>
      {savingsLabel ? <UiText size="md" weight="semibold">{savingsLabel}</UiText> : null}
    </CardShell>
  )
}

export interface ConfidenceCardProps extends CardModelBase {
  confidenceLabel?: string
}

export function ConfidenceCard({ confidenceLabel, ...rest }: ConfidenceCardProps) {
  return (
    <CardShell kind="confidence" {...rest}>
      {confidenceLabel ? (
        <UiText size="md" weight="semibold">
          {confidenceLabel}
        </UiText>
      ) : null}
    </CardShell>
  )
}

export interface ComparisonCardProps extends CardModelBase {
  leftLabel?: string
  rightLabel?: string
}

export function ComparisonCard({
  leftLabel,
  rightLabel,
  ...rest
}: ComparisonCardProps) {
  return (
    <CardShell kind="comparison" {...rest}>
      <UiStack direction="horizontal" gap="md">
        {leftLabel ? <UiText size="sm">{leftLabel}</UiText> : null}
        {rightLabel ? <UiText size="sm">{rightLabel}</UiText> : null}
      </UiStack>
    </CardShell>
  )
}

export const CARD_UI_MODELS = [
  'FlightCard',
  'HotelCard',
  'PackageCard',
  'ItineraryCard',
  'ActivityCard',
  'RecommendationCard',
  'WarningCard',
  'SavingsCard',
  'ConfidenceCard',
  'ComparisonCard',
] as const
