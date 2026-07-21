/**
 * Sprint 67 — beta smoke tests (reuse Sprint 66 flows + beta gates).
 */

import { resetFeatureRegistry } from '../../ai'
import {
  resetBookingDocumentCenter,
  resetDefaultBookingExecutionEngine,
  resetDefaultBookingRecordStore,
  resetDefaultBookingSessionStore,
} from '../../agent/bookingExecution'
import { resetDefaultBookingProviderRegistry } from '../../agent/bookingIntelligence'
import { resetDefaultTripManagementService } from '../../agent/tripManagement'
import {
  runFlow1ConversationSearch,
  runFlow2BookingTripDocuments,
  runFlow3SyncRefresh,
  runFlow4Cancellation,
  runFlow7FeatureFlags,
} from '../validation/flows'
import type { ValidationFlowResult } from '../validation/types'
import { enableBetaObservability } from './observability'

export interface BetaSmokeResult {
  ok: boolean
  flows: ValidationFlowResult[]
  flowsPassed: number
  flowsFailed: number
  durationMs: number
  correlationId: string
}

function resetStores(): void {
  resetFeatureRegistry()
  resetDefaultBookingSessionStore()
  resetDefaultBookingExecutionEngine()
  resetDefaultBookingProviderRegistry()
  resetDefaultBookingRecordStore()
  resetBookingDocumentCenter()
  resetDefaultTripManagementService()
}

/** Execute beta smoke: search → recommend → book → trip → docs → cancel → refresh. */
export async function runBetaSmokeTests(): Promise<BetaSmokeResult> {
  const started = Date.now()
  resetStores()
  const obs = enableBetaObservability()
  const t0 = Date.now()

  const flows: ValidationFlowResult[] = []
  try {
    const search = await runFlow1ConversationSearch()
    obs.recordSearchLatency(Date.now() - t0, search.ok)
    flows.push(search)

    const booking = await runFlow2BookingTripDocuments()
    obs.recordBookingSuccess(booking.ok, booking.durationMs)
    flows.push(booking)

    const refresh = await runFlow3SyncRefresh()
    obs.recordTripLifecycle('refresh', refresh.durationMs)
    flows.push(refresh)

    const cancel = await runFlow4Cancellation()
    flows.push(cancel)

    const flags = await runFlow7FeatureFlags()
    flows.push(flags)
  } finally {
    obs.dispose()
  }

  const flowsPassed = flows.filter((f) => f.ok).length
  const flowsFailed = flows.filter((f) => !f.ok).length
  return {
    ok: flowsFailed === 0,
    flows,
    flowsPassed,
    flowsFailed,
    durationMs: Date.now() - started,
    correlationId: obs.correlationId,
  }
}
