/**
 * Concierge turn policy — decides ask / advise / confirm / execute.
 * Speaks only in agent terms. Never selects providers or search engines.
 *
 * Intelligence rule: Concierge Decision Engine asks
 * "Can I already provide value?" before "Which field is missing?"
 */

import type { TripRequirements } from '../agent/types'
import {
  isBroadDestination,
  shouldLeadWithValue,
} from './decisionEngine'
import {
  advanceConciergeState,
  hardMissingCount,
  hasSoftDepth,
  resolveConciergePhase,
} from './dialogueState'
import { extractSoftSignals } from './softSignals'
import {
  emptyConciergeState,
  type ConciergeAction,
  type ConciergeTurnContext,
  type ConciergeTurnDecision,
} from './types'

/** Soft deepening prompts when hard intake is done but consultant depth is thin. */
const SOFT_ASK_FIELDS: Array<keyof TripRequirements> = [
  'interests',
  'budgetStyle',
  'hotelPreference',
  'weatherPreference',
  'packageScope',
]

const EXECUTE_INTENTS = new Set(['plan', 'discover', 'answer', 'regenerate', 'edit', 'regenerate_day'])

export function decideConciergeTurn(ctx: ConciergeTurnContext): ConciergeTurnDecision {
  const previous = ctx.previous ?? emptyConciergeState()
  const softSignals = extractSoftSignals(ctx.userText, ctx.locale, previous.softSignals)
  const phase = resolveConciergePhase({
    memory: ctx.memory,
    previous,
    intent: ctx.intent,
    softSignals,
  })

  const hardMissing = hardMissingCount(ctx.missingFields, ctx.requirements)
  const intakeComplete = ctx.missingFields.length === 0
  const hasPlan = Boolean(ctx.memory.tripPlan)
  const heardSummary = buildHeardSummary(ctx, softSignals.mustHaves)

  let action: ConciergeAction = 'ask'
  let askFields: Array<keyof TripRequirements> = []
  let shouldExecuteAgent = false
  let rationale = 'Default discovery ask.'
  let valueBrief: string[] | undefined
  let framingNote: string | null | undefined
  let preferenceQuestion: string | null | undefined

  const valueGate = shouldLeadWithValue({
    requirements: ctx.requirements,
    locale: ctx.locale,
    userText: ctx.userText,
    previous,
    hardMissing,
  })

  const applyValueLead = (prefix: string): void => {
    action = valueGate.action
    askFields = []
    shouldExecuteAgent = false
    valueBrief = valueGate.valueBrief
    framingNote = valueGate.framingNote
    preferenceQuestion = valueGate.preferenceQuestion
    rationale = `${prefix}${valueGate.rationale}`
  }

  const broadDest = isBroadDestination(
    ctx.requirements.destination || ctx.requirements.destinations[0],
  )
  const explicitPlanCue = isExplicitPlanCue(ctx.userText, ctx.intent)

  // Sprint 45 — open-ended discovery: propose reasoned options instead of asking "where?".
  if (
    ctx.requirements.destinationFlexible
    && !ctx.requirements.destination
    && (ctx.intent === 'discover' || ctx.requirements.weatherPreference)
  ) {
    if (valueGate.leadWithValue) {
      applyValueLead('Open-ended discovery — ')
    } else {
      action = previous.turnCount === 0 ? 'greet' : 'propose_options'
      askFields = []
      rationale = 'Open-ended discovery — propose directions; no census fields.'
    }
    const nextPhase = 'advising'
    const state = advanceConciergeState({
      previous,
      phase: nextPhase,
      softSignals,
      lastAction: action,
      heardSummary,
    })
    return {
      action,
      phase: nextPhase,
      state,
      askFields,
      shouldExecuteAgent: false,
      rationale,
      valueBrief,
      framingNote,
      preferenceQuestion,
    }
  }

  // Ready for TripPlan handoff — distinct from Planning Draft (estimate) readiness.
  const readyToDraftPlan = intakeComplete
    && (ctx.requirements.durationDays != null || explicitPlanCue || hasPlan)
  // Deliberate trip shaping (not soft-seeded midrange/central defaults).
  const hasDeliberateStyle = Boolean(
    ctx.requirements.interests.length > 0
    || ctx.requirements.packageScope
    || ctx.requirements.tripPurpose,
  )
  // Broad countries stay on Planning Draft + city compare until the traveler
  // locks a city direction, confirms, or provides deliberate style/purpose.
  const mayExecuteItinerary = readyToDraftPlan
    && (!broadDest || explicitPlanCue || hasPlan || hasDeliberateStyle)

  // Value-first / Planning Draft: recommend before form fields or itinerary build.
  if (
    valueGate.leadWithValue
    && !mayExecuteItinerary
    && (
      hardMissing > 0
      || (intakeComplete && broadDest && !explicitPlanCue && !hasPlan)
      || (readyToDraftPlan && broadDest && !explicitPlanCue)
    )
  ) {
    applyValueLead('Decision Engine — ')
  } else if (phase === 'greeting' && previous.turnCount === 0 && !intakeComplete && !valueGate.leadWithValue) {
    action = 'greet'
    // Inspire with destination/vibe — never open on budget/travelers.
    askFields = ctx.missingFields.includes('destination')
      ? ['destination']
      : pickAskFields(ctx.missingFields, 1)
    rationale = 'First turn — greet and open with a discovery cue.'
  } else if (phase === 'refining' && hasPlan) {
    if (EXECUTE_INTENTS.has(ctx.intent) || ctx.intent === 'save') {
      action = 'refine'
      shouldExecuteAgent = true
      rationale = 'Plan exists — refine via agent abstractions.'
    } else {
      action = 'advise'
      rationale = 'Plan exists — advise without re-executing.'
    }
  } else if (
    intakeComplete
    && previous.lastAction === 'propose_options'
    && (isAffirmative(ctx.userText) || ctx.intent === 'plan' || explicitPlanCue)
  ) {
    action = 'plan'
    shouldExecuteAgent = true
    rationale = 'Traveler confirmed options — hand off to agent plan path.'
  } else if (mayExecuteItinerary && EXECUTE_INTENTS.has(ctx.intent)) {
    // City-specific / deliberate style / explicit plan — build TripPlan.
    action = 'plan'
    shouldExecuteAgent = true
    rationale = 'Intake complete — hand off to agent plan path.'
  } else if (intakeComplete && broadDest && !explicitPlanCue && valueGate.canProvideValue) {
    applyValueLead('Broad destination — Planning Draft before itinerary. ')
  } else if (intakeComplete && ctx.intent === 'unknown' && hasSoftDepth(softSignals)) {
    action = previous.lastAction === 'propose_options' ? 'confirm' : 'propose_options'
    rationale = 'Advisory beat — propose conversational options without executing.'
  } else if (hardMissing > 0) {
    // Fallback only when Decision Engine cannot yet help — still one discovery cue.
    action = previous.turnCount === 0 ? 'greet' : (hardMissing >= 3 ? 'ask' : 'clarify')
    askFields = ctx.missingFields.includes('destination')
      ? ['destination']
      : pickAskFields(ctx.missingFields, 1)
    rationale = 'Insufficient signal for recommendations — one discovery question.'
  } else if (!intakeComplete && (phase === 'deepening' || phase === 'advising' || phase === 'discovery')) {
    if (hasSoftDepth(softSignals) && softAskRemaining(ctx.missingFields).length <= 2) {
      action = 'propose_options'
      askFields = []
      rationale = 'Hard intake ready — propose directions while soft slots remain.'
    } else if (valueGate.canProvideValue) {
      applyValueLead('Soft deepening — ')
    } else {
      action = 'ask'
      askFields = pickSoftAskFields(ctx.missingFields)
      rationale = 'Hard intake complete — deepen soft preferences.'
    }
  } else if (
    phase === 'confirming'
    || (previous.lastAction === 'propose_options' && isAffirmative(ctx.userText))
  ) {
    if (isAffirmative(ctx.userText) || ctx.intent === 'plan') {
      action = 'plan'
      shouldExecuteAgent = true
      rationale = 'Confirmed — execute agent planning (provider-agnostic).'
    } else {
      action = 'confirm'
      rationale = 'Awaiting explicit confirmation.'
    }
  } else if (valueGate.canProvideValue) {
    applyValueLead('Default value beat — ')
  } else {
    action = 'ask'
    askFields = pickAskFields(ctx.missingFields, 1)
    rationale = 'Default discovery ask.'
  }

  // `search` means "ask agent to fulfill" — never a supplier name.
  if (action === 'plan' && ctx.requirements.packageScope === 'flights_only') {
    action = 'search'
    shouldExecuteAgent = true
    rationale = 'Flights-only scope — agent search handoff (no provider named).'
  }

  const nextPhase = action === 'plan' || action === 'search'
    ? 'executing'
    : action === 'confirm'
      ? 'confirming'
      : action === 'propose_options' || action === 'advise'
        ? 'advising'
        : phase

  const state = advanceConciergeState({
    previous,
    phase: nextPhase,
    softSignals,
    lastAction: action,
    heardSummary,
  })

  return {
    action,
    phase: nextPhase,
    state,
    askFields,
    shouldExecuteAgent,
    rationale,
    valueBrief,
    framingNote,
    preferenceQuestion,
  }
}

