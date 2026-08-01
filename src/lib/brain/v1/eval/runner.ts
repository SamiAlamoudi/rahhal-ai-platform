/**
 * Sprint 88 Task 4 — Deterministic golden evaluator.
 * Uses public Brain preview / ConversationManager / memory adapter contracts.
 * Does not duplicate planner logic or call providers.
 */

import { emptyMemory } from '../../../agent/types'
import type { ChatMessage } from '../../../chat/chatTypes'
import {
  createConversationManager,
  type ConversationManagerResult,
  type ConversationSession,
} from '../conversation'
import { routeBrainPreviewTurn, type BrainRouterDecision } from '../preview/BrainRouter'
import {
  createWorkingMemoryAdapter,
  type MemoryProvenanceMap,
  type WorkingSlotPatch,
} from '../preview/memory'
import type {
  GoldenBehavioralAssertion,
  GoldenEvaluationResult,
  GoldenForbiddenBehavior,
  GoldenScenario,
  GoldenSuiteResult,
} from './types'
import { GOLDEN_EVAL_CONTRACT_VERSION } from './types'

export type GoldenEvaluateOptions = {
  /** Injected by tests (e.g. vi.spyOn createProviderGateway). */
  gatewayCallCount?: () => number
}

type EvalContext = {
  lastCm: ConversationManagerResult | null
  priorCm: ConversationManagerResult | null
  router: BrainRouterDecision | null
  provenance: MemoryProvenanceMap
  priorProvenance: MemoryProvenanceMap
  gatewayCallCount: number
  reply: string
}

function isQuestionOnly(reply: string): boolean {
  const trimmed = reply.trim()
  if (!trimmed) return true
  if (!trimmed.includes('?')) return false
  const withoutQ = trimmed.replace(/\?/g, '').trim()
  const words = withoutQ.split(/\s+/).filter(Boolean)
  return words.length <= 8 && /^when |^where |^which |^how |^what |^من |^متى |^أين /i.test(trimmed)
}

function slotValue(
  slots: ConversationManagerResult['knownSlots'],
  slot: string,
): string | number | null | undefined {
  if (!slots) return undefined
  return (slots as unknown as Record<string, string | number | null | undefined>)[slot]
}

function checkAssertion(
  assertion: GoldenBehavioralAssertion,
  ctx: EvalContext,
): string | null {
  const cm = ctx.lastCm
  const response = cm?.response
  const reply = ctx.reply

  switch (assertion.kind) {
    case 'provided_value':
      if (Boolean(response?.providedValue) !== assertion.equals) {
        return `provided_value expected ${assertion.equals}, got ${response?.providedValue}`
      }
      return null
    case 'question_count_max':
      if ((response?.questionCount ?? 99) > assertion.max) {
        return `question_count ${response?.questionCount} exceeds max ${assertion.max}`
      }
      return null
    case 'question_count_equals':
      if ((response?.questionCount ?? -1) !== assertion.equals) {
        return `question_count expected ${assertion.equals}, got ${response?.questionCount}`
      }
      return null
    case 'reply_not_question_only':
      if (isQuestionOnly(reply)) {
        return 'reply_not_question_only failed: reply looks question-only'
      }
      return null
    case 'reply_ends_with_question':
      if (reply.trim().endsWith('?') !== assertion.equals) {
        return `reply_ends_with_question expected ${assertion.equals}`
      }
      return null
    case 'reply_matches': {
      const re = new RegExp(assertion.pattern, assertion.flags ?? 'i')
      if (!re.test(reply)) {
        return `reply_matches failed /${assertion.pattern}/`
      }
      return null
    }
    case 'question_slot_not_in': {
      const slot = cm?.question?.slot
      if (slot && assertion.slots.includes(String(slot))) {
        return `question_slot_not_in failed: asked ${slot}`
      }
      return null
    }
    case 'question_slot_is': {
      const slot = cm?.question?.slot ?? null
      if (slot !== assertion.slot) {
        return `question_slot_is expected ${assertion.slot}, got ${slot}`
      }
      return null
    }
    case 'router_path':
      if (!ctx.router || ctx.router.path !== assertion.path) {
        return `router_path expected ${assertion.path}, got ${ctx.router?.path ?? 'null'}`
      }
      return null
    case 'tool_batch_null':
      if (ctx.router?.path === 'brain' && ctx.router.result.toolBatch != null) {
        return 'tool_batch_null failed: toolBatch present'
      }
      return null
    case 'plan_id_preserved': {
      const a = ctx.priorCm?.session?.plan?.planId
      const b = cm?.session?.plan?.planId
      if (!a || !b || a !== b) {
        return `plan_id_preserved failed: ${a} → ${b}`
      }
      return null
    }
    case 'revised_slots_include':
      for (const s of assertion.slots) {
        if (!(cm?.revisedSlots ?? []).includes(s as never)) {
          return `revised_slots_include missing ${s}`
        }
      }
      return null
    case 'revised_slots_exclude':
      for (const s of assertion.slots) {
        if ((cm?.revisedSlots ?? []).includes(s as never)) {
          return `revised_slots_exclude found ${s}`
        }
      }
      return null
    case 'known_slot_equals': {
      const v = slotValue(cm?.knownSlots ?? null, assertion.slot)
      if (v !== assertion.value) {
        return `known_slot_equals ${assertion.slot}: expected ${assertion.value}, got ${v}`
      }
      return null
    }
    case 'known_slot_preserved': {
      const v = slotValue(cm?.knownSlots ?? null, assertion.slot)
      if (v !== assertion.value) {
        return `known_slot_preserved ${assertion.slot}: expected ${assertion.value}, got ${v}`
      }
      return null
    }
    case 'provenance_changed':
      for (const field of assertion.fields) {
        const prev = ctx.priorProvenance[field]
        const next = ctx.provenance[field]
        if (!next) return `provenance_changed missing ${field}`
        if (prev && prev.value === next.value) {
          return `provenance_changed ${field} value unchanged`
        }
      }
      return null
    case 'provenance_preserved':
      for (const field of assertion.fields) {
        const prev = ctx.priorProvenance[field]
        const next = ctx.provenance[field]
        if (!prev || !next) return `provenance_preserved missing ${field}`
        if (prev.value !== next.value) {
          return `provenance_preserved ${field} value changed`
        }
      }
      return null
    case 'fallback_reason_present':
      if (ctx.router?.path !== 'fallback' || !ctx.router.reason) {
        return 'fallback_reason_present failed'
      }
      return null
    case 'provider_gateway_not_called':
      if (ctx.gatewayCallCount !== 0) {
        return `provider_gateway_not_called failed: ${ctx.gatewayCallCount} calls`
      }
      return null
    default:
      return 'unknown assertion'
  }
}

