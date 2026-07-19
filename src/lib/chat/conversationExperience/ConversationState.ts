/**
 * Sprint 32 — ConversationState helpers (incremental planning context).
 */

import {
  emptyUnifiedContext,
  extractContextFromUserText,
  mergeUnifiedContext,
  type UnifiedTravelPlannerContext,
} from '../../brain/unifiedTravel'
import type { ConversationCommandKind, ConversationPhase, ConversationState } from './types'

export function createInitialConversationState(
  locale: 'ar' | 'en' = 'en',
): ConversationState {
  return {
    phase: 'idle',
    locale,
    context: emptyUnifiedContext(locale),
    lastPlanResult: null,
    pendingFollowUpField: null,
    travelersConfirmed: false,
    editCount: 0,
    compareMode: false,
    lastCommand: null,
    updatedAt: new Date().toISOString(),
  }
}

export function cloneConversationState(state: ConversationState): ConversationState {
  return {
    ...state,
    context: {
      ...state.context,
      preferredAirlines: [...state.context.preferredAirlines],
      preferredHotels: [...state.context.preferredHotels],
      loyaltyPrograms: [...state.context.loyaltyPrograms],
      activities: [...state.context.activities],
    },
    lastPlanResult: state.lastPlanResult,
  }
}

export function applyUserTextToState(
  state: ConversationState,
  userText: string,
): ConversationState {
  const extracted = extractContextFromUserText(userText, state.locale)
  const travelersMentioned = mentionsTravelers(userText)
  return {
    ...state,
    context: mergeUnifiedContext(state.context, extracted),
    travelersConfirmed: state.travelersConfirmed || travelersMentioned,
    updatedAt: new Date().toISOString(),
  }
}

export function applyCommandToState(
  state: ConversationState,
  command: ConversationCommandKind,
): ConversationState {
  const ctx = { ...state.context }
  let editCount = state.editCount
  let compareMode = state.compareMode
  let phase: ConversationPhase = state.phase

  switch (command) {
    case 'make_cheaper': {
      editCount += 1
      phase = 'editing'
      if (ctx.budgetAmount != null) {
        ctx.budgetAmount = Math.max(500, Math.round(ctx.budgetAmount * 0.85))
      } else {
        ctx.budgetAmount = 6_000
      }
      // Soft preference: drop luxury hotel brands if present.
      ctx.preferredHotels = ctx.preferredHotels.filter(
        (h) => !/ritz|st\s*regis|four seasons/i.test(h),
      )
      break
    }
    case 'direct_flights':
      editCount += 1
      phase = 'editing'
      // Preference signal stored as activity/note-like airline preference boost.
      ctx.preferredAirlines = unique([
        ...ctx.preferredAirlines,
        ...(ctx.preferredAirlines[0] ? [] : ['Saudia']),
      ])
      break
    case 'upgrade_hotel':
      editCount += 1
      phase = 'editing'
      ctx.preferredHotels = unique([...ctx.preferredHotels, 'Hilton', 'Marriott'])
      break
    case 'business_class':
      editCount += 1
      phase = 'editing'
      ctx.cabinClass = 'business'
      break
    case 'travel_with_children':
      editCount += 1
      phase = 'editing'
      ctx.children = Math.max(1, ctx.children || 1)
      ctx.adults = Math.max(1, ctx.adults)
      break
    case 'stay_downtown':
      editCount += 1
      phase = 'editing'
      ctx.preferredHotels = unique([...ctx.preferredHotels, 'Central', 'Downtown'])
      ctx.activities = unique([...ctx.activities, 'shopping'])
      break
    case 'shorten_trip':
      editCount += 1
      phase = 'editing'
      ctx.nights = Math.max(2, Math.round(ctx.nights * 0.7) || 2)
      if (ctx.startDate) {
        ctx.endDate = addDays(ctx.startDate, ctx.nights)
      }
      break
    case 'increase_budget':
      editCount += 1
      phase = 'editing'
      ctx.budgetAmount = ctx.budgetAmount != null
        ? Math.round(ctx.budgetAmount * 1.25)
        : 12_000
      break
    case 'regenerate':
      editCount += 1
      phase = 'editing'
      break
    case 'compare_options':
      compareMode = true
      phase = 'comparing'
      break
    case 'continue':
      phase = state.lastPlanResult ? 'presenting' : 'planning'
      break
    case 'pay_now':
      // Payment handoff — do not mutate planning context.
      phase = state.lastPlanResult ? 'presenting' : state.phase
      break
    case 'clarify_answer':
      phase = 'planning'
      break
    case 'plan':
      phase = 'planning'
      break
    default:
      break
  }

  return {
    ...state,
    context: ctx as UnifiedTravelPlannerContext,
    editCount,
    compareMode,
    phase,
    lastCommand: command,
    updatedAt: new Date().toISOString(),
  }
}

export function detectConversationCommand(userText: string): ConversationCommandKind {
  const lower = userText.toLowerCase().trim()

  if (/make (it )?cheaper|cheaper|lower (the )?budget|reduce (the )?cost|save money/.test(lower)) {
    return 'make_cheaper'
  }
  if (/only direct|direct flights?|non[- ]?stop|no stops?/.test(lower)) {
    return 'direct_flights'
  }
  if (/upgrade (the )?hotel|better hotel|nicer hotel|5[- ]star/.test(lower)) {
    return 'upgrade_hotel'
  }
  if (/business class|fly business|upgrade to business/.test(lower)) {
    return 'business_class'
  }
  if (/with children|with kids|bring (the )?kids|traveling with child/.test(lower)) {
    return 'travel_with_children'
  }
  if (/downtown|city center|near (the )?center|central location/.test(lower)) {
    return 'stay_downtown'
  }
  if (/shorten (the )?trip|fewer nights|shorter stay|reduce days/.test(lower)) {
    return 'shorten_trip'
  }
  if (/increase (the )?budget|raise (the )?budget|more budget|higher budget/.test(lower)) {
    return 'increase_budget'
  }
  if (/regenerate|try again|another (plan|itinerary)|new options?/.test(lower)) {
    return 'regenerate'
  }
  if (/compare|show alternatives|other options|which is better/.test(lower)) {
    return 'compare_options'
  }
  if (/continue|resume|pick up where/.test(lower)) {
    return 'continue'
  }
  if (
    /pay now|would you like to pay|yes[, ]?pay|proceed to (payment|checkout)|checkout now|ادفع الآن|أريد الدفع/.test(
      lower,
    )
  ) {
    return 'pay_now'
  }
  if (/^\d+\s*(adults?|travelers?|people|persons?)?$/.test(lower)
    || /^(two|three|four|one)\s*(adults?)?$/.test(lower)
    || /^(just )?(me|myself|solo)$/.test(lower)) {
    return 'clarify_answer'
  }

  return 'plan'
}

function unique(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    const key = v.toLowerCase()
    if (!v || seen.has(key)) continue
    seen.add(key)
    out.push(v)
  }
  return out
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function mentionsTravelers(userText: string): boolean {
  const lower = userText.toLowerCase()
  return /(\d+)\s*(adults?|travelers?|people|persons?|children|kids)/.test(lower)
    || /\b(solo|couple|family|two adults|with kids)\b/.test(lower)
    || /^(two|three|four|one)(\s+adults?)?$/.test(lower.trim())
    || /^(just )?(me|myself)$/.test(lower.trim())
}
