/**
 * Real-iPhone Lebanon booking spine — acceptance A → B → C.
 * Cloud tests validate extraction/provenance/gates; success requires device QA.
 */
import { describe, expect, it } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import { resolveAirportCode } from '../agent/airportCodes'
import { mergeRequirements, missingRequirementFields } from '../agent/memory'
import { emptyMemory, emptyRequirements } from '../agent/types'
import {
  bookingFieldsSearchReady,
  buildRequirementsProvenance,
  nextBookingMissingField,
} from '../agent/fieldProvenance'
import {
  generateLocalConversation,
  nextHardSlot,
} from '../agent/conversationBrain/localConversationModel'
import { buildTravelFacts } from '../agent/conversationBrain/travelFacts'
import { selectToolsForTurn } from '../agent/tools/selectTools'

describe('Lebanon booking flow acceptance A→B→C', () => {
  it('Test A: لبنان + أسبوع → ask travelers only, no cards / no شخصين', () => {
    const extracted = extractFromUserText('أريد السفر إلى لبنان لمدة أسبوع')
    expect(extracted.patch.destination).toBe('لبنان')
    expect(extracted.patch.durationDays).toBe(7)
    expect(extracted.patch.travelers).toBeUndefined()
    expect(resolveAirportCode('لبنان')).toBe('BEY')
    expect(resolveAirportCode('لبنان')).not.toBe('لبن')

    const merged = mergeRequirements(emptyRequirements(), extracted.patch, {
      replaceDestinations: true,
    })
    const provenance = buildRequirementsProvenance({
      patch: extracted.patch,
      merged,
      prior: null,
      destinationChanged: true,
    })

    expect(provenance.destination).toMatchObject({
      value: 'لبنان',
      source: 'current_turn',
      confirmed: true,
      currentTurnPriority: true,
    })
    expect(provenance.travelers).toMatchObject({
      value: null,
      confirmed: false,
    })
    expect(bookingFieldsSearchReady(provenance).ready).toBe(false)
    expect(nextBookingMissingField(provenance, merged)).toBe('travelers')

    const memory = emptyMemory('ar')
    memory.requirements = merged
    memory.fieldProvenance = provenance
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
      conversationId: 'lebanon-a',
    })
    expect(reply.displayText).toBe(
      'فهمت أنك تريد السفر إلى لبنان لمدة أسبوع. كم عدد المسافرين؟',
    )
    expect(reply.displayText).not.toMatch(/شخصين|لبن[^ا]|فندق|حي |دولار|جاهز|بطاقات/)
    expect(selectToolsForTurn({
      requirements: merged,
      intent: 'plan',
      missingFields: ['travelers'],
    })).toEqual([])
  })

  it('Test B: شخص واحد → travelers=1, ask dates next, never reuse 2', () => {
    const priorTokyo = emptyRequirements()
    priorTokyo.destination = 'Tokyo'
    priorTokyo.destinations = ['Tokyo']
    priorTokyo.travelers = 2
    priorTokyo.travelerType = 'couple'
    priorTokyo.cabinPreference = 'business'
    priorTokyo.startDate = '2026-08-03'
    priorTokyo.endDate = '2026-08-13'

    // Fresh Lebanon turn must wipe Tokyo travelers/dates/cabin.
    const turnA = extractFromUserText('أريد السفر إلى لبنان لمدة أسبوع')
    let merged = mergeRequirements(priorTokyo, turnA.patch, {
      replaceDestinations: true,
    })
    expect(merged.destination).toBe('لبنان')
    expect(merged.travelers).toBeNull()
    expect(merged.cabinPreference).toBeNull()
    expect(merged.startDate).toBeNull()

    const turnB = extractFromUserText('شخص واحد')
    expect(turnB.patch.travelers).toBe(1)
    expect(turnB.patch.travelerType).toBe('solo')

    merged = mergeRequirements(merged, turnB.patch)
    let provenance = buildRequirementsProvenance({
      patch: turnB.patch,
      merged,
      prior: buildRequirementsProvenance({
        patch: turnA.patch,
        merged: mergeRequirements(emptyRequirements(), turnA.patch, { replaceDestinations: true }),
        prior: null,
        destinationChanged: true,
      }),
      destinationChanged: false,
    })

    expect(merged.travelers).toBe(1)
    expect(merged.travelers).not.toBe(2)
    expect(provenance.travelers).toMatchObject({
      value: 1,
      source: 'current_turn',
      confirmed: true,
      currentTurnPriority: true,
    })
    expect(bookingFieldsSearchReady(provenance).ready).toBe(false)
    expect(nextBookingMissingField(provenance, merged)).toBe('startDate')

    const memory = emptyMemory('ar')
    memory.requirements = merged
    memory.fieldProvenance = provenance
    memory.missingFields = ['startDate']
    const facts = buildTravelFacts({
      memory,
      objective: 'collect_missing',
      missingSlots: ['startDate'],
      heardSummary: ['شخص واحد'],
    })
    expect(nextHardSlot(facts)).toBe('startDate')
    const reply = generateLocalConversation({
      facts,
      userMessage: 'شخص واحد',
      conversationId: 'lebanon-b',
    })
    expect(reply.displayText).toMatch(/تاريخ|مغادرة|عودة/)
    expect(reply.displayText).not.toMatch(/شخصين|لشخصين|Tokyo|Jordan|Dubai|طوكيو/)
    expect(selectToolsForTurn({
      requirements: merged,
      intent: 'plan',
      missingFields: ['startDate'],
    })).toEqual([])
  })

  it('Test C: من 3 أغسطس إلى 10 أغسطس preserves dates + لبنان + travelers=1', () => {
    let merged = mergeRequirements(emptyRequirements(), extractFromUserText('أريد السفر إلى لبنان لمدة أسبوع').patch, {
      replaceDestinations: true,
    })
    merged = mergeRequirements(merged, extractFromUserText('شخص واحد').patch)
    const turnC = extractFromUserText('من 3 أغسطس إلى 10 أغسطس')
    // Year rolls forward once Aug 3 of the current year is in the past.
    expect(turnC.patch.startDate).toMatch(/^\d{4}-08-03$/)
    expect(turnC.patch.endDate).toMatch(/^\d{4}-08-10$/)
    const startDate = turnC.patch.startDate!
    const endDate = turnC.patch.endDate!

    merged = mergeRequirements(merged, turnC.patch)
    const provenance = buildRequirementsProvenance({
      patch: turnC.patch,
      merged,
      prior: null,
      destinationChanged: false,
    })

    expect(merged.destination).toBe('لبنان')
    expect(merged.travelers).toBe(1)
    expect(merged.startDate).toBe(startDate)
    expect(merged.endDate).toBe(endDate)
    expect(merged.destinations.join(' ')).not.toMatch(/Tokyo|Jordan|Dubai|طوكيو|الأردن|دبي/i)
    expect(provenance.startDate).toMatchObject({
      value: startDate,
      source: 'current_turn',
      confirmed: true,
      currentTurnPriority: true,
    })
    expect(provenance.endDate).toMatchObject({
      value: endDate,
      source: 'current_turn',
      confirmed: true,
      currentTurnPriority: true,
    })
    // Origin still missing → no cards yet.
    expect(bookingFieldsSearchReady(provenance).ready).toBe(false)
    expect(nextBookingMissingField(provenance, merged)).toBe('origin')
    expect(missingRequirementFields(merged)).not.toContain('destination')
  })

  it('regression: الاثنين never becomes travelers=2; لبنان never لبن', () => {
    const r = extractFromUserText('أريد السفر يوم الاثنين إلى لبنان لمدة أسبوع')
    expect(r.patch.destination).toBe('لبنان')
    expect(r.patch.travelers).toBeUndefined()
    expect(resolveAirportCode(r.patch.destination!)).toBe('BEY')
    expect(resolveAirportCode('لبنان')).not.toEqual('لبن')
  })

  it('regression: stale travelers from previous trip never survive destination change', () => {
    const prior = emptyRequirements()
    prior.destination = 'Tokyo'
    prior.travelers = 2
    prior.travelerType = 'couple'
    const extracted = extractFromUserText('أريد السفر إلى لبنان لمدة أسبوع')
    const merged = mergeRequirements(prior, extracted.patch, { replaceDestinations: true })
    expect(merged.travelers).toBeNull()
    expect(merged.destination).toBe('لبنان')
  })
})
