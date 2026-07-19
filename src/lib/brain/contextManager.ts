import { ConversationHistoryApi, createEmptyHistory } from './conversationHistory'
import { ConversationMemoryApi, createEmptyMemory } from './conversationMemory'
import { createEmptyTravelGoals, TravelGoalsApi } from './travelGoals'
import { createEmptyTripPreferences, TripPreferencesApi } from './tripPreferences'
import type {
  BrainLocale,
  ConversationContext,
  ConversationMemory,
  TravelGoals,
  TravelIntent,
  TripPreferences,
} from './types'

export function createConversationContext(
  conversationId?: string,
  locale: BrainLocale = 'ar',
): ConversationContext {
  const memory = createEmptyMemory(conversationId, locale)
  return {
    conversationId: memory.conversationId,
    memory,
    history: createEmptyHistory(memory.conversationId),
    goals: createEmptyTravelGoals(),
    preferences: createEmptyTripPreferences(),
    lastIntent: null,
    missingFields: [],
    locale,
  }
}

/**
 * ContextManager — single owner of ConversationContext.
 */
export function ContextManager(initial?: ConversationContext) {
  let context = initial ? cloneContext(initial) : createConversationContext()

  return {
    get(): ConversationContext {
      return cloneContext(context)
    },

    replace(next: ConversationContext) {
      context = cloneContext(next)
    },

    setLocale(locale: BrainLocale) {
      context = {
        ...context,
        locale,
        memory: { ...context.memory, conversationLanguage: locale },
      }
    },

    setMemory(memory: ConversationMemory) {
      context = { ...context, memory: ConversationMemoryApi.clone(memory) }
    },

    setGoals(goals: TravelGoals) {
      context = { ...context, goals: { ...goals, secondaryIntents: [...goals.secondaryIntents], mustHave: [...goals.mustHave], niceToHave: [...goals.niceToHave] } }
    },

    setPreferences(preferences: TripPreferences) {
      context = { ...context, preferences: TripPreferencesApi.merge(createEmptyTripPreferences(), preferences) }
    },

    setIntent(intent: TravelIntent) {
      context = {
        ...context,
        lastIntent: intent,
        goals: TravelGoalsApi.setPrimary(context.goals, intent),
      }
    },

    setMissing(missingFields: ConversationContext['missingFields']) {
      context = { ...context, missingFields: [...missingFields] }
    },

    appendUser(content: string, intent: TravelIntent | null) {
      context = {
        ...context,
        history: ConversationHistoryApi.append(context.history, {
          role: 'user',
          content,
          intent,
        }),
      }
    },

    appendAssistant(content: string, intent: TravelIntent | null) {
      context = {
        ...context,
        history: ConversationHistoryApi.append(context.history, {
          role: 'assistant',
          content,
          intent,
        }),
      }
    },
  }
}

export type ContextManagerHandle = ReturnType<typeof ContextManager>

function cloneContext(ctx: ConversationContext): ConversationContext {
  return {
    conversationId: ctx.conversationId,
    memory: ConversationMemoryApi.clone(ctx.memory),
    history: {
      conversationId: ctx.history.conversationId,
      turns: ctx.history.turns.map((t) => ({ ...t })),
    },
    goals: {
      ...ctx.goals,
      secondaryIntents: [...ctx.goals.secondaryIntents],
      mustHave: [...ctx.goals.mustHave],
      niceToHave: [...ctx.goals.niceToHave],
    },
    preferences: {
      ...ctx.preferences,
      interests: [...ctx.preferences.interests],
      avoid: [...ctx.preferences.avoid],
    },
    lastIntent: ctx.lastIntent,
    missingFields: [...ctx.missingFields],
    locale: ctx.locale,
  }
}
