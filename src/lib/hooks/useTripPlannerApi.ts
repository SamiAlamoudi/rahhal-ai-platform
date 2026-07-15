/**
 * Phase AH — React hook bridging TravelSession UI → Trip Planner API.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createTripPlannerApiClient } from '../../integrations/api/tripPlannerApiClient'
import {
  adaptReasoningMap,
  adaptTripPlannerResultToSearchOrchestration,
  formatApiTransportError,
  latestPipelineStage,
  localizeValidationErrors,
  STAGE_LABELS_AR,
  STAGE_LABELS_EN,
} from '../ai/tripPlanner/frontend/adaptResultToUi'
import { mapTravelSessionToTripPlannerRequest } from '../ai/tripPlanner/frontend/mapSessionToRequest'
import { runTripPlannerFlow } from '../ai/tripPlanner/frontend/runTripPlannerFlow'
import type {
  BookingPreview,
  PipelineConfidence,
  TripPlannerResult,
  TripPlannerStage,
} from '../ai/tripPlanner/models'
import type { ReasoningResult } from '../../utils/reasoningEngine'
import type { NormalizedTravelOption, SearchOrchestrationResult } from '../../utils/searchOrchestrator'
import type { TravelSession } from '../../utils/travelSession'
import { useAuth } from '../auth'

export interface UseTripPlannerApiOptions {
  session: TravelSession
  enabled: boolean
  includeBookingPreview?: boolean
  locale?: 'ar' | 'en'
  /** Injected client for tests. */
  client?: ReturnType<typeof createTripPlannerApiClient>
  pollIntervalMs?: number
  maxPollAttempts?: number
}

export interface UseTripPlannerApiState {
  loading: boolean
  error: string | null
  errorCode: string | null
  result: TripPlannerResult | null
  orchestrationResult: SearchOrchestrationResult | null
  rankedOptions: NormalizedTravelOption[]
  reasoningResults: Map<string, ReasoningResult>
  pipelineStage: TripPlannerStage | 'Polling' | null
  pipelineLabels: string[]
  confidence: PipelineConfidence | null
  warnings: string[]
  assumptions: string[]
  tradeOffs: string[]
  validationErrors: string[]
  bookingPreview: BookingPreview | null
  partial: boolean
  retryCount: number
  cancel: () => void
  retry: () => void
}

