import { describe, expect, it } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import { mergeRequirements } from '../agent/memory'
import { emptyRequirements } from '../agent/types'
import {
  buildDestinationTelemetry,
  destinationFromTranscript,
  destinationsConflict,
  resolveDestinationIdentity,
} from '../agent/destinationIdentity'
import { buildFlightSearchRequest, buildHotelSearchRequest } from '../agent/tools/searchEngineBridge'
import type { AgentToolContext } from '../agent/tools/types'

describe('destination integrity pipeline', () => {
  it('Riyadh to Tokyo → Tokyo, Japan only', () => {
    const r = extractFromUserText('Riyadh to Tokyo, 3 Aug to 13 Aug, two passengers, Business.')
    expect(r.patch.origin).toBe('Riyadh')
    expect(r.patch.destination).toBe('Tokyo')
    expect(r.patch.destinations).toEqual(['Tokyo'])
    expect(r.patch.destinationCity).toBe('Tokyo')
    expect(r.patch.destinationCountry).toBe('Japan')
    expect(r.patch.destinations).not.toContain('Jordan')
    expect(r.patch.destinations).not.toContain('الأردن')
  })

  it('I want to travel to Tokyo → Tokyo, Japan only', () => {
    const r = extractFromUserText('I want to travel to Tokyo')
    expect(r.patch.destination).toBe('Tokyo')
    expect(r.patch.destinationCity).toBe('Tokyo')
    expect(r.patch.destinationCountry).toBe('Japan')
  })

  it('Arabic طوكيو → Tokyo, Japan; acceptance utterance is search-ready', () => {
    const r = extractFromUserText(
      'أريد السفر من الرياض إلى طوكيو من 3 أغسطس إلى 13 أغسطس لشخصين درجة رجال الأعمال.',
    )
    expect(r.patch.origin).toBe('Riyadh')
    expect(r.patch.destination).toBe('Tokyo')
    expect(r.patch.destinationCity).toBe('Tokyo')
    expect(r.patch.destinationCountry).toBe('Japan')
    expect(r.patch.travelers).toBe(2)
    expect(r.patch.cabinPreference).toBe('business')
    expect(r.patch.startDate).toMatch(/-08-03$/)
    expect(r.patch.endDate).toMatch(/-08-13$/)
    expect(JSON.stringify(r.patch)).not.toMatch(/Jordan|الأردن|Amman|Dubai/i)
  })

  it('previous session Jordan, new turn Tokyo → Tokyo overrides Jordan', () => {
    const base = {
      ...emptyRequirements(),
      destination: 'الأردن',
      destinations: ['الأردن'],
      destinationCity: null,
      destinationCountry: 'Jordan',
    }
    const patch = extractFromUserText('أريد السفر إلى طوكيو').patch
    const merged = mergeRequirements(base, patch, {
      replaceDestinations: true,
    })
    expect(merged.destination).toBe('Tokyo')
    expect(merged.destinations).toEqual(['Tokyo'])
    expect(merged.destinationCity).toBe('Tokyo')
    expect(merged.destinationCountry).toBe('Japan')
    expect(merged.destinations).not.toContain('الأردن')
  })

  it('no destination → extract invents nothing (never Jordan)', () => {
    const r = extractFromUserText('مرحبا')
    expect(r.patch.destination).toBeUndefined()
    expect(r.patch.destinations).toBeUndefined()
    expect(destinationFromTranscript('مرحبا')).toBeNull()
  })

  it('search payload uses the same Tokyo identity (not Jordan/DXB)', () => {
    const req = {
      ...emptyRequirements(),
      origin: 'Riyadh',
      destination: 'Tokyo',
      destinations: ['Tokyo'],
      destinationCity: 'Tokyo',
      destinationCountry: 'Japan',
      startDate: '2026-08-03',
      endDate: '2026-08-13',
      travelers: 2,
      cabinPreference: 'business',
    }
    const ctx = {
      requirements: req,
      input: {},
      locale: 'ar',
      conversationId: 'dest-integrity',
    } as unknown as AgentToolContext
    const flight = buildFlightSearchRequest(ctx)
    const hotel = buildHotelSearchRequest(ctx)
    expect(flight.destination).toBe('HND')
    expect(hotel.city).toBe('Tokyo')
    expect(hotel.destination).toBe('Tokyo')
    expect(flight.destination).not.toBe('DXB')
    expect(hotel.city).not.toMatch(/Dubai|Jordan|Amman/i)
  })

  it('conflict detector catches Tokyo ASR vs Jordan search', () => {
    const transcript = resolveDestinationIdentity('Tokyo')
    const search = resolveDestinationIdentity('Jordan')
    expect(destinationsConflict(transcript, search)).toBe(true)
    expect(destinationsConflict(
      resolveDestinationIdentity('Tokyo'),
      resolveDestinationIdentity('Tokyo'),
    )).toBe(false)
  })

  it('telemetry fields include all pipeline stages', () => {
    const t = buildDestinationTelemetry({
      transcriptDestination: 'طوكيو',
      extractedDestination: 'Tokyo',
      memoryDestination: 'Tokyo',
      searchPayloadDestination: 'Tokyo',
      renderedDestination: 'طوكيو',
      identity: resolveDestinationIdentity('Tokyo'),
      conflict: false,
    })
    expect(t).toMatchObject({
      transcriptDestination: 'طوكيو',
      extractedDestination: 'Tokyo',
      memoryDestination: 'Tokyo',
      searchPayloadDestination: 'Tokyo',
      renderedDestination: 'طوكيو',
      destinationCity: 'Tokyo',
      destinationCountry: 'Japan',
      conflict: false,
    })
  })
})
