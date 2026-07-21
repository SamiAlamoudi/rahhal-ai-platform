export { AdaptiveLearningEngine, createAdaptiveLearningEngine, runAdaptiveLearning } from './AdaptiveLearningEngine'
export type { AdaptiveLearningResult } from './AdaptiveLearningEngine'
export { inferPreferencesFromText, preferenceKey } from './PreferenceInference'
export type { InferredPreferenceSignal } from './PreferenceInference'
export { processFeedback } from './FeedbackProcessor'
export type { FeedbackInput } from './FeedbackProcessor'
export { analyzeRepeatedBehavior } from './BehaviorAnalyzer'
export {
  increaseConfidence,
  decreaseConfidence,
  snapConfidence,
  confidenceFromObservations,
} from './ConfidenceAdjuster'
export {
  improveRecommendations,
  formatLearningExplanation,
} from './RecommendationImprover'
export {
  emitLearningEvent,
  onLearningEvent,
  resetLearningEventListeners,
} from './events'
export type { LearningEvent, LearningEventName } from './events'
