/**
 * Sprint 52 — Decision Optimizer Engine.
 */

import { detectTravelGoal } from '../../os/goalDetection'
import { optimizeDecisions } from '../../os/scoring'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../../platform/engineContract'

export function createDecisionOptimizerEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'decision_optimizer',
    version: '1.0.0',
    name: 'Decision Optimizer',
    description: 'Generate, score, compare, rank, and reject weak travel options.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const goal = detectTravelGoal(ctx)
      const result = optimizeDecisions({
        memory: ctx.memory,
        profile: ctx.profile,
        reasoningResult: ctx.reasoningResult,
        goal,
        month: ctx.memory.requirements.startDate
          ? new Date(ctx.memory.requirements.startDate).getMonth() + 1
          : ctx.now.getMonth() + 1,
        userText: ctx.userText,
      })
      return {
        engineId: 'decision_optimizer',
        findings: result.strongest.map((row) => row.name),
        signals: {
          goal,
          strongest: result.strongest,
          rejectedCount: result.rejected.length,
          rankedCount: result.ranked.length,
        },
        priority: result.strongest.length > 0 ? 'high' : 'low',
      }
    },

    plan(ctx, analysis) {
      const strongest = (analysis.signals.strongest as Array<{ name: string }>) ?? []
      if (strongest.length === 0) {
        return { engineId: 'decision_optimizer', actions: [], alternatives: [] }
      }
      return {
        engineId: 'decision_optimizer',
        actions: [{
          id: 'rank_options',
          description: ctx.locale === 'ar'
            ? 'ترتيب أقوى الخيارات ورفض الضعيف'
            : 'Rank strongest options and reject weak ones',
          priority: 'high',
        }],
        alternatives: strongest.slice(1).map((row) => row.name),
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'decision_optimizer',
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
      const result = optimizeDecisions({
        memory: ctx.memory,
        profile: ctx.profile,
        reasoningResult: ctx.reasoningResult,
        goal,
        month: ctx.memory.requirements.startDate
          ? new Date(ctx.memory.requirements.startDate).getMonth() + 1
          : ctx.now.getMonth() + 1,
      })
      const top = result.strongest[0]!
      const fragment = ctx.locale === 'ar'
        ? `بعد تقييم كل الخيارات المعقولة، أقوى توصية: ${top.name} (درجة ${(top.score * 100).toFixed(0)}%). رُفض ${result.rejected.length} خياراً ضعيفاً.`
        : `After evaluating every reasonable option, strongest pick: ${top.name} (score ${(top.score * 100).toFixed(0)}%). Rejected ${result.rejected.length} weak candidates.`

      return {
        engineId: 'decision_optimizer',
        applied: true,
        effects: ['rank_and_reject'],
        replyFragment: fragment,
        alerts: [],
        recommendations: result.strongest.map((row) => ({
          title: row.name,
          why: [
            ctx.locale === 'ar'
              ? `درجة القرار ${(row.score * 100).toFixed(0)}%`
              : `Decision score ${(row.score * 100).toFixed(0)}%`,
          ],
          whyNot: result.rejected.slice(0, 2).map((r) =>
            `${r.name}: ${r.rejectReason ?? 'weak fit'}`),
          pros: Object.entries(row.objectives)
            .filter(([, v]) => (v ?? 0) >= 0.7)
            .slice(0, 3)
            .map(([k, v]) => `${k}: ${((v ?? 0) * 100).toFixed(0)}%`),
          cons: Object.entries(row.objectives)
            .filter(([, v]) => (v ?? 1) < 0.45)
            .slice(0, 2)
            .map(([k, v]) => `${k}: ${((v ?? 0) * 100).toFixed(0)}%`),
          tradeoffs: [],
          confidence: row.confidence,
        })),
        memoryNotes: [`optimizer:${top.id}`],
        nextBestAction: ctx.locale === 'ar'
          ? 'هل تريد مقارنة باريتو متعددة الأهداف؟'
          : 'Want a multi-objective Pareto comparison?',
        metadata: {
          strongest: result.strongest,
          rejected: result.rejected.slice(0, 5),
        },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.findings.length > 0 ? 0.88 : 0.3
    },
  }
}
