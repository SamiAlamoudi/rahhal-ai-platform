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
  buildPlanningDraft,
  canBuildPlanningDraft,
  planningDraftToInsightLines,
  resolveTravelerCount,
  resolveDurationDays,
  type PlanningDraft,
  type PlanningEstimate,
} from './planningDraft'
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
  isConversationIntelligenceEnabled,
  CONVERSATION_INTELLIGENCE_FEATURE_ID,
  analyzeConversation,
  enrichWithConversationIntelligence,
  extractEntities,
  detectConversationIntent,
  resolveReferences,
  summarizeConversation,
  formatSummaryForConsultant,
  planIntelligentQuestions,
  filterInterviewMissingFields,
  PHASE4_CONVERSATION_INTELLIGENCE_VERSION,
} from './conversationIntelligence'
export type {
  ConversationIntelligenceResult,
  LiveTravelMemory,
  ConversationIntentKind,
  ExtractedEntities,
} from './conversationIntelligence'
export {
  isLlmConversationBrainEnabled,
  LLM_CONVERSATION_BRAIN_FEATURE_ID,
  runLlmConversationBrain,
  enrichWithLlmConversationBrain,
  detectArabicDialect,
  PHASE5_LLM_CONVERSATION_BRAIN_VERSION,
} from './llmBrain'
export type {
  LlmBrainResult,
  ArabicDialect,
  ToolDecisionKind,
  ConfidenceLevel,
} from './llmBrain'
export {
  isAgentRuntimeEnabled,
  AGENT_RUNTIME_FEATURE_ID,
  runAgentRuntime,
  enrichWithAgentRuntime,
  resetAgentRuntimeSessions,
  PHASE6_AGENT_RUNTIME_VERSION,
} from './agentRuntime'
export type {
  AgentRuntimeResult,
  RuntimeEventType,
  ToolLifecycleStatus,
} from './agentRuntime'
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
  isPriceIntelligenceEnabled,
  PRICE_INTELLIGENCE_FEATURE_ID,
  enrichWithPriceIntelligence,
  buildPriceIntelligenceInput,
  runBookingTiming,
  SPRINT81_PRICE_INTELLIGENCE_VERSION,
} from './priceIntelligence'
export type { BookingTimingResult } from './priceIntelligence'
export {
  isDynamicPackagesEnabled,
  DYNAMIC_PACKAGES_FEATURE_ID,
  enrichWithDynamicPackages,
  runPackageBuilder,
  SPRINT83_DYNAMIC_PACKAGES_VERSION,
} from './packageBuilder'
export type { PackageBuilderResult } from './packageBuilder'
export {
  isItineraryRefinementEnabled,
  ITINERARY_REFINEMENT_FEATURE_ID,
  enrichWithItineraryRefinement,
  runItineraryRefinement,
  SPRINT84_ITINERARY_REFINEMENT_VERSION,
} from './itineraryRefinement'
export type { RefinementResult } from './itineraryRefinement'
export {
  isUnifiedTripEnabled,
  UNIFIED_TRIP_FEATURE_ID,
  runUnifiedTrip,
  enrichWithUnifiedTrip,
  SPRINT93_UNIFIED_TRIP_VERSION,
} from './unifiedTrip'
export type {
  AgentUnifiedTripRequest,
  AgentUnifiedTripResponse,
  AgentUnifiedTripMeta,
} from './unifiedTrip'
export {
  isAlphaExperienceEnabled,
  ALPHA_EXPERIENCE_FEATURE_ID,
  runAlphaExperienceConversation,
  enrichWithAlphaExperience,
  assembleAlphaTravelerExperience,
  toAlphaExperienceComposeInput,
  toAgentAlphaTravelerExperienceMeta,
  SPRINT91_ALPHA_EXPERIENCE_VERSION,
  SPRINT99_ALPHA_ASSEMBLY_VERSION,
} from './alphaExperience'
export type {
  AgentAlphaExperienceRequest,
  AgentAlphaExperienceResponse,
  AgentAlphaExperienceMeta,
  AssembleAlphaTravelerExperienceInput,
  AgentAlphaTravelerExperienceMeta,
  AgentAlphaTravelerExperienceAttachment,
} from './alphaExperience'
export {
  isBookingAssistantEnabled,
  BOOKING_ASSISTANT_FEATURE_ID,
  assembleBookingAssistant,
  toBookingAssistantComposeInput,
  toAgentBookingAssistantMeta,
  SPRINT101_BOOKING_ASSISTANT_VERSION,
} from './bookingAssistant'
export type {
  AssembleBookingAssistantInput,
  AgentBookingAssistantMeta,
  AgentBookingAssistantAttachment,
} from './bookingAssistant'
export {
  isConciergeExperienceEnabled,
  CONCIERGE_EXPERIENCE_FEATURE_ID,
  runConciergeExperience,
  enrichWithConciergeExperience,
  SPRINT96_AI_CONCIERGE_VERSION,
} from './conciergeExperience'
export type {
  AgentConciergeExperienceRequest,
  AgentConciergeExperienceResponse,
  AgentConciergeExperienceMeta,
} from './conciergeExperience'
/** Sprint 111 — Decision Conversation Layer (post–Response Composer) */
export {
  isConciergeEnabled,
  CONCIERGE_FEATURE_ID,
  runConcierge,
  createConciergeRunner,
  optionsFromResponseComposer,
  SPRINT111_CONCIERGE_VERSION,
} from './concierge'
export type {
  ConciergeInput,
  ConciergeResult,
  ConciergeRecommendationOption,
  ConciergeExplanation,
  ConciergeTradeoff,
  ConciergeScenario,
  ConciergeSavingsAnalysis,
  ConciergeNarrative,
  ConciergeConversationMetadata,
} from './concierge'
export {
  integrateConciergeIntoTurn,
  toRecommendationResponseDto,
  toConversationResponseDto,
  toTripResponseDto,
  offersFromEngineSnapshots,
  tripFactsFromMemory,
  emptyRecommendationResponseDto,
  SPRINT97_CONCIERGE_INTEGRATION_VERSION,
} from './conciergeIntegration'
export type {
  ConciergeTurnIntegrationInput,
  ConciergeTurnIntegrationResult,
  RecommendationResponseDto,
  ConversationResponseDto,
  TripResponseDto,
} from './conciergeIntegration'
export {
  isBookingOrchestratorEnabled,
  BOOKING_ORCHESTRATOR_FEATURE_ID,
  runLiveBookingOrchestrator,
  SPRINT94_BOOKING_ORCHESTRATOR_VERSION,
} from './bookingOrchestrator'
export type {
  AgentBookingOrchestratorRequest,
  AgentBookingOrchestratorResponse,
  AgentBookingOrchestratorMeta,
} from './bookingOrchestrator'
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

