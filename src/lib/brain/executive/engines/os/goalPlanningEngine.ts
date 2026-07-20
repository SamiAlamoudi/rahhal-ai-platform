/**
 * Sprint 52 — Goal Planning Engine.
 */

import { detectTravelGoal, goalAxisBoosts } from '../../os/goalDetection'
import { optimizeDecisions } from '../../os/scoring'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../../platform/engineContract'

export function createGoalPlanningEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'goal_planning',
    version: '1.0.0',
    name: 'Goal Planning Engine',
    description: 'Detect travel goals and optimize plans around them.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const goal = detectTravelGoal(ctx)
      const boosts = goalAxisBoosts(goal)
      return {
        engineId: 'goal_planning',
        findings: [goal],
        signals: { goal, boosts },
        priority: goal === 'general' ? 'low' : 'high',
      }
    },

    plan(ctx, analysis) {
      const goal = String(analysis.signals.goal ?? 'general')
      return {
        engineId: 'goal_planning',
        actions: [{
          id: 'optimize_for_goal',
          description: ctx.locale === 'ar'
            ? `تحسين الخطة لهدف: ${goal}`
            : `Optimize plan for goal: ${goal}`,
          priority: analysis.priority,
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
      const top = strongest[0]
      const planLines = goalPlanLines(goal, ctx.locale, top?.name ?? null)
      const fragment = [
        ctx.locale === 'ar' ? `هدف الرحلة: ${goalLabelAr(goal)}` : `Trip goal: ${goal}`,
        ...planLines.map((line) => `• ${line}`),
      ].join('\n')

      return {
        engineId: 'goal_planning',
        applied: true,
        effects: ['goal_aligned_plan'],
        replyFragment: fragment,
        alerts: [],
        recommendations: top
          ? [{
            title: top.name,
            why: [ctx.locale === 'ar' ? `أفضل مواءمة لهدف ${goal}` : `Best alignment for ${goal}`],
            pros: [],
            cons: [],
            tradeoffs: [],
            confidence: top.confidence,
          }]
          : [],
        memoryNotes: [`goal:${goal}`],
        nextBestAction: null,
        metadata: { goal, topId: top?.id ?? null },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.signals.goal === 'general' ? 0.55 : 0.86
    },
  }
}

function goalLabelAr(goal: string): string {
  const map: Record<string, string> = {
    relaxation: 'استرخاء',
    honeymoon: 'شهر عسل',
    adventure: 'مغامرة',
    family: 'عائلة',
    business: 'عمل',
    conference: 'مؤتمر',
    medical: 'طبي',
    shopping: 'تسوق',
    pilgrimage: 'رحلة دينية',
    photography: 'تصوير',
    food: 'استكشاف طعام',
    general: 'عام',
  }
  return map[goal] ?? goal
}

function goalPlanLines(
  goal: string,
  locale: 'ar' | 'en',
  destination: string | null,
): string[] {
  const dest = destination ?? (locale === 'ar' ? 'الوجهة المختارة' : 'the selected destination')
  const ar = locale === 'ar'
  switch (goal) {
    case 'family':
      return ar
        ? [`فندق عائلي مركزي في ${dest}`, 'أنشطة نهارية مناسبة للأطفال', 'وتيرة هادئة بدون تنقلات طويلة']
        : [`Family-central hotel in ${dest}`, 'Daytime kid-friendly activities', 'Calm pace without long transfers']
    case 'honeymoon':
      return ar
        ? [`إقامة رومانسية فاخرة في ${dest}`, 'عشاء خاص وإطلالة هادئة', 'تقليل الازدحام في الجدول']
        : [`Romantic luxury stay in ${dest}`, 'Private dinner and calm views', 'Minimize crowd density in the schedule']
    case 'business':
    case 'conference':
      return ar
        ? [`قرب المطار/مركز الأعمال في ${dest}`, 'إنترنت موثوق ومرونة إلغاء', 'يوم عازل قبل الاجتماعات']
        : [`Airport/business-district access in ${dest}`, 'Reliable internet and flexible cancellation', 'Buffer day before meetings']
    case 'adventure':
      return ar
        ? [`أنشطة خارجية في ${dest}`, 'نافذة طقس مناسبة', 'تأمين مغامرات']
        : [`Outdoor activities in ${dest}`, 'Suitable weather window', 'Adventure insurance']
    case 'medical':
      return ar
        ? [`قرب مرافق طبية موثوقة في ${dest}`, 'راحة وتنقل سهل', 'مرونة في المواعيد']
        : [`Near trusted medical facilities in ${dest}`, 'Comfort and easy transfers', 'Appointment flexibility']
    case 'food':
      return ar
        ? [`مسار مطاعم محلية في ${dest}`, 'سوق طعام مسائي', 'فندق في حي مطاعم']
        : [`Local restaurant trail in ${dest}`, 'Evening food market', 'Hotel in a dining district']
    default:
      return ar
        ? [`محاذاة الخطة مع ${dest}`, 'توازن تكلفة وراحة', 'بدائل جاهزة']
        : [`Align itinerary around ${dest}`, 'Balance cost and comfort', 'Keep ready alternatives']
  }
}
