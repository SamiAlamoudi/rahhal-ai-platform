import { describe, it, expect } from 'vitest'
import { analyzeRequirements } from '../requirementAnalyzer'
import { createEmptyTravelSession, mergeTravelSession } from '../travelSession'

describe('Scenario 4: Contextual inference', () => {
  it('infers family with high confidence from "أنا وزوجتي وطفلين"', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), 'أنا وزوجتي وطفلين')
    const profile = analyzeRequirements(session, 'أنا وزوجتي وطفلين')
    expect(profile.travelerType).toBe('family-with-kids')
    expect(profile.confidence.travelerType).toBe('high')
  })

  it('infers couple with medium confidence from "أنا وزوجتي"', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), 'أنا وزوجتي')
    const profile = analyzeRequirements(session, 'أنا وزوجتي')
    expect(profile.travelerType).toBe('couple')
  })

  it('does NOT infer honeymoon from couple text', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), 'أنا وزوجتي')
    const profile = analyzeRequirements(session, 'أنا وزوجتي')
    expect(profile.travelPurpose).not.toBe('honeymoon')
  })

  it('infers business from "مؤتمر في دبي"', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), 'مؤتمر في دبي')
    const profile = analyzeRequirements(session, 'مؤتمر في دبي')
    expect(profile.travelPurpose).toBe('business')
  })

  it('infers religious from "أداء العمرة"', () => {
    const session = mergeTravelSession(createEmptyTravelSession(), 'أداء العمرة')
    const profile = analyzeRequirements(session, 'أداء العمرة')
    expect(profile.travelPurpose).toBe('religious')
  })
})
