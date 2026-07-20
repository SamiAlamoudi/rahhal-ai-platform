/**
 * Trip Monitor Engine — continuous watch over trip risks and disruptions.
 */

import { findDestinationProfile } from '../../../agent/reasoning/destinationCatalog'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
  ExecutivePriority,
} from '../platform/engineContract'

export function createTripMonitorEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'trip_monitor',
    version: '1.0.0',
    name: 'Trip Monitor Engine',
    description: 'Monitors flights, weather, visa, passport, advisories, and hotel changes.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const findings: string[] = []
      const signals: Record<string, unknown> = {}
      let priority: ExecutivePriority = 'low'

      const dest = ctx.memory.requirements.destination
        ?? ctx.reasoningResult?.primary?.name
        ?? null
      const profile = dest ? findDestinationProfile(dest) : null
      const risks = profile?.risks ?? []
      const tripSignals = ctx.tripSignals ?? {}

      if ((tripSignals.flightDelayMinutes ?? 0) >= 60) {
        findings.push(ctx.locale === 'ar'
          ? `تأخير طيران ≈ ${tripSignals.flightDelayMinutes} دقيقة`
          : `Flight delay ≈ ${tripSignals.flightDelayMinutes} minutes`)
        signals.flightDelayMinutes = tripSignals.flightDelayMinutes
        priority = raise(priority, 'critical')
      } else if ((tripSignals.flightDelayMinutes ?? 0) >= 20) {
        findings.push(ctx.locale === 'ar' ? 'تأخير طيران متوسط' : 'Moderate flight delay')
        priority = raise(priority, 'high')
      }

      if (tripSignals.gateChange) {
        findings.push(ctx.locale === 'ar'
          ? `تغيير بوابة: ${tripSignals.gateChange}`
          : `Gate change: ${tripSignals.gateChange}`)
        signals.gateChange = tripSignals.gateChange
        priority = raise(priority, 'high')
      }

      if (tripSignals.weatherAlert) {
        findings.push(tripSignals.weatherAlert)
        signals.weatherAlert = tripSignals.weatherAlert
        priority = raise(priority, 'high')
      }

      if (tripSignals.visaExpiringDays != null && tripSignals.visaExpiringDays <= 30) {
        findings.push(ctx.locale === 'ar'
          ? `التأشيرة تنتهي خلال ${tripSignals.visaExpiringDays} يوماً`
          : `Visa expires in ${tripSignals.visaExpiringDays} days`)
        priority = raise(priority, tripSignals.visaExpiringDays <= 14 ? 'critical' : 'high')
      }

      if (tripSignals.passportExpiringDays != null && tripSignals.passportExpiringDays <= 180) {
        findings.push(ctx.locale === 'ar'
          ? `الجواز ينتهي خلال ${tripSignals.passportExpiringDays} يوماً`
          : `Passport expires in ${tripSignals.passportExpiringDays} days`)
        priority = raise(priority, tripSignals.passportExpiringDays <= 90 ? 'critical' : 'medium')
      }

      if (tripSignals.advisoryLevel && tripSignals.advisoryLevel !== 'none') {
        findings.push(ctx.locale === 'ar'
          ? `تنبيه سفر: ${tripSignals.advisoryLevel}`
          : `Travel advisory: ${tripSignals.advisoryLevel}`)
        priority = raise(
          priority,
          tripSignals.advisoryLevel === 'critical' ? 'critical'
            : tripSignals.advisoryLevel === 'warning' ? 'high'
              : 'medium',
        )
      }

      if (tripSignals.hotelIssue) {
        findings.push(tripSignals.hotelIssue)
        priority = raise(priority, 'high')
      }

      if (tripSignals.strikeAlert) {
        findings.push(tripSignals.strikeAlert)
        priority = raise(priority, 'high')
      }

      for (const risk of risks) {
        if (risk.includes('schengen') || risk.includes('visa')) {
          findings.push(ctx.locale === 'ar'
            ? 'احتمالية تأخير تأشيرة — راقب الموعد'
            : 'Visa timing risk — monitor appointment slots')
          priority = raise(priority, 'medium')
        }
        if (risk.includes('high_cost')) {
          findings.push(ctx.locale === 'ar' ? 'وجهة مرتفعة التكلفة' : 'High-cost destination watch')
          priority = raise(priority, 'low')
        }
      }

      if (findings.length === 0 && dest) {
        findings.push(ctx.locale === 'ar'
          ? `مراقبة نشطة لرحلة ${dest} — لا تنبيهات حرجة`
          : `Active monitoring for ${dest} — no critical alerts`)
      }

      signals.destination = dest
      signals.riskCount = risks.length

      return { engineId: 'trip_monitor', findings, signals, priority }
    },

    plan(ctx, analysis) {
      const actions = analysis.findings.map((finding, index) => ({
        id: `monitor_${index}`,
        description: finding,
        priority: analysis.priority,
      }))
      const alternatives: string[] = []
      if (analysis.priority === 'critical' || analysis.priority === 'high') {
        alternatives.push(ctx.locale === 'ar'
          ? 'إعادة توليد الخطة ببدائل أقل مخاطرة'
          : 'Regenerate itinerary with lower-risk alternatives')
      }
      return { engineId: 'trip_monitor', actions, alternatives }
    },

    execute(ctx, plan) {
      const alerts = plan.actions.map((action) => ({
        priority: action.priority,
        message: action.description,
        category: 'trip_monitor',
      }))
      const shouldNotify = alerts.some((a) => a.priority === 'critical' || a.priority === 'high')
      const shouldRegen = alerts.some((a) => a.priority === 'critical')
      return {
        engineId: 'trip_monitor',
        applied: true,
        effects: [
          shouldNotify ? 'notify_traveler' : 'silent_watch',
          shouldRegen ? 'suggest_itinerary_regen' : 'keep_plan',
        ],
        replyFragment: shouldNotify
          ? (ctx.locale === 'ar'
            ? `تنبيه: ${alerts[0]?.message}`
            : `Alert: ${alerts[0]?.message}`)
          : null,
        alerts,
        recommendations: plan.alternatives.map((alt) => ({
          title: alt,
          why: [ctx.locale === 'ar' ? 'تقليل المخاطر' : 'Reduce travel risk'],
          pros: [],
          cons: [],
          tradeoffs: [],
          confidence: 0.72,
        })),
        memoryNotes: [],
        nextBestAction: shouldNotify
          ? (ctx.locale === 'ar' ? 'هل تريد بدائل فورية؟' : 'Want me to propose alternatives now?')
          : null,
        metadata: { shouldNotify, shouldRegen, alertCount: alerts.length },
      }
    },

    confidence(_ctx, analysis) {
      if (analysis.findings.length === 0) return 0.4
      if (analysis.priority === 'critical') return 0.92
      if (analysis.priority === 'high') return 0.84
      return 0.7
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
