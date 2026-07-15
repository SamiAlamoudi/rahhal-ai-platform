import type { ChatMessage } from '../../chat/chatTypes'
import type { AgentLocale, AgentMemory, TripPlan } from '../types'

/**
 * LLM provider abstraction for the Travel AI Agent.
 * Concrete vendors (OpenAI, Anthropic, Gemini, DeepSeek, local) plug in here.
 * No real remote APIs in foundation — only interfaces + local/stub adapters.
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
  /** Optional freeform assistance text when not producing a full plan. */
  assistantHint?: string | null
}

export interface AgentLlmProvider {
  readonly providerId: AgentLlmProviderId
  isAvailable(): boolean
  complete(request: AgentLlmRequest): Promise<AgentLlmResponse>
}

export interface AgentLlmRegistry {
  list(): AgentLlmProviderId[]
  get(id: AgentLlmProviderId): AgentLlmProvider | undefined
  getActive(): AgentLlmProvider
}

export type { TripPlan }
