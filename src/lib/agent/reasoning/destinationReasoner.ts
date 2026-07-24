/**
 * Evolution Sprint 1 — DestinationReasoner
 * Directional fit only — no destination API / catalog booking calls.
 * May reference well-known place names from traveler text as labels only.
 */

import { analyzeConstraints } from './constraintAnalyzer'
import { analyzeTravelerIntent } from './travelerIntentAnalyzer'
import { buildTravelerProfile } from './travelerProfileBuilder'
import {
  clamp01,
  clampScore,
  emptySlice,
  type ConsultantReasoningInput,
  type DestinationReasonerResult,
} from './consultantTypes'

/** Directional alternatives by purpose — static consultant knowledge, not live inventory. */
const PURPOSE_DIRECTIONS: Record<string, string[]> = {
  honeymoon: ['Maldives', 'Santorini', 'Bali'],
  family: ['Istanbul', 'Dubai', 'Kuala Lumpur'],
  business: ['Dubai', 'London', 'Riyadh staycation'],
  adventure: ['Georgia', 'Nepal', 'Jordan'],
  recovery: ['Maldives', 'Bodrum', 'Baku'],
  cultural: ['Istanbul', 'Cairo', 'Rome'],
  leisure: ['Istanbul', 'Baku', 'Batumi'],
  unknown: ['Istanbul', 'Dubai', 'Baku'],
}

function looksOpenEnded(text: string, stated: string | null): boolean {
  if (stated) return false
  return /where should|suggest|recommend|ideas|وين|اقترح|مو محددة|any destination/i.test(text)
}

export function reasonAboutDestination(input: ConsultantReasoningInput): DestinationReasonerResult {
  const intent = analyzeTravelerIntent(input)
  const profile = buildTravelerProfile(input)
  const constraints = analyzeConstraints(input)
  const stated = input.known?.destination?.trim() || null
  const openEnded = looksOpenEnded(input.userText, stated)
  const purpose = profile.profile.purpose

  const suitabilityNotes: string[] = []
  const whyNotNotes: string[] = []
  const alternativesToConsider = PURPOSE_DIRECTIONS[purpose] ?? PURPOSE_DIRECTIONS.unknown

  if (stated) {
    suitabilityNotes.push(`Traveler named "${stated}" — treat as primary direction unless contradicted.`)
    if (profile.profile.riskTolerance === 'low' && /nepal|remote|jungle/i.test(stated)) {
      whyNotNotes.push('Named destination may conflict with low risk preference — verify comfort with logistics.')
    }
    if (profile.profile.purpose === 'family' && /party|nightlife only/i.test(stated)) {
      whyNotNotes.push('Nightlife-heavy framing may not fit a family purpose.')
    }
  } else if (openEnded) {
    suitabilityNotes.push('Open-ended discovery — propose directions aligned to purpose before locking a city.')
    suitabilityNotes.push(`Purpose "${purpose}" suggests considering: ${alternativesToConsider.slice(0, 3).join(', ')}.`)
  } else {
    suitabilityNotes.push('No destination stated yet — avoid inventing a locked city.')
    whyNotNotes.push('Cannot score a specific destination without a name or discovery brief.')
  }

  if (constraints.constraints.flexibleDimensions.includes('destination')) {
    suitabilityNotes.push('Traveler signaled destination flexibility — keep alternatives visible.')
  }

  const missingInformation: string[] = []
  if (!stated && !openEnded) missingInformation.push('destination')
  if (openEnded && purpose === 'unknown') missingInformation.push('trip_purpose_for_destination_fit')

  let confidence = stated ? 0.75 : openEnded ? 0.65 : 0.4
  if (purpose !== 'unknown') confidence += 0.1
  if (whyNotNotes.length) confidence -= 0.05

  const reasoning = [
    'Destination reasoning is directional only (no live availability).',
    ...suitabilityNotes.slice(0, 3),
  ]

  return {
    ...emptySlice({
      confidence: clamp01(confidence),
      reasoning,
      tradeoffs: [
        stated
          ? 'Locking early to a named city speeds planning but may miss better-fit alternatives.'
          : 'Keeping destination open maximizes fit but delays concrete itinerary.',
      ],
      assumptions: [
        'Place names are labels from traveler text or purpose heuristics — not live supplier inventory.',
      ],
      missingInformation,
      recommendationScore: clampScore(stated ? 70 : openEnded ? 60 : 30),
    }),
    destinationFit: {
      statedDestination: stated,
      openEnded,
      suitabilityNotes,
      whyNotNotes,
      alternativesToConsider: openEnded || whyNotNotes.length ? alternativesToConsider.slice(0, 3) : [],
    },
  }
}

export const DestinationReasoner = { reason: reasonAboutDestination }
