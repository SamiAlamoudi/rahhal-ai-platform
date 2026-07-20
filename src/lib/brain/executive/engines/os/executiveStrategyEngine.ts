/**
 * Sprint 52 — Executive Strategy Engine.
 */

import { selectExecutiveStrategy, enginesForStrategy } from '../../os/strategySelection'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../../platform/engineContract'

export function createExecutiveStrategyEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'executive_strategy',
    version: '1.0.0',
    name: 'Executive Strategy Engine',
    description: 'Dynamically choose reasoning strategy: fast, deep, budget, risk, luxury, family, business, emergency.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const strategy = selectExecutiveStrategy(ctx)
      const modules = [...enginesForStrategy(strategy)]
      return {
        engineId: 'executive_strategy',
        findings: [strategy],
        signals: { strategy, modules },
        priority: strategy === 'emergency' ? 'critical' : 'high',
      }
    },

    plan(ctx, analysis) {
      return {
        engineId: 'executive_strategy',
        actions: [{
          id: 'apply_strategy',
          description: ctx.locale === 'ar'
            ? `تطبيق استراتيجية: ${analysis.signals.strategy}`
            : `Apply strategy: ${analysis.signals.strategy}`,
          priority: analysis.priority,
        }],
        alternatives: [],
      }
    },

    execute(ctx) {
      const strategy = selectExecutiveStrategy(ctx)
      const modules = [...enginesForStrategy(strategy)]
      const fragment = ctx.locale === 'ar'
        ? `استراتيجية التفكير: ${strategy} · وحدات مفعّلة: ${modules.length}.`
        : `Reasoning strategy: ${strategy} · active modules: ${modules.length}.`

      return {
        engineId: 'executive_strategy',
        applied: true,
        effects: ['select_strategy'],
        replyFragment: fragment,
        alerts: strategy === 'emergency'
          ? [{
            priority: 'critical' as const,
            message: ctx.locale === 'ar'
              ? 'وضع طوارئ — أولوية الحلول السريعة'
              : 'Emergency mode — prioritize rapid solutions',
            category: 'strategy',
          }]
          : [],
        recommendations: [],
        memoryNotes: [`strategy:${strategy}`],
        nextBestAction: null,
        metadata: { strategy, modules },
      }
    },

    confidence() {
      return 0.92
    },
  }
}
