import { describe, expect, it } from 'vitest'
import { DecisionEngine } from './DecisionEngine'

describe('DecisionEngine', () => {
  const eng = new DecisionEngine()

  it('refuses on safety block', () => {
    const d = eng.decide({
      intentId: 'book_flight',
      intentConfidence: 0.9,
      safety: {
        status: 'block',
        code: 'impossible_itinerary',
        message: 'no',
        missingFields: [],
      },
      reasoner: { overallFeasible: false, findings: [] },
    })
    expect(d.action).toBe('refuse_politely')
    expect(d.toolRoute).toBeNull()
  })

  it('clarifies on low confidence or safety clarify', () => {
    const d = eng.decide({
      intentId: 'unknown',
      intentConfidence: 0.2,
      safety: { status: 'clarify', message: '?', missingFields: ['destination'] },
      reasoner: { overallFeasible: true, findings: [] },
    })
    expect(d.action).toBe('clarify')
    expect(d.toolRoute?.toolId).toBe('clarify_user')
  })

  it('advises when booking not feasible', () => {
    const d = eng.decide({
      intentId: 'book_hotel',
      intentConfidence: 0.9,
      safety: { status: 'ok', message: 'ok', missingFields: [] },
      reasoner: { overallFeasible: false, findings: [] },
    })
    expect(d.action).toBe('advise')
  })

  it('routes tool when safe and feasible', () => {
    const d = eng.decide({
      intentId: 'book_flight',
      intentConfidence: 0.9,
      safety: { status: 'ok', message: 'ok', missingFields: [] },
      reasoner: { overallFeasible: true, findings: [] },
    })
    expect(d.action).toBe('route_tool')
    expect(d.toolRoute?.toolId).toBe('search_flights_mock')
    expect(d.toolRoute?.execute).toBe(false)
  })
})
