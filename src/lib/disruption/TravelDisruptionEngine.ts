/**
 * Sprint 37 — TravelDisruptionEngine
 * Detect → impact → recover → rank → trip update → explain.
 * Extends trip management / refund stack; does not rewrite planner or payments.
 */

import type { NotificationScheduler } from '../trips/NotificationScheduler'
import type { PostBookingService } from '../trips/PostBookingService'
import { DisruptionDetector } from './DisruptionDetector'
import {
  DisruptionEvents,
  createDisruptionEvent,
  type DisruptionEvent,
} from './DisruptionEvents'
import { DisruptionExplainer } from './DisruptionExplainer'
import { isTravelDisruptionEngineEnabled } from './DisruptionFeatureFlags'
import { DisruptionMetrics } from './DisruptionMetrics'
import { ImpactCalculator } from './ImpactCalculator'
import { RecoveryRanker } from './RecoveryRanker'
import { RecoverySearcher } from './RecoverySearcher'
import { TripUpdateService } from './TripUpdateService'
import type {
  DisruptionContext,
  DisruptionEventType,
  DisruptionHandleInput,
  DisruptionHandlingResult,
} from './types'

export interface TravelDisruptionEngineOptions {
  enabled?: boolean
  detector?: DisruptionDetector
  impactCalculator?: ImpactCalculator
  searcher?: RecoverySearcher
  ranker?: RecoveryRanker
  tripUpdater?: TripUpdateService
  explainer?: DisruptionExplainer
  events?: DisruptionEvents
  metrics?: DisruptionMetrics
  postBooking?: PostBookingService | null
  notifications?: NotificationScheduler | null
  onEvent?: (event: DisruptionEvent) => void
}

export class TravelDisruptionEngine {
  private readonly enabledOverride: boolean | undefined
  private readonly detector: DisruptionDetector
  private readonly impactCalculator: ImpactCalculator
  private readonly searcher: RecoverySearcher
  private readonly ranker: RecoveryRanker
  private readonly tripUpdater: TripUpdateService
  private readonly explainer: DisruptionExplainer
  private readonly events: DisruptionEvents
  private readonly metrics: DisruptionMetrics
  private readonly notifications: NotificationScheduler | null
  private readonly onEvent: ((event: DisruptionEvent) => void) | undefined
  private readonly recent: DisruptionEvent[] = []

  constructor(options: TravelDisruptionEngineOptions = {}) {
    this.enabledOverride = options.enabled
    this.detector = options.detector ?? new DisruptionDetector()
    this.impactCalculator = options.impactCalculator ?? new ImpactCalculator()
    this.searcher = options.searcher ?? new RecoverySearcher()
    this.ranker = options.ranker ?? new RecoveryRanker()
    this.tripUpdater =
      options.tripUpdater
      ?? new TripUpdateService(options.postBooking ?? null)
    this.explainer = options.explainer ?? new DisruptionExplainer()
    this.events = options.events ?? new DisruptionEvents()
    this.metrics = options.metrics ?? new DisruptionMetrics()
    this.notifications = options.notifications ?? null
    this.onEvent = options.onEvent
  }

  isEnabled(): boolean {
    if (typeof this.enabledOverride === 'boolean') return this.enabledOverride
    return isTravelDisruptionEngineEnabled()
  }

  detectFromUserText(text: string): DisruptionEventType | null {
    return this.detector.detectFromUserText(text)
  }

