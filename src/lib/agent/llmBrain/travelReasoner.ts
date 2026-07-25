/**
 * Phase 5 — TravelReasoner
 * Consultant-grade reasoning over destination, season, visa, transport, style.
 * Deterministic mock-LLM path (no network). Production APIs disabled.
 */

import type { ConversationIntentKind, LiveTravelMemory } from '../conversationIntelligence'
import type { ArabicDialect, FactCertainty, TravelReasoningResult } from './types'

function coldDestinations(): string[] {
  return ['Georgia', 'Switzerland', 'Japan (Hokkaido)', 'Iceland', 'Turkey (Cappadocia winter)']
}

function looksColdAsk(text: string): boolean {
  return /cold|بارد|ثلج|snow|ودي أغير|أغير\s*ال?جو|اغير\s*ال?جو|أجواء باردة|somewhere cold/i.test(text)
}

function looksJapan(text: string, memory: LiveTravelMemory): boolean {
  const hay = `${text} ${memory.destination ?? ''} ${memory.cities.join(' ')}`
  return /japan|tokyo|osaka|kyoto|اليابان|طوكيو|اوساكا|أبي اليابان|ابغى اليابان/i.test(hay)
}

function monthOf(memory: LiveTravelMemory, text: string): string | null {
  if (memory.monthHint) return memory.monthHint
  if (/october|أكتوبر|اكتوبر|خلها أكتوبر|خلّها أكتوبر/i.test(text)) return 'October'
  if (/march|مارس/i.test(text)) return 'March'
  return null
}

export function reasonAboutTravel(input: {
  userText: string
  memory: LiveTravelMemory
  intent: ConversationIntentKind
  dialect: ArabicDialect
}): TravelReasoningResult {
  const text = input.userText
  const memory = input.memory
  const month = monthOf(memory, text)
  const aspects: TravelReasoningResult['aspects'] = []
  const seasonNotes: string[] = []
  const riskNotes: string[] = []
  const travelerNotes: string[] = []
  const proactiveTips: string[] = []

  let destinationStrategy: string | null = null
  let flightStrategy: string | null = null
  let hotelStrategy: string | null = null

  if (looksColdAsk(text) && !memory.destination) {
    destinationStrategy = `Cold-climate shortlist: ${coldDestinations().slice(0, 3).join(', ')}`
    aspects.push({
      topic: 'destination',
      insight: destinationStrategy,
      certainty: 'estimated',
    })
    seasonNotes.push('Match destination to current/next cold season window.')
    proactiveTips.push('Check school holidays if traveling with children — crowds and fares spike.')
  }

  if (looksJapan(text, memory) || memory.destination === 'Tokyo' || memory.destination === 'Japan') {
    destinationStrategy = destinationStrategy ?? `Japan focus: ${memory.destination ?? 'Japan'}`
    if (month === 'October') {
      seasonNotes.push('October in Japan is excellent for mild weather and autumn colors.')
      seasonNotes.push('Cherry blossoms are not in season in October (spring only).')
      aspects.push({
        topic: 'season',
        insight: 'October = autumn, not sakura',
        certainty: 'known',
      })
    }
    riskNotes.push('Confirm passport validity (≥6 months) before ticketing.')
    riskNotes.push('Visa requirements depend on nationality — do not assume approval.')
    proactiveTips.push('JR Pass may save money for multi-city rail.')
    proactiveTips.push('Typhoon risk is mainly mid-year; October is usually calmer but still check forecasts.')
    flightStrategy = memory.stopoverPreference === 'direct'
      ? 'Prefer nonstop when schedule allows.'
      : 'Compare nonstop vs one-stop if savings are meaningful.'
    hotelStrategy = memory.hotelPreferences.includes('quiet')
      ? 'Quiet hotels near transit.'
      : 'Prioritize location near metro for first-time visitors.'
  }

  if (memory.purpose === 'family') {
    travelerNotes.push('Family pace: shorter transfer days, family-friendly hotels.')
    proactiveTips.push('Family hotels near metro reduce taxi fatigue.')
  }
  if (memory.purpose === 'honeymoon') {
    travelerNotes.push('Honeymoon: quieter stays, memorable dining.')
  }
  if (memory.purpose === 'business') {
    travelerNotes.push('Business: prefer direct flights and central hotels.')
    flightStrategy = flightStrategy ?? 'Bias toward direct / reliable connections.'
  }
  if (memory.purpose === 'luxury' || memory.purpose === 'adventure') {
    travelerNotes.push(`Travel style: ${memory.purpose}.`)
  }

  if (memory.budgetAmount != null) {
    aspects.push({
      topic: 'budget',
      insight: `Budget ceiling ~${memory.budgetAmount} ${memory.currency ?? 'SAR'}`,
      certainty: 'known',
    })
    if (memory.budgetAmount < 5000) {
      riskNotes.push('Tight budget — prioritize shoulder season and flexible dates.')
    }
  } else if (memory.destination) {
    aspects.push({
      topic: 'budget',
      insight: 'Budget not stated yet',
      certainty: 'unknown',
    })
  }

  if (memory.visaStatus === 'needs_check' || input.intent === 'visa_question') {
    aspects.push({
      topic: 'visa',
      insight: 'Visa status requires verification — never invent approvals',
      certainty: 'unknown',
    })
  }

  if (/مترو|metro|transit|ترانزيت|transit/i.test(text)) {
    flightStrategy = /مو مشكلة|لا مانع|one stop|ترانزيت/i.test(text)
      ? 'One stop is acceptable if it saves money.'
      : flightStrategy
    hotelStrategy = /metro|مترو/i.test(text)
      ? 'Hotel near metro preferred.'
      : hotelStrategy
  }

  if (/business class/i.test(text)) {
    flightStrategy = 'Cabin preference: business class when it fits budget.'
    aspects.push({ topic: 'cabin', insight: 'business class requested', certainty: 'known' })
  }

  // Dialect-aware soft note (not user-facing filler)
  if (input.dialect !== 'unknown' && input.dialect !== 'msa') {
    aspects.push({
      topic: 'language',
      insight: `Traveler dialect cue: ${input.dialect}`,
      certainty: 'estimated' as FactCertainty,
    })
  }

  if (proactiveTips.length === 0 && memory.destination) {
    proactiveTips.push('Confirm public holidays around your dates — museums and transport schedules shift.')
  }

  return {
    destinationStrategy,
    seasonNotes,
    riskNotes: riskNotes.slice(0, 4),
    travelerNotes,
    flightStrategy,
    hotelStrategy,
    aspects,
    proactiveTips: proactiveTips.slice(0, 4),
  }
}

export const TravelReasoner = {
  reason: reasonAboutTravel,
}
