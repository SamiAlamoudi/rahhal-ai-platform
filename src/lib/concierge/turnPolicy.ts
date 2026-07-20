/**
 * Concierge turn policy — decides ask / advise / confirm / execute.
 * Speaks only in agent terms. Never selects providers or search engines.
 */

import type { TripRequirements } from '../agent/types'
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

  let action: ConciergeAction
  let askFields: Array<keyof TripRequirements> = []
  let shouldExecuteAgent = false
  let rationale: string

  // Sprint 45 — open-ended discovery: propose reasoned options instead of asking "where?".
  if (
    ctx.requirements.destinationFlexible
    && !ctx.requirements.destination
    && (ctx.intent === 'discover' || ctx.requirements.weatherPreference)
  ) {
    action = previous.turnCount === 0 ? 'greet' : 'propose_options'
    askFields = pickAskFields(
      ctx.missingFields.filter((field) => field !== 'destination'),
      2,
    )
    rationale = 'Open-ended discovery — propose destinations; ask only remaining hard slots.'
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
    }
  }

  if (phase === 'greeting' && previous.turnCount === 0 && !intakeComplete) {
    action = 'greet'
    askFields = pickAskFields(ctx.missingFields, 2)
    rationale = 'First turn — greet and open discovery.'
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
    && (isAffirmative(ctx.userText) || ctx.intent === 'plan')
  ) {
    action = 'plan'
    shouldExecuteAgent = true
    rationale = 'Traveler confirmed options — hand off to agent plan path.'
  } else if (intakeComplete && EXECUTE_INTENTS.has(ctx.intent)) {
    // Full agent intake satisfied — Concierge yields to the travel engine.
    action = 'plan'
    shouldExecuteAgent = true
    rationale = 'Intake complete — hand off to agent plan path.'
  } else if (intakeComplete && ctx.intent === 'unknown' && hasSoftDepth(softSignals)) {
    action = previous.lastAction === 'propose_options' ? 'confirm' : 'propose_options'
    rationale = 'Advisory beat — propose conversational options without executing.'
  } else if (hardMissing > 0) {
    action = previous.turnCount === 0 ? 'greet' : (hardMissing >= 3 ? 'ask' : 'clarify')
    askFields = pickAskFields(ctx.missingFields, action === 'greet' ? 2 : Math.min(2, hardMissing))
    rationale = 'Hard requirements incomplete — ask/clarify as a consultant.'
  } else if (!intakeComplete && (phase === 'deepening' || phase === 'advising' || phase === 'discovery')) {
    if (hasSoftDepth(softSignals) && softAskRemaining(ctx.missingFields).length <= 2) {
      action = 'propose_options'
      askFields = softAskRemaining(ctx.missingFields).slice(0, 2)
      rationale = 'Hard intake ready — propose directions while soft slots remain.'
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
  }
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
  if (fromMissing.length > 0) return fromMissing.slice(0, 2)
  return ['interests', 'budgetStyle']
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
  if (dest) rows.push(dest)
  if (ctx.requirements.durationDays != null) rows.push(`${ctx.requirements.durationDays}d`)
  if (ctx.requirements.budgetAmount != null) {
    rows.push(`${ctx.requirements.budgetAmount}${ctx.requirements.budgetCurrency ?? ''}`)
  } else if (ctx.requirements.budgetFlexible) {
    rows.push('flexible-budget')
  }
  if (ctx.requirements.travelers != null) rows.push(`${ctx.requirements.travelers} pax`)
  for (const item of mustHaves.slice(0, 3)) rows.push(item)
  return rows
}
