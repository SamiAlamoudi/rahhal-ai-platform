/**
 * Sprint 44 — ChatGPT-like conversation experience types.
 * Orchestration only — no new travel engines.
 */

export type ChatGptIntent =
  | 'book_flight'
  | 'search_hotels'
  | 'create_itinerary'
  | 'travel_advice'
  | 'visa_question'
  | 'general_chat'
  | 'follow_up'
  | 'tool_result'
  | 'small_talk'
  | 'unknown'
  | 'weather'
  | 'pricing'

export type ChatGptExperienceState =
  | 'idle'
  | 'listening'
  | 'understanding'
  | 'thinking'
  | 'using_tools'
  | 'searching'
  | 'generating'
  | 'responding'
  | 'speaking'
  | 'done'
  | 'error'

export type PlanStepId =
  | 'understand_request'
  | 'determine_tools'
  | 'gather_information'
  | 'combine_results'
  | 'generate_response'

export interface ResponsePlan {
  intent: ChatGptIntent
  steps: PlanStepId[]
  toolsRequired: boolean
  toolIds: string[]
  reason: string
}

export interface ToolDecision {
  useTools: boolean
  toolIds: string[]
  reason: string
}

export interface MemorySnapshot {
  conversationId: string
  previousMessages: Array<{ role: string; content: string }>
  preferences: {
    destinations: string[]
    budgets: Array<{ amount: number | null; currency: string | null }>
    travelStyle: string | null
    companions: string | null
  }
  unfinished: string[]
  previousToolResults: string[]
  summary: string | null
  rollingWindow: Array<{ role: string; content: string }>
}

export interface ExperienceTurnContext {
  conversationId: string
  userText: string
  locale: 'ar' | 'en'
  userId?: string | null
  history: Array<{ role: string; content: string }>
  signal?: AbortSignal
}

export interface ExperienceTurnResult {
  intent: ChatGptIntent
  plan: ResponsePlan
  toolDecision: ToolDecision
  memory: MemorySnapshot
  text: string
  followUp: string | null
  states: ChatGptExperienceState[]
  timings: Record<string, number>
  usedTools: boolean
  recoveredFromError: boolean
}

export interface SessionUiRecovery {
  conversationId: string | null
  draft: string
  modality: 'text' | 'voice'
  voiceMode: 'push_to_talk' | 'hands_free'
  voiceLocale: 'ar' | 'en'
  pinnedIds: string[]
  updatedAt: string
}

export const EXPERIENCE_STATE_LABELS: Record<ChatGptExperienceState, { ar: string; en: string }> = {
  idle: { ar: 'جاهز', en: 'Ready' },
  listening: { ar: 'Listening…', en: 'Listening…' },
  understanding: { ar: 'Understanding…', en: 'Understanding…' },
  thinking: { ar: 'Thinking…', en: 'Thinking…' },
  using_tools: { ar: 'Using tools…', en: 'Using tools…' },
  searching: { ar: 'Searching…', en: 'Searching…' },
  generating: { ar: 'Generating…', en: 'Generating…' },
  responding: { ar: 'Responding…', en: 'Responding…' },
  speaking: { ar: 'Speaking…', en: 'Speaking…' },
  done: { ar: 'Done', en: 'Done' },
  error: { ar: 'Error', en: 'Error' },
}
