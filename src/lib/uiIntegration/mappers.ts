/**
 * Sprint 120 — Map production Pipeline / Streaming artifacts → Sprint 119 UI props.
 * Presentation mapping only — no engine logic.
 */

import type { PipelineResult } from '../agent/pipeline'
import type { StreamingConversationResult, StreamingEvent } from '../agent/streaming'
import type { ItineraryEngineResult, ItineraryDayPlan } from '../agent/itinerary'
import type { ConversationEditorResult } from '../agent/editing'

export interface FlightCardModel {
  id: string
  title: string
  airline?: string
  route?: string
  priceLabel?: string
}

export interface HotelCardModel {
  id: string
  title: string
  city?: string
  starsLabel?: string
  priceLabel?: string
}

export interface PackageCardModel {
  id: string
  title: string
  totalLabel?: string
  nightsLabel?: string
}

export interface RecommendationCardModel {
  id: string
  title: string
  reason?: string
  priceLabel?: string
}

export interface WarningCardModel {
  id: string
  title: string
  severity: 'info' | 'warning' | 'critical'
}

export interface ConfidenceCardModel {
  id: string
  title: string
  confidenceLabel: string
}

export interface SavingsCardModel {
  id: string
  title: string
  savingsLabel?: string
}

export interface TimelineDayModel {
  date: string
  dayLabel: string
  events: Array<{
    id: string
    title: string
    timeLabel?: string
    status: 'pending' | 'running' | 'completed' | 'warning' | 'error' | 'skipped'
    kind?: string
  }>
}

export interface PipelineProgressModel {
  currentStage: string | null
  progressPercent: number
  estimatedRemainingTimeMs: number
  stageLabels: Array<{ stage: string; status: string; message: string }>
  thinking: boolean
  partial: boolean
  confidence: number
  warnings: string[]
}

function money(amount: number | null | undefined, currency: string): string | undefined {
  if (amount == null || !Number.isFinite(amount)) return undefined
  return `${amount} ${currency}`
}

export function mapFlightsFromPipeline(pipeline: PipelineResult | null): FlightCardModel[] {
  if (!pipeline) return []
  return pipeline.flightOffers.map((f, i) => {
    const id = String(f.id ?? `flt_${i}`)
    const origin = String(f.origin ?? '')
    const destination = String(f.destination ?? '')
    const currency = String(f.currency ?? 'SAR')
    const price = typeof f.price === 'number' ? f.price : null
    return {
      id,
      title: String(f.title ?? id),
      airline: (f.airline as string | undefined) ?? undefined,
      route: origin && destination ? `${origin} → ${destination}` : undefined,
      priceLabel: money(price, currency),
    }
  })
}

export function mapHotelsFromPipeline(pipeline: PipelineResult | null): HotelCardModel[] {
  if (!pipeline) return []
  return pipeline.hotelOffers.map((h, i) => {
    const id = String(h.id ?? `htl_${i}`)
    const currency = String(h.currency ?? 'SAR')
    const price = typeof h.price === 'number' ? h.price : null
    const stars = typeof h.stars === 'number' ? h.stars : null
    return {
      id,
      title: String(h.hotelName ?? h.name ?? id),
      city: (h.city as string | undefined) ?? undefined,
      starsLabel: stars != null ? `${stars}★` : undefined,
      priceLabel: money(price, currency),
    }
  })
}

export function mapPackagesFromPipeline(pipeline: PipelineResult | null): PackageCardModel[] {
  if (!pipeline?.trip) return []
  const trip = pipeline.trip
  const selected = trip.selected as Record<string, unknown> | null | undefined
  if (!selected) {
    const count = typeof trip.tripCount === 'number' ? trip.tripCount : 0
    if (!count) return []
    return [
      {
        id: 'pkg_summary',
        title: 'Trip packages',
        totalLabel: `${count} package(s)`,
      },
    ]
  }
  const cost = selected.cost as { totalCost?: number; currency?: string } | undefined
  return [
    {
      id: String(selected.id ?? 'pkg_1'),
      title: String(selected.title ?? 'Trip package'),
      nightsLabel:
        typeof selected.nights === 'number' ? `${selected.nights} night(s)` : undefined,
      totalLabel: money(cost?.totalCost ?? null, cost?.currency ?? 'SAR'),
    },
  ]
}

