/**
 * Learning Engine — improve future reasoning from accepts/rejects/bookings.
 */

import { getPreferenceEngine } from '../../../ai/preferences'
import { learnRejectedDestinations } from '../rejectedDestinations'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../platform/engineContract'

export function createLearningEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'learning',
    version: '1.0.0',
    name: 'Learning Engine',
    description: 'Learns from accepts, rejects, bookings, and cancellations.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const signal = detectLearningSignal(ctx.userText)
      return {
        engineId: 'learning',
        findings: signal === 'none' ? [] : [signal],
        signals: { signal },
        priority: signal === 'none' ? 'low' : 'medium',
      }
    },

    plan(ctx, analysis) {
      if (analysis.findings.length === 0) {
        return { engineId: 'learning', actions: [], alternatives: [] }
      }
      return {
        engineId: 'learning',
        actions: [{
          id: String(analysis.signals.signal),
          description: ctx.locale === 'ar'
            ? `تحديث نموذج التفضيلات (${analysis.signals.signal})`
            : `Update preference model (${analysis.signals.signal})`,
          priority: 'medium',
        }],
        alternatives: [],
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'learning',
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

      const engine = getPreferenceEngine()
      const signal = plan.actions[0]?.id ?? 'none'
      const notes: string[] = []

      if (signal === 'reject') {
        const rejected = learnRejectedDestinations(ctx.userText, ctx.userId, engine)
        if (rejected.length) {
          notes.push(ctx.locale === 'ar'
            ? `تعلّمت الرفض: ${rejected.join(', ')}`
            : `Learned rejection: ${rejected.join(', ')}`)
        }
      }

      if (signal === 'accept' || signal === 'book') {
        const profile = engine.getProfile(ctx.userId)
        const dest = ctx.memory.requirements.destination
        if (dest && !profile.travelStyle.favoriteDestinations.includes(dest)) {
          engine.upsertProfile({
            ...profile,
            userId: ctx.userId,
            updatedAt: new Date().toISOString(),
            travelStyle: {
              ...profile.travelStyle,
              favoriteDestinations: [...profile.travelStyle.favoriteDestinations, dest],
            },
            weights: {
              ...profile.weights,
              personalization: Math.min(0.35, profile.weights.personalization + 0.02),
            },
          })
          notes.push(ctx.locale === 'ar'
            ? `عزّزت تفضيلك لـ ${dest}`
            : `Reinforced preference for ${dest}`)
        }
      }

      if (signal === 'cancel') {
        const profile = engine.getProfile(ctx.userId)
        engine.upsertProfile({
          ...profile,
          userId: ctx.userId,
          updatedAt: new Date().toISOString(),
          budget: {
            ...profile.budget,
            flexibility: profile.budget.flexibility === 'open' ? 'flexible' : profile.budget.flexibility,
          },
        })
        notes.push(ctx.locale === 'ar'
          ? 'سجّلت إلغاءً لتحسين التوقعات لاحقاً'
          : 'Recorded cancellation to improve future expectations')
      }

      return {
        engineId: 'learning',
        applied: notes.length > 0,
        effects: notes.length ? ['update_preference_model'] : [],
        replyFragment: null,
        alerts: [],
        recommendations: [],
        memoryNotes: notes,
        nextBestAction: null,
        metadata: { signal, notes },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.findings.length > 0 ? 0.82 : 0.2
    },
  }
}

function detectLearningSignal(text: string): 'accept' | 'reject' | 'book' | 'cancel' | 'none' {
  const lower = text.toLowerCase()
  if (/\bcancel\b|إلغاء|الغي|ألغ/.test(lower) || /إلغاء/.test(text)) return 'cancel'
  if (/\bbook\b|\bconfirm\b|احجز|أكد|أكّد|تأكيد/.test(lower) || /احجز|أكد/.test(text)) return 'book'
  if (/\bnot\b|\bno\b|skip|avoid|ما أبغى|لا أريد|مو/.test(lower) || /ما أبغى|لا أريد/.test(text)) {
    return 'reject'
  }
  if (/\byes\b|\block\b|first one|الأولى|تمام|موافق|نعتمد/.test(lower) || /الأولى|موافق/.test(text)) {
    return 'accept'
  }
  return 'none'
}
