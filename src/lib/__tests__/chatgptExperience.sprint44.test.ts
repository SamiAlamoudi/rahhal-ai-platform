import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
} from '../ai'
import {
  classifyChatIntent,
  decideTools,
  buildResponsePlan,
  createMemoryManager,
  composeNaturalReply,
  smartFollowUp,
  createChatGptExperienceOrchestrator,
  readSessionUiRecovery,
  writeSessionUiRecovery,
  togglePinnedConversation,
  withToolRetry,
  isChatGptExperienceEnabled,
  EXPERIENCE_STATE_LABELS,
  createExperienceStateMachine,
} from '../chat/chatgptExperience'
import { getDefaultChatProviderType } from '../chat/chatProviderFactory'
import { createQuarantinedChatProvider } from '../chat/chatProviderFactory.quarantined'
import type { ChatMessage, ChatProvider, ChatStreamChunk } from '../chat/chatTypes'

function userMessage(conversationId: string, content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `m-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

function enableChatGptExperienceChain(): void {
  const registry = getFeatureRegistry()
  for (const id of [
    'brain.enabled',
    'brain.concierge',
    'brain.travel_engine',
    'brain.trip_planning',
    'brain.execution',
    'brain.search',
    'brain.trip_orchestrator',
    'brain.context_memory',
    'brain.unified_travel_planner',
    'brain.conversation_ui',
    'brain.travel_execution_engine',
    'brain.payments_platform',
    'brain.trip_management',
    'ui.conversation_experience',
    'ui.chatgpt_experience',
  ] as const) {
    registry.setEnabled(id, true)
  }
}

function memoryStub(preferences?: {
  destinations?: string[]
  budgets?: Array<{ amount: number | null; currency: string | null }>
  travelStyle?: string | null
  companions?: string | null
}) {
  return {
    conversationId: 'c1',
    previousMessages: [] as Array<{ role: string; content: string }>,
    preferences: {
      destinations: preferences?.destinations ?? [],
      budgets: preferences?.budgets ?? [{ amount: null, currency: null }],
      travelStyle: preferences?.travelStyle ?? null,
      companions: preferences?.companions ?? null,
    },
    unfinished: [] as string[],
    previousToolResults: [] as string[],
    summary: null as string | null,
    rollingWindow: [] as Array<{ role: string; content: string }>,
  }
}

describe('Sprint 44 — ChatGPT experience', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('gates ui.chatgpt_experience behind conversation experience', () => {
    expect(isChatGptExperienceEnabled()).toBe(false)
    enableChatGptExperienceChain()
    expect(isChatGptExperienceEnabled()).toBe(true)
    getFeatureRegistry().setEnabled('ui.chatgpt_experience', false)
    expect(isChatGptExperienceEnabled()).toBe(false)
  })

  it('creates chatgpt-experience provider when flag chain is on', () => {
    enableChatGptExperienceChain()
    const provider = createQuarantinedChatProvider('chatgpt-experience')
    expect(provider.providerId).toBe('chatgpt-experience')
    // Default selection prefers chatgpt when env does not force mock/conversation-ui.
    const forced = (import.meta.env.VITE_CHAT_PROVIDER as string | undefined)?.trim().toLowerCase()
    if (!forced || forced === 'travel-agent') {
      expect(getDefaultChatProviderType()).toBe('chatgpt-experience')
    }
  })

  it('classifies intents before response generation', () => {
    expect(classifyChatIntent({ userText: 'hello' }).intent).toBe('small_talk')
    expect(classifyChatIntent({ userText: 'I want to travel to Japan' }).intent).toBe('create_itinerary')
    expect(classifyChatIntent({ userText: 'find hotels in Dubai' }).intent).toBe('search_hotels')
    expect(classifyChatIntent({ userText: 'book a flight to Paris' }).intent).toBe('book_flight')
    expect(
      classifyChatIntent({
        userText: 'cheaper please',
        history: [{ role: 'assistant', content: 'Here are options' }],
      }).intent,
    ).toBe('follow_up')
  })

  it('builds an internal plan and skips tools for greetings', () => {
    const intent = classifyChatIntent({ userText: 'Hi there' }).intent
    const tools = decideTools(intent)
    expect(tools.useTools).toBe(false)
    const plan = buildResponsePlan({ intent, toolDecision: tools })
    expect(plan.steps).toEqual(['understand_request', 'generate_response'])
    expect(plan.toolsRequired).toBe(false)
  })

  it('routes weather / hotels / flights to tools without inventing providers', () => {
    expect(decideTools('weather').toolIds).toContain('weather')
    expect(decideTools('search_hotels').useTools).toBe(true)
    expect(decideTools('book_flight').useTools).toBe(true)
    expect(decideTools('pricing').useTools).toBe(true)
  })

  it('memory manager keeps a rolling window and tool results', () => {
    const memory = createMemoryManager({ enabled: true, windowSize: 4 })
    const history = [
      { role: 'user', content: 'one' },
      { role: 'assistant', content: 'two' },
      { role: 'user', content: 'three' },
      { role: 'assistant', content: 'four' },
      { role: 'user', content: 'five' },
    ]
    const snap = memory.absorbTurn({
      conversationId: 'mem-1',
      userText: 'I want Japan under 5000 SAR',
      locale: 'en',
      history,
    })
    expect(snap.rollingWindow.length).toBeLessThanOrEqual(5)
    memory.rememberToolResult('mem-1', 'Found 3 options')
    const again = memory.absorbTurn({
      conversationId: 'mem-1',
      userText: 'and family trip',
      locale: 'en',
      history: [...history, { role: 'user', content: 'I want Japan under 5000 SAR' }],
    })
    expect(again.previousToolResults).toContain('Found 3 options')
  })

  it('asks a natural Japan follow-up instead of a bare “When?”', () => {
    const mem = memoryStub()
    const follow = smartFollowUp({
      intent: 'create_itinerary',
      locale: 'en',
      destination: 'Japan',
      memory: mem,
    })
    expect(follow).toMatch(/tourism, business, or family/i)
    expect(follow).not.toMatch(/^When\??$/i)

    const reply = composeNaturalReply({
      intent: 'create_itinerary',
      userText: 'I want to travel to Japan',
      locale: 'en',
      memory: mem,
    })
    expect(reply.text.toLowerCase()).toContain('japan')
    expect(reply.followUp).toMatch(/tourism, business, or family/i)
  })

  it('streams first tokens immediately and exposes experience states', async () => {
    const stubTools: ChatProvider = {
      providerId: 'stub-tools',
      async *streamReply() {
        yield { type: 'delta', text: 'tool body' }
        yield { type: 'done', meta: { stub: true } }
      },
    }
    const orch = createChatGptExperienceOrchestrator({
      toolProvider: stubTools,
      enabled: true,
    })
    const started = Date.now()
    let firstTokenAt: number | null = null
    const chunks: ChatStreamChunk[] = []
    for await (const chunk of orch.streamTurn({
      conversationId: 's1',
      messages: [userMessage('s1', 'hello')],
      signal: new AbortController().signal,
      locale: 'en',
    })) {
      chunks.push(chunk)
      if (firstTokenAt == null && chunk.type === 'delta' && chunk.text) {
        firstTokenAt = Date.now() - started
      }
    }
    expect(firstTokenAt).not.toBeNull()
    expect(firstTokenAt!).toBeLessThan(500)
    const states = chunks
      .map((c) => c.experienceState ?? (typeof c.meta?.experienceState === 'string' ? c.meta.experienceState : null))
      .filter(Boolean)
    expect(states).toContain('understanding')
    expect(states).toContain('thinking')
    const done = chunks.find((c) => c.type === 'done')
    expect(done?.meta?.chatgptExperience).toBe(true)
    expect(done?.meta?.experienceDiagnostics).toBeTruthy()
    // Internal plan must not appear as user-facing text.
    const text = chunks.filter((c) => c.type === 'delta').map((c) => c.text ?? '').join('')
    expect(text).not.toMatch(/understand_request|determine_tools/)
  })

  it('defers tools when a clarifying follow-up improves the turn', async () => {
    let toolCalls = 0
    const stubTools: ChatProvider = {
      providerId: 'stub-tools',
      async *streamReply() {
        toolCalls += 1
        yield { type: 'delta', text: 'should not run' }
        yield { type: 'done', meta: {} }
      },
    }
    const orch = createChatGptExperienceOrchestrator({ toolProvider: stubTools })
    const chunks: ChatStreamChunk[] = []
    for await (const chunk of orch.streamTurn({
      conversationId: 'japan-1',
      messages: [userMessage('japan-1', 'I want to travel to Japan')],
      signal: new AbortController().signal,
      locale: 'en',
    })) {
      chunks.push(chunk)
    }
    expect(toolCalls).toBe(0)
    const text = chunks.filter((c) => c.type === 'delta').map((c) => c.text ?? '').join('')
    expect(text).toMatch(/tourism, business, or family/i)
  })

  it('retries failed tools then recovers with a natural message', async () => {
    let attempts = 0
    const result = await withToolRetry({
      label: 'unit',
      attempts: 2,
      locale: 'en',
      run: async () => {
        attempts += 1
        throw new Error('boom')
      },
    })
    expect(attempts).toBe(2)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message.toLowerCase()).toContain('snag')
    }
  })

  it('restores session UI recovery and pinned conversations', () => {
    const storage = (() => {
      const map = new Map<string, string>()
      return {
        getItem: (k: string) => map.get(k) ?? null,
        setItem: (k: string, v: string) => {
          map.set(k, v)
        },
      }
    })()
    writeSessionUiRecovery(
      {
        conversationId: 'c-restore',
        draft: 'draft text',
        modality: 'voice',
        voiceMode: 'hands_free',
        voiceLocale: 'en',
        pinnedIds: [],
      },
      storage,
    )
    const pinned = togglePinnedConversation('c-restore', storage)
    expect(pinned).toContain('c-restore')
    const recovered = readSessionUiRecovery(storage)
    expect(recovered?.draft).toBe('draft text')
    expect(recovered?.modality).toBe('voice')
    expect(recovered?.voiceMode).toBe('hands_free')
    expect(recovered?.pinnedIds).toContain('c-restore')
  })

  it('transitions conversation states smoothly', () => {
    const sm = createExperienceStateMachine('idle')
    expect(sm.transition('listening')).toBe('listening')
    expect(sm.transition('understanding')).toBe('understanding')
    expect(sm.transition('thinking')).toBe('thinking')
    expect(sm.transition('responding')).toBe('responding')
    expect(sm.transition('done')).toBe('done')
    expect(EXPERIENCE_STATE_LABELS.listening.en).toBe('Listening…')
    expect(EXPERIENCE_STATE_LABELS.thinking.en).toBe('Thinking…')
  })
})
