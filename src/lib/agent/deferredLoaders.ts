/**
 * RC-3 — cached dynamic loaders for agent enrichment / brain / provider layers.
 * Keeps travelAgentService.impl free of eager LLM / planner / reasoner / runtime graphs.
 */

type Loader<T> = () => Promise<T>

const cache = new Map<string, Promise<unknown>>()

function loadOnce<T>(key: string, loader: Loader<T>): Promise<T> {
  let pending = cache.get(key) as Promise<T> | undefined
  if (!pending) {
    pending = loader()
    cache.set(key, pending)
  }
  return pending
}

/** Test helper — clear loader cache between isolation checks. */
export function resetDeferredLoaderCache(): void {
  cache.clear()
}

export function loadConversationIntelligence() {
  return loadOnce('conversationIntelligence', () => import('./conversationIntelligence'))
}

export function loadLlmBrain() {
  return loadOnce('llmBrain', () => import('./llmBrain'))
}

export function loadAgentRuntime() {
  return loadOnce('agentRuntime', () => import('./agentRuntime'))
}

export function loadTravelPlanner() {
  return loadOnce('travelPlanner', () => import('./travelPlanner'))
}

export function loadReasoning() {
  return loadOnce('reasoning', () => import('./reasoning'))
}

export function loadBrainCore() {
  return loadOnce('brainCore', () => import('../brain/core'))
}

export function loadBrainIntegration() {
  return loadOnce('brainIntegration', () => import('../brain/integration'))
}

export function loadBrainOrchestrator() {
  return loadOnce('brainOrchestrator', () => import('../brain/orchestrator'))
}

export function loadBookingFlow() {
  return loadOnce('bookingFlow', () => import('../bookingFlow'))
}

export function loadAutonomous() {
  return loadOnce('autonomous', () => import('./autonomous'))
}

export function loadBookingIntelligence() {
  return loadOnce('bookingIntelligence', () => import('./bookingIntelligence'))
}

export function loadBudgetIntelligence() {
  return loadOnce('budgetIntelligence', () => import('./budgetIntelligence'))
}

export function loadIntegrationTripOrchestrator() {
  return loadOnce('integrationTripOrchestrator', () => import('./integrationTripOrchestrator'))
}

export function loadTravelerPersonalization() {
  return loadOnce('travelerPersonalization', () => import('./travelerPersonalization'))
}

export function loadTripOptimizer() {
  return loadOnce('tripOptimizer', () => import('./tripOptimizer'))
}

export function loadAutonomousDecision() {
  return loadOnce('autonomousDecision', () => import('./autonomousDecision'))
}

export function loadAdaptiveLearning() {
  return loadOnce('adaptiveLearning', () => import('./adaptiveLearning'))
}

export function loadPriceIntelligence() {
  return loadOnce('priceIntelligence', () => import('./priceIntelligence'))
}

export function loadPackageBuilder() {
  return loadOnce('packageBuilder', () => import('./packageBuilder'))
}

export function loadItineraryRefinement() {
  return loadOnce('itineraryRefinement', () => import('./itineraryRefinement'))
}

export function loadBookingExecution() {
  return loadOnce('bookingExecution', () => import('./bookingExecution'))
}

export function loadPaymentsPlatform() {
  return loadOnce('paymentsPlatform', () => import('./paymentsPlatform'))
}

export function loadConstitution() {
  return loadOnce('constitution', () => import('./constitution'))
}

export function loadConciergeIntegration() {
  return loadOnce('conciergeIntegration', () => import('./conciergeIntegration'))
}

export function loadAlphaExperience() {
  return loadOnce('alphaExperience', () => import('./alphaExperience'))
}

export function loadBookingAssistant() {
  return loadOnce('bookingAssistant', () => import('./bookingAssistant'))
}

export function loadBooking() {
  return loadOnce('booking', () => import('../booking'))
}

export function loadBookingConfirmation() {
  return loadOnce('bookingConfirmation', () => import('../bookingConfirmation'))
}

export function loadOrderManagement() {
  return loadOnce('orderManagement', () => import('../orderManagement'))
}

export function loadSmartItinerary() {
  return loadOnce('smartItinerary', () => import('../smartItinerary'))
}

export function loadConcierge() {
  return loadOnce('concierge', () => import('../concierge'))
}

export function loadConciergeRecommendations() {
  return loadOnce('conciergeRecommendations', () => import('../concierge/recommendationBridge'))
}

export function loadConciergeMeta() {
  return loadOnce('conciergeMeta', () => import('../concierge/meta'))
}

export function loadToolStubs() {
  return loadOnce('toolStubs', () => import('./tools/stubs'))
}

export function loadRealtimeVoice() {
  return loadOnce('realtimeVoice', () => import('../realtimeVoice'))
}
