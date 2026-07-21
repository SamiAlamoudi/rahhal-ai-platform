/**
 * Sprint 66 — End-to-End Production Validation integration tests.
 * Reuses existing mocks / simulated providers — no architecture changes.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import {
  resetBookingDocumentCenter,
  resetDefaultBookingExecutionEngine,
  resetDefaultBookingRecordStore,
  resetDefaultBookingSessionStore,
} from '../agent/bookingExecution'
import { resetDefaultBookingProviderRegistry } from '../agent/bookingIntelligence'
import { resetDefaultTripManagementService } from '../agent/tripManagement'
import { setProviderLogSink } from '../agent/liveProviders'
import {
  buildHealthDashboard,
  buildSystemReadinessReport,
  runFlow1ConversationSearch,
  runFlow2BookingTripDocuments,
  runFlow3SyncRefresh,
  runFlow4Cancellation,
  runFlow5MultiBooking,
  runFlow6ProviderFailure,
  runFlow7FeatureFlags,
  runProductionValidation,
  SPRINT66_VALIDATION_VERSION,
} from '../ops'
import { resetOpsMetrics, resetLogger } from '../ops'

describe('Sprint 66 — End-to-End Production Validation', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetDefaultBookingSessionStore()
    resetDefaultBookingExecutionEngine()
    resetDefaultBookingProviderRegistry()
    resetDefaultBookingRecordStore()
    resetBookingDocumentCenter()
    resetDefaultTripManagementService()
    resetOpsMetrics()
    resetLogger()
    setProviderLogSink(null)
  })

  afterEach(() => {
    resetDefaultTripManagementService()
    resetBookingDocumentCenter()
    setProviderLogSink(null)
  })

  it('Flow 1: conversation → search → ranking → recommendation', async () => {
    const result = await runFlow1ConversationSearch()
    expect(result.flowId).toBe('flow1_conversation_search_ranking')
    expect(result.ok).toBe(true)
    expect(result.steps.some((s) => s.id === 'f1.search' && s.status === 'pass')).toBe(true)
    expect(result.steps.some((s) => s.id === 'f1.ranking' && s.status === 'pass')).toBe(true)
    expect(result.steps.some((s) => s.id === 'f1.recommendation' && s.status === 'pass')).toBe(true)
  })

  it('Flow 2: booking execution → trip → documents', async () => {
    const result = await runFlow2BookingTripDocuments()
    expect(result.ok).toBe(true)
    expect(result.artifacts?.tripId).toBeTruthy()
    expect(result.steps.every((s) => s.status === 'pass')).toBe(true)
  })

  it('Flow 3: retrieve → sync → refresh trip/docs', async () => {
    const result = await runFlow3SyncRefresh()
    expect(result.ok).toBe(true)
    expect(result.steps.some((s) => s.id === 'f3.sync' && s.status === 'pass')).toBe(true)
    expect(result.steps.some((s) => s.id === 'f3.refresh_trip' && s.status === 'pass')).toBe(true)
  })

  it('Flow 4: cancellation → provider → trip update', async () => {
    const result = await runFlow4Cancellation()
    expect(result.ok).toBe(true)
    expect(result.steps.some((s) => s.id === 'f4.provider_cancel' && s.status === 'pass')).toBe(true)
    expect(result.steps.some((s) => s.id === 'f4.trip_update' && s.status === 'pass')).toBe(true)
  })

  it('Flow 5: multi-booking trip + timeline consistency', async () => {
    const result = await runFlow5MultiBooking()
    expect(result.ok).toBe(true)
    expect(result.steps.some((s) => s.id === 'f5.timeline' && s.status === 'pass')).toBe(true)
    const domains = result.artifacts?.domains as string[] | undefined
    expect(domains?.length).toBeGreaterThanOrEqual(2)
  })

  it('Flow 6: provider failure → retry → fallback → recovery', async () => {
    const result = await runFlow6ProviderFailure()
    expect(result.ok).toBe(true)
    expect(result.steps.some((s) => s.id === 'f6.retry' && s.status === 'pass')).toBe(true)
    expect(result.steps.some((s) => s.id === 'f6.fallback' && s.status === 'pass')).toBe(true)
  })

  it('Flow 7: feature flag ON/OFF behaviour', async () => {
    const result = await runFlow7FeatureFlags()
    expect(result.ok).toBe(true)
    expect(result.steps.some((s) => s.id === 'f7.toggle' && s.status === 'pass')).toBe(true)
  })

  it('builds health dashboard objects', async () => {
    const flows = [
      await runFlow1ConversationSearch(),
      await runFlow2BookingTripDocuments(),
      await runFlow5MultiBooking(),
      await runFlow6ProviderFailure(),
    ]
    const dashboard = buildHealthDashboard(flows)
    expect(dashboard.conversation.status).toMatch(/healthy|degraded/)
    expect(dashboard.booking.status).toMatch(/healthy|degraded/)
    expect(dashboard.trip.status).toMatch(/healthy|degraded/)
    expect(dashboard.document.component).toBe('document')
    expect(dashboard.provider.component).toBe('provider')
    expect(dashboard.overall.component).toBe('overall')
    expect(dashboard.generatedAt).toBeTruthy()
  })

  it('generates System Readiness Report covering all required sections', async () => {
    const report = await runProductionValidation()
    expect(report.version).toBe(SPRINT66_VALIDATION_VERSION)
    expect(report.flows).toHaveLength(7)
    expect(report.flows.every((f) => f.ok)).toBe(true)
    expect(report.productionValidated).toBe(true)
    const sectionIds = report.sections.map((s) => s.id)
    for (const id of [
      'conversation',
      'search',
      'booking',
      'trips',
      'documents',
      'providers',
      'metrics',
      'security',
      'recovery',
      'feature_flags',
    ]) {
      expect(sectionIds).toContain(id)
    }
    expect(report.dashboard.overall.status).toMatch(/healthy|degraded/)
    expect(report.summary.flowsPassed).toBe(7)
    expect(report.summary.flowsFailed).toBe(0)
    expect(report.summary.totalSteps).toBeGreaterThan(20)
  })

  it('buildSystemReadinessReport aggregates provided flows', async () => {
    const f1 = await runFlow1ConversationSearch()
    const f7 = await runFlow7FeatureFlags()
    const report = buildSystemReadinessReport([f1, f7])
    expect(report.flows).toHaveLength(2)
    expect(report.summary.flowsPassed).toBe(2)
  })
})
