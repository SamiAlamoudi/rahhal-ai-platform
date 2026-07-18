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

export function decideConciergeTurn(ctx: ConciergeTurnContext): ConciergeTurnDecision {
  const previous = ctx.previous ?? emptyConciergeState()
  const softSignals = extractSoftSignals(ctx.userText, ctx.locale, previous.softSignals)
  const phase = resolveConciergePhase({
    memory: ctx.memory,
    previous,
    intent: ctx.intent,
    softSignals,
  })

  const hardMissing = hardMissingCount(ctx.missingFields)
  const hasPlan = Boolean(ctx.memory.tripPlan)
  const heardSummary = buildHeardSummary(ctx, softSignals.mustHaves)

  let action: ConciergeAction
  let askFields: Array<keyof TripRequirements> = []
  let shouldExecuteAgent = false
  let rationale: string

  if (phase === 'greeting' && previous.turnCount === 0) {
    action = 'greet'
    askFields = pickAskFields(ctx.missingFields, 2)
    rationale = 'First turn — greet and open discovery.'
  } else if (phase === 'refining' && hasPlan) {
    if (ctx.intent === 'regenerate' || ctx.intent === 'regenerate_day' || ctx.intent === 'edit' || ctx.intent === 'plan') {
      action = 'refine'
      shouldExecuteAgent = true
      rationale = 'Plan exists — refine via agent abstractions.'
    } else if (ctx.intent === 'save') {
      action = 'refine'
      shouldExecuteAgent = true
      rationale = 'Save requested — agent handles persistence ack.'
    } else {
      action = 'advise'
      rationale = 'Plan exists — advise without re-executing.'
    }
  } else if (hardMissing > 0) {
    action = previous.turnCount === 0 ? 'greet' : (hardMissing >= 3 ? 'ask' : 'clarify')
    askFields = pickAskFields(ctx.missingFields, action === 'greet' ? 2 : Math.min(2, hardMissing))
    rationale = 'Hard requirements incomplete — ask/clarify as a consultant.'
  } else if (!hasSoftDepth(softSignals) && phase === 'deepening') {
    action = 'ask'
    askFields = pickSoftAskFields(ctx.missingFields)
    rationale = 'Hard intake complete — deepen soft preferences.'
  } else if (phase === 'advising' && !hasPlan) {
    // First advising turn: propose options; then confirm / execute.
    if (previous.lastAction !== 'propose_options' && previous.lastAction !== 'confirm') {
      action = 'propose_options'
      rationale = 'Enough context — propose conversational options.'
    } else if (isAffirmative(ctx.userText) || ctx.intent === 'plan') {
      action = 'confirm'
      rationale = 'Traveler affirmed — confirm before executing agent.'
    } else {
      action = 'advise'
      rationale = 'Continue advising with tradeoffs.'
    }
  } else if (phase === 'confirming' || (previous.lastAction === 'propose_options' && isAffirmative(ctx.userText))) {
    if (isAffirmative(ctx.userText) || ctx.intent === 'plan') {
      action = 'plan'
      shouldExecuteAgent = true
      rationale = 'Confirmed — execute agent planning (provider-agnostic).'
    } else {
      action = 'confirm'
      rationale = 'Awaiting explicit confirmation.'
    }
  } else if (hardMissing === 0 && (ctx.intent === 'plan' || isAffirmative(ctx.userText))) {
    action = 'plan'
    shouldExecuteAgent = true
    rationale = 'Requirements ready — hand off to agent plan path.'
  } else if (hardMissing === 0 && hasSoftDepth(softSignals)) {
    action = previous.lastAction === 'propose_options' ? 'confirm' : 'propose_options'
    rationale = 'Ready to advise with options.'
  } else {
    action = 'ask'
    askFields = pickAskFields(ctx.missingFields, 1)
    rationale = 'Default discovery ask.'
  }

  // Map propose_options / plan to search synonym only as agent execute flag —
  // Concierge never chooses a supplier; `search` means "ask agent to fulfill".
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

function pickSoftAskFields(
  missing: Array<keyof TripRequirements>,
): Array<keyof TripRequirements> {
  const fromMissing = SOFT_ASK_FIELDS.filter((field) => missing.includes(field))
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
