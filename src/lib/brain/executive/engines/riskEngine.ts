/**
 * Risk Engine — safety, disruption, seasonality, and mitigation plans.
 */

import { findDestinationProfile } from '../../../agent/reasoning/destinationCatalog'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
  ExecutivePriority,
} from '../platform/engineContract'

export function createRiskEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'risk',
    version: '1.0.0',
    name: 'Risk Engine',
    description: 'Scores travel risks and produces mitigation + alternative plans.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const dest = ctx.memory.requirements.destination
        ?? ctx.reasoningResult?.primary?.name
        ?? null
      const profile = dest ? findDestinationProfile(dest) : null
      const risks = profile?.risks ?? []
      const findings = [...risks]
      let score = 0.15
      let priority: ExecutivePriority = 'low'

      for (const risk of risks) {
        if (risk.includes('visa') || risk.includes('schengen')) {
          score += 0.18
          priority = raise(priority, 'medium')
        }
        if (risk.includes('high_cost')) {
          score += 0.08
        }
        if (risk.includes('busy') || risk.includes('crowd')) {
          score += 0.12
          priority = raise(priority, 'medium')
        }
        if (risk.includes('weather') || risk.includes('mountain') || risk.includes('storm')) {
          score += 0.15
          priority = raise(priority, 'high')
        }
      }

      if (ctx.tripSignals?.advisoryLevel === 'critical') {
        score += 0.4
        priority = 'critical'
        findings.push('advisory:critical')
      } else if (ctx.tripSignals?.advisoryLevel === 'warning') {
        score += 0.25
        priority = raise(priority, 'high')
        findings.push('advisory:warning')
      }

      if ((ctx.tripSignals?.flightDelayMinutes ?? 0) >= 60) {
        score += 0.2
        priority = raise(priority, 'high')
        findings.push('disruption:delay')
      }

      score = Math.min(0.99, score)

      return {
        engineId: 'risk',
        findings,
        signals: { riskScore: score, destination: dest },
        priority,
      }
    },

    plan(ctx, analysis) {
      const score = Number(analysis.signals.riskScore ?? 0)
      const actions = [{
        id: 'mitigate',
        description: ctx.locale === 'ar'
          ? `خطة تخفيف لمستوى مخاطرة ${score.toFixed(2)}`
          : `Mitigation plan for risk score ${score.toFixed(2)}`,
        priority: analysis.priority,
      }]
      const alternatives = score >= 0.45
        ? [
          ctx.locale === 'ar' ? 'وجهة بديلة أقل مخاطرة' : 'Lower-risk alternative destination',
          ctx.locale === 'ar' ? 'تأمين سفر موسّع' : 'Expanded travel insurance',
        ]
        : []
      return { engineId: 'risk', actions, alternatives }
    },

    execute(ctx, plan) {
      const riskScoreMatch = plan.actions[0]?.description.match(/(\d+\.\d+)/)
      const riskScore = riskScoreMatch
        ? Number(riskScoreMatch[1])
        : Number(ctx.reasoningResult?.primary?.score ?? 0.2)

      const mitigations: string[] = []
      if (riskScore >= 0.3) {
        mitigations.push(ctx.locale === 'ar'
          ? 'احجز التأشيرة/المواعيد مبكراً قبل التذاكر غير القابلة للاسترداد.'
          : 'Secure visa/appointments before non-refundable tickets.')
      }
      if (riskScore >= 0.4) {
        mitigations.push(ctx.locale === 'ar'
          ? 'أضف يوماً عازلاً قبل الاجتماعات أو الرحلات المتصلة.'
          : 'Add a buffer day before meetings or tight connections.')
      }
      if (riskScore >= 0.55) {
        mitigations.push(ctx.locale === 'ar'
          ? 'فعّل تنبيهات الطقس/الإضرابات وخطط بديل فندق.'
          : 'Enable weather/strike alerts and pre-plan a hotel fallback.')
      }
      if (mitigations.length === 0) {
        mitigations.push(ctx.locale === 'ar'
          ? 'المخاطر منخفضة — راقب التحديثات الاعتيادية فقط.'
          : 'Risk is low — routine monitoring is enough.')
      }

      return {
        engineId: 'risk',
        applied: true,
        effects: ['risk_score', 'mitigation_plan'],
        replyFragment: (ctx.locale === 'ar'
          ? `درجة المخاطرة ${riskScore.toFixed(2)}.\n`
          : `Risk score ${riskScore.toFixed(2)}.\n`)
          + mitigations.map((line) => `• ${line}`).join('\n'),
        alerts: riskScore >= 0.55
          ? [{
            priority: 'high' as const,
            message: ctx.locale === 'ar'
              ? 'مخاطر مرتفعة — راجع خطة التخفيف'
              : 'Elevated risk — review mitigation plan',
            category: 'risk',
          }]
          : [],
        recommendations: plan.alternatives.map((title) => ({
          title,
          why: [ctx.locale === 'ar' ? 'تقليل المخاطر' : 'Lower risk exposure'],
          pros: [],
          cons: [],
          tradeoffs: [],
          confidence: 0.7,
        })),
        memoryNotes: [],
        nextBestAction: riskScore >= 0.45
          ? (ctx.locale === 'ar'
            ? 'هل تريد خطة بديلة كاملة؟'
            : 'Want a full alternative plan?')
          : null,
        metadata: { riskScore, mitigations },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.findings.length > 0 ? 0.81 : 0.4
    },
  }
}

function raise(current: ExecutivePriority, next: ExecutivePriority): ExecutivePriority {
  const rank: Record<ExecutivePriority, number> = {
    low: 0,
    medium: 1,
    high: 2,
    critical: 3,
  }
  return rank[next] > rank[current] ? next : current
}