/** Sprint 110 — AI Trip Builder */
export {
  isTripBuilderEnabled,
  TRIP_BUILDER_FEATURE_ID,
  runTripBuilder,
  buildTrips,
  createTripBuilder,
  createTripBuilderRunner,
  prioritizeOffersForDecisionEngine as prioritizeTripOffersForDecisionEngine,
  toResponseComposerInput as toTripBuilderResponseComposerInput,
  SPRINT110_TRIP_BUILDER_VERSION,
} from './tripBuilder'
export type {
  TripBuilderInput,
  TripBuilderResult,
  TripCandidate,
  TripPackageForComposer,
  TripRankKind,
} from './tripBuilder'

/** Sprint 112 — AI Memory & Personalization Engine (import path: ./memory/index) */
export {
  isMemoryEngineEnabled,
  MEMORY_ENGINE_FEATURE_ID,
  runMemoryEngine,
  createMemoryRunner,
  resetMemoryEngineStores,
  extractPreferencesFromText,
  toConciergeMemoryHints,
  toResponseComposerMemoryNotes,
  SPRINT112_MEMORY_ENGINE_VERSION,
} from './memory/index'
export type {
  MemoryEngineInput,
  MemoryEngineResult,
  MemoryTravelerProfile,
  MemoryMetadata,
  TravelHistorySummary,
  PreferenceScoreBreakdown,
} from './memory/index'

/** Sprint 113 — AI Orchestrator (production coordination layer) */
export {
  isPipelineOrchestratorEnabled,
  PIPELINE_ORCHESTRATOR_FEATURE_ID,
  runAIOrchestrator,
  createAIOrchestrator,
  buildOrchestratorPlan,
  SPRINT113_AI_ORCHESTRATOR_VERSION,
} from './orchestrator'
export type {
  OrchestratorInput,
  OrchestratorResult,
  ExecutionPlan,
  ExecutionMetrics,
  OrchestratorFinalResponse,
} from './orchestrator'

/** Sprint 114 — Intelligent Itinerary Engine */
export {
  isItineraryEngineEnabled,
  ITINERARY_ENGINE_FEATURE_ID,
  runItineraryEngine,
  createItineraryEngine,
  createItineraryRunner,
  SPRINT114_ITINERARY_ENGINE_VERSION,
} from './itinerary'
export type {
  ItineraryEngineInput,
  ItineraryEngineResult,
  ItineraryDayPlan,
  ItineraryScores,
  ItineraryMetadata,
  TripStyleKind,
} from './itinerary'