  handle(input: DisruptionHandleInput): DisruptionHandlingResult | { ok: false; code: string; message: string } {
    if (!this.isEnabled()) {
      return {
        ok: false,
        code: 'FEATURE_DISABLED',
        message: 'Travel Disruption Engine is disabled (brain.travel_disruption_engine).',
      }
    }

    const disruption = this.detector.detect({
      eventType: input.eventType,
      context: input.context,
      signal: input.signal,
      delayMinutes: input.delayMinutes,
    })

    this.emit(
      createDisruptionEvent('DisruptionDetected', input.context.tripId, {
        disruptionId: disruption.disruptionId,
        eventType: disruption.eventType,
        severity: disruption.severity,
      }),
    )
    this.metrics.recordDetected(disruption.eventType)

    const impact = this.impactCalculator.calculate(disruption, input.context)
    this.emit(
      createDisruptionEvent('ImpactCalculated', input.context.tripId, {
        travelersAffected: impact.travelersAffected,
        stressScore: impact.stressScore,
      }),
    )

    const options = this.searcher.search(disruption, input.context)
    this.emit(
      createDisruptionEvent('RecoveryOptionsGenerated', input.context.tripId, {
        optionCount: options.length,
      }),
    )
    this.metrics.recordRecoveries(options.length)

    const plans = this.ranker.rank(options, disruption, input.context, impact)
    const selectedPlan = plans[0] ?? null
    if (selectedPlan) {
      this.emit(
        createDisruptionEvent('RecoveryPlanSelected', input.context.tripId, {
          planId: selectedPlan.planId,
          score: selectedPlan.score,
          totalExtraCost: selectedPlan.totalExtraCost,
        }),
      )
    }

    const autoApply = input.autoApplyBestPlan !== false
    let tripUpdate = null
    const notifications: DisruptionHandlingResult['notifications'] = []

    if (autoApply && selectedPlan) {
      tripUpdate = this.tripUpdater.apply(disruption, input.context, impact, selectedPlan)
      this.emit(
        createDisruptionEvent('TripUpdated', input.context.tripId, {
          planId: selectedPlan.planId,
          notes: tripUpdate.notes.length,
        }),
      )
      this.metrics.recordApplied(selectedPlan.totalExtraCost, selectedPlan.confidenceScore)

      if (this.notifications) {
        const trigger =
          disruption.eventType === 'gate_changed' ? 'gate_change' : 'flight_delay'
        const scheduled = this.notifications.schedule({
          tripId: input.context.tripId,
          userId: input.context.userId,
          trigger,
          destination: input.context.destination,
          bookingReference:
            input.context.flightConfirmation
            ?? input.context.hotelConfirmation
            ?? input.context.tripId,
        })
        notifications.push({
          trigger: scheduled.trigger,
          title: scheduled.title,
          body: scheduled.body,
        })
        this.emit(
          createDisruptionEvent('UserNotified', input.context.tripId, {
            notificationId: scheduled.notificationId,
            trigger: scheduled.trigger,
          }),
        )
      }
    }

    const explanation = this.explainer.explain({
      disruption,
      impact,
      selectedPlan,
      tripUpdate,
      locale: input.locale ?? 'en',
    })

    const result: DisruptionHandlingResult = {
      disruption,
      impact,
      plans,
      selectedPlan,
      tripUpdate,
      estimatedExtraCost: selectedPlan?.totalExtraCost ?? 0,
      estimatedDelayMinutes: selectedPlan?.estimatedDelayMinutes ?? disruption.delayMinutes,
      confidenceScore: selectedPlan?.confidenceScore ?? 0.5,
      explanation,
      notifications,
      applied: Boolean(tripUpdate),
    }

    this.emit(
      createDisruptionEvent('DisruptionHandled', input.context.tripId, {
        disruptionId: disruption.disruptionId,
        applied: result.applied,
        confidenceScore: result.confidenceScore,
      }),
    )

    return result
  }

  handleFromUserText(input: {
    userText: string
    context: DisruptionContext
    delayMinutes?: number
    autoApplyBestPlan?: boolean
    locale?: 'ar' | 'en'
    signal?: Record<string, unknown>
  }): DisruptionHandlingResult | { ok: false; code: string; message: string } {
    const eventType = this.detector.detectFromUserText(input.userText)
    if (!eventType) {
      return {
        ok: false,
        code: 'NO_DISRUPTION_DETECTED',
        message: 'Could not detect a travel disruption from the request.',
      }
    }
    return this.handle({
      eventType,
      context: input.context,
      delayMinutes: input.delayMinutes,
      autoApplyBestPlan: input.autoApplyBestPlan,
      locale: input.locale,
      signal: { ...input.signal, userText: input.userText },
    })
  }

  getMetrics() {
    return this.metrics.snapshot()
  }

  getRecentEvents(limit = 50): DisruptionEvent[] {
    return this.recent.slice(-limit)
  }

  private emit(event: DisruptionEvent): void {
    this.recent.push(event)
    this.events.emit(event)
    this.onEvent?.(event)
  }
}

export function createTravelDisruptionEngine(
  options?: TravelDisruptionEngineOptions,
): TravelDisruptionEngine {
  return new TravelDisruptionEngine(options)
}

export function isDisruptionHandlingResult(
  value: DisruptionHandlingResult | { ok: false; code: string; message: string },
): value is DisruptionHandlingResult {
  return !('ok' in value && value.ok === false)
}
