import { describe, expect, it } from 'vitest'
import { createTravelBrain } from './TravelBrain'
import { processBrainTurn } from './turn'

describe('processBrainTurn', () => {
  it('returns rich trace for UI', async () => {
    const brain = createTravelBrain()
    await brain.begin('turn-user', 'en')
    const trace = brain.processTurn('Book a flight from Riyadh to Dubai budget 3000 SAR')
    expect(trace.intent.id).toBe('book_flight')
    expect(trace.recommendations.flights.length).toBeGreaterThan(0)
    expect(trace.recommendations.activities.length).toBeGreaterThan(0)
    expect(trace.timeline.length).toBeGreaterThan(0)
    expect(trace.reply.length).toBeGreaterThan(0)
    const viaHelper = processBrainTurn(brain, 'Recommend a hotel in Istanbul')
    expect(viaHelper.recommendations.hotels.length).toBeGreaterThan(0)
  })
})
