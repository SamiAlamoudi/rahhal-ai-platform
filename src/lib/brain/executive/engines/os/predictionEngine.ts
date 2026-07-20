/**
 * Sprint 52 — Prediction Engine.
 */

import { detectTravelGoal } from '../../os/goalDetection'
import { buildPrediction } from '../../os/prediction'
import { optimizeDecisions } from '../../os/scoring'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../../platform/engineContract'

export function createPredictionEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'prediction',
    version: '1.0.0',
    name: 'Prediction Engine',
    description: 'Predict preferred destination, budget, month, airline, hotel, and acceptance risk.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const goal = detectTravelGoal(ctx)
      const { strongest } = optimizeDecisions({
        memory: ctx.memory,
        profile: ctx.profile,
        reasoningResult: ctx.reasoningResult,
        goal,
      })
      const prediction = buildPrediction({
        profile: ctx.profile,
        memory: ctx.memory,
        reasoningResult: ctx.reasoningResult,
        strongest,
        goal,
        now: ctx.now,
      })
      return {
        engineId: 'prediction',
        findings: [
          prediction.preferredDestination ?? 'unknown',
          `accept:${prediction.acceptProbability.toFixed(2)}`,
        ],
        signals: { prediction, goal },
        priority: 'medium',
      }
    },

    plan(ctx) {
      return {
        engineId: 'prediction',
        actions: [{
          id: 'forecast_needs',
          description: ctx.locale === 'ar'
            ? 'توقع احتياجات المسافر القادمة'
            : 'Forecast upcoming traveler needs',
          priority: 'medium',
        }],
        alternatives: [],
      }
    },

    execute(ctx) {
      const goal = detectTravelGoal(ctx)
      const { strongest } = optimizeDecisions({
        memory: ctx.memory,
        profile: ctx.profile,
        reasoningResult: ctx.reasoningResult,
        goal,
      })
      const prediction = buildPrediction({
        profile: ctx.profile,
        memory: ctx.memory,
        reasoningResult: ctx.reasoningResult,
        strongest,
        goal,
        now: ctx.now,
      })

      const fragment = ctx.locale === 'ar'
        ? `توقع: وجهة ${prediction.preferredDestination ?? '—'} · ميزانية ≈ ${prediction.likelyBudget ?? '—'} ر.س · شهر ${prediction.likelyTravelMonth ?? '—'} · قبول ${(prediction.acceptProbability * 100).toFixed(0)}% · تغيير وجهة ${(prediction.changeDestinationProbability * 100).toFixed(0)}%.`
        : `Forecast: destination ${prediction.preferredDestination ?? '—'} · budget ≈ ${prediction.likelyBudget ?? '—'} SAR · month ${prediction.likelyTravelMonth ?? '—'} · accept ${(prediction.acceptProbability * 100).toFixed(0)}% · change-destination ${(prediction.changeDestinationProbability * 100).toFixed(0)}%.`

      return {
        engineId: 'prediction',
        applied: true,
        effects: ['traveler_forecast'],
        replyFragment: fragment,
        alerts: prediction.cancelProbability >= 0.35
          ? [{
            priority: 'medium' as const,
            message: ctx.locale === 'ar'
              ? 'احتمال إلغاء مرتفع نسبياً — ثبّت المرونة في الحجز'
              : 'Relatively high cancel probability — keep booking flexibility',
            category: 'prediction',
          }]
          : [],
        recommendations: [],
        memoryNotes: prediction.preferredDestination
          ? [`predict:${prediction.preferredDestination}`]
          : [],
        nextBestAction: null,
        metadata: { prediction },
      }
    },

    confidence(_ctx, analysis) {
      const prediction = analysis.signals.prediction as { confidence?: number } | undefined
      return prediction?.confidence ?? 0.55
    },
  }
}
