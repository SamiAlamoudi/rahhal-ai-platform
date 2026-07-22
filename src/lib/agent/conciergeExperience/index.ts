/**
 * Sprint 96 — AI Concierge Experience agent bridge barrel.
 */

export {
  CONCIERGE_EXPERIENCE_FEATURE_ID,
  isConciergeExperienceEnabled,
} from './feature'

export {
  SPRINT96_AI_CONCIERGE_VERSION,
  runConciergeExperience,
  enrichWithConciergeExperience,
  toAgentConciergeExperienceMeta,
  type AgentConciergeExperienceRequest,
  type AgentConciergeExperienceResponse,
  type AgentConciergeExperienceMeta,
} from './bridge'
