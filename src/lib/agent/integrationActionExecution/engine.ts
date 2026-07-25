/**
 * Integration Sprint 11 — ActionEngine entrypoint.
 * Pipeline: Intent → Validation → Confirmation → Provider Execution → Result → Summary
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationActionExecutionEnabled } from './feature'
import { detectActionIntent, detectActionKind } from './intents'
import { buildConfirmationGate } from './confirmation'
import { validateAction } from './validation'
import { executeActionSafely, type ActionExecuteDeps } from './execute'
import {
  readActionMemory,
  recordHistory,
  setPendingAction,
  writeActionMemory,
} from './memory'
import { buildActionExecutionSummary } from './consultant'
import {
  FUTURE_LIVE_ACTION_CAPABILITIES,
  INTEGRATION_ACTION_EXECUTION_VERSION,
  type ActionExecutionMode,
  type ActionExecutionResult,
  type ActionKind,
  type ActionPipelineStage,
  type PendingAction,
} from './types'

export interface ActionExecutionDeps extends ActionExecuteDeps {
  enabled?: boolean
  userId?: string | null
  /** Default preview for first ask; mock after confirm. Live always blocked. */
  defaultMode?: ActionExecutionMode
}

export interface RunActionExecutionInput {
  memory: AgentMemory
  tripPlan?: TripPlan | null
  userText?: string | null
  locale?: AgentLocale
  deps?: ActionExecutionDeps
}

const ACTION_LABELS: Record<ActionKind, { en: string; ar: string }> = {
  book_flight: { en: 'Book flight', ar: 'حجز رحلة' },
  reserve_hotel: { en: 'Reserve hotel', ar: 'حجز فندق' },
  save_itinerary: { en: 'Save itinerary', ar: 'حفظ الخطة' },
  share_trip: { en: 'Share trip', ar: 'مشاركة الرحلة' },
  cancel_booking: { en: 'Cancel booking', ar: 'إلغاء الحجز' },
  modify_booking: { en: 'Modify booking', ar: 'تعديل الحجز' },
}

export class ActionEngine {
  private readonly deps: ActionExecutionDeps

  constructor(deps: ActionExecutionDeps = {}) {
    this.deps = deps
  }

  isEnabled(): boolean {
    return isIntegrationActionExecutionEnabled({ enabled: this.deps.enabled })
  }

