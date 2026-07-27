/**
 * Recovery Phase 1 — FREEZE & SIMPLIFY
 *
 * Canonical product spine (do not add parallel owners):
 *
 *   /chat → LegacyChatPage → chatEngine → travel-agent → travelAgentService.planTurn
 *
 * Voice = browser STT → chatEngine → OpenAI Conversation Brain → TTS (same spine).
 *
 * @see docs/ARCHITECTURE_CONVERSATION_FIRST.md
 * @see docs/MIGRATION_CONVERSATION_FIRST.md
 */

/** Sole conversation system for product traffic. */
export const RECOVERY_CONVERSATION = 'chatEngine+travel-agent' as const

/** Sole turn owner: user message → planning → execution → response. */
export const RECOVERY_TURN_OWNER = 'travelAgentService.planTurn' as const

/** Sole chat UI shell. */
export const RECOVERY_CHAT_UI = 'LegacyChatPage' as const

/** Sole hosted payment implementation. */
export const RECOVERY_PAYMENT = 'lib/payment' as const

/**
 * Sole conversation persistence path.
 * `localChatStore` is the explicit degraded/demo fallback of the same path — not a second product.
 */
export const RECOVERY_CONVERSATION_STORE = 'chatService+repositories(+localChatStore fallback)' as const

/**
 * Sole memory pipeline on the default turn.
 * PreferenceEngine (`ai.persistent_memory`) seeds preferences into the same turn — not a parallel store.
 */
export const RECOVERY_MEMORY = 'agent/memory.ts (rebuildMemoryFromMessages)' as const

/**
 * Feature flags frozen OFF for product traffic.
 * Tests may still `setEnabled` these for isolated suite coverage.
 * Product wiring must not branch on them (see ChatPage / chatProviderFactory / Home).
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
  'ai.memory_engine',
  'ai.orchestrator',
  'ai.execution_pipeline',
  'ai.streaming_conversation',
  'ai.editable_conversation',
  'payments.live',
] as const

export type RecoveryFrozenOffFlag = (typeof RECOVERY_FROZEN_OFF_FLAGS)[number]
