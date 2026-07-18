/**
 * Phase AB — in-memory anonymous analytics (privacy-gated).
 */

import { maskMetadata } from '../../ops/logging/mask'
import type {
  AnalyticsEvent,
  AnalyticsEventName,
  AnalyticsSnapshot,
  FunnelMetrics,
} from './types'

export interface AnalyticsRecorderOptions {
  analyticsAllowed?: boolean
  appVersion?: string | null
}

export interface ProductAnalytics {
  isAllowed(): boolean
  track(
    name: AnalyticsEventName,
    anonymousSessionId: string,
    metadata?: Record<string, unknown>,
  ): AnalyticsEvent | null
  snapshot(): AnalyticsSnapshot
  clear(): void
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `ae_${crypto.randomUUID()}`
  }
  return `ae_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export class InMemoryProductAnalytics implements ProductAnalytics {
  private readonly events: AnalyticsEvent[] = []
  private analyticsAllowed: boolean
  private readonly appVersion: string | null

  constructor(options: AnalyticsRecorderOptions = {}) {
    this.analyticsAllowed = options.analyticsAllowed !== false
    this.appVersion = options.appVersion ?? null
  }

  isAllowed(): boolean {
    return this.analyticsAllowed
  }

  setAllowed(allowed: boolean): void {
    this.analyticsAllowed = allowed
  }

  track(
    name: AnalyticsEventName,
    anonymousSessionId: string,
    metadata: Record<string, unknown> = {},
  ): AnalyticsEvent | null {
    if (!this.analyticsAllowed) return null
    if (!anonymousSessionId.trim()) return null
    const event: AnalyticsEvent = {
      id: generateId(),
      name,
      at: new Date().toISOString(),
      anonymousSessionId: anonymousSessionId.slice(0, 64),
      appVersion: this.appVersion,
      metadata: maskMetadata(metadata),
    }
    this.events.push(event)
    return { ...event, metadata: { ...event.metadata } }
  }

  snapshot(): AnalyticsSnapshot {
    const count = (name: AnalyticsEventName) => this.events.filter((e) => e.name === name).length
    const shown = count('recommendation_shown')
    const accepted = count('recommendation_accepted')
    const started = count('itinerary_started')
    const completed = count('itinerary_completed')
    const funnel: FunnelMetrics = {
      view: count('booking_funnel_view'),
      hold: count('booking_funnel_hold'),
      payment: count('booking_funnel_payment'),
      ticket: count('booking_funnel_ticket'),
      complete: count('booking_funnel_complete'),
      conversionRate: 0,
    }
    funnel.conversionRate = funnel.view > 0
      ? Number((funnel.complete / funnel.view).toFixed(4))
      : 0

    return {
      recommendationShown: shown,
      recommendationAccepted: accepted,
      recommendationAcceptanceRate: shown > 0 ? Number((accepted / shown).toFixed(4)) : 0,
      itineraryStarted: started,
      itineraryCompleted: completed,
      itineraryCompletionRate: started > 0 ? Number((completed / started).toFixed(4)) : 0,
      bookingFunnel: funnel,
      eventCount: this.events.length,
    }
  }

  clear(): void {
    this.events.length = 0
  }
}

let defaultAnalytics: InMemoryProductAnalytics | null = null

export function getProductAnalytics(): InMemoryProductAnalytics {
  if (!defaultAnalytics) defaultAnalytics = new InMemoryProductAnalytics({ appVersion: '1.1.0-planning' })
  return defaultAnalytics
}

export function resetProductAnalytics(): void {
  defaultAnalytics?.clear()
  defaultAnalytics = null
}
