/**
 * Travel Memory Engine — durable personalization from conversation + locks.
 */

import { getPreferenceEngine } from '../../../ai/preferences'
import { learnPreferencesFromRequirements } from '../../../agent/reasoning/preferenceBridge'
import { learnRejectedDestinations } from '../rejectedDestinations'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../platform/engineContract'

export function createTravelMemoryEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'travel_memory',
    version: '1.0.0',
    name: 'Travel Memory Engine',
    description: 'Persists favorites, rejections, style, and budget sensitivity forever.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const profile = ctx.profile
      const findings: string[] = []
      if (profile.travelStyle.favoriteDestinations.length) {
        findings.push(`favorites:${profile.travelStyle.favoriteDestinations.length}`)
      }
      if (profile.travelStyle.rejectedDestinations.length) {
        findings.push(`rejected:${profile.travelStyle.rejectedDestinations.length}`)
      }
      if (profile.budget.typicalTripBudget != null) {
        findings.push(`budget:${profile.budget.typicalTripBudget}`)
      }
      if (ctx.memory.requirements.destination) {
        findings.push(`lock:${ctx.memory.requirements.destination}`)
      }
      return {
        engineId: 'travel_memory',
        findings,
        signals: {
          favorites: profile.travelStyle.favoriteDestinations,
          rejected: profile.travelStyle.rejectedDestinations,
          style: profile.travelStyle.style,
          budgetSensitivity: profile.budget.flexibility,
        },
        priority: 'low',
      }
    },

    plan(ctx, analysis) {
      const actions = []
      if (ctx.userText.trim()) {
        actions.push({
          id: 'learn_turn',
          description: ctx.locale === 'ar' ? 'تعلّم من هذه المحادثة' : 'Learn from this turn',
          priority: 'low' as const,
        })
      }
      if (analysis.signals.lock) {
        actions.push({
          id: 'remember_lock',
          description: ctx.locale === 'ar' ? 'حفظ الوجهة المفضلة' : 'Remember locked destination',
          priority: 'medium' as const,
        })
      }
      return { engineId: 'travel_memory', actions, alternatives: [] }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'travel_memory',
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
      const learnedRejections = learnRejectedDestinations(ctx.userText, ctx.userId, engine)
      learnPreferencesFromRequirements(ctx.memory.requirements, { userId: ctx.userId, engine })
      const updated = engine.getProfile(ctx.userId)

      const notes: string[] = []
      if (learnedRejections.length) {
        notes.push(ctx.locale === 'ar'
          ? `تذكرت رفض: ${learnedRejections.join(', ')}`
          : `Remembered rejection: ${learnedRejections.join(', ')}`)
      }
      if (ctx.memory.requirements.destination) {
        notes.push(ctx.locale === 'ar'
          ? `أضفت ${ctx.memory.requirements.destination} للمفضلة`
          : `Added ${ctx.memory.requirements.destination} to favorites`)
      }

      return {
        engineId: 'travel_memory',
        applied: true,
        effects: ['persist_preferences'],
        replyFragment: null,
        alerts: [],
        recommendations: [],
        memoryNotes: notes,
        nextBestAction: null,
        metadata: {
          favoriteCount: updated.travelStyle.favoriteDestinations.length,
          rejectedCount: updated.travelStyle.rejectedDestinations.length,
          learnedRejections,
        },
      }
    },

    confidence() {
      return 0.9
    },
  }
}
