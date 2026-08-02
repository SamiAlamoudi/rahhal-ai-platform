import { describe, expect, it } from 'vitest'
import { createTravelBrain } from '../brain'
import { emptyPreferenceProfile } from '../brain/preferences/types'
import {
  appendDecision,
  buildConciergeBundle,
  buildExplainedRecommendations,
  buildMemoryFacts,
  buildSmartFollowUps,
  buildTravelDashboard,
  buildTripIntelligence,
  compareDecisions,
  inferMemoryHints,
  inferTravelDna,
  luxuryEmptyFor,
  restoreDecision,
} from './index'

describe('Travel Concierge Intelligence', () => {
  it('infers memory hints from natural language', () => {
    const hints = inferMemoryHints(
      'Business class with spouse and 2 kids, prefer halal food, previously visited Istanbul',
    )
    expect(hints.cabinClass).toBe('business')
    expect(hints.foodPreferences).toContain('halal')
    expect(hints.familyMembers.length).toBeGreaterThan(0)
    expect(hints.favoriteDestinations).toContain('Istanbul')
    expect(hints.previousTrips.length).toBeGreaterThan(0)
  })

  it('builds memory facts for airlines hotels cabin style food budget destinations family trips', () => {
    const prefs = emptyPreferenceProfile()
    prefs.favoriteAirlines = ['Saudia']
    prefs.favoriteHotels = ['Raffles']
    prefs.travelStyle = 'luxury'
    prefs.budgetLevel = 'high'
    const facts = buildMemoryFacts(
      prefs,
      { destination: 'Dubai', budgetAmount: 8000, currency: 'SAR' },
      inferMemoryHints('business class seafood with spouse'),
      'en',
    )
    const kinds = new Set(facts.map((f) => f.kind))
    expect(kinds.has('airline')).toBe(true)
    expect(kinds.has('hotel')).toBe(true)
    expect(kinds.has('cabin')).toBe(true)
    expect(kinds.has('travel_style')).toBe(true)
    expect(kinds.has('food')).toBe(true)
    expect(kinds.has('budget')).toBe(true)
    expect(kinds.has('destination')).toBe(true)
    expect(kinds.has('family')).toBe(true)
  })

  it('explains recommendations with why pros cons confidence alternatives', () => {
    const brain = createTravelBrain()
    const prefs = emptyPreferenceProfile()
    prefs.travelStyle = 'business'
    const draft = {
      origin: 'Riyadh',
      destination: 'Istanbul',
      budgetAmount: 5000,
      currency: 'SAR' as const,
    }
    const bundle = {
      flights: brain.recommendations.rankFlights(draft, prefs, ['business']),
      hotels: brain.recommendations.rankHotels(draft, prefs),
      packages: brain.recommendations.rankPackages(draft, prefs),
      activities: [],
      restaurants: [],
    }
    const explained = buildExplainedRecommendations(bundle, prefs, draft)
    expect(explained.length).toBeGreaterThan(0)
    const first = explained[0]!
    expect(first.why.length).toBeGreaterThan(8)
    expect(first.pros.length).toBeGreaterThan(0)
    expect(first.cons.length).toBeGreaterThan(0)
    expect(first.confidence).toBeGreaterThan(0)
    expect(Array.isArray(first.alternatives)).toBe(true)
  })

  it('builds all 14 trip intelligence sections', () => {
    const sections = buildTripIntelligence({ destination: 'Istanbul', visaCountry: 'TR' }, 'en')
    expect(sections).toHaveLength(14)
    expect(sections.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'best_time',
        'weather',
        'visa',
        'currency',
        'safety',
        'local_tips',
        'dress_code',
        'time_difference',
        'internet',
        'power_adapter',
        'transportation',
        'airport_tips',
        'cultural_etiquette',
        'emergency_numbers',
      ]),
    )
  })

  it('builds premium travel dashboard readiness', () => {
    const dash = buildTravelDashboard(
      { origin: 'Riyadh', destination: 'Dubai', budgetAmount: 4000, hotelClass: 5 },
      emptyPreferenceProfile(),
      true,
      'en',
    )
    expect(dash.tripScore).toBeGreaterThan(0)
    expect(dash.readiness.preparation).toBeGreaterThan(0)
    expect(dash.readiness.flight).toBeGreaterThan(0)
    expect(dash.readiness.hotel).toBeGreaterThan(0)
  })

  it('infers travel DNA traits', () => {
    const prefs = emptyPreferenceProfile()
    prefs.travelStyle = 'luxury'
    prefs.luxuryLevel = 'ultra'
    const dna = inferTravelDna(prefs, { hotelClass: 5 }, ['museum food shopping'], 'en')
    expect(dna.primary).toBe('luxury')
    expect(dna.traits.length).toBeGreaterThan(5)
    expect(dna.summary.length).toBeGreaterThan(5)
  })

  it('asks at most two non-repetitive follow-ups', () => {
    const asked = new Set<string>()
    const first = buildSmartFollowUps({}, emptyPreferenceProfile(), asked, 'en')
    expect(first.length).toBeLessThanOrEqual(2)
    for (const q of first) asked.add(q.key)
    const second = buildSmartFollowUps({}, emptyPreferenceProfile(), asked, 'en')
    for (const q of second) {
      expect(asked.has(q.key)).toBe(false)
    }
  })

  it('supports decision timeline restore and compare', async () => {
    const brain = createTravelBrain()
    await brain.begin('c-test', 'en')
    const t1 = brain.processTurn('Book a flight from Riyadh to Istanbul budget 5000 SAR', 'en')
    let history = appendDecision([], t1, 'en')
    const t2 = brain.processTurn('Prefer business class quiet hotel', 'en')
    history = appendDecision(history, t2, 'en')
    expect(history[0]?.status).toBe('active')
    const older = history[1]!
    history = restoreDecision(history, older.id)
    expect(history.find((h) => h.id === older.id)?.status).toBe('restored')
    const cmp = compareDecisions(history, history[0]!.id, history[1]!.id)
    expect(cmp.a).toBeTruthy()
    expect(cmp.b).toBeTruthy()
  })

  it('luxury empty states have premium copy', () => {
    const copy = luxuryEmptyFor('chat', 'en')
    expect(copy.title).toBeTruthy()
    expect(copy.body).toBeTruthy()
    expect(copy.illustration).toBe('horizon')
  })

  it('buildConciergeBundle assembles full intelligence package', async () => {
    const brain = createTravelBrain()
    await brain.begin('c2', 'en')
    const trace = brain.processTurn(
      'Book a flight from Riyadh to Istanbul budget 5000 SAR business class',
      'en',
    )
    const bundle = buildConciergeBundle({
      draft: trace.draft,
      preferences: trace.preferences,
      recommendations: trace.recommendations,
      trace,
      recentTexts: [trace.userText],
      locale: 'en',
    })
    expect(bundle.memoryFacts.length).toBeGreaterThan(0)
    expect(bundle.recommendations.length).toBeGreaterThan(0)
    expect(bundle.decisionTimeline.length).toBeGreaterThan(0)
    expect(bundle.tripIntel).toHaveLength(14)
    expect(bundle.dashboard.tripScore).toBeGreaterThanOrEqual(0)
    expect(bundle.dna.traits.length).toBeGreaterThan(0)
    expect(bundle.emptyInspiration.title).toBeTruthy()
  })
})
