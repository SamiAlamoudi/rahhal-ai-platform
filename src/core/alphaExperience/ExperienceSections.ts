/**
 * Sprint 99 — build / omit experience sections from available data (no placeholders).
 */

import type {
  AlphaExperienceComposeInput,
  TravelerAlternativesSection,
  TravelerConciergeSection,
  TravelerConfidenceSection,
  TravelerExperienceSection,
  TravelerExplanationSection,
  TravelerFlightSection,
  TravelerHotelSection,
  TravelerNextActionSection,
  TravelerPackageSection,
  TravelerPriceSection,
  TravelerSummarySection,
  TravelerTimelineSection,
} from './AlphaExperienceDTO'
import { priorityForSection } from './ExperiencePriority'
import { buildTravelerJourneyTimeline } from './TravelerJourney'

function normText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null
  const t = value.replace(/\s+/g, ' ').trim()
  return t.length > 0 ? t : null
}

export function buildExperienceSections(
  input: AlphaExperienceComposeInput,
): TravelerExperienceSection[] {
  const sections: TravelerExperienceSection[] = []
  const currency = (input.currency || input.packageSelected?.currency || 'SAR').toUpperCase()

  const timeline = buildTravelerJourneyTimeline(input)
  if (timeline) sections.push(timeline)

  const confidence = buildConfidenceSection(input)
  if (confidence) sections.push(confidence)

  const price = buildPriceSection(input, currency)
  if (price) sections.push(price)

  const pkg = buildPackageSection(input)
  if (pkg) sections.push(pkg)

  const flight = buildFlightSection(input)
  if (flight) sections.push(flight)

  const hotel = buildHotelSection(input)
  if (hotel) sections.push(hotel)

  const alternatives = buildAlternativesSection(input)
  if (alternatives) sections.push(alternatives)

  const concierge = buildConciergeSection(input)
  if (concierge) sections.push(concierge)

  const explanation = buildExplanationSection(input)
  if (explanation) sections.push(explanation)

  const summary = buildSummarySection(input)
  if (summary) sections.push(summary)

  const next = buildNextActionSection(input)
  if (next) sections.push(next)

  return sections
}

function buildConfidenceSection(
  input: AlphaExperienceComposeInput,
): TravelerConfidenceSection | null {
  const c = input.concierge?.confidence
  if (c && Number.isFinite(c.score)) {
    return {
      id: 'confidence',
      priority: priorityForSection('confidence'),
      score: c.score,
      level: c.level,
      label: c.label,
      uncertaintyExplanation: c.uncertaintyExplanation ?? null,
    }
  }
  const engine = input.engineConfidence
  if (typeof engine === 'number' && Number.isFinite(engine)) {
    const score = engine > 1 ? engine / 100 : engine
    const level = score >= 0.75 ? 'high' : score >= 0.5 ? 'medium' : 'low'
    return {
      id: 'confidence',
      priority: priorityForSection('confidence'),
      score,
      level,
      label: level === 'high' ? 'High confidence' : level === 'medium' ? 'Medium confidence' : 'Low confidence',
      uncertaintyExplanation: level === 'high'
        ? null
        : 'Some preference or offer signals are still incomplete.',
    }
  }
  return null
}

function buildPriceSection(
  input: AlphaExperienceComposeInput,
  currency: string,
): TravelerPriceSection | null {
  const note = normText(input.priceOpportunity?.note)
  if (!note) return null
  return {
    id: 'price',
    priority: priorityForSection('price'),
    note,
    confidence: input.priceOpportunity?.confidence ?? null,
    currency: input.priceOpportunity?.currency ?? currency,
  }
}

function buildPackageSection(
  input: AlphaExperienceComposeInput,
): TravelerPackageSection | null {
  const p = input.packageSelected
  if (!p?.id) return null
  const title = normText(p.title) ?? normText(p.id)
  if (!title) return null
  return {
    id: 'package',
    priority: priorityForSection('package'),
    packageId: p.id,
    title,
    totalPrice: p.totalPrice ?? null,
    currency: (p.currency || input.currency || 'SAR').toUpperCase(),
    confidence: p.confidence ?? null,
    explanation: normText(p.explanation),
  }
}

