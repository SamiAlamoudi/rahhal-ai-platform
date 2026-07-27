import type { ChatMessage } from '../../chat/chatTypes'
import type { AgentLocale, AgentMemory, TripPlan } from '../types'

/**
 * LLM provider abstraction for the Travel AI Agent.
 * Conversation Brain uses `converse` for all user-facing language.
 * Travel Intelligence never authors traveler-facing prose.
 */
export type AgentLlmProviderId =
  | 'local'
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'deepseek'

export interface AgentLlmRequest {
  conversationId: string
  messages: ChatMessage[]
  memory: AgentMemory
  locale: AgentLocale
  signal?: AbortSignal
}

export interface AgentLlmPlanDraft {
  title?: string
  summary?: string
  /** Optional vendor-drafted notes merged into the structured plan. */
  notes?: string[]
}

export interface AgentLlmResponse {
  providerId: AgentLlmProviderId
  status: 'ok' | 'unavailable' | 'skipped'
  draft: AgentLlmPlanDraft | null
  /** @deprecated Conversation Brain uses converse(); hint is unused for UI. */
  assistantHint?: string | null
}

export interface ConversationLlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LlmTokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface ConversationLlmRequest {
  systemPrompt: string
  messages: ConversationLlmMessage[]
  signal?: AbortSignal
  temperature?: number
  /** Streaming partial assistant text (accumulated). */
  onDelta?: (accumulatedText: string) => void
  /** Prefer SSE streaming when the provider supports it (default true for OpenAI). */
  stream?: boolean
}

export interface ConversationLlmResponse {
  providerId: AgentLlmProviderId
  status: 'ok' | 'unavailable' | 'error'
  text: string
  error?: string
  usage?: LlmTokenUsage | null
}

export interface AgentLlmProvider {
  readonly providerId: AgentLlmProviderId
  isAvailable(): boolean
  complete(request: AgentLlmRequest): Promise<AgentLlmResponse>
  /** Generative dialogue for Conversation Brain (OpenAI when configured). */
  converse(request: ConversationLlmRequest): Promise<ConversationLlmResponse>
}

export interface AgentLlmRegistry {
  list(): AgentLlmProviderId[]
  get(id: AgentLlmProviderId): AgentLlmProvider | undefined
  getActive(): AgentLlmProvider
}

export type { TripPlan }