/** Sprint 115 — Unified AI Execution Pipeline */
export {
  isExecutionPipelineEnabled,
  EXECUTION_PIPELINE_FEATURE_ID,
  runUnifiedExecutionPipeline,
  createPipelineRunner,
  SPRINT115_EXECUTION_PIPELINE_VERSION,
} from './pipeline'
export type {
  PipelineInput,
  PipelineResult,
  PipelineMetrics,
  PipelineStageId,
  PipelineStageResult,
} from './pipeline'

/** Sprint 116 — AI Streaming Conversation Experience */
export {
  isStreamingConversationEnabled,
  STREAMING_CONVERSATION_FEATURE_ID,
  runStreamingConversation,
  createStreamingConversation,
  SPRINT116_STREAMING_CONVERSATION_VERSION,
} from './streaming'
export type {
  StreamingConversationInput,
  StreamingConversationResult,
  StreamingEvent,
  StreamingMetrics,
} from './streaming'

/** Sprint 118 — Editable AI Conversation */
export {
  isEditableConversationEnabled,
  EDITABLE_CONVERSATION_FEATURE_ID,
  runConversationEditor,
  createConversationEditor,
  SPRINT118_EDITABLE_CONVERSATION_VERSION,
} from './editing'
export type {
  ConversationEditInput,
  ConversationEditorResult,
  EditPlan,
  EditDiff,
  EditKind,
} from './editing'

/** Sprint 92 — Amadeus Sandbox TravelProvider */
export {
  isAmadeusSandboxEnabled,
  AMADEUS_SANDBOX_FEATURE_ID,
  createAmadeusSandboxProvider,
  registerAmadeusSandboxProvider,
  createAmadeusSandboxRegistry,
  SPRINT92_AMADEUS_SANDBOX_VERSION,
  AMADEUS_SANDBOX_PROVIDER_ID,
} from './providers/amadeusSandbox'
export type {
  AmadeusSandboxProvider,
  AmadeusSandboxProviderOptions,
} from './providers/amadeusSandbox'

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

/** Integration Sprint 2 — conversation ↔ live flight search bridge */
export {
  INTEGRATION_LIVE_FLIGHT_SEARCH_VERSION,
  tryConversationLiveFlightSearch,
  conversationResultToToolData,
  runConversationAwareFlightSearch,
  rankConversationFlights,
  buildConsultantFlightSummary,
  resetConversationFlightSearchCache,
  getConversationFlightSearchCache,
  buildLiveCriteriaFromContext,
  type ConversationFlightSearchResult,
  type RankedConversationFlight,
} from './integrationFlightSearch'

/** Integration Sprint 3 — conversation ↔ live hotel search bridge */
export {
  INTEGRATION_LIVE_HOTEL_SEARCH_VERSION,
  tryConversationLiveHotelSearch,
  conversationHotelResultToToolData,
  runConversationAwareHotelSearch,
  rankConversationHotels,
  buildConsultantHotelSummary,
  resetConversationHotelSearchCache,
  getConversationHotelSearchCache,
  buildLiveHotelCriteriaFromContext,
  type ConversationHotelSearchResult,
  type RankedConversationHotel,
} from './integrationHotelSearch'

/** Integration Sprint 4 — AI Trip Orchestrator */
export {
  INTEGRATION_TRIP_ORCHESTRATOR_VERSION,
  INTEGRATION_TRIP_ORCHESTRATOR_FEATURE_ID,
  isIntegrationTripOrchestratorEnabled,
  runTripOrchestrator,
  enrichWithIntegrationTripOrchestrator,
  buildOrchestratorBudget,
  detectTripScenario,
  type TripOrchestratorResult,
  type OrchestratorExecutionPlan,
} from './integrationTripOrchestrator'

/** Integration Sprint 5 — Destination Intelligence */
export {
  INTEGRATION_DESTINATION_INTELLIGENCE_VERSION,
  INTEGRATION_DESTINATION_INTELLIGENCE_FEATURE_ID,
  isIntegrationDestinationIntelligenceEnabled,
  runDestinationIntelligence,
  enrichWithIntegrationDestinationIntelligence,
  recommendDestinations,
  compareDestinations,
  type DestinationIntelligenceResult,
  type DestinationRecommendation,
  type DestinationComparison,
} from './integrationDestinationIntelligence'

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
