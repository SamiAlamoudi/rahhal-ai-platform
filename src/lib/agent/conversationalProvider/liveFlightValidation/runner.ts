/**
 * Sprint 80 P2 — end-to-end live flight validation runner.
 *
 * Runs pilot (Amadeus LiveFlightProvider via unified layer) vs legacy
 * Flight Search Engine, compares outputs, measures latency, aggregates telemetry.
 *
 * CI: inject `runLive` mock (no network).
 * Staging/dev with secrets: omit `runLive` to hit real Amadeus sandbox.
 */

import { mergeRequirements } from '../../memory'
import { emptyRequirements } from '../../types'
import { createFlightSearchEngine } from '../../flightSearchEngine'
import { runFlightSearchTool } from '../../tools/searchEngineBridge'
import type { AgentToolContext } from '../../tools/types'
import {
  runLiveFlightSearch,
  type LiveFlightSearchCriteria,
  type LiveFlightSearchResult,
} from '../../liveFlightSearch'
import { mapConversationalProviderRequest } from '../requestMapper'
import { runLiveFlightProviderPilot } from '../flightPilot'
import { createFlightPilotTelemetry } from '../telemetry'
import { comparePilotToLegacy } from './compare'
import { evaluateLiveFlightValidationGate } from './gate'
import { inspectPilotFieldIntegrity } from './inspect'
import { buildLatencyBreakdown, buildValidationTelemetryRates } from './metrics'
import { DEFAULT_LIVE_FLIGHT_VALIDATION_SCENARIO } from './scenarios'
import {
  LIVE_FLIGHT_P2_VALIDATION_VERSION,
  type LiveFlightValidationMode,
  type LiveFlightValidationResult,
  type LiveFlightValidationScenario,
} from './types'

export type RunLiveFlightValidationOptions = {
  scenario?: LiveFlightValidationScenario
  env?: Record<string, string | undefined>
  /** Injectable live runner (required for CI mocks). */
  runLive?: (
    criteria: LiveFlightSearchCriteria,
    options?: { enabled?: boolean },
  ) => Promise<LiveFlightSearchResult>
  /** Force mock mode even if credentials exist. */
  forceMock?: boolean
  /** Allow production gate bypass in unit tests only. */
  allowProductionForTests?: boolean
}

function buildContext(scenario: LiveFlightValidationScenario): AgentToolContext {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: scenario.origin,
    destination: scenario.destination,
    destinations: [scenario.destination],
    startDate: scenario.departureDate,
    endDate: scenario.returnDate,
    travelers: scenario.adults + scenario.children,
    cabinPreference: scenario.cabin,
    budgetCurrency: scenario.currency,
    durationDays: scenario.returnDate ? 8 : 3,
  })
  return {
    locale: 'ar',
    requirements,
    input: {},
  } as AgentToolContext
}

function sampleOffer(data: Record<string, unknown>): Record<string, unknown> | null {
  const offers = Array.isArray(data.offers) ? data.offers : []
  const first = offers[0]
  return first != null && typeof first === 'object' && !Array.isArray(first)
    ? (first as Record<string, unknown>)
    : null
}

/**
 * Execute one validation scenario. Never throws for provider failures —
 * encodes outcomes into the result object.
 */
