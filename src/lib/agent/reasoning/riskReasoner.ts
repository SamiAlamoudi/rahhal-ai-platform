/**
 * Evolution Sprint 1 — RiskReasoner
 */

import { buildTravelerProfile } from './travelerProfileBuilder'
import { reasonAboutDestination } from './destinationReasoner'
import {
  clamp01,
  clampScore,
  emptySlice,
  type ConsultantReasoningInput,
  type RiskReasonerResult,
} from './consultantTypes'

export function reasonAboutRisk(input: ConsultantReasoningInput): RiskReasonerResult {
  const profile = buildTravelerProfile(input)
  const destination = reasonAboutDestination(input)
  const tolerance = profile.profile.riskTolerance

  const identified: string[] = []
  const mitigations: string[] = []

  if (tolerance === 'low') {
    identified.push('Traveler prefers lower operational/safety friction.')
    mitigations.push('Favor well-served hubs, clearer logistics, and refundable options when planning later.')
  }
  if (tolerance === 'high') {
    identified.push('Traveler may accept higher friction for experience.')
    mitigations.push('Still disclose visa/logistics risks; do not romanticize uncertainty.')
  }
  if (destination.destinationFit.whyNotNotes.length) {
    identified.push(...destination.destinationFit.whyNotNotes)
    mitigations.push('Offer safer alternative directions if risk conflict persists.')
  }
  if (profile.profile.purpose === 'family') {
    identified.push('Family travel raises logistics and pacing risk.')
    mitigations.push('Prefer shorter transfers and clearer daily pace.')
  }
  if (identified.length === 0) {
    identified.push('No explicit risk flags yet — keep standard disclosure later when offers exist.')
    mitigations.push('Do not invent crisis-level risks without evidence.')
  }

  const missingInformation: string[] = []
  if (tolerance === 'unknown') missingInformation.push('risk_tolerance')

  const confidence = clamp01(tolerance === 'unknown' ? 0.5 : 0.72)

  return {
    ...emptySlice({
      confidence,
      reasoning: [
        `Risk tolerance=${tolerance}.`,
        `Identified ${identified.length} risk notes without live advisories API.`,
      ],
      tradeoffs: [
        'Lower risk often means fewer exotic options and sometimes higher cost.',
        'Higher adventure increases experience upside and operational uncertainty.',
      ],
      assumptions: [
        'This layer does not call live travel-advisory APIs — qualitative consultant risk only.',
      ],
      missingInformation,
      recommendationScore: clampScore(tolerance === 'low' ? 70 : tolerance === 'high' ? 60 : 50),
    }),
    risks: {
      tolerance,
      identified,
      mitigations,
    },
  }
}

export const RiskReasoner = { reason: reasonAboutRisk }
