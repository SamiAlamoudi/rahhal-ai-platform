export type {
  AgentLocale,
  AgentMemory,
  AgentProviderMeta,
  TripPlan,
  TravelItinerary,
  TripRequirements,
  AgentIntent,
  AccommodationRecommendation,
  AgentToolRunSummary,
  RegenerateScope,
  TripDecision,
} from './types'
export { emptyMemory, emptyRequirements, withTripPlan, INTAKE_FIELD_ORDER } from './types'
export { createTravelAgentProvider, travelAgentProvider } from './travelAgentProvider'
export { createTravelAgentService, travelAgentService } from './travelAgentService'
export {
  saveGeneratedItinerary,
  updateSavedItinerary,
  itineraryToSavedTripData,
  parseAgentItineraryFromTripData,
} from './itineraryPersistence'
export {
  rebuildMemoryFromMessages,
  memoryFromMeta,
  isAgentProviderMeta,
  tripPlanFromMeta,
  missingRequirementFields,
  nextMissingIntakeField,
  mergeRequirements,
  applySmartClarification,
} from './memory'
export {
  HARD_CLARIFICATION_FIELDS,
  SOFT_CLARIFICATION_FIELDS,
  inferSoftRequirements,
  missingClarificationFields,
  isSmartClarificationEnabled,
} from './clarification'
export { extractFromUserText } from './extractRequirements'
export {
  buildTripPlan,
  buildTravelItinerary,
  applyTripPlanEdits,
  applyItineraryEdits,
  regenerateTripDay,
} from './buildItinerary'
export { formatTripPlanReply, formatItineraryReply, buildFollowUpQuestion, buildSpokenPlanSummary, composeTripPlanDisplay, buildThinkingBridge } from './formatReply'
export {
  runConversationBrain,
  buildTravelFacts,
  RAHHAL_CONVERSATION_SYSTEM_PROMPT,
} from './conversationBrain'
export {
  isAutonomousAgentEnabled,
  AUTONOMOUS_AGENT_FEATURE_ID,
  runAutonomousTurn,
  buildExecutionPlan,
  upsertTravelGoal,
  AutonomousStateMachine,
  runToolPlan,
  runAutonomousJobInBackground,
} from './autonomous'
export type {
  AutonomousAgentSnapshot,
  AutonomousExecutionState,
  AutonomousProgressEvent,
  AutonomousProgressPhase,
  AutonomousGoal,
} from './autonomous'
export {
  isBookingIntelligenceEnabled,
  BOOKING_INTELLIGENCE_FEATURE_ID,
  runBookingIntelligence,
  createBookingProviderRegistry,
  createDefaultSimulatedBookingProviders,
  rankOffersV2,
  fuseOffers,
  optimizeBookingCombinations,
  assessBookingReadiness,
} from './bookingIntelligence'
export type {
  BookingIntelligenceSnapshot,
  BookingIntelligenceResult,
  BookingProviderDomain,
  RankedOffer,
} from './bookingIntelligence'
export {
  isBudgetIntelligenceEnabled,
  BUDGET_INTELLIGENCE_FEATURE_ID,
  parseBudgetUtterance,
  allocateBudget,
  computeBudgetScore,
  rankFlightsByBudget,
  rankHotelsByBudget,
  rankPackagesByBudget,
  runBudgetIntelligence,
  enrichWithBudgetIntelligence,
  SPRINT75_BUDGET_INTELLIGENCE_VERSION,
} from './budgetIntelligence'
export type {
  BudgetIntelligenceResult,
  BudgetDiagnostics,
  BudgetAllocation,
  BudgetIntent,
  RankedBudgetCandidate,
} from './budgetIntelligence'
export {
  isTravelerPersonalizationEnabled,
  TRAVELER_PERSONALIZATION_FEATURE_ID,
  parsePreferenceUtterance,
  emptyTravelerProfile,
  learnListPreference,
  runTravelerPersonalization,
  enrichWithTravelerPersonalization,
  resetTravelerProfileStore,
  SPRINT76_TRAVELER_PERSONALIZATION_VERSION,
} from './travelerPersonalization'
export type {
  TravelerPersonalizationResult,
  TravelerPersonalizationDiagnostics,
  TravelerProfile,
  LearningEvent,
} from './travelerPersonalization'
export {
  isTripOptimizerEnabled,
  TRIP_OPTIMIZER_FEATURE_ID,
  parseOptimizerIntent,
  runTripOptimizer,
  enrichWithTripOptimizer,
  SPRINT77_TRIP_OPTIMIZER_VERSION,
} from './tripOptimizer'
export type {
  TripOptimizerResult,
  TripOptimizerDiagnostics,
  OptimizedItinerary,
  JourneyScoreBreakdown,
} from './tripOptimizer'
export {
  isTravelPlannerEnabled,
  TRAVEL_PLANNER_FEATURE_ID,
  runTravelPlanner,
  detectPlannerIntent,
  detectConstraints,
  planRequiredQuestions,
  SPRINT78_TRAVEL_PLANNER_VERSION,
} from './travelPlanner'
export type {
  TravelPlannerResult,
  TravelPlannerDiagnostics,
  TravelPurpose,
  SearchPlan,
} from './travelPlanner'
export {
  isAutonomousDecisionEnabled,
  AUTONOMOUS_DECISION_FEATURE_ID,
  enrichWithAutonomousDecision,
  runDecisionEngine,
  createDecisionEngine,
  createSearchPlans,
  SPRINT79_DECISION_ENGINE_VERSION,
} from './autonomousDecision'
export type {
  AutonomousDecisionResult,
  AutonomousDecisionMeta,
} from './autonomousDecision'
export {
  isAdaptiveLearningEnabled,
  ADAPTIVE_LEARNING_FEATURE_ID,
  runAdaptiveLearningTurn,
  getLearnedProfile,
  resetAdaptiveLearningProfile,
  setAdaptiveLearningEnabled,
  SPRINT80_ADAPTIVE_LEARNING_VERSION,
} from './adaptiveLearning'
export type {
  AdaptiveLearningMeta,
  AdaptiveLearningResult,
} from './adaptiveLearning'
export {
  isBookingExecutionEnabled,
  isTransactionManagerEnabled,
  isBookingResumeEnabled,
  BOOKING_EXECUTION_FEATURE_ID,
  TRANSACTION_MANAGER_FEATURE_ID,
  BOOKING_RESUME_FEATURE_ID,
  runBookingExecution,
  createBookingExecutionEngine,
  lineItemsFromBookingIntelligence,
  shouldRunBookingExecution,
} from './bookingExecution'
export type {
  BookingExecutionResult,
  BookingExecutionSnapshot,
  UnifiedBooking,
  BookingLifecycleStatus,
} from './bookingExecution'
export {
  isTripManagementEnabled,
  TRIP_MANAGEMENT_FEATURE_ID,
  createTripFromBookings,
  createTripFromExecution,
  getTrip,
  getTrips,
  getTripStatus,
  refreshTrip,
  mergeTripProviderUpdates,
  mergeProviderUpdates,
  getDefaultTripManagementService,
  resetDefaultTripManagementService,
  TripManagementService,
} from './tripManagement'
export type {
  ManagedTrip,
  TripLifecycleStatus,
  TripTimelineEvent,
  TripSearchQuery,
  TripSortMode,
  TripFilterMode,
  TripDocumentBundle,
} from './tripManagement'
export {
  isDocumentCenterV2Enabled,
  DOCUMENT_CENTER_V2_FEATURE_ID,
  getDefaultDocumentService,
  resetDefaultDocumentService,
  DocumentService,
  publishDocumentsAfterBookingExecution,
} from './documentCenter'
export type {
  EnterpriseDocument,
  EnterpriseDocumentType,
  DocumentSearchQuery,
  DocumentSortMode,
  ZipPackageResult,
} from './documentCenter'
export {
  isPaymentsEnabled,
  isTicketingEnabled,
  isRefundsEnabled,
  PAYMENTS_FEATURE_ID,
  TICKETING_FEATURE_ID,
  REFUNDS_FEATURE_ID,
  runPaymentsPlatform,
  createPaymentsPlatformEngine,
  createDefaultMockPaymentProviders,
} from './paymentsPlatform'
export type {
  PaymentsPlatformResult,
  PaymentsPlatformSnapshot,
  PaymentLifecycleStatus,
  UnifiedTicket,
} from './paymentsPlatform'
export {
  createDefaultAgentToolRegistry,
  createMockAgentToolRegistry,
  createUnavailableAgentToolRegistry,
  AGENT_TOOL_NAMES,
} from './tools/stubs'
export { createAgentToolRegistry } from './tools/registry'
export { createToolExecutor } from './tools/executor'
export { selectToolsForTurn } from './tools/selectTools'
export { mergeToolResultsIntoPlan } from './tools/mergeToolResults'
export { buildToolInput } from './tools/buildToolInput'
export {
  resolveAirportCode,
  buildFlightSearchRequest,
  buildHotelSearchRequest,
  runFlightSearchTool,
  runHotelSearchTool,
} from './tools/searchEngineBridge'
export { createMockFlightSearchTool, createMockHotelSearchTool } from './tools/mockTools'
export {
  applyIntelligentDecisions,
  detectTripConflicts,
  scoreFlightCandidate,
  scoreHotelCandidate,
  computeTripScores,
} from './decision'
export type {
  TripDecisionScores,
  DecisionRationale,
  DecisionConflict,
} from './decision'
export type {
  AgentTool,
  AgentToolName,
  AgentToolRegistry,
  AgentToolResult,
  ToolExecutionBatch,
  ToolJsonSchema,
  ToolExecutionMeta,
} from './tools/types'
export {
  runTravelReasoning,
  formatReasoningReply,
  detectOpenEndedDestination,
  seedRequirementsFromPreferences,
  learnPreferencesFromRequirements,
  isTravelReasoningEnabled,
  DESTINATION_CATALOG,
} from './reasoning'
export type {
  TravelReasoningResult,
  DestinationCandidate,
  TravelReasoningSnapshot,
} from './reasoning'
export {
  createAgentLlmProvider,
  createAgentLlmRegistry,
  getDefaultAgentLlmProviderId,
} from './llm/factory'
export type { AgentLlmProvider, AgentLlmProviderId, AgentLlmRegistry } from './llm/types'
export {
  createAggregationEngine,
  createDefaultAggregationEngine,
  createDefaultProviderRegistry,
  createActiveMockProviderRegistry,
  createProviderRegistry,
  createProviderAdapter,
  dedupeOffers,
  rankOffers,
  scoreOfferConfidence,
  mergeCompatibleOffers,
  createDefaultMockProviderAdapters,
  createDefaultProviderAdapters,
  createActiveMockProviderAdapters,
  createFutureProviderStubs,
  createAmadeusProviderAdapter,
  resolveAmadeusProviderConfig,
  isAmadeusConfigured,
  createBookingComProviderAdapter,
  resolveBookingComProviderConfig,
  isBookingComConfigured,
  createGoogleMapsProviderAdapter,
  resolveGoogleMapsProviderConfig,
  isGoogleMapsConfigured,
  createOpenWeatherProviderAdapter,
  createWeatherProviderAdapter,
  resolveOpenWeatherProviderConfig,
  isOpenWeatherConfigured,
  createMockRome2RioAdapter,
  normalizeProviderError,
  FUTURE_PROVIDER_CATALOG,
  selectProviders,
} from './aggregation'
export type {
  AggregationEngine,
  AggregationResult,
  AggregatableDomain,
  ProviderAdapter,
  ProviderRegistry,
  ProviderCapabilities,
  ProviderHealthSnapshot,
  NormalizedOffer,
  ProviderMetadata,
  ProviderSelectionStrategy,
} from './aggregation'
export * as providerAdapters from './providers'

