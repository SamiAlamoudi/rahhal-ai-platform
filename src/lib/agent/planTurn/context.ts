import type { ConciergeService, ConciergeState } from '../../concierge'
import type { BookingRecord } from '../../booking'
import type { BrainMetaSnapshot } from '../../brain/integration'
import type { RahhalBrainMetaSnapshot, RahhalBrainTurnResult } from '../../brain/core'
import type { AgentLlmRegistry } from '../llm/types'
import type { ConversationObjective, TravelFacts } from '../conversationBrain'
import type { extractFromUserText } from '../extractRequirements'
import type {
  AgentMemory,
  AgentProviderMeta,
  TripPlan,
} from '../types'
import type { ToolExecutionBatch } from '../tools/types'
import type {
  AutonomousAgentSnapshot,
  AutonomousProgressEvent,
} from '../autonomous'
import type { BookingIntelligenceResult } from '../bookingIntelligence'
import type { BudgetIntelligenceResult } from '../budgetIntelligence'
import type { TravelerPersonalizationResult } from '../travelerPersonalization'
import type { TripOptimizerResult } from '../tripOptimizer'
import type { TravelPlannerResult } from '../travelPlanner'
import type { AutonomousDecisionResult } from '../autonomousDecision'
import type { AdaptiveLearningResult } from '../adaptiveLearning'
import type { BookingTimingResult } from '../priceIntelligence'
import type { PackageBuilderResult } from '../packageBuilder'
import type { RefinementResult } from '../itineraryRefinement'
import type { BookingExecutionResult } from '../bookingExecution'
import type { PaymentsPlatformResult } from '../paymentsPlatform'
import type { ConciergeTurnIntegrationResult } from '../conciergeIntegration'
import type { AgentAlphaTravelerExperienceAttachment } from '../alphaExperience'
import type { AgentBookingAssistantAttachment } from '../bookingAssistant'
import type { applyConstitutionToTurn } from '../constitution'
import type {
  TravelAgentTurnInput,
  TravelAgentTurnResult,
  TravelAgentServiceOptions,
} from '../travelAgentService'

export type ExtractedRequirements = ReturnType<typeof extractFromUserText>

export interface RunToolsForPlanInput {
  memory: AgentMemory
  conversationId: string
  userText?: string
  signal?: AbortSignal
  seed?: string
  basePlan?: TripPlan
  priorAutonomous?: AutonomousAgentSnapshot | null
  onProgress?: (event: AutonomousProgressEvent) => void
  /** Sprint 78 — precomputed travel strategy (runs before engines). */
  travelPlanner?: TravelPlannerResult | null
}

export interface RunToolsForPlanResult {
  plan: TripPlan
  batch: ToolExecutionBatch
  autonomous?: AutonomousAgentSnapshot
  bookingIntelligence?: BookingIntelligenceResult
  budgetIntelligence?: BudgetIntelligenceResult
  travelerPersonalization?: TravelerPersonalizationResult
  tripOptimizer?: TripOptimizerResult
  travelPlanner?: TravelPlannerResult
  autonomousDecision?: AutonomousDecisionResult
  priceIntelligence?: BookingTimingResult
  dynamicPackages?: PackageBuilderResult
  itineraryRefinement?: RefinementResult
  bookingExecution?: BookingExecutionResult
  payments?: PaymentsPlatformResult
}

export interface PlanTurnDeps {
  options: TravelAgentServiceOptions
  llms: AgentLlmRegistry
  savePlanHook?: TravelAgentServiceOptions['savePlan']
  conciergeService: ConciergeService | null
  listBookingRecords: () => Promise<BookingRecord[]>
  runToolsForPlan: (input: RunToolsForPlanInput) => Promise<RunToolsForPlanResult>
  isConciergeEnabled: () => boolean
  isBookingHistoryEnabled: () => boolean
  isBookingConfirmationEnabled: () => boolean
  isOrderManagementEnabled: () => boolean
  isSmartItineraryEnabled: () => boolean
  isBrainEnabled: () => boolean
  isBrainHandoffEnabled: () => boolean
  isTravelEngineEnabled: () => boolean
  isTripPlanningEnabled: () => boolean
  isExecutionEnabled: () => boolean
  isSearchEnabled: () => boolean
  isTripOrchestratorEnabled: () => boolean
  isReasoningEnabled: () => boolean
  isClarificationEnabled: () => boolean
  isBrainCoreEnabled: () => boolean
  isAutonomousEnabled: () => boolean
  isTravelerPersonalizationOn: () => boolean
  isTravelPlannerOn: () => boolean
  isAdaptiveLearningOn: () => boolean
  isFlowEnabled: () => boolean
}

export interface PlanTurnContext {
  input: TravelAgentTurnInput
  userText: string
  alphaJourneyCue: boolean
  preferenceUserId: string
  extracted: ExtractedRequirements
  memory: AgentMemory
  reasoningResult: import('../reasoning').TravelReasoningResult | null
  reasoningMeta: AgentProviderMeta['reasoning'] | undefined
  clarificationMeta: NonNullable<AgentProviderMeta['clarification']> | undefined
  rahhalBrainMeta: RahhalBrainMetaSnapshot | undefined
  travelExecutiveSnapshot: RahhalBrainTurnResult['executive'] | undefined
  executivePlatformSnapshot: RahhalBrainTurnResult['executivePlatform'] | undefined
  liveIntelligenceSnapshot: RahhalBrainTurnResult['liveIntelligence'] | undefined
  autonomousSnapshot: AutonomousAgentSnapshot | null
  priorAutonomous: AutonomousAgentSnapshot | null
  bookingIntelligenceResult: BookingIntelligenceResult | null
  budgetIntelligenceResult: BudgetIntelligenceResult | null
  travelerPersonalizationResult: TravelerPersonalizationResult | null
  tripOptimizerResult: TripOptimizerResult | null
  travelPlannerResult: TravelPlannerResult | null
  autonomousDecisionResult: AutonomousDecisionResult | null
  adaptiveLearningResult: AdaptiveLearningResult | null
  priceIntelligenceResult: BookingTimingResult | null
  dynamicPackagesResult: PackageBuilderResult | null
  itineraryRefinementResult: RefinementResult | null
  bookingExecutionResult: BookingExecutionResult | null
  paymentsResult: PaymentsPlatformResult | null
  constitutionMeta: AgentProviderMeta['constitution'] | undefined
  conciergeIntegration: ConciergeTurnIntegrationResult | null
  alphaTravelerAssembly: AgentAlphaTravelerExperienceAttachment | null
  bookingAssistantAssembly: AgentBookingAssistantAttachment | null
  brainMeta: BrainMetaSnapshot | undefined
  travelEngineOn: boolean
  tripPlanningOn: boolean
  executionOn: boolean
  searchOn: boolean
  orchestratorOn: boolean
  conciergeState: ConciergeState | null
  toolBatch: ToolExecutionBatch | null
  objective: ConversationObjective
  savedTitle: string | null
}

export interface PresentationHandoff {
  facts: TravelFacts
  toolHadNoResults: boolean
  decisionConfidence: number
  constitutionPreview: ReturnType<typeof applyConstitutionToTurn>
}

export type PlanTurnStageResult = TravelAgentTurnResult | null