function buildFlightSection(
  input: AlphaExperienceComposeInput,
): TravelerFlightSection | null {
  const f = input.flight
  if (!f?.id) return null
  return {
    id: 'flight',
    priority: priorityForSection('flight'),
    flightId: f.id,
    airline: f.airline ?? null,
    origin: f.origin ?? null,
    destination: f.destination ?? null,
    price: f.price ?? null,
    currency: (f.currency || input.currency || 'SAR').toUpperCase(),
    durationMinutes: f.durationMinutes ?? null,
    stops: f.stops ?? null,
  }
}

function buildHotelSection(
  input: AlphaExperienceComposeInput,
): TravelerHotelSection | null {
  const h = input.hotel
  if (!h?.id) return null
  return {
    id: 'hotel',
    priority: priorityForSection('hotel'),
    hotelId: h.id,
    name: h.name ?? null,
    price: h.price ?? null,
    currency: (h.currency || input.currency || 'SAR').toUpperCase(),
    stars: h.stars ?? null,
    rating: h.rating ?? null,
  }
}

function buildAlternativesSection(
  input: AlphaExperienceComposeInput,
): TravelerAlternativesSection | null {
  const items = (input.concierge?.alternatives ?? [])
    .map((a) => ({
      kind: a.kind,
      label: a.label,
      estimatedCost: a.estimatedCost ?? null,
      currency: (a.currency || input.currency || 'SAR').toUpperCase(),
      explanation: a.explanation,
    }))
    .filter((a) => a.label && a.explanation)
  if (items.length === 0) return null
  return {
    id: 'alternatives',
    priority: priorityForSection('alternatives'),
    items,
  }
}

function buildConciergeSection(
  input: AlphaExperienceComposeInput,
): TravelerConciergeSection | null {
  if (!input.concierge?.enabled) return null
  const explanation = normText(input.concierge.explanation)
  const recommendedOption = normText(input.concierge.recommendedOption)
  const suggestionCount = input.concierge.suggestions?.length ?? 0
  if (!explanation && !recommendedOption && suggestionCount === 0) return null
  return {
    id: 'concierge',
    priority: priorityForSection('concierge'),
    explanation,
    recommendedOption,
    suggestionCount,
  }
}

function buildExplanationSection(
  input: AlphaExperienceComposeInput,
): TravelerExplanationSection | null {
  const whyDestination = normText(input.concierge?.whyDestination)
  const whyFlights = normText(input.concierge?.whyFlights)
  const whyHotel = normText(input.concierge?.whyHotel)
  const whyPackage = normText(input.concierge?.whyPackage)
    ?? normText(input.packageSelected?.explanation)
  const whyTiming = normText(input.concierge?.whyTiming)
    ?? normText(input.priceOpportunity?.note)
  const summary = normText(input.concierge?.explanation)
    ?? normText(input.decisionExplanation)
    ?? normText(input.concierge?.summaryText)

  const assembledSummary = summary
    ?? whyDestination
    ?? whyFlights
    ?? whyHotel
    ?? whyPackage
    ?? whyTiming
  if (!assembledSummary) return null

  return {
    id: 'explanation',
    priority: priorityForSection('explanation'),
    whyDestination,
    whyFlights,
    whyHotel,
    whyPackage,
    whyTiming,
    summary: assembledSummary,
  }
}

function buildSummarySection(
  input: AlphaExperienceComposeInput,
): TravelerSummarySection | null {
  const text = normText(input.concierge?.summaryText)
  if (!text) return null
  const reasons = [
    input.concierge?.whyDestination,
    input.concierge?.whyFlights,
    input.concierge?.whyHotel,
  ].map(normText).filter((x): x is string => Boolean(x)).slice(0, 3)

  return {
    id: 'summary',
    priority: priorityForSection('summary'),
    text,
    recommendedOptionLabel: normText(input.concierge?.recommendedOption),
    keyReasons: dedupeStrings(reasons),
  }
}

function buildNextActionSection(
  input: AlphaExperienceComposeInput,
): TravelerNextActionSection | null {
  const action = normText(input.concierge?.nextStep)
  if (!action) return null
  return {
    id: 'next_action',
    priority: priorityForSection('next_action'),
    action,
  }
}

export function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of values) {
    const key = raw.replace(/\s+/g, ' ').trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(raw.replace(/\s+/g, ' ').trim())
  }
  return out
}

/** Re-export timeline builder for ExperienceSections consumers. */
export type { TravelerTimelineSection }
