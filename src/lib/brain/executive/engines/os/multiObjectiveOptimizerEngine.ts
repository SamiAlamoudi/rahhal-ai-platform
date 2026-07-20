/**
 * Sprint 52 — Multi-Objective Optimizer (Pareto).
 */

import { detectTravelGoal } from '../../os/goalDetection'
import { optimizeDecisions, paretoOptimal } from '../../os/scoring'
import type { ObjectiveAxis } from '../../os/types'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../../platform/engineContract'

const AXES: ObjectiveAxis[] = [
  'price', 'comfort', 'luxury', 'time', 'weather',
  'activities', 'visa', 'family', 'business', 'safety',
]

export function createMultiObjectiveOptimizerEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'multi_objective_optimizer',
    version: '1.0.0',
    name: 'Multi-Objective Optimizer',
    description: 'Produce Pareto-optimal recommendations across price, comfort, luxury, time, and more.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const goal = detectTravelGoal(ctx)
      const { ranked } = optimizeDecisions({
        memory: ctx.memory,
        profile: ctx.profile,
        reasoningResult: ctx.reasoningResult,
        goal,
      })
      const pareto = paretoOptimal(ranked, AXES)
      return {
        engineId: 'multi_objective_optimizer',
        findings: pareto.map((row) => row.name),
        signals: { pareto, axisCount: AXES.length, goal },
        priority: pareto.length > 0 ? 'high' : 'low',
      }
    },

    plan(ctx, analysis) {
      if (analysis.findings.length === 0) {
        return { engineId: 'multi_objective_optimizer', actions: [], alternatives: [] }
      }
      return {
        engineId: 'multi_objective_optimizer',
        actions: [{
          id: 'pareto_select',
          description: ctx.locale === 'ar'
            ? 'اختيار حلول باريتو المثلى'
            : 'Select Pareto-optimal solutions',
          priority: 'high',
        }],
        alternatives: analysis.findings.slice(1, 4),
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'multi_objective_optimizer',
          applied: false,
          effects: [],
          replyFragment: null,
          alerts: [],
          recommendations: [],
          memoryNotes: [],
          nextBestAction: null,
          metadata: {},
        }
      }

      const goal = detectTravelGoal(ctx)
      const { ranked } = optimizeDecisions({
        memory: ctx.memory,
        profile: ctx.profile,
        reasoningResult: ctx.reasoningResult,
        goal,
      })
      const pareto = paretoOptimal(ranked, AXES).slice(0, 4)
      const names = pareto.map((row) => row.name).join(', ')
      const fragment = ctx.locale === 'ar'
        ? `تحسين متعدد الأهداف (${AXES.length} محاور): حلول باريتو — ${names}.`
        : `Multi-objective optimization (${AXES.length} axes): Pareto set — ${names}.`

      return {
        engineId: 'multi_objective_optimizer',
        applied: true,
        effects: ['pareto_front'],
        replyFragment: fragment,
        alerts: [],
        recommendations: pareto.map((row) => ({
          title: row.name,
          why: AXES
            .map((axis) => ({ axis, v: row.objectives[axis] ?? 0 }))
            .sort((a, b) => b.v - a.v)
            .slice(0, 3)
            .map((row2) => `${row2.axis}: ${(row2.v * 100).toFixed(0)}%`),
          pros: [],
          cons: [],
          tradeoffs: AXES
            .filter((axis) => (row.objectives[axis] ?? 1) < 0.5)
            .slice(0, 2)
            .map((axis) => `${axis} tradeoff`),
          confidence: row.confidence,
        })),
        memoryNotes: [],
        nextBestAction: null,
        metadata: { pareto, axes: AXES },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.findings.length > 0 ? 0.87 : 0.3
    },
  }
}
