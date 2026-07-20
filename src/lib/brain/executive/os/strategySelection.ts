/**
 * Sprint 52 — Executive Strategy selection (shared pure helpers).
 */

import type { ExecutiveEngineContext } from '../platform/engineContract'
import type { ExecutiveStrategy } from './types'
import { detectTravelGoal } from './goalDetection'

export function selectExecutiveStrategy(ctx: ExecutiveEngineContext): ExecutiveStrategy {
  const text = ctx.userText.toLowerCase()
  const tone = ctx.understanding.emotionalContext.tone

  if (
    tone === 'stressed'
    || /\bemergency\b|urgent|asap|lost (?:my )?passport|strike|cancelled|طوارئ|عاجل|ضايع|إلغاء/.test(text)
  ) {
    return 'emergency'
  }

  if (/quick|fast|short answer|بسرعة|باختصار|سريع/.test(text)) {
    return 'fast'
  }

  if (
    /budget|cheap|afford|وفر|ميزانية|رخيص/.test(text)
    || ctx.profile.budget.style === 'budget'
    || ctx.intents.primary.id === 'budget_optimization'
  ) {
    return 'budget'
  }

  if (/safe|risk|visa|مخاطر|أمان|تأشيرة/.test(text) || ctx.intents.primary.id === 'visa_inquiry') {
    return 'risk'
  }

  if (
    /luxury|five.?star|suite|فاخر|درجة أولى|first class/.test(text)
    || ctx.profile.budget.style === 'luxury'
    || ctx.profile.travelStyle.style === 'luxury_focus'
    || ctx.intents.primary.id === 'luxury_travel'
  ) {
    return 'luxury'
  }

  const goal = detectTravelGoal(ctx)
  if (goal === 'family') return 'family'
  if (goal === 'business' || goal === 'conference') return 'business'

  if (
    ctx.understanding.travelContext.discoveryMode
    || ctx.reasoningResult?.primary
    || /compare|why|explain|قارن|لماذا|اشرح/.test(text)
  ) {
    return 'deep'
  }

  return 'fast'
}

export function enginesForStrategy(strategy: ExecutiveStrategy): Set<string> {
  const base = new Set([
    'executive_strategy',
    'prediction',
    'self_review',
  ])

  switch (strategy) {
    case 'emergency':
      base.add('smart_negotiation')
      base.add('goal_planning')
      return base
    case 'fast':
      base.add('global_knowledge')
      base.add('decision_optimizer')
      base.add('goal_planning')
      return base
    case 'budget':
      base.add('global_knowledge')
      base.add('decision_optimizer')
      base.add('multi_objective_optimizer')
      base.add('smart_negotiation')
      base.add('explanation_v2')
      base.add('goal_planning')
      return base
    case 'risk':
      base.add('global_knowledge')
      base.add('decision_optimizer')
      base.add('travel_graph')
      base.add('smart_negotiation')
      base.add('explanation_v2')
      base.add('goal_planning')
      return base
    case 'luxury':
      base.add('global_knowledge')
      base.add('decision_optimizer')
      base.add('multi_objective_optimizer')
      base.add('explanation_v2')
      base.add('goal_planning')
      base.add('travel_graph')
      return base
    case 'family':
    case 'business':
      base.add('global_knowledge')
      base.add('decision_optimizer')
      base.add('multi_objective_optimizer')
      base.add('prediction')
      base.add('explanation_v2')
      base.add('goal_planning')
      base.add('smart_negotiation')
      return base
    case 'deep':
    default:
      base.add('global_knowledge')
      base.add('decision_optimizer')
      base.add('multi_objective_optimizer')
      base.add('travel_graph')
      base.add('smart_negotiation')
      base.add('goal_planning')
      base.add('explanation_v2')
      return base
  }
}