function isExplicitPlanCue(text: string, intent: ConciergeTurnContext['intent']): boolean {
  if (intent === 'plan' || intent === 'regenerate') return true
  const lower = text.trim().toLowerCase()
  return /\b(build (the )?plan|generate (the )?plan|full (itinerary|plan)|go ahead and plan)\b/i.test(lower)
    || /(ابني|ولّد|ولد|جهّز).*(خطة|الرحلة)|خطة كاملة/.test(text)
}

function pickAskFields(
  missing: Array<keyof TripRequirements>,
  limit: number,
): Array<keyof TripRequirements> {
  return missing.slice(0, Math.max(0, limit))
}

function softAskRemaining(
  missing: Array<keyof TripRequirements>,
): Array<keyof TripRequirements> {
  return SOFT_ASK_FIELDS.filter((field) => missing.includes(field))
}

function pickSoftAskFields(
  missing: Array<keyof TripRequirements>,
): Array<keyof TripRequirements> {
  const fromMissing = softAskRemaining(missing)
  if (fromMissing.length > 0) return fromMissing.slice(0, 1)
  return []
}

function isAffirmative(text: string): boolean {
  const lower = text.trim().toLowerCase()
  return /^(yes|yep|ok|okay|sure|go ahead|please do|confirm|do it|sounds good)\b/i.test(lower)
    || /^(نعم|أيوه|ايوه|موافق|تم|أكد|أكدها|يلا|حسنا|حسناً|تمام)\b/.test(text.trim())
    || /\b(go ahead|build (the )?plan|generate|لنبني|ابني|ولّد|ولد)\b/i.test(lower)
}

