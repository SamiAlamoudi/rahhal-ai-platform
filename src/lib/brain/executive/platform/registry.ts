/**
 * Sprint 51 — Executive engine registry (dependency inversion).
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
import type { ExecutiveEngine, ExecutiveEngineId } from './engineContract'

export function createDefaultExecutiveEngines(): ExecutiveEngine[] {
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

export function selectEnginesForTurn(
  engines: ExecutiveEngine[],
  input: {
    userText: string
    hasReasoning: boolean
    hasTripPlan: boolean
    discoveryMode: boolean
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

  return engines.filter((engine) => ids.has(engine.metadata().engineId))
}
