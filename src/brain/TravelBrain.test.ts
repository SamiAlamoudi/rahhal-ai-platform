import { describe, expect, it } from 'vitest'
import { createTravelBrain } from './TravelBrain'

describe('TravelBrain facade', () => {
  it('runs a foundation turn with mocks only', async () => {
    const brain = createTravelBrain()
    await brain.begin('u-brain', 'en')
    const result = brain.handleUserText('Book a flight from Riyadh to Istanbul budget 5000 SAR')
    expect(result.intentId).toBe('book_flight')
    expect(result.toolId).toBe('search_flights_mock')
    expect(result.decisionAction).toBe('route_tool')
    expect(result.reply.length).toBeGreaterThan(10)
    expect(result.feasible).toBe(true)

    const clarify = brain.handleUserText('hello there xyz')
    expect(['clarify', 'refuse_politely', 'advise', 'route_tool']).toContain(clarify.decisionAction)

    const blocked = brain.handleUserText('Book a flight from Dubai to Dubai')
    expect(blocked.decisionAction).toBe('refuse_politely')
  })

  it('uses planner pricing timeline modules', async () => {
    const brain = createTravelBrain()
    await brain.begin('u2', 'ar')
    brain.handleUserText('باقة إلى دبي')
    const draft = brain.conversation.getTravelSession()?.draft ?? { destination: 'Dubai' }
    const plan = brain.planner.plan(draft)
    const timeline = brain.timeline.build(plan, '2026-11-01')
    const price = brain.pricing.estimate(draft)
    expect(timeline.length).toBeGreaterThan(0)
    expect(price.mid).toBeGreaterThan(0)
    expect(brain.tools.route('weather').execute).toBe(false)
  })
})

describe('brain public barrel', () => {
  it('re-exports foundation symbols', async () => {
    const mod = await import('./index')
    expect(mod.createTravelBrain).toBeTypeOf('function')
    expect(mod.TRAVEL_INTENT_IDS.length).toBeGreaterThan(10)
    expect(mod.MOCK_FLIGHTS.length).toBeGreaterThan(0)
  })
})
