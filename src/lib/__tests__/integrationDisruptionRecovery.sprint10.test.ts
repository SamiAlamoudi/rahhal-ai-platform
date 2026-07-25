/**
 * Integration Sprint 10 — Live Disruption Recovery tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID,
  INTEGRATION_DISRUPTION_RECOVERY_VERSION,
  FUTURE_LIVE_ALERT_CAPABILITIES,
  analyzeDisruptionImpact,
  createDisruptionEngine,
  createMockLiveDisruptionAlertProvider,
  detectDisruptionKind,
  detectLiveDisruption,
  enrichWithIntegrationDisruptionRecovery,
  isIntegrationDisruptionRecoveryEnabled,
  planRecoveryOptions,
  runDisruptionRecovery,
  scoreRisk,
} from '../agent/integrationDisruptionRecovery'
import { emptyMemory, emptyRequirements, mergeRequirements, withTripPlan } from '../agent'
import { buildTripPlan } from '../agent/buildItinerary'
import type { AgentMemory } from '../agent/types'

function memoryWithTrip(): AgentMemory {
  const requirements = mergeRequirements(emptyRequirements(), {
    origin: 'Riyadh',
    destination: 'Istanbul',
    destinations: ['Istanbul'],
    startDate: '2026-09-01',
    endDate: '2026-09-06',
    durationDays: 5,
    travelers: 2,
    budgetAmount: 8000,
    budgetCurrency: 'SAR',
    budgetStyle: 'midrange',
  })
  const base = emptyMemory('en')
  const plan = buildTripPlan({
    conversationId: 'disruption-recovery-test',
    requirements,
    locale: 'en',
  })
  plan.flights = [{
    from: 'RUH',
    to: 'IST',
    airline: 'TK',
    stops: 0,
    estimatedCost: 2200,
    currency: 'SAR',
    notes: null,
  }]
  plan.accommodations = [{
    name: 'Bosphorus Business Hotel',
    area: 'Sultanahmet',
    category: 'hotel',
    fit: 'Central',
    estimatedNightly: 500,
    currency: 'SAR',
  }]
  return withTripPlan({ ...base, requirements, missingFields: [] }, plan)
}

describe('Integration Sprint 10 — Live Disruption Recovery', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps integration disruption recovery flag OFF by default', () => {
    expect(getFeatureRegistry().isEnabled(INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID)).toBe(false)
    expect(isIntegrationDisruptionRecoveryEnabled()).toBe(false)
    expect(INTEGRATION_DISRUPTION_RECOVERY_VERSION).toMatch(/integration-disruption-recovery/)
  })

  it('returns disabled when flag is OFF', async () => {
    const result = await runDisruptionRecovery({
      memory: memoryWithTrip(),
      userText: 'My flight is delayed.',
    })
    expect(result.enabled).toBe(false)
    expect(result.ok).toBe(false)
  })

  it('detects delay / cancellation / missed connection / hotel / weather kinds', () => {
    expect(detectDisruptionKind('My flight is delayed.')).toBe('flight_delay')
    expect(detectDisruptionKind('My flight was canceled.')).toBe('flight_cancellation')
    expect(detectDisruptionKind('I missed my connection.')).toBe('missed_connection')
    expect(detectDisruptionKind('Gate change to B12')).toBe('gate_change')
    expect(detectDisruptionKind('My hotel canceled.')).toBe('hotel_overbooking')
    expect(detectDisruptionKind('Hotel overbooked us')).toBe('hotel_overbooking')
    expect(detectDisruptionKind('Late check-in after midnight')).toBe('late_check_in')
    expect(detectDisruptionKind('Activity cancelled today')).toBe('activity_cancellation')
    expect(detectDisruptionKind('Storm weather delay')).toBe('weather_disruption')
  })

  it('scores risk low → critical for delays', () => {
    expect(scoreRisk('flight_delay', 30)).toBe('low')
    expect(scoreRisk('flight_delay', 90)).toBe('medium')
    expect(scoreRisk('flight_delay', 200)).toBe('high')
    expect(scoreRisk('flight_delay', 400)).toBe('critical')
    expect(scoreRisk('missed_connection', 150)).toBe('critical')
  })

  it('delay scenario: impact + five recovery strategies', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID, true)
    const result = await runDisruptionRecovery({
      memory: memoryWithTrip(),
      userText: 'My flight is delayed 3 hours.',
      deps: { enabled: true },
    })
    expect(result.ok).toBe(true)
    expect(result.disruption?.kind).toBe('flight_delay')
    expect(result.disruption?.delayMinutes).toBe(180)
    expect(result.impact?.timeline).toBe(true)
    expect(result.impact?.hotel).toBe(true)
    expect(result.impact?.transfers).toBe(true)
    expect(result.plans).toHaveLength(5)
    expect(result.plans.map((p) => p.strategy).sort()).toEqual([
      'best',
      'cheapest',
      'fastest',
      'minimal_disruption',
      'premium',
    ].sort())
    expect(result.primary).toBeTruthy()
    expect(result.replan?.timelineShiftedMinutes).toBe(180)
    expect(result.consultantSummaryEn).toMatch(/delayed|Recommended|recovery/i)
    expect(result.liveAlertsReady).toBe(false)
  })

  it('cancellation scenario: high risk + overnight-aware plans', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID, true)
    const result = await runDisruptionRecovery({
      memory: memoryWithTrip(),
      userText: 'My flight was canceled.',
      deps: { enabled: true },
    })
    expect(result.ok).toBe(true)
    expect(result.disruption?.kind).toBe('flight_cancellation')
    expect(result.risk).toBe('high')
    expect(result.impact?.overnightLikely).toBe(true)
    expect(result.impact?.budget).toBe(true)
    expect(result.primary?.score).toBeGreaterThan(50)
    expect(result.replan?.hotelCheckInAdjusted).toBe(true)
  })

  it('conversational support: what should I do now / hotel canceled', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID, true)
    const engine = createDisruptionEngine({ enabled: true })
    const whatNow = await engine.run({
      memory: memoryWithTrip(),
      userText: 'What should I do now?',
      deps: { enabled: true },
    })
    expect(whatNow.ok).toBe(true)
    expect(whatNow.intent).toBe('what_now')
    expect(whatNow.consultantSummaryEn.length).toBeGreaterThan(20)

    const hotel = await runDisruptionRecovery({
      memory: memoryWithTrip(),
      userText: 'My hotel canceled.',
      deps: { enabled: true },
    })
    expect(hotel.disruption?.kind).toBe('hotel_overbooking')
    expect(hotel.plans.some((p) => p.strategy === 'best')).toBe(true)
  })

  it('recovery quality: best balances; cheapest cheaper; fastest saves more time', () => {
    const disruption = detectLiveDisruption('My flight is delayed 4 hours.')!
    const impact = analyzeDisruptionImpact({ disruption, plan: memoryWithTrip().tripPlan })
    const plans = planRecoveryOptions({ disruption, impact, currency: 'SAR' })
    const by = Object.fromEntries(plans.map((p) => [p.strategy, p]))
    expect(by.cheapest!.extraCost).toBeLessThan(by.premium!.extraCost)
    expect(by.fastest!.timeSavedMinutes).toBeGreaterThan(by.cheapest!.timeSavedMinutes)
    expect(by.best!.score).toBeGreaterThanOrEqual(by.cheapest!.score - 5)
  })

  it('future live alerts stay disabled (provider abstraction ready)', async () => {
    expect(FUTURE_LIVE_ALERT_CAPABILITIES.airlineAlerts).toBe(false)
    expect(FUTURE_LIVE_ALERT_CAPABILITIES.hotelAlerts).toBe(false)
    expect(FUTURE_LIVE_ALERT_CAPABILITIES.weatherAlerts).toBe(false)
    const provider = createMockLiveDisruptionAlertProvider()
    expect(provider.live).toBe(false)
    expect(await provider.poll({})).toEqual([])
  })

  it('soft-enriches trip notes when flag ON', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID, true)
    const memory = memoryWithTrip()
    const enriched = await enrichWithIntegrationDisruptionRecovery({
      memory,
      userText: 'I missed my connection.',
      force: true,
      deps: { enabled: true },
    })
    expect(enriched.disruptionRecovery?.ok).toBe(true)
    expect(enriched.tripPlan?.notes.some((n) => /Disruption recovery|استعادة/i.test(n))).toBe(true)
    expect(enriched.reply).toMatch(/Missed|Recommended|recovery|فوت|استعادة/i)
  })

  it('regression: enrich is a no-op when flag OFF', async () => {
    const memory = memoryWithTrip()
    const enriched = await enrichWithIntegrationDisruptionRecovery({
      memory,
      userText: 'My flight is delayed.',
    })
    expect(enriched.disruptionRecovery).toBeNull()
    expect(enriched.memory).toBe(memory)
  })

  it('performance: recovery path completes under budget', async () => {
    getFeatureRegistry().setEnabled(INTEGRATION_DISRUPTION_RECOVERY_FEATURE_ID, true)
    const started = Date.now()
    for (let i = 0; i < 20; i++) {
      await runDisruptionRecovery({
        memory: memoryWithTrip(),
        userText: i % 2 === 0 ? 'My flight is delayed 2 hours.' : 'I missed my connection.',
        deps: { enabled: true },
      })
    }
    const elapsed = Date.now() - started
    expect(elapsed).toBeLessThan(1500)
  })
})
