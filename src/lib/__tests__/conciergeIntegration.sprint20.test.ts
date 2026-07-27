/**
 * Sprint 20 — AI Travel Concierge Integration.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import {
  isBrainConciergeIntegrationEnabled,
  resetBrainIntegrationSessions,
  runIntegratedBrainTurn,
} from '../brain'

function userMessage(content: string, conversationId = 'c-s20'): ChatMessage {
  const now = '2026-07-19T00:00:00.000Z'
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
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

describe('Sprint 20 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('registers integration flags disabled by default', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('brain.concierge')).toBe(false)
    expect(registry.isEnabled('brain.agent_handoff')).toBe(false)
    expect(registry.isEnabled('brain.voice')).toBe(false)
    expect(isBrainConciergeIntegrationEnabled()).toBe(false)
  })

  it('requires brain.enabled before brain.concierge', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.concierge', true)
    expect(registry.isEnabled('brain.concierge')).toBe(false)
    registry.setEnabled('brain.enabled', true)
    expect(registry.isEnabled('brain.concierge')).toBe(true)
  })
})

describe('Sprint 20 planTurn Brain integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('does not attach meta.brain when flags are off (backward compatible)', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: false,
    })
    const result = await service.planTurn({
      conversationId: 'c-off',
      messages: [userMessage('flights to Dubai', 'c-off')],
    })
    expect(result.meta.brain).toBeUndefined()
    expect(result.reply.length).toBeGreaterThan(0)
  })

  it('runs Brain before assistant response and attaches BrainResponsePlan', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: true,
      brainHandoffEnabled: false,
    })
    const result = await service.planTurn({
      conversationId: 'c-on',
      messages: [userMessage('Find flights to Dubai for 2 travelers', 'c-on')],
    })

    expect(result.meta.brain).toBeTruthy()
    expect(result.meta.brain?.summary).toMatch(/^(need_slot:|ready:)/)
    expect(result.meta.brain?.assistantGoal).toMatch(/^(collect:|execute:)/)
    expect(result.meta.brain?.intent).toBeTruthy()
    expect(result.meta.brain?.action).toBeTruthy()
    expect(Array.isArray(result.meta.brain?.missingFields)).toBe(true)
    expect(Array.isArray(result.meta.brain?.searchRequests)).toBe(true)
  })

  it('merges brain memory into agent requirements when handoff is enabled', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: false,
      brainEnabled: true,
      brainHandoffEnabled: true,
    })
    const result = await service.planTurn({
      conversationId: 'c-handoff',
      messages: [userMessage('I want to visit Istanbul with budget 7000 SAR', 'c-handoff')],
    })

    expect(result.memory.requirements.destination).toBeTruthy()
    expect(result.meta.brain?.summary).toBeTruthy()
  })

  it('still allows Concierge path with brain meta attached', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: true,
      brainEnabled: true,
    })
    const result = await service.planTurn({
      conversationId: 'c-concierge',
      messages: [userMessage('مرحبا أريد السفر', 'c-concierge')],
    })
    expect(result.meta.brain).toBeTruthy()
    expect(typeof result.reply).toBe('string')
  })
})

describe('Sprint 20 shared text/voice Brain pipeline', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
  })

  it('runIntegratedBrainTurn is the shared entry for text and speech', () => {
    const textPlan = runIntegratedBrainTurn({
      conversationId: 'shared-1',
      userText: 'Search hotels in Paris',
      locale: 'en',
    })
    expect(textPlan.plan.intent).toBe('SearchHotels')
    expect(textPlan.plan.summary).toMatch(/^(need_slot:|ready:)/)
  })
})
