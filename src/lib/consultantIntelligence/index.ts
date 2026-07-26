export type { ConsultantLocale, DiscoveryInference, EmpathyCue } from './types'
export { inferDiscoveryFromText } from './discovery'
export { detectEmpathyCue, empathyLine } from './empathy'
export { buildProactiveConsultantTips } from './proactive'
export {
  CONSULTANT_BANNED_AR,
  CONSULTANT_BANNED_EN,
  CONSULTANT_PERSONALITY_RULES,
  consultantAck,
  memoryReflectLine,
} from './personality'

import type { AgentLocale } from '../agent/types'
import { detectEmpathyCue, empathyLine } from './empathy'
import { buildProactiveConsultantTips } from './proactive'
import { inferDiscoveryFromText } from './discovery'

/** Build recommendation / tip lines for TravelFacts (shared by text + voice). */
export function buildConsultantFactNotes(input: {
  locale: AgentLocale
  userText: string
  destination?: string | null
  destinationCity?: string | null
  startDate?: string | null
  durationDays?: number | null
  travelerType?: string | null
  tripPurpose?: string | null
  budgetAmount?: number | null
  budgetStyle?: string | null
  interests?: string[]
  softMustHaves?: string[]
  softDealBreakers?: string[]
}): string[] {
  const discovery = inferDiscoveryFromText(input.userText)
  const mustHaves = unique([
    ...(input.softMustHaves ?? []),
    ...discovery.mustHaves,
  ])
  const dealBreakers = unique([
    ...(input.softDealBreakers ?? []),
    ...discovery.dealBreakers,
  ])
  const cue = detectEmpathyCue({
    userText: input.userText,
    tripPurpose: input.tripPurpose ?? discovery.tripPurpose,
    travelerType: input.travelerType,
    budgetAmount: input.budgetAmount,
    budgetStyle: input.budgetStyle,
    interests: input.interests,
    softMustHaves: mustHaves,
    softDealBreakers: dealBreakers,
  })
  const notes: string[] = []
  const empathy = empathyLine(cue, input.locale)
  if (empathy) notes.push(empathy)
  notes.push(...buildProactiveConsultantTips({
    locale: input.locale,
    destination: input.destination,
    destinationCity: input.destinationCity,
    startDate: input.startDate,
    durationDays: input.durationDays,
    travelerType: input.travelerType,
    tripPurpose: input.tripPurpose ?? discovery.tripPurpose,
    dealBreakers,
    mustHaves,
  }))
  return notes.slice(0, 3)
}

function unique(values: string[]): string[] {
  const out: string[] = []
  for (const value of values) {
    if (value && !out.includes(value)) out.push(value)
  }
  return out
}
