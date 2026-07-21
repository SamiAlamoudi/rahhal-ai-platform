/**
 * Sprint 76 — Traveler Personalization Intelligence production tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  createMockTravelerProfileStore,
  emptyTravelerProfile,
  learnListPreference,
  learnSingularPreference,
  parsePreferenceUtterance,
  rankFlightsByPersonalization,
  rankHotelsByPersonalization,
  resetTravelerProfileStore,
  runTravelerPersonalization,
  SPRINT76_TRAVELER_PERSONALIZATION_VERSION,
} from '../agent/travelerPersonalization'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId = 'p76'): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 7)}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-21T00:00:00.000Z',
    updatedAt: '2026-07-21T00:00:00.000Z',
  }
}

describe('Sprint 76 — Traveler Personalization Intelligence', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetTravelerProfileStore()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetTravelerProfileStore()
  })

  it('enables ai.traveler_personalization by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.traveler_personalization')).toBe(true)
    expect(SPRINT76_TRAVELER_PERSONALIZATION_VERSION).toMatch(/personalization/)
  })

  it('creates an empty traveler profile', () => {
    const profile = emptyTravelerProfile('user-1')
    expect(profile.userId).toBe('user-1')
    expect(profile.preferredAirlines).toEqual([])
    expect(profile.loyaltyPrograms).toEqual([])
    expect(profile.version).toBe(1)
  })

  it('parses preference phrases from conversation', () => {
    expect(parsePreferenceUtterance('I always fly Qatar Airways.')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'airline', value: 'Qatar Airways', polarity: 'prefer' }),
      ]),
    )
    expect(parsePreferenceUtterance('I prefer Marriott hotels.')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'hotelChain', value: 'Marriott', polarity: 'prefer' }),
      ]),
    )
    expect(parsePreferenceUtterance('I like window seats.')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'seat', value: 'window' }),
      ]),
    )
    expect(parsePreferenceUtterance('Business class only.')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'cabin', value: 'business' }),
      ]),
    )
    expect(parsePreferenceUtterance('I prefer direct flights.')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'directFlights', value: 'direct' }),
      ]),
    )
    expect(parsePreferenceUtterance('I never stay below 4 stars.')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'hotelStars', numericValue: 4 }),
      ]),
    )
    expect(parsePreferenceUtterance('My wife prefers king beds.')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'roomType', value: 'king' }),
      ]),
    )
    expect(parsePreferenceUtterance('I normally travel for business.')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'tripStyle', value: 'business' }),
      ]),
    )
    expect(parsePreferenceUtterance('I avoid Emirates.')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'airline', value: 'Emirates', polarity: 'avoid' }),
      ]),
    )
  })

  it('learns and grows confidence gradually without immediate overwrite', () => {
    const first = learnListPreference([], 'Qatar Airways', 'prefer', 'preferredAirlines')
    expect(first.event.kind).toBe('created')
    expect(first.list[0]!.confidence).toBeGreaterThan(0)
    expect(first.list[0]!.confidence).toBeLessThan(0.5)

    const second = learnListPreference(first.list, 'Qatar Airways', 'prefer', 'preferredAirlines')
    expect(second.event.kind).toBe('reinforced')
    expect(second.list[0]!.confidence).toBeGreaterThan(first.list[0]!.confidence)

    const cabin1 = learnSingularPreference(null, 'business', 'prefer', 'preferredCabin')
    const cabin2 = learnSingularPreference(cabin1.preference, 'economy', 'prefer', 'preferredCabin')
    expect(cabin2.event.conflict).toBe(true)
    expect(cabin2.preference.value).toBe('business')
    expect(cabin2.preference.confidence).toBeLessThan(cabin1.preference.confidence)
  })

  it('handles conflicting preferences with decay then flip', () => {
    let pref: ReturnType<typeof learnSingularPreference<'business' | 'economy'>>['preference'] =
      learnSingularPreference(null, 'business' as const, 'prefer', 'preferredCabin').preference
    // Decay until flip threshold
    for (let i = 0; i < 8; i += 1) {
      pref = learnSingularPreference(pref, 'economy', 'prefer', 'preferredCabin').preference
    }
    expect(pref.value).toBe('economy')
  })

  it('ranks flights higher when preferred airline matches', () => {
    const store = createMockTravelerProfileStore()
    runTravelerPersonalization({
      userId: 'rank-user',
      userText: 'I always fly Qatar Airways.',
      store,
    })
    const ranked = rankFlightsByPersonalization(
      [
        { id: 'a', title: 'Emirates RUH→DXB', airline: 'Emirates', stops: 0, baseScore: 60 },
        { id: 'b', title: 'Qatar Airways RUH→DOH', airline: 'Qatar Airways', stops: 0, baseScore: 55 },
      ],
      store.get('rank-user'),
    )
    expect(ranked[0]!.id).toBe('b')
    expect(ranked[0]!.delta).toBeGreaterThan(0)
    expect(ranked[0]!.reasons.some((r) => /Qatar/i.test(r))).toBe(true)
  })

  it('ranks hotels higher when preferred chain matches', () => {
    const store = createMockTravelerProfileStore()
    runTravelerPersonalization({
      userId: 'hotel-user',
      userText: 'I prefer Marriott hotels.',
      store,
    })
    const ranked = rankHotelsByPersonalization(
      [
        { id: 'h1', title: 'Hilton Garden', chain: 'Hilton', stars: 4, baseScore: 60 },
        { id: 'h2', title: 'Marriott Marquis', chain: 'Marriott', stars: 4, baseScore: 55 },
      ],
      store.get('hotel-user'),
    )
    expect(ranked[0]!.id).toBe('h2')
    expect(ranked[0]!.personalizedScore).toBeGreaterThan(ranked[1]!.personalizedScore)
  })

  it('persists learning across multiple conversations via mock store', () => {
    const store = createMockTravelerProfileStore()
    runTravelerPersonalization({
      userId: 'multi',
      userText: 'I always fly Qatar Airways.',
      store,
    })
    const again = runTravelerPersonalization({
      userId: 'multi',
      userText: 'I always fly Qatar Airways.',
      store,
    })
    expect(again.profile?.preferredAirlines[0]?.observations).toBeGreaterThanOrEqual(2)
    expect(again.diagnostics.confidenceScores['airline:Qatar Airways']).toBeGreaterThan(0.4)
  })

  it('reports missing profile diagnostics when userId absent', () => {
    const result = runTravelerPersonalization({
      userId: null,
      userText: 'I prefer Marriott hotels.',
    })
    expect(result.diagnostics.missingProfile).toBe(true)
    expect(result.profile).toBeNull()
    expect(result.diagnostics.travelerProfileUsed).toBe(false)
  })

  it('returns ranking adjustments and learning events diagnostics', () => {
    const store = createMockTravelerProfileStore()
    const result = runTravelerPersonalization({
      userId: 'diag',
      userText: 'I prefer Marriott hotels and direct flights.',
      store,
      flightOffers: [
        { id: 'f1', airline: 'Saudia', from: 'RUH', to: 'DXB', stops: 0, price: 1200 },
      ],
      hotelStays: [
        { id: 'h1', name: 'Marriott Downtown', chain: 'Marriott', hotelStars: 5, nightly: 400 },
      ],
    })
    expect(result.diagnostics.learningEvents.length).toBeGreaterThan(0)
    expect(result.diagnostics.matchedPreferences.length).toBeGreaterThan(0)
    expect(result.diagnostics.rankingAdjustments.length).toBeGreaterThan(0)
  })

  it('planTurn attaches travelerPersonalization meta across turns', async () => {
    const agent = createTravelAgentService({
      travelerPersonalizationEnabled: true,
      autonomousAgentEnabled: false,
      bookingIntelligenceEnabled: false,
      budgetIntelligenceEnabled: false,
      bookingExecutionEnabled: false,
      paymentsEnabled: false,
      rahhalBrainEnabled: false,
    })

    const turn1 = await agent.planTurn({
      conversationId: 'p76-meta',
      messages: [msg('I always fly Qatar Airways.', 'p76-meta')],
    })
    expect(turn1.meta.travelerPersonalization?.learningEventCount).toBeGreaterThan(0)
    expect(turn1.meta.travelerPersonalization?.matchedPreferences.some((p) => /Qatar/i.test(p))).toBe(true)

    const turn2 = await agent.planTurn({
      conversationId: 'p76-meta',
      messages: [
        msg('I always fly Qatar Airways.', 'p76-meta'),
        {
          ...msg('Thanks', 'p76-meta'),
          role: 'assistant',
          id: 'a1',
        },
        msg('I prefer Marriott hotels.', 'p76-meta'),
      ],
    })
    expect(turn2.meta.travelerPersonalization?.matchedPreferences.some((p) => /Marriott/i.test(p))).toBe(true)
    const qatarConfidence = turn2.meta.travelerPersonalization?.confidenceScores['airline:Qatar Airways']
    expect(qatarConfidence).toBeGreaterThan(0.3)
  })
})
