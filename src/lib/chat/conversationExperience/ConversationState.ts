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
    case 'my_trip':
    case 'show_itinerary':
    case 'download_ticket':
    case 'any_delays':
    case 'what_hotel':
      // Sprint 35 trip queries — answered from post-booking store, no re-plan.
      phase = 'presenting'
      break
    case 'cancel_refund_quote':
    case 'cancel_hotel_only':
    case 'flight_delay_policy':
    case 'deposit_refund':
    case 'cancel_after_checkin':
    case 'airline_cancels':
    case 'one_traveler_cancels':
      // Sprint 36 refund policy questions — answered via PolicyEngine quotes.
      phase = 'presenting'
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
  if (
    /^(my trip|show my trip|my trips|show my trips)\b/.test(lower)
    || /رحلتي|عرض رحلتي/.test(lower)
  ) {
    return 'my_trip'
  }
  if (
    /show my itinerary|my itinerary|download (my )?itinerary/.test(lower)
    || /عرض جدول|جدول رحلتي/.test(lower)
  ) {
    return 'show_itinerary'
  }
  if (
    /download my ticket|show my ticket|my e-?ticket|boarding pass/.test(lower)
    || /تذكرتي|تحميل التذكرة/.test(lower)
  ) {
    return 'download_ticket'
  }

  // Sprint 37 — operational disruption recovery (before status/refund queries).
  if (/missed (my )?connection|miss(ed)? my connecting/.test(lower) || /فاتتني المواصلة/.test(lower)) {
    return 'missed_connection'
  }
  if (
    /my flight (was |is )?cancelled|flight (was |is )?cancelled|canceled my flight/.test(lower)
    || /ألغيت رحلتي|تم إلغاء رحلتي/.test(lower)
  ) {
    return 'flight_cancelled'
  }
  if (
    (/my flight (is |was )?delayed|delayed by \d+/.test(lower) || /تأجلت رحلتي|رحلتي متأخرة/.test(lower))
    && !/what happens if|refund|policy|will i get/.test(lower)
  ) {
    return 'flight_delayed'
  }
  if (
    /my hotel (cancelled|canceled)|hotel cancelled my|hotel canceled my|hotel overbook/.test(lower)
    || /ألغى الفندق|الفندق ألغى/.test(lower)
  ) {
    return 'hotel_cancelled'
  }
  if (/gate (was |has )?changed|new gate\b/.test(lower)) {
    return 'gate_changed'
  }
  if (/schedule (was |has )?changed|rescheduled/.test(lower)) {
    return 'schedule_changed'
  }
  if (/car (is )?unavailable|rental (was )?cancelled/.test(lower)) {
    return 'car_unavailable'
  }
  if (/activity (was |is )?cancelled|tour cancelled/.test(lower)) {
    return 'activity_cancelled'
  }
  if (/airport (is )?closed|airport closure/.test(lower)) {
    return 'airport_closure'
  }
  if (/weather (disruption|delay|cancel)|\bstorm\b|\bfog\b/.test(lower)) {
    return 'weather_disruption'
  }
  if (/\bstrike\b|industrial action/.test(lower)) {
    return 'strike'
  }
  if (/visa (was )?rejected|visa denial/.test(lower)) {
    return 'visa_rejection'
  }
  if (/border (restriction|closed)|entry ban/.test(lower)) {
    return 'border_restriction'
  }

  if (
    /any delays\??|flight status|is my flight delayed/.test(lower)
    || /حالة الرحلة/.test(lower)
  ) {
    return 'any_delays'
  }
  if (
    /what hotel am i staying in|which hotel|my hotel|hotel voucher/.test(lower)
    || /أي فندق|فندقي/.test(lower)
  ) {
    return 'what_hotel'
  }

  if (
    /cancel only the hotel|hotel only|just the hotel/.test(lower)
    || /ألغي الفندق فقط/.test(lower)
  ) {
    return 'cancel_hotel_only'
  }
  if (
    /what happens if my flight is delayed|delay.*refund|flight delay.*refund/.test(lower)
    || /تأخير الرحلة/.test(lower)
  ) {
    return 'flight_delay_policy'
  }
  if (
    /lose my deposit|deposit refund|will i (get|lose) (my )?deposit/.test(lower)
    || /العربون|الوديعة/.test(lower)
  ) {
    return 'deposit_refund'
  }
  if (
    /cancel after check-?in|after check in|early departure/.test(lower)
    || /بعد تسجيل الوصول/.test(lower)
  ) {
    return 'cancel_after_checkin'
  }
  if (
    /airline cancels|if the airline cancel|carrier cancel/.test(lower)
    || /إلغاء من شركة الطيران/.test(lower)
  ) {
    return 'airline_cancels'
  }
  if (
    /only one (traveler|passenger) cancels|one of us cancels|cancel one (traveler|passenger)/.test(
      lower,
    )
    || /مسافر واحد/.test(lower)
  ) {
    return 'one_traveler_cancels'
  }
  if (
    /if i cancel now|how much will i get back|cancel.*refund|refund if i cancel/.test(lower)
    || /كم سأسترد|إذا ألغيت/.test(lower)
  ) {
    return 'cancel_refund_quote'
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
