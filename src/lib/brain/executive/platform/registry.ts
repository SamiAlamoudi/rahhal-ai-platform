/**
 * Sprint 51 — Executive engine registry (dependency inversion).
 * Sprint 52 — OS engines registered and lazily selected by strategy.
 */

import { createTripMonitorEngine } from '../engines/tripMonitor'
import { createLiveConciergeEngine } from '../engines/liveConcierge'
import { createExplainableDecisionEngine } from '../engines/explainableDecision'
import { createTravelMemoryEngine } from '../engines/travelMemory'
import { createMultimodalDocumentEngine } from '../engines/multimodalDocument'
import { createBudgetIntelligenceV2Engine } from '../engines/budgetIntelligenceV2'
import { createItineraryOptimizerEngine } from '../engines/itineraryOptimizer'
import { createRiskEngine } from '../engines/riskEngine'
import { createExecutiveResponseEngine } from '../engines/executiveResponse'
import { createLearningEngine } from '../engines/learningEngine'
import {
  createGlobalKnowledgeEngine,
  createDecisionOptimizerEngine,
  createMultiObjectiveOptimizerEngine,
  createTravelGraphEngine,
  createPredictionEngine,
  createSmartNegotiationEngine,
  createGoalPlanningEngine,
  createExecutiveStrategyEngine,
  createExplanationEngineV2,
  createSelfReviewEngine,
} from '../engines/os'
import { enginesForStrategy, selectExecutiveStrategy } from '../os/strategySelection'
import { isExecutiveOsEnabled } from '../os/feature'
import type { ExecutiveEngine, ExecutiveEngineContext, ExecutiveEngineId } from './engineContract'

export function createPlatformEngines(): ExecutiveEngine[] {
  return [
    createTravelMemoryEngine(),
    createMultimodalDocumentEngine(),
    createTripMonitorEngine(),
    createLiveConciergeEngine(),
    createRiskEngine(),
    createBudgetIntelligenceV2Engine(),
    createExplainableDecisionEngine(),
    createItineraryOptimizerEngine(),
    createLearningEngine(),
    createExecutiveResponseEngine(),
  ]
}

export function createOsEngines(): ExecutiveEngine[] {
  return [
    createExecutiveStrategyEngine(),
    createGlobalKnowledgeEngine(),
    createDecisionOptimizerEngine(),
    createMultiObjectiveOptimizerEngine(),
    createTravelGraphEngine(),
    createPredictionEngine(),
    createSmartNegotiationEngine(),
    createGoalPlanningEngine(),
    createExplanationEngineV2(),
    createSelfReviewEngine(),
  ]
}

/** Sprint 51 default — platform engines only (stable length for regression tests). */
export function createDefaultExecutiveEngines(): ExecutiveEngine[] {
  return createPlatformEngines()
}

export function createAllExecutiveEngines(options?: { includeOs?: boolean }): ExecutiveEngine[] {
  const includeOs = options?.includeOs ?? isExecutiveOsEnabled()
  return includeOs
    ? [...createPlatformEngines(), ...createOsEngines()]
    : createPlatformEngines()
}

export function selectEnginesForTurn(
  engines: ExecutiveEngine[],
  input: {
    userText: string
    hasReasoning: boolean
    hasTripPlan: boolean
    discoveryMode: boolean
    osEnabled?: boolean
    strategyContext?: ExecutiveEngineContext | null
  },
): ExecutiveEngine[] {
  const ids = new Set<ExecutiveEngineId>()

  // Always learn + remember.
  ids.add('travel_memory')
  ids.add('learning')

  // Document extraction when text looks like a document.
  if (/passport|boarding|pnr|voucher|visa|جواز|تأشيرة|بطاقة صعود|تأكيد/i.test(input.userText)) {
    ids.add('multimodal_document')
  }

  // Live concierge for explicit in-trip needs only (never trip-intake keywords).
  if (
    /\bi(?:'m| am)?\s+(?:hungry|tired|lost)\b|lost (?:my )?passport|need (?:a )?(?:pharmacy|hospital|taxi|uber)|flight (?:is )?delayed|hotel (?:is )?(?:bad|terrible)|another hotel|local experience|جوعان|جائع|تعبان|ضايع|صيدلية|مستشفى|تأخير.*طيران|فندق سيء|فندق آخر|تجربة محلية/i
      .test(input.userText)
  ) {
    ids.add('live_concierge')
  }

  if (input.hasReasoning || input.discoveryMode) {
    ids.add('explainable_decision')
    ids.add('budget_intelligence_v2')
    ids.add('risk')
  }

  if (input.hasTripPlan) {
    ids.add('trip_monitor')
    ids.add('itinerary_optimizer')
    ids.add('risk')
    ids.add('budget_intelligence_v2')
  }

  // Always compose if anything else runs.
  ids.add('executive_response')

  // Sprint 52 — lazy OS engine selection by strategy.
  if (input.osEnabled && input.strategyContext) {
    const strategy = selectExecutiveStrategy(input.strategyContext)
    for (const id of enginesForStrategy(strategy)) {
      ids.add(id as ExecutiveEngineId)
    }
    // Negotiation only when friction signals exist.
    if (
      !/no|can't|cannot|won't|too expensive|over budget|مستحيل|ما أبي|غالي|رفض|not /i.test(input.userText)
      && !input.strategyContext.profile.travelStyle.rejectedDestinations.length
    ) {
      // Keep negotiation for budget/risk/emergency strategies only.
      if (strategy === 'fast' || strategy === 'deep' || strategy === 'luxury') {
        ids.delete('smart_negotiation')
      }
    }
  }

  const selected = engines.filter((engine) => ids.has(engine.metadata().engineId))

  // Stable order: strategy first, self_review last among selected.
  return selected.sort((a, b) => {
    const rank = (id: ExecutiveEngineId): number => {
      if (id === 'executive_strategy') return -2
      if (id === 'self_review') return 100
      if (id === 'executive_response') return 99
      return 0
    }
    return rank(a.metadata().engineId) - rank(b.metadata().engineId)
  })
}