function buildHeardSummary(
  ctx: ConciergeTurnContext,
  mustHaves: string[],
): string[] {
  const rows: string[] = []
  const dest = ctx.requirements.destination || ctx.requirements.destinations[0]
  const ar = ctx.locale === 'ar'
  if (dest) {
    const destAr: Record<string, string> = {
      Morocco: 'المغرب',
      Marrakech: 'مراكش',
      Agadir: 'أكادير',
      Dubai: 'دبي',
      Riyadh: 'الرياض',
      Jeddah: 'جدة',
    }
    rows.push(ar ? (destAr[dest] || dest) : dest)
  }
  if (ctx.requirements.durationDays != null) {
    const d = ctx.requirements.durationDays
    rows.push(ar ? (d === 7 ? 'أسبوع' : `${d} أيام`) : `${d} days`)
  }
  if (ctx.requirements.budgetAmount != null) {
    const cur = (ctx.requirements.budgetCurrency || 'SAR').toUpperCase()
    const curLabel = ar
      ? (cur === 'SAR' ? 'ريال' : cur === 'USD' ? 'دولار' : cur === 'AED' ? 'درهم' : cur)
      : cur
    rows.push(`${ctx.requirements.budgetAmount} ${curLabel}`)
  } else if (ctx.requirements.budgetFlexible) {
    rows.push(ar ? 'ميزانية مرنة' : 'flexible budget')
  }
  if (ctx.requirements.travelers != null) {
    rows.push(ar ? `${ctx.requirements.travelers} مسافرين` : `${ctx.requirements.travelers} travelers`)
  }
  for (const item of mustHaves.slice(0, 3)) rows.push(item)
  return rows
}