  async run(input: RunActionExecutionInput): Promise<ActionExecutionResult> {
    const started = Date.now()
    if (!isIntegrationActionExecutionEnabled({
      enabled: input.deps?.enabled ?? this.deps.enabled,
    })) {
      return disabled(Date.now() - started)
    }

    const logs = ['action_execution_enabled']
    const stages: ActionPipelineStage[] = ['intent']
    const userId = input.deps?.userId ?? this.deps.userId ?? null
    const userText = input.userText?.trim() ?? ''
    const intent = detectActionIntent(userText)
    logs.push(`intent:${intent}`)

    let memorySnap = readActionMemory(userId)
    let action = detectActionKind(userText)
    if (!action && intent === 'confirm_action' && memorySnap.pending) {
      action = memorySnap.pending.kind
    }
    if (!action && intent === 'decline_action' && memorySnap.pending) {
      action = memorySnap.pending.kind
    }

    if (!action && intent === 'unknown') {
      const summary = buildActionExecutionSummary({
        action: null,
        intent,
        confirmation: null,
        execution: null,
        validation: null,
        mode: 'preview',
      })
      return {
        version: INTEGRATION_ACTION_EXECUTION_VERSION,
        enabled: true,
        ok: false,
        intent,
        action: null,
        mode: 'preview',
        stages,
        validation: null,
        confirmation: null,
        execution: null,
        memory: memorySnap,
        liveReady: false,
        consultantSummaryEn: summary.en,
        consultantSummaryAr: summary.ar,
        latencyMs: Date.now() - started,
        logs: [...logs, 'no_action_detected'],
      }
    }

    if (intent === 'decline_action' && memorySnap.pending) {
      stages.push('confirmation', 'result', 'conversation_summary')
      const declined = memorySnap.pending
      memorySnap = recordHistory(userId, {
        id: `hist_${Date.now().toString(36)}`,
        kind: declined.kind,
        status: 'declined',
        mode: 'preview',
        at: new Date().toISOString(),
        detailEn: 'Traveler declined confirmation',
      })
      memorySnap = setPendingAction(userId, null)
      const summary = {
        en: 'Okay — I cancelled that pending action. Nothing was booked.',
        ar: 'حسناً — ألغيت الإجراء المعلّق. لم يُحجز شيء.',
      }
      return {
        version: INTEGRATION_ACTION_EXECUTION_VERSION,
        enabled: true,
        ok: true,
        intent,
        action: declined.kind,
        mode: 'preview',
        stages,
        validation: null,
        confirmation: {
          required: true,
          kind: 'booking',
          confirmed: false,
          promptEn: '',
          promptAr: '',
        },
        execution: null,
        memory: memorySnap,
        liveReady: false,
        consultantSummaryEn: summary.en,
        consultantSummaryAr: summary.ar,
        latencyMs: Date.now() - started,
        logs: [...logs, 'declined'],
      }
    }

    if (!action) {
      const summary = buildActionExecutionSummary({
        action: null,
        intent,
        confirmation: null,
        execution: null,
        validation: null,
        mode: 'preview',
      })
      return {
        version: INTEGRATION_ACTION_EXECUTION_VERSION,
        enabled: true,
        ok: false,
        intent,
        action: null,
        mode: 'preview',
        stages,
        validation: null,
        confirmation: null,
        execution: null,
        memory: memorySnap,
        liveReady: false,
        consultantSummaryEn: summary.en,
        consultantSummaryAr: summary.ar,
        latencyMs: Date.now() - started,
        logs: [...logs, 'awaiting_action'],
      }
    }

    const plan = input.tripPlan ?? input.memory.tripPlan
    stages.push('validation')
    const validation = validateAction({ action, plan })
    logs.push(`validation:${validation.ok ? 'ok' : 'missing'}`)

    if (!validation.ok) {
      stages.push('conversation_summary')
      const summary = buildActionExecutionSummary({
        action,
        intent,
        confirmation: null,
        execution: null,
        validation,
        mode: 'preview',
      })
      return {
        version: INTEGRATION_ACTION_EXECUTION_VERSION,
        enabled: true,
        ok: false,
        intent,
        action,
        mode: 'preview',
        stages,
        validation,
        confirmation: null,
        execution: null,
        memory: memorySnap,
        liveReady: false,
        consultantSummaryEn: summary.en,
        consultantSummaryAr: summary.ar,
        latencyMs: Date.now() - started,
        logs,
      }
    }

    const defaultMode = input.deps?.defaultMode ?? this.deps.defaultMode ?? 'preview'
    const confirmed = intent === 'confirm_action'
      && memorySnap.pending?.kind === action

    stages.push('confirmation')
    const confirmation = buildConfirmationGate({
      action,
      confirmed,
      paymentCue: /pay|payment|ادفع|دفع/i.test(userText),
    })

    // First request (or confirm without pending): preview + require confirmation when needed
    if (confirmation.required && !confirmed) {
      const pending: PendingAction = {
        id: `pending_${action}_${Date.now().toString(36)}`,
        kind: action,
        createdAt: new Date().toISOString(),
        offerId: null,
        summaryEn: ACTION_LABELS[action].en,
        summaryAr: ACTION_LABELS[action].ar,
      }
      memorySnap = setPendingAction(userId, pending)
      memorySnap = recordHistory(userId, {
        id: `hist_${Date.now().toString(36)}`,
        kind: action,
        status: 'pending',
        mode: defaultMode === 'live' ? 'preview' : defaultMode,
        at: pending.createdAt,
        detailEn: 'Awaiting traveler confirmation',
      })
      memorySnap = writeActionMemory(userId, {
        ...memorySnap,
        lastConfirmation: {
          kind: confirmation.kind,
          confirmed: false,
          at: pending.createdAt,
        },
      })

      // Preview / dry-run snapshot (no side effects)
      stages.push('provider_execution', 'result', 'conversation_summary')
      const previewMode: ActionExecutionMode =
        defaultMode === 'dry_run' ? 'dry_run' : 'preview'
      const execution = await executeActionSafely({
        action,
        mode: previewMode,
        deps: { ...this.deps, ...input.deps, mode: previewMode },
      })
      logs.push(`preview:${previewMode}`)

      const summary = buildActionExecutionSummary({
        action,
        intent,
        confirmation,
        execution,
        validation,
        mode: previewMode,
      })

      return {
        version: INTEGRATION_ACTION_EXECUTION_VERSION,
        enabled: true,
        ok: true,
        intent: intent === 'unknown' ? 'request_action' : intent,
        action,
        mode: previewMode,
        stages,
        validation,
        confirmation,
        execution,
        memory: memorySnap,
        liveReady: false,
        consultantSummaryEn: summary.en,
        consultantSummaryAr: summary.ar,
        latencyMs: Date.now() - started,
        logs: [...logs, `future:${JSON.stringify(FUTURE_LIVE_ACTION_CAPABILITIES)}`],
      }
    }

    // Confirmed (or no confirmation required) → mock execute (never live)
    const execMode: ActionExecutionMode = 'mock'
    stages.push('provider_execution')
    const execution = await executeActionSafely({
      action,
      mode: execMode,
      deps: { ...this.deps, ...input.deps, mode: execMode },
    })
    stages.push('result', 'conversation_summary')
    logs.push(`executed:${execution.mode}:${execution.success}`)

    const now = new Date().toISOString()
    memorySnap = setPendingAction(userId, null)
    memorySnap = writeActionMemory(userId, {
      ...memorySnap,
      lastConfirmation: {
        kind: confirmation.kind,
        confirmed: true,
        at: now,
      },
    })
    memorySnap = recordHistory(userId, {
      id: `hist_${Date.now().toString(36)}`,
      kind: action,
      status: execution.success ? 'completed' : 'failed',
      mode: execMode,
      at: now,
      detailEn: execution.detailEn,
    })

    const summary = buildActionExecutionSummary({
      action,
      intent,
      confirmation: { ...confirmation, confirmed: true },
      execution,
      validation,
      mode: execMode,
    })

    return {
      version: INTEGRATION_ACTION_EXECUTION_VERSION,
      enabled: true,
      ok: execution.success,
      intent: confirmed ? 'confirm_action' : 'request_action',
      action,
      mode: execMode,
      stages,
      validation,
      confirmation: { ...confirmation, confirmed: true },
      execution,
      memory: memorySnap,
      liveReady: false,
      consultantSummaryEn: summary.en,
      consultantSummaryAr: summary.ar,
      latencyMs: Date.now() - started,
      logs,
    }
  }
}

function disabled(latencyMs: number): ActionExecutionResult {
  return {
    version: INTEGRATION_ACTION_EXECUTION_VERSION,
    enabled: false,
    ok: false,
    intent: 'unknown',
    action: null,
    mode: 'preview',
    stages: [],
    validation: null,
    confirmation: null,
    execution: null,
    memory: {
      pending: null,
      lastConfirmation: null,
      completed: null,
      history: [],
    },
    liveReady: false,
    consultantSummaryEn: '',
    consultantSummaryAr: '',
    latencyMs,
    logs: ['action_execution_disabled'],
  }
}

export function createActionEngine(deps?: ActionExecutionDeps): ActionEngine {
  return new ActionEngine(deps)
}

export async function runActionExecution(
  input: RunActionExecutionInput,
): Promise<ActionExecutionResult> {
  return createActionEngine(input.deps).run(input)
}