function checkForbidden(
  code: GoldenForbiddenBehavior,
  ctx: EvalContext,
): string | null {
  const cm = ctx.lastCm
  const reply = ctx.reply
  const slot = cm?.question?.slot ? String(cm.question.slot) : null
  const qCount = cm?.response?.questionCount ?? 0

  switch (code) {
    case 'question_only_reply':
      return isQuestionOnly(reply) ? 'forbidden: question_only_reply' : null
    case 'exceed_one_question':
      return qCount > 1 || (reply.match(/\?/g) ?? []).length > 1
        ? 'forbidden: exceed_one_question'
        : null
    case 'ask_passport_in_explore':
      return slot === 'passport' || /passport number|جواز السفر/i.test(reply)
        ? 'forbidden: ask_passport_in_explore'
        : null
    case 'ask_payment_in_explore':
      return slot === 'payment_consent' || /payment consent|card number|رقم البطاقة/i.test(reply)
        ? 'forbidden: ask_payment_in_explore'
        : null
    case 'ask_traveler_identity_in_explore':
      return slot === 'traveler_identity' || /full name as on the passport|الهوية/i.test(reply)
        ? 'forbidden: ask_traveler_identity_in_explore'
        : null
    case 'invoke_search':
      if (ctx.router?.path === 'brain' && ctx.router.result.toolBatch != null) {
        return 'forbidden: invoke_search'
      }
      return null
    case 'invoke_provider_gateway':
      return ctx.gatewayCallCount > 0 ? 'forbidden: invoke_provider_gateway' : null
    case 'discard_prior_context': {
      if (!ctx.priorCm?.knownSlots) return null
      if (ctx.priorCm.knownSlots.origin && !cm?.knownSlots?.origin) {
        return 'forbidden: discard_prior_context (origin lost)'
      }
      if (
        ctx.priorCm.knownSlots.budget != null
        && cm?.knownSlots?.budget == null
        && !(cm?.revisedSlots ?? []).includes('budget')
      ) {
        return 'forbidden: discard_prior_context (budget lost)'
      }
      if (ctx.priorCm.knownSlots.destination && !cm?.knownSlots?.destination) {
        return 'forbidden: discard_prior_context (destination lost)'
      }
      return null
    }
    case 'silent_empty_failure':
      if (ctx.router?.path === 'fallback' && ctx.router.reason) return null
      if (ctx.router?.path === 'brain' && reply.trim()) return null
      if (ctx.router?.path === 'current') return null
      return 'forbidden: silent_empty_failure'
    case 'enable_ai_tie_v1':
      return null
    default:
      return null
  }
}

function msg(role: 'user' | 'assistant', content: string, conversationId: string): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role,
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

