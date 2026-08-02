/**
 * Brain UI production freeze — sole conversation owner is TravelBrain.
 *
 * Canonical product spine:
 *
 *   App → BrainProvider → useTravelBrain → BrainSessionController
 *       → TravelBrain.processTurn → RecommendationEngine → UI
 *
 * Voice = mock STT → TravelBrain (no live STT/TTS).
 * No parallel chatEngine / planTurn conversation owner for product traffic.
 */

/** Sole conversation system for product traffic. */
export const RECOVERY_CONVERSATION =
  'BrainProvider+BrainSessionController+TravelBrain' as const

/** Sole turn owner: user message → TravelBrain → recommendations → UI. */
export const RECOVERY_TURN_OWNER = 'TravelBrain.processTurn' as const

/** Sole chat UI shell. */
export const RECOVERY_CHAT_UI = 'BrainChatPage' as const

/** Sole hosted payment implementation. */
export const RECOVERY_PAYMENT = 'lib/payment' as const

/**
 * Sole conversation persistence path for product UI.
 * In-memory TravelBrain short-term memory (mock foundation).
 */
export const RECOVERY_CONVERSATION_STORE = 'BrainSessionController+TravelBrain.memory' as const

/**
 * Sole memory pipeline on the default turn.
 */
export const RECOVERY_MEMORY = 'src/brain preferences+shortTerm memory' as const

/**
 * Feature flags frozen OFF for product traffic.
 * Tests may still `setEnabled` these for isolated suite coverage.
 * Product wiring must not branch on them for conversation ownership.
 */
export const RECOVERY_FROZEN_OFF_FLAGS = [
  'ui.production_integration',
  'ui.premium_home',
  'ui.experience_v1',
  'ui.chatgpt_experience',
  'ui.conversation_experience',
  'brain.enabled',
  'brain.conversation_ui',
  'brain.ai_orchestrator',
  'brain.payments_platform',
  'brain.finance_platform',
  'brain.context_memory',
  'brain.memory',
  'ai.brain.v1',
  'ai.memory_engine',
  'ai.orchestrator',
  'ai.execution_pipeline',
  'ai.streaming_conversation',
  'ai.editable_conversation',
  'payments.live',
] as const

export type RecoveryFrozenOffFlag = (typeof RECOVERY_FROZEN_OFF_FLAGS)[number]

/**
 * Microphone state after a completed assistant turn.
 * Next listen requires an explicit user action (mock voice orb).
 */
export const RECOVERY_VOICE_MIC_AFTER_REPLY = 'idle' as const

/**
 * Realtime turn-detection barge-in flag — unused (no live realtime voice).
 */
export const RECOVERY_VOICE_INTERRUPT_RESPONSE = false as const
