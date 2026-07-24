/**
 * Phase 3 Stage 2 — Multi-turn conversation event tracking.
 * Detects continue / new trip / corrections / topic switches, etc.
 */

import type {
  ConversationTopic,
  ConversationTurnEvent,
  MultiTurnConversationSession,
} from './memoryTypes'
import { extractKnownFactsFromText } from './conversationContext'

export interface TrackedTurn {
  event: ConversationTurnEvent
  topic: ConversationTopic
  isCorrection: boolean
  changedFields: string[]
}

export function trackConversationTurn(input: {
  userText: string
  topic: ConversationTopic
  session: MultiTurnConversationSession
}): TrackedTurn {
  const text = input.userText.trim()
  const lower = text.toLowerCase()
  const session = input.session
  const extracted = extractKnownFactsFromText(text)
  const changedFields: string[] = []

  const prevDest = session.destinationFacts.destination ?? null
  const prevBudget = session.strategyFacts.budgetAmount ?? null
  const prevDays = session.strategyFacts.durationDays ?? null
  const prevAdults = session.travelerFacts.adults ?? null

  if (
    extracted.destination
    && prevDest
    && normalize(extracted.destination) !== normalize(prevDest)
  ) {
    changedFields.push('destination')
  }
  if (
    extracted.budgetAmount != null
    && prevBudget != null
    && extracted.budgetAmount !== prevBudget
  ) {
    changedFields.push('budget')
  }
  if (
    extracted.durationDays != null
    && prevDays != null
    && extracted.durationDays !== prevDays
  ) {
    changedFields.push('dates')
  }
  if (
    extracted.adults != null
    && prevAdults != null
    && extracted.adults !== prevAdults
  ) {
    changedFields.push('travelers')
  }

  const correcting =
    /\b(actually|instead|not|correction|i meant|change (that|it) to|update)\b/i.test(lower)
    || /بالأحرى|قصدت|تصحيح|مو كذا|عدّل|بدل/.test(text)
    || changedFields.length > 0

  if (
    /\b(new trip|start over|different trip|another trip|from scratch)\b/i.test(lower)
    || /رحلة جديدة|من البداية|خطة جديدة/.test(text)
  ) {
    return {
      event: 'new_trip',
      topic: input.topic,
      isCorrection: false,
      changedFields,
    }
  }

  // Corrections / slot changes take priority over pending-clarification resume.
  if (correcting && changedFields.includes('destination')) {
    return {
      event: 'changing_destination',
      topic: input.topic,
      isCorrection: true,
      changedFields,
    }
  }
  if (correcting && changedFields.includes('budget')) {
    return {
      event: 'changing_budget',
      topic: input.topic,
      isCorrection: true,
      changedFields,
    }
  }
  if (correcting && changedFields.includes('dates')) {
    return {
      event: 'changing_dates',
      topic: input.topic,
      isCorrection: true,
      changedFields,
    }
  }
  if (correcting && changedFields.includes('travelers')) {
    return {
      event: 'changing_travelers',
      topic: input.topic,
      isCorrection: true,
      changedFields,
    }
  }
  if (correcting) {
    return {
      event: 'correcting_information',
      topic: input.topic,
      isCorrection: true,
      changedFields,
    }
  }

  if (
    /^(and|also|what about|how about|then|كذلك|وكمان|وماذا عن|ثم)/i.test(text)
    || /\b(follow[- ]?up|more details|tell me more)\b/i.test(lower)
    || /المزيد|فضلاً أوضح|وضح أكثر/.test(text)
  ) {
    return {
      event: 'follow_up',
      topic: input.topic,
      isCorrection: false,
      changedFields,
    }
  }

  if (
    session.conversationTopic
    && session.conversationTopic !== input.topic
    && session.turnNumber > 0
  ) {
    return {
      event: 'switching_topics',
      topic: input.topic,
      isCorrection: false,
      changedFields,
    }
  }

  if (
    /^(continue|resume|go on|back to|نعم|أكمل|كمل|متابعة)/i.test(text)
    || /\b(continue|resume) (the |my )?(trip|plan|conversation)\b/i.test(lower)
  ) {
    return {
      event: 'resuming',
      topic: input.topic,
      isCorrection: false,
      changedFields,
    }
  }

  // Answering a pending clarification without other events → resume.
  if (session.pendingClarification && text.length > 0) {
    return {
      event: 'resuming',
      topic: input.topic,
      isCorrection: false,
      changedFields,
    }
  }

  return {
    event: 'continuing',
    topic: input.topic,
    isCorrection: false,
    changedFields,
  }
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export const ConversationTracker = {
  track: trackConversationTurn,
}