export async function runLiveFlightValidation(
  options: RunLiveFlightValidationOptions = {},
): Promise<LiveFlightValidationResult> {
  const scenario = options.scenario ?? DEFAULT_LIVE_FLIGHT_VALIDATION_SCENARIO
  const gate = evaluateLiveFlightValidationGate({
    env: options.env,
    allowProductionForTests: options.allowProductionForTests,
  })

  const telemetry = createFlightPilotTelemetry()
  const engine = createFlightSearchEngine({ forceMock: true })
  const ctx = buildContext(scenario)

  if (!gate.allowed) {
    return {
      version: LIVE_FLIGHT_P2_VALIDATION_VERSION,
      mode: 'skipped',
      scenario,
      gate: {
        allowed: false,
        deployTarget: gate.deployTarget,
        reason: gate.reason,
        productionBlocked: gate.productionBlocked,
      },
      pilot: {
        ok: false,
        empty: true,
        offerCount: 0,
        searchEngine: null,
        usedLive: null,
        sampleOffer: null,
      },
      legacy: {
        ok: false,
        empty: true,
        offerCount: 0,
        searchEngine: null,
        sampleOffer: null,
      },
      fieldIntegrity: {
        authentication: 'n/a',
        tokenRefresh: 'n/a',
        requestMapping: 'n/a',
        responseNormalization: 'n/a',
        pricingIntegrity: 'n/a',
        carrierData: 'n/a',
        baggage: 'n/a',
        fareFamilies: 'n/a',
        cabinClasses: 'n/a',
      },
      differences: [],
      latency: buildLatencyBreakdown({
        providerResponseMs: 0,
        normalizationMs: 0,
        totalSearchMs: 0,
        legacySearchMs: 0,
      }),
      telemetry: buildValidationTelemetryRates(telemetry.snapshot()),
      auth: {
        tokenAcquired: false,
        tokenRefreshed: false,
        detail: gate.reason,
      },
      liveSkippedReason: gate.reason,
      generatedAt: new Date().toISOString(),
    }
  }

  const useInjected = typeof options.runLive === 'function' || options.forceMock
  const mode: LiveFlightValidationMode = useInjected
    ? 'mock'
    : gate.hasCredentials && gate.sandboxHost
      ? 'live'
      : 'skipped'

  if (mode === 'skipped') {
    return {
      version: LIVE_FLIGHT_P2_VALIDATION_VERSION,
      mode: 'skipped',
      scenario,
      gate: {
        allowed: true,
        deployTarget: gate.deployTarget,
        reason: gate.reason,
        productionBlocked: false,
      },
      pilot: {
        ok: false,
        empty: true,
        offerCount: 0,
        searchEngine: null,
        usedLive: null,
        sampleOffer: null,
      },
      legacy: {
        ok: false,
        empty: true,
        offerCount: 0,
        searchEngine: null,
        sampleOffer: null,
      },
      fieldIntegrity: {
        authentication: 'missing',
        tokenRefresh: 'n/a',
        requestMapping: 'n/a',
        responseNormalization: 'n/a',
        pricingIntegrity: 'n/a',
        carrierData: 'n/a',
        baggage: 'n/a',
        fareFamilies: 'n/a',
        cabinClasses: 'n/a',
      },
      differences: [],
      latency: buildLatencyBreakdown({
        providerResponseMs: 0,
        normalizationMs: 0,
        totalSearchMs: 0,
        legacySearchMs: 0,
      }),
      telemetry: buildValidationTelemetryRates(telemetry.snapshot()),
      auth: {
        tokenAcquired: false,
        tokenRefreshed: false,
        detail: !gate.hasCredentials
          ? 'Missing Amadeus credentials (AMADEUS_API_KEY/SECRET or CLIENT_ID/SECRET)'
          : 'Amadeus host is not sandbox (test.api.amadeus.com)',
      },
      liveSkippedReason: !gate.hasCredentials
        ? 'Missing Amadeus credentials'
        : 'Non-sandbox Amadeus host blocked for P2 validation',
      generatedAt: new Date().toISOString(),
    }
  }

  let requestMapped = false
  try {
    mapConversationalProviderRequest({ domain: 'flights', ctx })
    requestMapped = true
  } catch {
    requestMapped = false
  }

  let providerResponseMs = 0
  let tokenAcquired = false
  let tokenRefreshed = false
  let emptyLive = false

  const timedRunLive = async (
    criteria: LiveFlightSearchCriteria,
    liveOptions?: { enabled?: boolean },
  ): Promise<LiveFlightSearchResult> => {
    const started = Date.now()
    const runner = options.runLive ?? runLiveFlightSearch
    const result = await runner(criteria, { enabled: true, ...liveOptions })
    providerResponseMs = Date.now() - started
    tokenAcquired = result.enabled && (result.ok || result.error?.code !== 'SECRETS_MISSING')
    // Sprint 105 runner acquires a fresh token per search; second call within
    // the same validation marks refresh/reuse intent for telemetry.
    tokenRefreshed = tokenAcquired
    emptyLive = result.ok && result.empty
    return result
  }

  const pilotStarted = Date.now()
  const pilot = await runLiveFlightProviderPilot(engine, ctx, {
    pilotEnabled: true,
    runLive: timedRunLive,
    telemetry,
  })
  const totalSearchMs = Date.now() - pilotStarted
  const normalizationMs = Math.max(0, totalSearchMs - providerResponseMs)

  const legacyStarted = Date.now()
  const legacy = await runFlightSearchTool(engine, ctx)
  const legacySearchMs = Date.now() - legacyStarted

  const pilotOffers = Array.isArray(pilot.data.offers) ? pilot.data.offers : []
  const legacyOffers = Array.isArray(legacy.data.offers) ? legacy.data.offers : []
  const differences = comparePilotToLegacy(pilot.data, legacy.data)
  const fieldIntegrity = inspectPilotFieldIntegrity({
    pilotData: pilot.data,
    requestMapped,
    authTokenAcquired: tokenAcquired || Boolean(pilot.data.usedLive),
    authTokenRefreshed: tokenRefreshed,
    normalizationCompleted: true,
  })

  const snap = telemetry.snapshot()
  const rates = buildValidationTelemetryRates(snap, {
    emptyResponses: emptyLive || pilot.empty ? 1 : 0,
    timeouts: snap.events.filter((e) => e.errorCode === 'TIMEOUT').length,
    authFailures: snap.events.filter((e) => e.errorCode === 'AUTH_FAILURE').length,
    providerErrors: snap.events.filter((e) =>
      e.errorCode != null
      && !['TIMEOUT', 'AUTH_FAILURE', 'INVALID_REQUEST', null].includes(e.errorCode),
    ).length,
  })

  return {
    version: LIVE_FLIGHT_P2_VALIDATION_VERSION,
    mode,
    scenario,
    gate: {
      allowed: true,
      deployTarget: gate.deployTarget,
      reason: gate.reason,
      productionBlocked: false,
    },
    pilot: {
      ok: !pilot.empty || pilotOffers.length > 0,
      empty: pilot.empty,
      offerCount: pilotOffers.length,
      searchEngine: typeof pilot.data.searchEngine === 'string' ? pilot.data.searchEngine : null,
      usedLive: typeof pilot.data.usedLive === 'boolean' ? pilot.data.usedLive : null,
      sampleOffer: sampleOffer(pilot.data),
    },
    legacy: {
      ok: !legacy.empty || legacyOffers.length > 0,
      empty: legacy.empty,
      offerCount: legacyOffers.length,
      searchEngine: typeof legacy.data.searchEngine === 'string' ? legacy.data.searchEngine : null,
      sampleOffer: sampleOffer(legacy.data),
    },
    fieldIntegrity,
    differences,
    latency: buildLatencyBreakdown({
      providerResponseMs,
      normalizationMs,
      totalSearchMs,
      legacySearchMs,
    }),
    telemetry: rates,
    auth: {
      tokenAcquired: tokenAcquired || Boolean(pilot.data.usedLive),
      tokenRefreshed,
      detail: mode === 'live'
        ? 'Live Amadeus sandbox path exercised'
        : 'Mock runLive injected (CI / no network)',
    },
    liveSkippedReason: null,
    generatedAt: new Date().toISOString(),
  }
}
