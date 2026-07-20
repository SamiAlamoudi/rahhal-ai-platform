/**
 * Phase 2 — Executive Context Builder.
 * Unifies memory, preferences, and conversation signals into one decision context.
 */

import type { PersonalizationProfile } from '../../ai/preferences/types'
import type { AgentMemory } from '../../agent/types'
import type {
  BrainIntentResult,
  ConversationUnderstanding,
} from '../core/types'
import type { ExecutiveContext, ExecutiveTravelStyle } from './types'
import { detectOptimizationAxis } from './discoveryOptimizer'

export function buildExecutiveContext(input: {
  memory: AgentMemory
  understanding: ConversationUnderstanding
  intents: BrainIntentResult
  profile: PersonalizationProfile
  userText: string
}): ExecutiveContext {
  const req = input.memory.requirements
  const profile = input.profile
  const optimizationAxis = detectOptimizationAxis(input.userText, input.memory.locale)

  const budgetSensitivity: ExecutiveContext['budgetSensitivity'] =
    req.budgetFlexible === true || profile.budget.flexibility === 'open'
      ? 'open'
      : req.budgetFlexible === false || profile.budget.flexibility === 'strict'
        ? 'strict'
        : 'flexible'

  return {
    locale: input.memory.locale,
    travelStyle: inferTravelStyle(input.intents, profile, input.understanding),
    budgetSensitivity,
    rejectedDestinations: [...profile.travelStyle.rejectedDestinations],
    favoriteDestinations: [...profile.travelStyle.favoriteDestinations],
    optimizationAxis,
    urgency: /\b(?:urgent|asap|tomorrow|غداً|غدا|عاجل|بسرعة)\b/i.test(input.userText),
    luxuryPreference:
      profile.budget.style === 'luxury'
      || req.budgetStyle === 'luxury'
      || input.intents.primary.id === 'luxury_travel',
    familyTravel:
      req.travelerType === 'family'
      || input.intents.primary.id === 'family_travel'
      || input.intents.secondary.some((row) => row.id === 'family_travel'),
    businessTravel:
      req.tripPurpose === 'business'
      || input.intents.primary.id === 'business_travel',
    discoveryMode: input.understanding.travelContext.discoveryMode,
    climateHint: input.understanding.travelContext.climateHint ?? req.weatherPreference,
    budgetSar: req.budgetAmount,
    budgetCurrency: req.budgetCurrency || profile.budget.currency || 'SAR',
    travelMonth: req.startDate,
  }
}

function inferTravelStyle(
  intents: BrainIntentResult,
  profile: PersonalizationProfile,
  understanding: ConversationUnderstanding,
): ExecutiveTravelStyle {
  if (intents.primary.id === 'luxury_travel' || profile.budget.style === 'luxury') return 'luxury'
  if (intents.primary.id === 'adventure' || profile.travelStyle.style === 'adventure') return 'adventure'
  if (intents.primary.id === 'family_travel') return 'family'
  if (intents.primary.id === 'business_travel') return 'business'
  if (intents.primary.id === 'honeymoon') return 'romantic'
  if (profile.budget.style === 'budget' || profile.budget.flexibility === 'strict') return 'budget_sensitive'
  if (profile.traveler.travelerTypes.includes('solo')) return 'solo'
  if (profile.travelStyle.favoriteDestinations.length >= 2) return 'repeat'
  if (understanding.emotionalContext.needsBreak) return 'general'
  return 'general'
}
