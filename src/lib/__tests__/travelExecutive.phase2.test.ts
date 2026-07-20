/**
 * Phase 2 — AI Travel Executive tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
  resetPreferenceEngine,
  getPreferenceEngine,
} from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  detectRejectedDestinations,
  learnRejectedDestinations,
  applyRejectedDestinationsFilter,
  detectOptimizationAxis,
  optimizeDiscoveryRanking,
  composeExecutiveDiscoveryReply,
  buildExecutiveContext,
  isTravelExecutiveEnabled,
  processExecutiveIntelligence,
} from '../brain/executive'
import { runTravelReasoning } from '../agent/reasoning'
import { extractFromUserText } from '../agent/extractRequirements'
import { understandConversation, classifyBrainIntents } from '../brain/core'
import { emptyMemory } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

function userMessage(content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-p2',
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

describe('Phase 2 feature flag', () => {
  beforeEach(() => resetFeatureRegistry())

  it('enables ai.travel_executive by default', () => {
    expect(isTravelExecutiveEnabled()).toBe(true)
    getFeatureRegistry().setEnabled('ai.rahhal_brain', false)
    expect(isTravelExecutiveEnabled()).toBe(false)
  })
})

describe('rejected destination memory', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
  })

  it('detects "not Norway" rejection', () => {
    const found = detectRejectedDestinations('not Norway please', 'en')
    expect(found).toContain('Norway')
  })

  it('learns rejection into preference profile', () => {
    learnRejectedDestinations('I do not want New Zealand', 'user-p2')
    const profile = getPreferenceEngine().getProfile('user-p2')
    expect(profile.travelStyle.rejectedDestinations).toContain('New Zealand')
  })

  it('filters rejected destinations from reasoning results', () => {
    const result = runTravelReasoning({
      locale: 'en',
      requirements: {
        ...emptyMemory('en').requirements,
        destinationFlexible: true,
        weatherPreference: 'cold',
        budgetAmount: 12000,
        budgetCurrency: 'SAR',
        durationDays: 7,
        travelers: 2,
      },
      userText: 'somewhere cold next month 12000 SAR',
    })
    const filtered = applyRejectedDestinationsFilter(result, ['Norway'], 'en')
    const names = [filtered.primary, ...filtered.alternatives]
      .filter(Boolean)
      .map((row) => row!.name)
    expect(names).not.toContain('Norway')
  })
})

describe('discovery optimizer', () => {
  it('detects cost optimization axis', () => {
    expect(detectOptimizationAxis('optimize for total cost', 'en')).toBe('cost')
    expect(detectOptimizationAxis('رتّبها للتكلفة', 'ar')).toBe('cost')
  })

  it('re-ranks for scenery axis', () => {
    const result = runTravelReasoning({
      locale: 'en',
      requirements: {
        ...emptyMemory('en').requirements,
        destinationFlexible: true,
        weatherPreference: 'cold',
        budgetAmount: 20000,
        budgetCurrency: 'SAR',
        durationDays: 7,
        travelers: 2,
      },
      userText: 'somewhere cold',
    })
    const text = 'somewhere cold — optimize for scenery'
    const extracted = extractFromUserText(text, 'en')
    const understanding = understandConversation({
      userText: text,
      memory: emptyMemory('en'),
      extracted,
    })
    const intents = classifyBrainIntents({
      userText: text,
      locale: 'en',
      understanding,
      extracted,
    })
    const context = buildExecutiveContext({
      memory: emptyMemory('en'),
      understanding,
      intents,
      profile: getPreferenceEngine().getProfile('user-p2'),
      userText: text,
    })
    expect(context.optimizationAxis).toBe('scenery')
    const optimized = optimizeDiscoveryRanking(result, context)
    expect(optimized.primary).toBeTruthy()
    expect(optimized.rationale[0]).toMatch(/scenery|المناظر/i)
  })
})

describe('executive discovery reply', () => {
  it('uses consultant one-liner format with optimization follow-up', () => {
    const text = 'I need somewhere cold next month with 12000 SAR'
    const extracted = extractFromUserText(text, 'en')
    const memory = emptyMemory('en')
    const understanding = understandConversation({ userText: text, memory, extracted })
    const intents = classifyBrainIntents({
      userText: text,
      locale: 'en',
      understanding,
      extracted,
    })
    const reasoning = runTravelReasoning({
      locale: 'en',
      requirements: {
        ...memory.requirements,
        destinationFlexible: true,
        weatherPreference: 'cold',
        budgetAmount: 12000,
        budgetCurrency: 'SAR',
        durationDays: 7,
        travelers: 2,
      },
      userText: text,
    })
    const executive = processExecutiveIntelligence({
      userText: text,
      memory,
      understanding,
      intents,
      reasoningResult: reasoning,
      userId: 'user-p2',
      profile: getPreferenceEngine().getProfile('user-p2'),
    })
    const reply = composeExecutiveDiscoveryReply({
      result: executive.reasoningResult!,
      requirements: memory.requirements,
      context: executive.context,
    })
    expect(reply).toMatch(/I found destinations|وجدت/i)
    expect(reply).toMatch(/optimize for scenery, activities, or total cost|المناظر، الأنشطة، أم التكلفة/i)
    expect(reply).toMatch(/ideal for|exceeds your budget|visa delays|مثالية/i)
  })
})

describe('planTurn integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
  })

  it('returns executive-formatted discovery reply via RahhalBrain', async () => {
    const service = createTravelAgentService({ concierge: false })
    const result = await service.planTurn({
      conversationId: 'conv-p2',
      messages: [userMessage('I need somewhere cold next month with 12000 SAR')],
    })
    expect(result.reply).toMatch(/optimize for scenery|المناظر، الأنشطة/i)
    expect(result.meta.travelExecutive?.optimizationAxis).toBeNull()
    expect(result.meta.rahhalBrain?.decision).toBe('respond')
  })

  it('remembers rejected destination on follow-up turn', async () => {
    const service = createTravelAgentService({ concierge: false })
    await service.planTurn({
      conversationId: 'conv-p2b',
      messages: [userMessage('somewhere cold 15000 SAR'), userMessage('not Norway')],
    })
    const profile = getPreferenceEngine().getProfile('conv-p2b')
    expect(profile.travelStyle.rejectedDestinations).toContain('Norway')
  })
})
