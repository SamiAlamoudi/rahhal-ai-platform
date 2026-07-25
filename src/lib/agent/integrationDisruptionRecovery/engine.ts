/**
 * Integration Sprint 10 — DisruptionEngine entrypoint.
 */

import type { AgentLocale, AgentMemory, TripPlan } from '../types'
import { isIntegrationDisruptionRecoveryEnabled } from './feature'
import { detectLiveDisruption, detectRecoveryIntent } from './detector'
import { analyzeDisruptionImpact } from './impact'
import { planRecoveryOptions } from './recoveryPlanner'
import { buildAutoReplan } from './replan'
import { createMockLiveDisruptionAlertProvider } from './liveAlerts'
import { buildDisruptionRecoverySummary } from './consultant'
import {
  INTEGRATION_DISRUPTION_RECOVERY_VERSION,
  type DisruptionRecoveryResult,
  type LiveDisruptionAlertProvider,
  type RecoveryStrategy,
} from './types'

export interface DisruptionRecoveryDeps {
  enabled?: boolean
  alertProvider?: LiveDisruptionAlertProvider
  preferredStrategy?: RecoveryStrategy | null
}

export interface RunDisruptionRecoveryInput {
  memory: AgentMemory
  tripPlan?: TripPlan | null
  userText?: string | null
  locale?: AgentLocale
  deps?: DisruptionRecoveryDeps
}

export class DisruptionEngine {
  constructor(private readonly deps: DisruptionRecoveryDeps = {}) {}

  isEnabled(): boolean {
    return isIntegrationDisruptionRecoveryEnabled({ enabled: this.deps.enabled })
  }

  async run(input: RunDisruptionRecoveryInput): Promise<DisruptionRecoveryResult> {
    const started = Date.now()
    if (!isIntegrationDisruptionRecoveryEnabled({
      enabled: input.deps?.enabled ?? this.deps.enabled,
    })) {
      return disabled(Date.now() - started)
    }

    const logs = ['disruption_recovery_enabled']
    const userText = input.userText?.trim() ?? ''
    const intent = detectRecoveryIntent(userText)
    logs.push(`intent:${intent}`)

    const disruption = detectLiveDisruption(userText)
    if (!disruption && intent === 'unknown') {
      const summary = buildDisruptionRecoverySummary({
        disruption: null,
        impact: null,
        risk: null,
        primary: null,
        plans: [],
        replan: null,
      })
      return {
        version: INTEGRATION_DISRUPTION_RECOVERY_VERSION,
        enabled: true,
        ok: false,
        intent,
        disruption: null,
        impact: null,
        risk: null,
        plans: [],
        primary: null,
        replan: null,
        liveAlertsReady: false,
        consultantSummaryEn: summary.en,
        consultantSummaryAr: summary.ar,
        latencyMs: Date.now() - started,
        logs: [...logs, 'no_disruption_detected'],
      }
    }

    // "What should I do now?" without explicit disruption — soft prompt unless prior context
    if (!disruption) {
      const summary = buildDisruptionRecoverySummary({
        disruption: null,
        impact: null,
        risk: null,
        primary: null,
        plans: [],
        replan: null,
      })
      return {
        version: INTEGRATION_DISRUPTION_RECOVERY_VERSION,
        enabled: true,
        ok: intent === 'what_now',
        intent,
        disruption: null,
        impact: null,
        risk: null,
        plans: [],
        primary: null,
        replan: null,
        liveAlertsReady: false,
        consultantSummaryEn: intent === 'what_now'
          ? 'If something broke in your trip (delay, missed connection, hotel issue), tell me and I’ll rebuild options.'
          : summary.en,
        consultantSummaryAr: intent === 'what_now'
          ? 'إذا حدث خلل في رحلتك (تأخير، فوت ترانزيت، مشكلة فندق) أخبرني وسأعيد بناء الخيارات.'
          : summary.ar,
        latencyMs: Date.now() - started,
        logs: [...logs, 'awaiting_disruption_details'],
      }
    }

    const plan = input.tripPlan ?? input.memory.tripPlan
    const impact = analyzeDisruptionImpact({ disruption, plan })
    logs.push(`risk:${disruption.risk}`, `stress:${impact.stressScore}`)

    const currency = plan?.estimatedBudget.currency
      ?? input.memory.requirements.budgetCurrency
      ?? 'SAR'
    let plans = planRecoveryOptions({ disruption, impact, currency })
    if (input.deps?.preferredStrategy || this.deps.preferredStrategy) {
      const preferred = input.deps?.preferredStrategy ?? this.deps.preferredStrategy
      plans = [...plans].sort((a, b) => {
        if (a.strategy === preferred) return -1
        if (b.strategy === preferred) return 1
        return b.score - a.score
      })
    }
    const primary = plans[0] ?? null

    const replan = buildAutoReplan({
      disruption,
      impact,
      plan,
      recoveryExtraCost: primary?.extraCost,
    })
    logs.push('auto_replan')

    const alerts = input.deps?.alertProvider
      ?? this.deps.alertProvider
      ?? createMockLiveDisruptionAlertProvider()
    const polled = await alerts.poll({ tripId: plan?.id })
    logs.push(`alerts:${polled.length}:live=${alerts.live}`)

    const summary = buildDisruptionRecoverySummary({
      disruption,
      impact,
      risk: disruption.risk,
      primary,
      plans,
      replan,
    })

    return {
      version: INTEGRATION_DISRUPTION_RECOVERY_VERSION,
      enabled: true,
      ok: true,
      intent: intent === 'unknown' ? 'report_disruption' : intent,
      disruption,
      impact,
      risk: disruption.risk,
      plans,
      primary,
      replan,
      liveAlertsReady: false,
      consultantSummaryEn: summary.en,
      consultantSummaryAr: summary.ar,
      latencyMs: Date.now() - started,
      logs,
    }
  }
}

function disabled(latencyMs: number): DisruptionRecoveryResult {
  return {
    version: INTEGRATION_DISRUPTION_RECOVERY_VERSION,
    enabled: false,
    ok: false,
    intent: 'unknown',
    disruption: null,
    impact: null,
    risk: null,
    plans: [],
    primary: null,
    replan: null,
    liveAlertsReady: false,
    consultantSummaryEn: '',
    consultantSummaryAr: '',
    latencyMs,
    logs: ['disruption_recovery_disabled'],
  }
}

export function createDisruptionEngine(deps?: DisruptionRecoveryDeps): DisruptionEngine {
  return new DisruptionEngine(deps)
}

export async function runDisruptionRecovery(
  input: RunDisruptionRecoveryInput,
): Promise<DisruptionRecoveryResult> {
  return createDisruptionEngine(input.deps).run(input)
}
