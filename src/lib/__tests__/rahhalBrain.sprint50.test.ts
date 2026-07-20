/**
 * Sprint 50 — Rahhal Brain Core v1 tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
} from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  RahhalBrain,
  runRahhalBrainTurn,
  understandConversation,
  classifyBrainIntents,
  buildInternalPlan,
  reflectOnResponse,
  composeBrainResponse,
  isRahhalBrainEnabled,
} from '../brain/core'
import { extractFromUserText } from '../agent/extractRequirements'
import { emptyMemory } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

function userMessage(content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-50',
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

describe('Sprint 50 feature flag', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('enables ai.rahhal_brain by default with dependencies', () => {
    const registry = getFeatureRegistry()
    expect(isRahhalBrainEnabled()).toBe(true)
    registry.setEnabled('ai.concierge', false)
    expect(isRahhalBrainEnabled()).toBe(false)
  })
})

describe('conversation understanding', () => {
  it('detects vacation need from "I need a break"', () => {
    const extracted = extractFromUserText('I need a break', 'en')
    const understanding = understandConversation({
      userText: 'I need a break',
      memory: emptyMemory('en'),
      extracted,
    })
    expect(understanding.implicitRequests).toContain('vacation_escape')
    expect(understanding.emotionalContext.needsBreak).toBe(true)
  })

  it('detects discovery mode from vague cold place ask', () => {
    const extracted = extractFromUserText('somewhere cold next month', 'en')
    const understanding = understandConversation({
      userText: 'somewhere cold next month',
      memory: emptyMemory('en'),
      extracted,
    })
    expect(understanding.travelContext.discoveryMode).toBe(true)
    expect(understanding.travelContext.climateHint).toBe('cold')
  })

  it('captures long-flight constraint from spouse preference', () => {
    const extracted = extractFromUserText('My wife hates long flights', 'en')
    const understanding = understandConversation({
      userText: 'My wife hates long flights',
      memory: emptyMemory('en'),
      extracted,
    })
    expect(understanding.constraints).toContain('avoid_long_flights')
  })
})

describe('intent engine', () => {
  it('classifies multiple intents for cold discovery with budget', () => {
    const text = 'I want somewhere cold next month with a budget of 12000 SAR'
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
    expect(intents.primary.id).toBe('destination_discovery')
    expect(intents.secondary.some((row) => row.id === 'budget_optimization')).toBe(true)
    expect(intents.primary.confidence).toBeGreaterThan(0.8)
  })
})

describe('RahhalBrain orchestration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('responds with ranked destinations for open-ended cold ask', () => {
    const turn = runRahhalBrainTurn({
      conversationId: 'conv-50',
      userText: 'I want somewhere cold next month with a budget of 12000 SAR',
      messages: [userMessage('I want somewhere cold next month with a budget of 12000 SAR')],
      userId: 'user-50',
    })
    expect(turn.decision.type).toBe('respond')
    expect(turn.decision.reply).toMatch(/consultant|ترشيحاتي|My picks|I found destinations|وجدت|optimize for scenery/i)
    expect(turn.reasoningResult?.primary).toBeTruthy()
    expect(turn.meta.modulesExecuted).toContain('reasoning')
    expect(turn.meta.reflected).toBe(true)
    expect(turn.internalPlan.steps.length).toBeGreaterThan(3)
  })

  it('builds internal plan with visa and ranking steps for discovery', () => {
    const text = 'somewhere cold, 12000 SAR'
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
    const plan = buildInternalPlan({
      understanding,
      intents,
      memory: emptyMemory('en'),
      reasoningRan: true,
    })
    expect(plan.modulesToRun).toContain('visa')
    expect(plan.modulesToRun).toContain('ranking')
  })

  it('reflects long-flight constraint into tradeoffs', () => {
    const text = 'somewhere cold next month, 12000 SAR'
    const extracted = extractFromUserText(text, 'en')
    const memory = emptyMemory('en')
    const understanding = understandConversation({
      userText: 'My wife hates long flights. ' + text,
      memory,
      extracted,
    })
    understanding.constraints.push('avoid_long_flights')
    const brain = RahhalBrain()
    const turn = brain.runTurn({
      conversationId: 'conv-50',
      userText: 'My wife hates long flights. ' + text,
      messages: [],
      memory,
      userId: 'user-50',
    })
    expect(turn.decision.reply).toMatch(/shorter flight|طيران أقصر/i)
  })
})

describe('planTurn integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('routes open-ended discovery through Rahhal Brain on planTurn', async () => {
    const service = createTravelAgentService({ concierge: false })
    const result = await service.planTurn({
      conversationId: 'conv-50',
      messages: [
        userMessage('I want somewhere cold next month with a budget of 12000 SAR'),
      ],
    })
    // Experience Sprint 2 — LLM Conversation Brain authors the traveler-facing reply.
    expect(result.reply.length).toBeGreaterThan(20)
    expect(result.reply.toLowerCase()).not.toMatch(/next question|سؤال التالي|form inventory/)
    expect(result.meta.spokenText).toBeTruthy()
    expect(result.meta.rahhalBrain?.decision).toBe('respond')
    expect(result.meta.rahhalBrain?.primaryIntent).toBe('destination_discovery')
    expect(result.meta.reasoning?.candidateIds.length).toBeGreaterThan(0)
  })

  it('falls back to legacy path when ai.rahhal_brain is disabled', async () => {
    getFeatureRegistry().setEnabled('ai.rahhal_brain', false)
    const service = createTravelAgentService({
      concierge: false,
      rahhalBrainEnabled: false,
    })
    const result = await service.planTurn({
      conversationId: 'conv-50-legacy',
      messages: [
        userMessage('I want somewhere cold next month with a budget of 12000 SAR'),
      ],
    })
    // Brain meta is off, but Conversation Brain still presents reasoning facts conversationally.
    expect(result.reply.length).toBeGreaterThan(20)
    expect(result.meta.spokenText).toBeTruthy()
    expect(result.meta.rahhalBrain).toBeUndefined()
    expect(result.meta.reasoning?.candidateIds.length).toBeGreaterThan(0)
  })
})

describe('response composer structure', () => {
  it('includes recommendation and next step fields', () => {
    const turn = runRahhalBrainTurn({
      conversationId: 'conv-50',
      userText: 'somewhere cold, 12000 SAR',
      messages: [userMessage('somewhere cold, 12000 SAR')],
      userId: 'user-50',
    })
    const composed = composeBrainResponse({
      locale: 'en',
      understanding: turn.understanding,
      intents: turn.intents,
      memory: turn.memory,
      reasoningResult: turn.reasoningResult,
      missingFields: turn.memory.missingFields,
    })
    expect(composed?.recommendation).toBeTruthy()
    expect(composed?.nextStep).toMatch(/lock|نثبّت/i)
    const reflected = reflectOnResponse({
      draft: composed!,
      understanding: turn.understanding,
      intents: turn.intents,
      memory: turn.memory,
      reasoningResult: turn.reasoningResult,
    })
    expect(reflected.body.length).toBeGreaterThan(composed!.body.length)
  })
})
