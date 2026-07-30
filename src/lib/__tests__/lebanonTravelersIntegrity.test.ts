import { describe, expect, it } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import { resolveAirportCode } from '../agent/airportCodes'
import { mergeRequirements, missingRequirementFields } from '../agent/memory'
import { emptyMemory, emptyRequirements } from '../agent/types'
import {
  bookingFieldsSearchReady,
  buildRequirementsProvenance,
} from '../agent/fieldProvenance'
import { resolveDestinationIdentity } from '../agent/destinationIdentity'
import {
  generateLocalConversation,
  nextHardSlot,
} from '../agent/conversationBrain/localConversationModel'
import { buildTravelFacts } from '../agent/conversationBrain/travelFacts'
import { buildBookingOptionsFromPlan } from '../agent/bookingOptionsFromSearch'
import { selectToolsForTurn } from '../agent/tools/selectTools'
import type { TripPlan } from '../agent/types'

describe('Lebanon + travelers integrity', () => {
  it('لبنان never becomes لبن via IATA slicing', () => {
    expect(resolveAirportCode('لبنان')).toBe('BEY')
    expect(resolveAirportCode('Lebanon')).toBe('BEY')
    expect(resolveAirportCode('بيروت')).toBe('BEY')
    expect(resolveAirportCode('لبنان')).not.toBe('لبن')
    // Unknown Arabic must not be sliced into a fake 3-letter code.
    expect(resolveAirportCode('كازاخستان')).toBe('XXX')
  })

  it('extract keeps لبنان and leaves travelers undefined', () => {
    const r = extractFromUserText('أريد السفر إلى لبنان لمدة أسبوع')
    expect(r.patch.destination).toBe('لبنان')
    expect(r.patch.durationDays).toBe(7)
    expect(r.patch.travelers).toBeUndefined()
    expect(r.patch.travelerType).toBeUndefined()
    expect(resolveDestinationIdentity(r.patch.destination ?? null)?.label).toBe('لبنان')
  })

  it('weekday الاثنين must not invent travelers=2', () => {
    const r = extractFromUserText('أريد السفر يوم الاثنين إلى لبنان لمدة أسبوع')
    expect(r.patch.destination).toBe('لبنان')
    expect(r.patch.travelers).toBeUndefined()
    expect(r.patch.travelerType).toBeUndefined()
  })

  it('explicit لشخصين still extracts 2', () => {
    const r = extractFromUserText('أريد السفر إلى لبنان لمدة أسبوع لشخصين')
    expect(r.patch.destination).toBe('لبنان')
    expect(r.patch.travelers).toBe(2)
  })

  it('stale travelers from a previous trip are cleared on destination change', () => {
    const prior = emptyRequirements()
    prior.destination = 'Tokyo'
    prior.destinations = ['Tokyo']
    prior.travelers = 2
    prior.travelerType = 'couple'
    prior.durationDays = 10

    const extracted = extractFromUserText('أريد السفر إلى لبنان لمدة أسبوع')
    const merged = mergeRequirements(prior, extracted.patch, {
      replaceDestinations: extracted.flags?.replaceDestinations === true,
    })

    expect(merged.destination).toBe('لبنان')
    expect(merged.travelers).toBeNull()
    expect(merged.travelerType).toBeNull()
    expect(merged.durationDays).toBe(7)
    expect(missingRequirementFields(merged)).toContain('travelers')
  })

  it('provenance blocks search until travelers are confirmed', () => {
    const extracted = extractFromUserText('أريد السفر إلى لبنان لمدة أسبوع')
    const merged = mergeRequirements(emptyRequirements(), extracted.patch, {
      replaceDestinations: true,
    })
    const provenance = buildRequirementsProvenance({
      patch: extracted.patch,
      merged,
      prior: null,
      destinationChanged: true,
    })
    expect(provenance.destination?.value).toBe('لبنان')
    expect(provenance.destination?.confirmed).toBe(true)
    expect(provenance.destination?.source).toBe('current_turn')
    expect(provenance.travelers?.value).toBeNull()
    expect(provenance.travelers?.confirmed).toBe(false)
    expect(bookingFieldsSearchReady(provenance).ready).toBe(false)
    expect(bookingFieldsSearchReady(provenance).missing).toContain('travelers')
  })

  it('first reply acknowledges لبنان and asks كم عدد المسافرين؟ without شخصين', () => {
    const memory = emptyMemory('ar')
    memory.requirements.destination = 'لبنان'
    memory.requirements.destinations = ['لبنان']
    memory.requirements.durationDays = 7
    memory.requirements.travelers = null
    memory.missingFields = ['travelers']

    const facts = buildTravelFacts({
      memory,
      objective: 'collect_missing',
      missingSlots: ['travelers'],
      heardSummary: ['أريد السفر إلى لبنان لمدة أسبوع'],
    })
    expect(nextHardSlot(facts)).toBe('travelers')

    const reply = generateLocalConversation({
      facts,
      userMessage: 'أريد السفر إلى لبنان لمدة أسبوع',
      conversationId: 'lebanon-integrity',
    })
    expect(reply.displayText).toMatch(/لبنان/)
    expect(reply.displayText).toMatch(/كم عدد المسافرين؟/)
    expect(reply.displayText).not.toMatch(/شخصين|لشخصين|شريكتكم/)
    expect(reply.spokenText).not.toMatch(/شخصين|لشخصين|شريكتكم/)
    expect(reply.displayText).not.toMatch(/جاهز|الخيارات|بطاقات|دولار|\$/)
  })

  it('selectTools returns no search tools when travelers missing', () => {
    const tools = selectToolsForTurn({
      requirements: {
        ...emptyRequirements(),
        destination: 'لبنان',
        destinations: ['لبنان'],
        durationDays: 7,
        travelers: null,
      },
      intent: 'plan',
      missingFields: ['travelers'],
      searchPlan: null,
    })
    expect(tools).toEqual([])
  })

  it('booking cards never display truncated لبن', () => {
    const budget = {
      currency: 'USD',
      amount: 0,
      breakdown: [] as Array<{ label: string; amount: number }>,
    }
    const plan = {
      id: 'p1',
      title: 'لبنان',
      summary: '',
      locale: 'ar' as const,
      destinations: ['لبنان'],
      startDate: null,
      endDate: null,
      durationDays: 7,
      travelers: null,
      travelerType: null,
      interests: [],
      dailyItinerary: [],
      activities: [],
      transportation: [],
      flights: [{
        id: 'f1',
        from: 'RUH',
        to: 'لبن',
        airline: 'Saudia',
        flightNumber: null,
        stops: 0,
        estimatedCost: 1200,
        currency: 'USD',
        notes: '',
        departureTime: null,
        arrivalTime: null,
        durationMinutes: 200,
        cabin: 'economy',
        provider: 'mock',
        fromProvider: true,
      }],
      accommodations: [],
      attractions: [],
      weatherNotes: [],
      visaNotes: [],
      travelTips: [],
      packingSuggestions: [],
      estimatedBudget: budget,
      estimatedCosts: budget,
      notes: [],
      conversationId: 'c1',
      requirements: {
        ...emptyRequirements(),
        destination: 'لبنان',
        destinations: ['لبنان'],
        durationDays: 7,
        travelers: null,
      },
      updatedAt: new Date().toISOString(),
    } as TripPlan

    const cards = buildBookingOptionsFromPlan(plan)
    expect(cards.length).toBeGreaterThan(0)
    for (const card of cards) {
      if (card.kind === 'flight') {
        expect(card.to).toBe('لبنان')
        expect(card.to).not.toBe('لبن')
      }
    }
  })

  it('no fabricated travelers in extraction patch JSON', () => {
    const extracted = extractFromUserText('أريد السفر إلى لبنان لمدة أسبوع')
    expect(JSON.stringify(extracted.patch)).not.toMatch(/شخصين/)
    expect(extracted.patch.travelers).toBeUndefined()
  })
})
