/**
 * Recovery Phase 6 — AI Agent Runtime & Tool Execution tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  enrichWithAgentRuntime,
  isAgentRuntimeEnabled,
  PHASE6_AGENT_RUNTIME_VERSION,
  resetAgentRuntimeSessions,
  runAgentRuntime,
  FlightSearchAdapter,
  VisaAdapter,
} from '../agent/agentRuntime'
import { createTravelAgentService } from '../agent/travelAgentService'
import { emptyMemory } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId = 'rt-p6'): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 7)}`,
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
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  }
}

describe('Phase 6 — AI Agent Runtime', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetAgentRuntimeSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetAgentRuntimeSessions()
  })

  it('keeps ai.agent_runtime OFF by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.agent_runtime')).toBe(false)
    expect(isAgentRuntimeEnabled()).toBe(false)
    expect(PHASE6_AGENT_RUNTIME_VERSION).toMatch(/agent-runtime/)
  })

  it('runs full conversation → tool → stream pipeline with events', async () => {
    const result = await runAgentRuntime({
      userText: 'Find flights to Tokyo in October',
      locale: 'en',
      sessionId: 'pipe-1',
    })
    expect(result.memory.destination).toBe('Tokyo')
    expect(result.toolDecision).toBe('search_flights')
    expect(result.toolExecution?.status).toBe('completed')
    expect(result.toolExecution?.toolId).toBe('flights')
    expect(result.streamedChunks.length).toBeGreaterThan(0)
    const types = result.events.map((e) => e.type)
    expect(types).toContain('ThinkingStarted')
    expect(types).toContain('ReasoningFinished')
    expect(types).toContain('ToolStarted')
    expect(types).toContain('ToolFinished')
    expect(types).toContain('MemoryUpdated')
    expect(types).toContain('StreamingStarted')
    expect(types).toContain('StreamingFinished')
    expect(result.synced.executionPhase).toBe('streaming')
  })

  it('retries mock tool failure then completes', async () => {
    const result = await runAgentRuntime({
      userText: 'Search hotels in Dubai',
      locale: 'en',
      forceToolFailureOnce: true,
      sessionId: 'retry-1',
    })
    expect(result.toolExecution?.status).toBe('completed')
    expect(result.toolExecution?.attempt).toBe(2)
    expect(result.events.some((e) => e.detail.includes('retry'))).toBe(true)
  })

  it('handles interruption and pauses naturally', async () => {
    const result = await runAgentRuntime({
      userText: 'I want Tokyo',
      locale: 'en',
      interruptAfter: 'thinking',
      sessionId: 'int-1',
    })
    expect(result.interrupted).toBe(true)
    expect(result.synced.voice).toBe('interrupted')
    expect(result.synced.executionPhase).toBe('paused')
    expect(result.events.some((e) => e.type === 'Interrupted')).toBe(true)
    expect(result.responseText.toLowerCase()).toMatch(/pause|توقف/)
  })

  it('cancels tool on interrupt-during-tool', async () => {
    const result = await runAgentRuntime({
      userText: 'Find flights to Paris',
      locale: 'en',
      interruptAfter: 'tool',
      sessionId: 'int-tool',
    })
    expect(result.interrupted).toBe(true)
    expect(result.toolExecution?.status).toBe('cancelled')
  })

  it('updates session memory across turns', async () => {
    const t1 = await runAgentRuntime({
      userText: 'أبي اليابان',
      locale: 'ar',
      sessionId: 'mem-1',
    })
    expect(t1.memory.destination).toBe('Japan')
    const t2 = await runAgentRuntime({
      userText: 'خلها أكتوبر',
      locale: 'ar',
      sessionId: 'mem-1',
      priorMemory: t1.memory,
    })
    expect(t2.memory.destination).toBe('Japan')
    expect(t2.memory.monthHint).toBe('October')
    expect(t2.dialect).toBe('saudi')
  })

  it('handles visa tool path and Arabic dialect', async () => {
    const result = await runAgentRuntime({
      userText: 'هل أحتاج تأشيرة لليابان؟',
      locale: 'ar',
      sessionId: 'visa-1',
    })
    expect(result.toolDecision).toBe('need_visa')
    expect(result.toolExecution?.toolId).toBe('visa')
    expect(result.toolExecution?.resultSummary).toMatch(/unknown|needs_check|تأشير|visa/i)
  })

  it('exposes mock adapters without network', async () => {
    const flight = await FlightSearchAdapter.execute({
      memory: (await runAgentRuntime({
        userText: 'Tokyo',
        locale: 'en',
        sessionId: 'ad-1',
      })).memory,
      userText: 'Tokyo',
      attempt: 1,
    })
    expect(flight.status).toBe('completed')
    expect(flight.payload.estimateOnly).toBe(true)
    const visa = await VisaAdapter.execute({
      memory: flight.payload as never,
      userText: 'visa',
      attempt: 1,
    })
    // visa adapter ignores bad memory shape via optional fields
    expect(visa.toolId).toBe('visa')
  })

  it('enrich is a no-op when flag OFF', async () => {
    const { agentRuntime, memory } = await enrichWithAgentRuntime({
      userText: 'Find flights to Tokyo',
      memory: emptyMemory(),
    })
    expect(agentRuntime).toBeNull()
    expect(memory.requirements.destination).toBeNull()
  })

  it('planTurn attaches agentRuntime meta only when enabled', async () => {
    const off = createTravelAgentService({ agentRuntimeEnabled: false })
    const offTurn = await off.planTurn({
      conversationId: 'rt-off',
      messages: [msg('Find flights to Tokyo', 'rt-off')],
    })
    expect(offTurn.meta.agentRuntime).toBeUndefined()

    const on = createTravelAgentService({ agentRuntimeEnabled: true })
    const onTurn = await on.planTurn({
      conversationId: 'rt-on',
      messages: [msg('Find flights to Tokyo in October', 'rt-on')],
    })
    expect(onTurn.meta.agentRuntime?.tool).toBe('search_flights')
    expect(onTurn.meta.agentRuntime?.toolStatus).toBe('completed')
    expect(onTurn.meta.agentRuntime?.eventCount).toBeGreaterThan(3)
    expect(onTurn.meta.agentRuntime?.events?.some((e) => e.type === 'ToolFinished')).toBe(true)
  })

  it('keeps conversation/voice/execution/memory synchronized', async () => {
    const result = await runAgentRuntime({
      userText: 'Weather in Tokyo October',
      locale: 'en',
      voiceState: 'listening',
      sessionId: 'sync-1',
    })
    expect(result.synced.memory.destination).toBe('Tokyo')
    expect(result.synced.conversation.memory.destination).toBe('Tokyo')
    expect(['speaking', 'interrupted', 'thinking', 'listening']).toContain(result.synced.voice)
    expect(result.trace.some((s) => s.stage === 'stream')).toBe(true)
    expect(result.durationMs).toBeGreaterThanOrEqual(0)
  })
})
