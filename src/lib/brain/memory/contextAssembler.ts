/**
 * Sprint 28 — ContextAssembler
 * Combines current conversation + previous state + stored travel preferences.
 */

import type { BrainLocale, TravelIntent } from '../types'
import {
  applyEnrichedPatch,
  cloneEnrichedMemory,
  createEmptyEnrichedMemory,
  ensureEnriched,
} from './enrichedMemory'
import {
  buildFollowUpQuestions,
  detectMissingPreferenceSlots,
} from './followUpQuestions'
import type {
  AssembledContext,
  EnrichedConversationMemory,
  ShortTermMemoryState,
  TravelPreferenceProfile,
} from './types'

export type ContextAssemblerInput = {
  conversationId: string
  userId?: string | null
  locale?: BrainLocale
  currentMessage: string
  shortTerm: ShortTermMemoryState
  previousState?: ShortTermMemoryState | null
  longTerm?: TravelPreferenceProfile | null
  intent?: TravelIntent | null
}

/**
 * Merge long-term prefs into session memory without overwriting explicit session answers.
 */
export function mergeLongTermIntoSession(
  session: EnrichedConversationMemory,
  longTerm: TravelPreferenceProfile | null | undefined,
): EnrichedConversationMemory {
  if (!longTerm) return cloneEnrichedMemory(ensureEnriched(session))
  const seed: Partial<EnrichedConversationMemory> = {}

  if (!session.airlinePreferences.length && longTerm.preferredAirlines.length) {
    seed.airlinePreferences = [...longTerm.preferredAirlines]
  }
  if (!session.hotelPreferences.length && longTerm.preferredHotelBrands.length) {
    seed.hotelPreferences = [...longTerm.preferredHotelBrands]
  }
  if (!session.cabinClass && longTerm.cabinClass) {
    seed.cabinClass = longTerm.cabinClass
  }
  if (
    session.budget.amount == null &&
    !session.budget.flexible &&
    longTerm.budgetRange.max != null
  ) {
    seed.budget = {
      amount: longTerm.budgetRange.max,
      currency: longTerm.budgetRange.currency,
      flexible: false,
    }
  }
  if (
    session.travelers.count == null &&
    longTerm.typicalTravelerCount != null
  ) {
    seed.travelers = {
      count: longTerm.typicalTravelerCount,
      adults: longTerm.typicalTravelerCount,
      children: 0,
      infants: 0,
    }
  }
  if (!session.familyMembers.length && longTerm.familyMembers.length) {
    seed.familyMembers = longTerm.familyMembers.map((m) => ({ ...m }))
  }
  if (!session.seatPreferences.length && longTerm.seatPreferences.length) {
    seed.seatPreferences = [...longTerm.seatPreferences]
  }
  if (!session.mealPreferences.length && longTerm.mealPreferences.length) {
    seed.mealPreferences = [...longTerm.mealPreferences]
  }
  if (
    !session.accessibilityRequirements.length &&
    longTerm.accessibilityRequirements.length
  ) {
    seed.accessibilityRequirements = [...longTerm.accessibilityRequirements]
  }
  if (!session.loyaltyPrograms.length && longTerm.loyaltyPrograms.length) {
    seed.loyaltyPrograms = longTerm.loyaltyPrograms.map((program) => ({
      program,
      memberNumber: null,
    }))
  }
  if (!session.visaStatus && longTerm.visaStatus) {
    seed.visaStatus = longTerm.visaStatus
    seed.visaRequirements = longTerm.visaStatus
  }
  if (
    !session.passportNationality.explicitlyProvided &&
    longTerm.nationality &&
    longTerm.allowSensitiveRetention
  ) {
    seed.passportNationality = {
      nationality: longTerm.nationality,
      passportCountry: longTerm.nationality,
      explicitlyProvided: true,
    }
  }

  return applyEnrichedPatch(ensureEnriched(session), seed)
}

export function ContextAssembler() {
  return {
    assemble(input: ContextAssemblerInput): AssembledContext {
      const locale = input.locale ?? input.shortTerm.memory.conversationLanguage ?? 'ar'
      const previousState = input.previousState
        ? cloneShortTerm(input.previousState)
        : null

      const workingMemory = mergeLongTermIntoSession(
        input.shortTerm.memory,
        input.longTerm,
      )

      const intent = input.intent ?? input.shortTerm.history.turns.at(-1)?.intent ?? 'GeneralConversation'
      const missingSlots = detectMissingPreferenceSlots({
        memory: workingMemory,
        intent,
        maxQuestions: 1,
      })
      const followUpQuestions = buildFollowUpQuestions({
        missingSlots,
        locale,
        max: 1,
      })

      const recentTurns = input.shortTerm.history.turns.map((t) => ({ ...t }))

      return {
        conversationId: input.conversationId,
        userId: input.userId ?? input.shortTerm.userId,
        locale,
        currentMessage: input.currentMessage,
        shortTerm: cloneShortTerm(input.shortTerm),
        previousState,
        longTerm: input.longTerm ? cloneLongTerm(input.longTerm) : null,
        workingMemory,
        summary: input.shortTerm.summary
          ? {
              ...input.shortTerm.summary,
              keyFacts: [...input.shortTerm.summary.keyFacts],
              coveredTurnIds: [...input.shortTerm.summary.coveredTurnIds],
            }
          : null,
        recentTurns,
        missingSlots,
        followUpQuestions,
        lastIntent: intent,
        assembledAt: new Date().toISOString(),
      }
    },

    /** Reconstruct working memory from stored short-term + long-term (persistence tests). */
    reconstruct(input: {
      conversationId: string
      shortTerm: ShortTermMemoryState | null
      longTerm: TravelPreferenceProfile | null
      locale?: BrainLocale
    }): EnrichedConversationMemory {
      if (!input.shortTerm) {
        return createEmptyEnrichedMemory(input.conversationId, input.locale ?? 'ar')
      }
      return mergeLongTermIntoSession(input.shortTerm.memory, input.longTerm)
    },
  }
}

function cloneShortTerm(state: ShortTermMemoryState): ShortTermMemoryState {
  return {
    ...state,
    memory: cloneEnrichedMemory(ensureEnriched(state.memory)),
    history: {
      conversationId: state.history.conversationId,
      turns: state.history.turns.map((t) => ({ ...t })),
    },
    summary: state.summary
      ? {
          ...state.summary,
          keyFacts: [...state.summary.keyFacts],
          coveredTurnIds: [...state.summary.coveredTurnIds],
        }
      : null,
    followUpQuestions: [...state.followUpQuestions],
    missingSlots: [...state.missingSlots],
  }
}

function cloneLongTerm(profile: TravelPreferenceProfile): TravelPreferenceProfile {
  return {
    ...profile,
    preferredAirlines: [...profile.preferredAirlines],
    preferredHotelBrands: [...profile.preferredHotelBrands],
    budgetRange: { ...profile.budgetRange },
    familyMembers: profile.familyMembers.map((m) => ({ ...m })),
    seatPreferences: [...profile.seatPreferences],
    mealPreferences: [...profile.mealPreferences],
    accessibilityRequirements: [...profile.accessibilityRequirements],
    loyaltyPrograms: [...profile.loyaltyPrograms],
    tripStyle: profile.tripStyle
      ? {
          ...profile.tripStyle,
          interests: [...profile.tripStyle.interests],
          avoid: [...profile.tripStyle.avoid],
        }
      : null,
  }
}
