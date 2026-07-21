/**
 * Sprint 87 — Rahhal AI Constitution (governance barrel).
 */

export {
  SPRINT87_AI_CONSTITUTION_VERSION,
  ALTERNATIVE_CONFIDENCE_THRESHOLD,
  FORBIDDEN_FAILURE_PHRASES,
  type PrincipleId,
  type PrincipleSeverity,
  type PrincipleDefinition,
  type ConstitutionPolicyId,
  type BehaviorSnapshot,
  type RecoveryAttemptKind,
  type PrincipleViolation,
  type PrincipleValidationResult,
} from './BehaviorTypes'

export {
  RAHHAL_PRINCIPLES,
  getPrinciple,
  listPrincipleIds,
} from './RahhalPrinciples'

export {
  PrincipleValidator,
  createPrincipleValidator,
  validatePrinciples,
  type ValidatePrinciplesInput,
} from './PrincipleValidator'

export {
  inferMissionFromText,
  destinationIsVariable,
  evaluateMissionPolicy,
} from './MissionPolicy'

export {
  explanationCompleteness,
  isExplanationComplete,
  evaluateExplanationPolicy,
} from './ExplanationPolicy'

export {
  normalizeConfidence,
  requiresAlternatives,
  evaluateAlternativePolicy,
} from './AlternativePolicy'

export {
  containsForbiddenFailureLanguage,
  preferredFailureFraming,
  evaluateConversationPolicy,
} from './ConversationPolicy'

export {
  REQUIRED_RECOVERY_ATTEMPTS,
  missingRecoveryAttempts,
  isRejectionCue,
  evaluateRecoveryPolicy,
} from './RecoveryPolicy'

export {
  evaluateRecommendationPolicy,
  buildCompliantRecommendationSkeleton,
} from './RecommendationPolicy'

export {
  evaluateDecisionPolicy,
  mayDeclareNoResults,
} from './DecisionPolicy'

export {
  emitConstitutionEvent,
  onConstitutionEvent,
  resetConstitutionEventListeners,
  type ConstitutionEvent,
  type ConstitutionEventName,
} from './events'