/**
 * Evaluate one golden scenario deterministically.
 * Multi-turn scenarios use ConversationManager session continuity.
 * Provenance assertions use WorkingMemoryAdapter (Task 3) — not wired into production.
 */
export function evaluateGoldenScenario(
  scenario: GoldenScenario,
  options: GoldenEvaluateOptions = {},
): GoldenEvaluationResult {
  const failures: string[] = []
  const manager = createConversationManager()
  const working = createWorkingMemoryAdapter()
  let session: ConversationSession | null = null
  let lastCm: ConversationManagerResult | null = null
  let priorCm: ConversationManagerResult | null = null
  let provenance: MemoryProvenanceMap = {}
  let priorProvenance: MemoryProvenanceMap = {}
  let memory = emptyMemory(scenario.locale)
  let router: BrainRouterDecision | null = null
  let reply = ''

  for (let turnIndex = 0; turnIndex < scenario.turns.length; turnIndex += 1) {
    const turn = scenario.turns[turnIndex]!
    priorCm = lastCm
    priorProvenance = { ...provenance }

    lastCm = manager.turn(
      {
        text: turn.text,
        locale: scenario.locale,
        priorSession: session,
        stage: turn.stage ?? 'explore',
      },
      { enabled: true },
    )
    session = lastCm.session
    reply =
      (scenario.locale === 'en' ? lastCm.response?.en : lastCm.response?.ar)
      || lastCm.response?.en
      || lastCm.response?.ar
      || ''

    if (lastCm.knownSlots) {
      const patch: WorkingSlotPatch = {}
      if (lastCm.knownSlots.destination) patch.destination = lastCm.knownSlots.destination
      if (lastCm.knownSlots.origin) patch.origin = lastCm.knownSlots.origin
      if (lastCm.knownSlots.budget != null) patch.budgetAmount = lastCm.knownSlots.budget
      if (lastCm.knownSlots.adults != null) patch.travelers = lastCm.knownSlots.adults
      if (lastCm.knownSlots.dates?.start) patch.startDate = lastCm.knownSlots.dates.start
      const applied = working.applyIncremental(memory, patch, {
        source: 'user_stated',
        priorProvenance: provenance,
        planId: lastCm.session?.plan?.planId ?? null,
        updatedAt: `2026-08-01T00:00:0${turnIndex}.000Z`,
      })
      memory = applied.memory
      provenance = applied.provenance
    }

    const conversationId = `golden-${scenario.id}`
    router = routeBrainPreviewTurn({
      userText: turn.text,
      locale: scenario.locale,
      conversationId,
      messages: [msg('user', turn.text, conversationId)],
      memory: emptyMemory(scenario.locale),
      enabled: true,
      bypassDeployGateForTests: true,
      runBrain: scenario.injectBrainFailure
        ? () => {
            throw new Error('golden_injected_brain_failure')
          }
        : undefined,
    })
    if (router.path === 'brain') {
      reply = router.result.reply || reply
    }
  }

  const ctx: EvalContext = {
    lastCm,
    priorCm,
    router,
    provenance,
    priorProvenance,
    gatewayCallCount: options.gatewayCallCount?.() ?? 0,
    reply,
  }

  for (const assertion of scenario.expected) {
    const err = checkAssertion(assertion, ctx)
    if (err) failures.push(err)
  }
  for (const code of scenario.forbidden) {
    const lastStage = scenario.turns[scenario.turns.length - 1]?.stage ?? 'explore'
    if (
      lastStage !== 'explore'
      && (code === 'ask_passport_in_explore'
        || code === 'ask_payment_in_explore'
        || code === 'ask_traveler_identity_in_explore')
    ) {
      continue
    }
    const err = checkForbidden(code, ctx)
    if (err) failures.push(err)
  }

  return {
    scenarioId: scenario.id,
    title: scenario.title,
    passed: failures.length === 0,
    failures,
    observations: {
      questionCount: lastCm?.response?.questionCount ?? null,
      providedValue: lastCm?.response?.providedValue ?? null,
      questionSlot: lastCm?.question?.slot ?? null,
      routerPath: router?.path ?? null,
      toolBatchNull:
        router?.path === 'brain' ? router.result.toolBatch === null : null,
      planId: lastCm?.session?.plan?.planId ?? null,
      gatewayCalls: ctx.gatewayCallCount,
      replyPreview: reply.slice(0, 160),
    },
    metadata: scenario.metadata,
  }
}

export function evaluateGoldenSuite(
  scenarios: GoldenScenario[],
  options: GoldenEvaluateOptions = {},
): GoldenSuiteResult {
  const results = scenarios.map((s) => evaluateGoldenScenario(s, options))
  const failureCount = results.filter((r) => !r.passed).length
  return {
    version: GOLDEN_EVAL_CONTRACT_VERSION,
    passed: failureCount === 0,
    results,
    failureCount,
  }
}