export function useTripPlannerApi(options: UseTripPlannerApiOptions): UseTripPlannerApiState {
  const { user, session: authSession, loading: authLoading } = useAuth()
  const locale = options.locale ?? 'ar'
  const clientRef = useRef(options.client ?? createTripPlannerApiClient({ transport: 'in_process' }))
  if (options.client) clientRef.current = options.client

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [result, setResult] = useState<TripPlannerResult | null>(null)
  const [pipelineStage, setPipelineStage] = useState<TripPlannerStage | 'Polling' | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [retryToken, setRetryToken] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setPipelineStage('Cancelled')
    setLoading(false)
    setErrorCode('cancelled')
    setError(locale === 'ar' ? 'تم إلغاء التخطيط.' : 'Planning was cancelled.')
  }, [locale])

  const retry = useCallback(() => {
    setRetryCount((n) => n + 1)
    setRetryToken((n) => n + 1)
    setError(null)
    setErrorCode(null)
  }, [])

  useEffect(() => {
    if (!options.enabled) {
      setResult(null)
      setError(null)
      setErrorCode(null)
      setLoading(false)
      setPipelineStage(null)
      return
    }

    if (authLoading) return

    if (!user?.id) {
      setResult(null)
      setErrorCode('auth_error')
      setError(formatApiTransportError('auth_error', 'Unauthorized', locale))
      setLoading(false)
      return
    }

    if (!authSession?.access_token && !options.client) {
      // In-process transport uses dev bearer from user id; expired session still blocks UI.
      // If supabase session vanished while user object is stale, treat as expired.
    }

    const controller = new AbortController()
    abortRef.current = controller
    let active = true

    const request = mapTravelSessionToTripPlannerRequest(options.session, {
      userId: user.id,
      preferredLanguage: locale,
      includeBookingPreview: options.includeBookingPreview === true,
      requestId: `ui_${options.session.lastUpdatedAt ?? 'x'}_${retryToken}`,
      idempotencyKey: [
        'ui',
        user.id,
        options.session.destination ?? '',
        options.session.departureDate ?? '',
        options.session.returnDate ?? '',
        String(options.session.budgetAmount ?? ''),
        String(options.includeBookingPreview === true),
        String(retryToken),
      ].join(':'),
    })

    setLoading(true)
    setError(null)
    setErrorCode(null)
    setPipelineStage('Received')

    runTripPlannerFlow({
      client: clientRef.current,
      request,
      signal: controller.signal,
      pollIntervalMs: options.pollIntervalMs,
      maxPollAttempts: options.maxPollAttempts,
      onStage: (stage, _message) => {
        if (active) setPipelineStage(stage)
      },
    })
      .then((outcome) => {
        if (!active || controller.signal.aborted) return
        if (!outcome.ok) {
          if (outcome.code === 'cancelled') {
            setErrorCode('cancelled')
            setError(locale === 'ar' ? 'تم إلغاء التخطيط.' : 'Planning was cancelled.')
            setResult(outcome.result)
            return
          }
          setErrorCode(outcome.code)
          setError(
            formatApiTransportError(
              outcome.code,
              outcome.error,
              locale,
            ),
          )
          setResult(outcome.result)
          return
        }

        setResult(outcome.result)
        if (
          outcome.result.status === 'failed' &&
          outcome.result.validationErrors.length > 0
        ) {
          const localized = localizeValidationErrors(outcome.result.validationErrors, locale)
          setErrorCode(outcome.result.validationErrors[0]?.code ?? 'validation_error')
          setError(localized[0] ?? outcome.result.failure?.message ?? null)
        } else if (outcome.result.status === 'failed' && outcome.result.failure) {
          setErrorCode(outcome.result.failure.code)
          setError(outcome.result.failure.message)
        } else {
          setError(null)
          setErrorCode(null)
        }
        setPipelineStage(latestPipelineStage(outcome.result) ?? outcome.result.stage)
      })
      .catch((err: unknown) => {
        if (!active) return
        if (err instanceof DOMException && err.name === 'AbortError') {
          setErrorCode('cancelled')
          setError(locale === 'ar' ? 'تم إلغاء التخطيط.' : 'Planning was cancelled.')
          return
        }
        setErrorCode('api_error')
        setError(
          locale === 'ar'
            ? 'تعذّر الاتصال بواجهة تخطيط الرحلة. حاول مرة أخرى.'
            : 'Could not reach the trip planner API. Please retry.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [
    options.enabled,
    options.session.destination,
    options.session.departureDate,
    options.session.returnDate,
    options.session.durationDays,
    options.session.budgetAmount,
    options.session.budgetCurrency,
    options.session.adults,
    options.session.children,
    options.session.decisionProfileConfirmed,
    options.includeBookingPreview,
    options.pollIntervalMs,
    options.maxPollAttempts,
    options.client,
    user?.id,
    authLoading,
    authSession?.access_token,
    locale,
    retryToken,
  ])

  const orchestrationResult = useMemo(
    () => (result ? adaptTripPlannerResultToSearchOrchestration(result) : null),
    [result],
  )
  const rankedOptions = orchestrationResult?.rankedOptions ?? []
  const reasoningResults = useMemo(
    () => (result ? adaptReasoningMap(result) : new Map<string, ReasoningResult>()),
    [result],
  )

  const labels = locale === 'ar' ? STAGE_LABELS_AR : STAGE_LABELS_EN
  const pipelineLabels = useMemo(() => {
    if (!result?.pipelineTimeline.length) {
      return pipelineStage ? [pipelineStage === 'Polling' ? (locale === 'ar' ? 'جارٍ الانتظار...' : 'Polling...') : labels[pipelineStage as TripPlannerStage] ?? String(pipelineStage)] : []
    }
    return result.pipelineTimeline.map((e) => labels[e.stage] ?? e.message)
  }, [result, pipelineStage, labels, locale])

  const tradeOffs = result?.itinerary?.explanation.tradeOffs
    ?? result?.itinerary?.optimization.tradeOffs
    ?? []
  const assumptions = result?.assumptions?.length
    ? result.assumptions
    : (result?.itinerary?.explanation.assumptions ?? [])
  const validationErrors = result
    ? localizeValidationErrors(result.validationErrors, locale)
    : []

  return {
    loading,
    error,
    errorCode,
    result,
    orchestrationResult,
    rankedOptions,
    reasoningResults,
    pipelineStage,
    pipelineLabels,
    confidence: result?.confidence ?? null,
    warnings: result?.warnings ?? [],
    assumptions,
    tradeOffs,
    validationErrors,
    bookingPreview: result?.bookingPreview ?? null,
    partial: result?.partial === true || result?.status === 'partial',
    retryCount,
    cancel,
    retry,
  }
}