export function mapRecommendationsFromPipeline(
  pipeline: PipelineResult | null,
): RecommendationCardModel[] {
  const recs = pipeline?.finalResponse?.recommendations ?? []
  return recs.map((r, i) => ({
    id: String(r.id ?? `rec_${i}`),
    title: String(r.title ?? `Option ${i + 1}`),
    reason: r.reason ?? undefined,
    priceLabel: money(r.price, r.currency || 'SAR'),
  }))
}

export function mapWarningsFromPipeline(pipeline: PipelineResult | null): WarningCardModel[] {
  const warnings = [
    ...(pipeline?.warnings ?? []),
    ...(pipeline?.finalResponse?.warnings ?? []),
  ]
  return warnings.map((w, i) => ({
    id: `warn_${i}`,
    title: w,
    severity: 'warning' as const,
  }))
}

export function mapConfidenceFromPipeline(
  pipeline: PipelineResult | null,
  fallback = 0,
): ConfidenceCardModel | null {
  const confidence = pipeline?.confidence ?? pipeline?.finalResponse?.confidence ?? fallback
  if (!confidence) return null
  return {
    id: 'confidence',
    title: 'Confidence',
    confidenceLabel: `${Math.round(confidence * 100)}%`,
  }
}

export function mapItineraryDays(
  itineraryArtifact: Record<string, unknown> | null | undefined,
): TimelineDayModel[] {
  // Pipeline stores itinerary as opaque artifact; days may be absent when engine OFF.
  const dayCount = typeof itineraryArtifact?.dayCount === 'number'
    ? itineraryArtifact.dayCount
    : 0
  if (!dayCount) return []
  return Array.from({ length: Math.min(dayCount, 14) }, (_, i) => ({
    date: `day_${i + 1}`,
    dayLabel: `Day ${i + 1}`,
    events: [
      {
        id: `day_${i + 1}_plan`,
        title: 'Itinerary day',
        status: 'completed' as const,
        kind: 'itinerary',
      },
    ],
  }))
}

export function mapItineraryEngineDays(
  result: ItineraryEngineResult | null | undefined,
): TimelineDayModel[] {
  if (!result?.days?.length) return []
  return result.days.map((day: ItineraryDayPlan) => ({
    date: day.date,
    dayLabel: day.label,
    events: day.blocks.map((b) => ({
      id: b.id,
      title: b.title,
      timeLabel: `${Math.floor(b.startMinutes / 60)}:${String(b.startMinutes % 60).padStart(2, '0')}`,
      status: 'completed' as const,
      kind: b.kind,
    })),
  }))
}

export function mapStreamingProgress(
  result: StreamingConversationResult | null,
  liveEvents: readonly StreamingEvent[] = [],
): PipelineProgressModel {
  const events = liveEvents.length ? liveEvents : result?.events ?? []
  const latest = events[events.length - 1]
  return {
    currentStage: result?.currentStage ?? latest?.stage ?? null,
    progressPercent: result?.progressPercent ?? latest?.progressPercent ?? 0,
    estimatedRemainingTimeMs: result?.estimatedRemainingTimeMs ?? 0,
    stageLabels: events
      .filter((e) => e.kind === 'started' || e.kind === 'completed' || e.kind === 'progress')
      .slice(-12)
      .map((e) => ({
        stage: e.stage,
        status: e.status,
        message: e.message,
      })),
    thinking: Boolean(
      latest && (latest.kind === 'started' || latest.kind === 'progress'),
    ),
    partial: result?.metadata.partial ?? false,
    confidence: result?.confidence ?? 0,
    warnings: result?.warnings ?? [],
  }
}

export function mapEditComparison(edit: ConversationEditorResult) {
  return {
    whatChanged: edit.whatChanged,
    affectedStages: edit.affectedStages,
    stagesToSkip: edit.stagesToSkip,
    stagesToRerun: edit.stagesToRerun,
    beforeBudget: edit.diff?.before.budget ?? null,
    afterBudget: edit.diff?.after.budget ?? null,
    confidenceDelta: edit.diff?.confidenceDelta ?? 0,
    budgetDelta: edit.diff?.budgetDelta ?? null,
    history: edit.history.map((h) => ({
      id: h.id,
      summary: h.summary,
      kind: h.kind,
      at: h.at,
    })),
  }
}
