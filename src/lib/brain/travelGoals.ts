import type { TravelGoals, TravelIntent } from './types'

export function createEmptyTravelGoals(): TravelGoals {
  return {
    primaryIntent: null,
    secondaryIntents: [],
    tripPurpose: null,
    mustHave: [],
    niceToHave: [],
  }
}

export const TravelGoalsApi = {
  create: createEmptyTravelGoals,

  setPrimary(goals: TravelGoals, intent: TravelIntent): TravelGoals {
    const secondary = goals.secondaryIntents.filter((i) => i !== intent)
    if (goals.primaryIntent && goals.primaryIntent !== intent) {
      if (!secondary.includes(goals.primaryIntent)) secondary.unshift(goals.primaryIntent)
    }
    return {
      ...goals,
      primaryIntent: intent,
      secondaryIntents: secondary.slice(0, 5),
    }
  },

  addMustHave(goals: TravelGoals, item: string): TravelGoals {
    const value = item.trim()
    if (!value || goals.mustHave.includes(value)) return goals
    return { ...goals, mustHave: [...goals.mustHave, value] }
  },
}