/** Sprint 71 — Live Provider Integration Framework (Provider Runtime) */
export {
  createProviderRuntimeRegistry,
  getDefaultProviderRuntimeRegistry,
  resetDefaultProviderRuntimeRegistry,
  createProviderRetryPolicy,
  validateProviderSecrets,
  validateAllProviderSecrets,
  searchWithFailover,
  SPRINT71_PROVIDER_RUNTIME_VERSION,
  GRACEFUL_PROVIDER_MESSAGE,
  type ProviderRuntimeRegistry,
  type ProviderRuntimeAdapter,
  type ProviderRuntimeId,
  type ProviderRuntimeHealth,
} from './providerRuntime'

/** Sprint 72 — Flight Search Engine */
export {
  createFlightSearchEngine,
  getDefaultFlightSearchEngine,
  resetDefaultFlightSearchEngine,
  rankFlights,
  dedupeFlights,
  applyFlightFilters,
  sortFlights,
  normalizeFlightOffer,
  SPRINT72_FLIGHT_SEARCH_VERSION,
  type FlightSearchEngine,
  type FlightSearchRequest,
  type FlightSearchPage,
  type UnifiedFlight,
  type FlightSortMode,
} from './flightSearchEngine'

/** Sprint 73 — Hotel Search Engine */
export {
  createHotelSearchEngine,
  getDefaultHotelSearchEngine,
  resetDefaultHotelSearchEngine,
  rankHotels,
  dedupeHotels,
  applyHotelFilters,
  sortHotels,
  normalizeHotelOffer,
  SPRINT73_HOTEL_SEARCH_VERSION,
  type HotelSearchEngine,
  type HotelSearchRequest,
  type HotelSearchPage,
  type UnifiedHotel,
  type HotelSortMode,
} from './hotelSearchEngine'
