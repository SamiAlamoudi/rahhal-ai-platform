/**
 * Sprint 52 — Global Knowledge Engine.
 */

import {
  getAllDestinationIntelligence,
  getDestinationIntelligence,
} from '../../os/globalKnowledge'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../../platform/engineContract'

export function createGlobalKnowledgeEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'global_knowledge',
    version: '1.0.0',
    name: 'Global Knowledge Engine',
    description: 'Structured destination intelligence across weather, visa, safety, luxury, and more.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const month = ctx.memory.requirements.startDate
        ? new Date(ctx.memory.requirements.startDate).getMonth() + 1
        : ctx.now.getMonth() + 1
      const all = getAllDestinationIntelligence(month)
      const focusName = ctx.memory.requirements.destination
        ?? ctx.reasoningResult?.primary?.name
        ?? null
      const focus = focusName ? getDestinationIntelligence(focusName, month) : all[0] ?? null
      return {
        engineId: 'global_knowledge',
        findings: focus
          ? [
            `weather:${focus.weather}`,
            `visa:${focus.visa}`,
            `risk:${focus.riskScore.toFixed(2)}`,
            `luxury:${focus.luxuryScore.toFixed(2)}`,
          ]
          : [],
        signals: {
          catalogSize: all.length,
          month,
          focusId: focus?.id ?? null,
          focus,
        },
        priority: focus ? 'medium' : 'low',
      }
    },

    plan(ctx, analysis) {
      if (!analysis.signals.focus) {
        return { engineId: 'global_knowledge', actions: [], alternatives: [] }
      }
      return {
        engineId: 'global_knowledge',
        actions: [{
          id: 'surface_intelligence',
          description: ctx.locale === 'ar'
            ? 'عرض ذكاء الوجهة المنظم'
            : 'Surface structured destination intelligence',
          priority: 'medium',
        }],
        alternatives: [],
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'global_knowledge',
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

      const month = ctx.memory.requirements.startDate
        ? new Date(ctx.memory.requirements.startDate).getMonth() + 1
        : ctx.now.getMonth() + 1
      const analysisFocus = getDestinationIntelligence(
        ctx.memory.requirements.destination
          ?? ctx.reasoningResult?.primary?.name
          ?? ctx.reasoningResult?.primary?.id
          ?? '',
        month,
      ) ?? getAllDestinationIntelligence(month)[0]

      if (!analysisFocus) {
        return {
          engineId: 'global_knowledge',
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

      const fragment = ctx.locale === 'ar'
        ? `ذكاء ${analysisFocus.nameAr}: طقس ${analysisFocus.weather} · تأشيرة ${analysisFocus.visa} · أمان ${(analysisFocus.safety * 100).toFixed(0)}% · فخامة ${(analysisFocus.luxuryScore * 100).toFixed(0)}% · مخاطرة ${(analysisFocus.riskScore * 100).toFixed(0)}%.`
        : `Intelligence for ${analysisFocus.nameEn}: weather ${analysisFocus.weather} · visa ${analysisFocus.visa} · safety ${(analysisFocus.safety * 100).toFixed(0)}% · luxury ${(analysisFocus.luxuryScore * 100).toFixed(0)}% · risk ${(analysisFocus.riskScore * 100).toFixed(0)}%.`

      return {
        engineId: 'global_knowledge',
        applied: true,
        effects: ['destination_intelligence'],
        replyFragment: fragment,
        alerts: analysisFocus.riskScore >= 0.5
          ? [{
            priority: 'medium' as const,
            message: ctx.locale === 'ar' ? 'مخاطر موسمية/تأشيرية مرتفعة نسبياً' : 'Elevated seasonal/visa risk',
            category: 'knowledge',
          }]
          : [],
        recommendations: [],
        memoryNotes: [`knowledge:${analysisFocus.id}`],
        nextBestAction: null,
        metadata: { intelligence: analysisFocus },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.signals.focus ? 0.9 : 0.35
    },
  }
}
