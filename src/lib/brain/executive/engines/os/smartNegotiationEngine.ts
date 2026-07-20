/**
 * Sprint 52 — Smart Negotiation Engine.
 */

import { detectRejectedDestinations } from '../../rejectedDestinations'
import { detectTravelGoal } from '../../os/goalDetection'
import { getDestinationIntelligence } from '../../os/globalKnowledge'
import { buildNegotiationSuggestions } from '../../os/negotiation'
import { optimizeDecisions } from '../../os/scoring'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../../platform/engineContract'

export function createSmartNegotiationEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'smart_negotiation',
    version: '1.0.0',
    name: 'Smart Negotiation Engine',
    description: 'Never dead-end with "no" — negotiate timing, destination, hotel, routing, and budget.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const rejected = detectRejectedDestinations(ctx.userText, ctx.locale)
      const needsNegotiation =
        rejected.length > 0
        || /no|can't|cannot|won't|too expensive|over budget|مستحيل|ما أبي|غالي|رفض/.test(
          ctx.userText.toLowerCase(),
        )
        || (ctx.memory.requirements.budgetAmount != null
          && ctx.reasoningResult?.primary?.budgetFit === 'over')

      return {
        engineId: 'smart_negotiation',
        findings: needsNegotiation ? ['negotiate'] : [],
        signals: { needsNegotiation, rejected },
        priority: needsNegotiation ? 'high' : 'low',
      }
    },

    plan(ctx, analysis) {
      if (!analysis.signals.needsNegotiation) {
        return { engineId: 'smart_negotiation', actions: [], alternatives: [] }
      }
      return {
        engineId: 'smart_negotiation',
        actions: [{
          id: 'negotiate_better',
          description: ctx.locale === 'ar'
            ? 'اقتراح بدائل تفاوضية أفضل'
            : 'Propose better negotiated alternatives',
          priority: 'high',
        }],
        alternatives: [],
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'smart_negotiation',
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
      const { strongest } = optimizeDecisions({
        memory: ctx.memory,
        profile: ctx.profile,
        reasoningResult: ctx.reasoningResult,
        goal,
      })
      const rejected = detectRejectedDestinations(ctx.userText, ctx.locale)
      const primaryName = ctx.reasoningResult?.primary?.name ?? strongest[0]?.name ?? null
      const primaryIntel = primaryName
        ? getDestinationIntelligence(primaryName)
        : null

      const suggestions = buildNegotiationSuggestions({
        locale: ctx.locale,
        userText: ctx.userText,
        budgetAmount: ctx.memory.requirements.budgetAmount,
        strongest,
        primaryIntel,
        rejectedMention: rejected[0] ?? null,
      })

      const fragment = [
        ctx.locale === 'ar'
          ? 'بدل الرفض القاطع، هذه حلول تفاوضية أفضل:'
          : 'Instead of a hard no, here are better negotiated paths:',
        ...suggestions.map((s) => `• [${s.kind}] ${s.message}`),
      ].join('\n')

      return {
        engineId: 'smart_negotiation',
        applied: true,
        effects: ['negotiate_alternatives'],
        replyFragment: fragment,
        alerts: [],
        recommendations: suggestions.map((s) => ({
          title: s.kind,
          why: [s.message],
          pros: [],
          cons: [],
          tradeoffs: [`better than: ${s.betterThan}`],
          confidence: 0.78,
        })),
        memoryNotes: [],
        nextBestAction: ctx.locale === 'ar'
          ? 'أي مسار تفاوضي نثبت؟'
          : 'Which negotiated path should we lock?',
        metadata: { suggestions },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.signals.needsNegotiation ? 0.84 : 0.25
    },
  }
}
