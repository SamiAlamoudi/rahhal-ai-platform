/**
 * Sprint 68 — Rollback system (deployment / config / provider / feature / safe mode).
 */

import { evaluatePatchRelease, shouldRollback } from '../release'
import { collectMonitoringSnapshot } from '../observability/monitoring'
import { evaluateAlertRules, DEFAULT_ALERT_RULES } from '../alerting'
import { planRecovery } from '../production/recovery'
import type { RollbackPlan, RollbackStep } from './types'

export function buildRollbackPlan(input?: {
  forceSafeMode?: boolean
  now?: () => number
}): RollbackPlan {
  const now = input?.now ?? (() => Date.now())
  const snapshot = collectMonitoringSnapshot()
  const alerts = evaluateAlertRules(snapshot, DEFAULT_ALERT_RULES)
  const decision = evaluatePatchRelease({ snapshot, alerts })
  const recommended = shouldRollback(snapshot, alerts) || input?.forceSafeMode === true
  const recovery = planRecovery({ scenario: 'provider_unavailable' })

  const steps: RollbackStep[] = [
    {
      id: 'safe_mode',
      kind: 'safe_mode',
      action: 'Enable safe mode: mock payments, live providers OFF, fail-closed readiness',
      automatic: true,
      priority: 1,
    },
    {
      id: 'feature_rollback',
      kind: 'feature',
      action: 'Disable experimental/beta flags (ai.live_providers, payments.live, providers.live_master)',
      automatic: true,
      priority: 2,
    },
    {
      id: 'provider_rollback',
      kind: 'provider',
      action: 'Force mock adapters + provider mock fallback; open circuits remain open',
      automatic: true,
      priority: 3,
    },
    {
      id: 'configuration_rollback',
      kind: 'configuration',
      action: 'Restore last known-good VITE_DEPLOY_TARGET + payment/provider env profile',
      automatic: false,
      priority: 4,
    },
    {
      id: 'deployment_rollback',
      kind: 'deployment',
      action: 'Redeploy previous Git SHA / hosting release artifact',
      automatic: false,
      priority: 5,
    },
    {
      id: 'startup_recovery',
      kind: 'startup_recovery',
      action: `Run startup recovery: ${recovery.actions.map((s) => s.detail).join(' → ') || 'revalidate env + health'}`,
      automatic: true,
      priority: 6,
    },
  ]

  return {
    recommended,
    reason: recommended
      ? decision.rationale
      : input?.forceSafeMode
        ? 'Safe mode requested'
        : 'No critical rollback trigger — continue monitoring',
    safeMode: Boolean(input?.forceSafeMode) || recommended,
    steps,
    releaseAction: decision.action,
    generatedAt: new Date(now()).toISOString(),
  }
}

export function triggerRollback(input?: { forceSafeMode?: boolean }): RollbackPlan {
  return buildRollbackPlan({ ...input, forceSafeMode: input?.forceSafeMode ?? true })
}
