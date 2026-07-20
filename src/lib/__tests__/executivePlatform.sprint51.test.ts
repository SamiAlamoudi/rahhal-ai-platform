/**
 * Sprint 51 — Executive Travel Platform tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
  resetPreferenceEngine,
  getPreferenceEngine,
} from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { emptyMemory } from '../agent/types'
import { runTravelReasoning } from '../agent/reasoning'
import { extractFromUserText } from '../agent/extractRequirements'
import {
  understandConversation,
  classifyBrainIntents,
  runRahhalBrainTurn,
} from '../brain/core'
import {
  isExecutivePlatformEnabled,
  runExecutivePlatform,
  createDefaultExecutiveEngines,
  createTripMonitorEngine,
  createLiveConciergeEngine,
  createMultimodalDocumentEngine,
  createRiskEngine,
  extractFields,
  estimateBreakdown,
} from '../brain/executive'
import type { ExecutiveEngineContext } from '../brain/executive/platform'
import type { ChatMessage } from '../chat/chatTypes'

function userMessage(content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-51',
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

function ctxFor(text: string, locale: 'ar' | 'en' = 'en'): ExecutiveEngineContext {
  const memory = emptyMemory(locale)
  const extracted = extractFromUserText(text, locale)
  const understanding = understandConversation({ userText: text, memory, extracted })
  const intents = classifyBrainIntents({ userText: text, locale, understanding, extracted })
  return {
    userId: 'u51',
    userText: text,
    locale,
    memory,
    understanding,
    intents,
    reasoningResult: null,
    profile: getPreferenceEngine().getProfile('u51'),
    executiveContext: null,
    now: new Date(),
  }
}

describe('Sprint 51 feature flag', () => {
  beforeEach(() => resetFeatureRegistry())

  it('enables ai.executive_platform by default with dependencies', () => {
    expect(isExecutivePlatformEnabled()).toBe(true)
    getFeatureRegistry().setEnabled('ai.travel_executive', false)
    expect(isExecutivePlatformEnabled()).toBe(false)
  })
})

describe('engine contract', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
  })

  it('registers all ten executive engines with full contract', () => {
    const engines = createDefaultExecutiveEngines()
    expect(engines).toHaveLength(10)
    const ctx = ctxFor('test')
    for (const engine of engines) {
      const meta = engine.metadata()
      expect(meta.engineId).toBeTruthy()
      expect(meta.version).toBeTruthy()
      const analysis = engine.analyze(ctx)
      expect(analysis.engineId).toBe(meta.engineId)
      const plan = engine.plan(ctx, analysis)
      expect(plan.engineId).toBe(meta.engineId)
      const execution = engine.execute(ctx, plan)
      expect(execution.engineId).toBe(meta.engineId)
      expect(engine.confidence(ctx, analysis)).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('live concierge', () => {
  it('detects hungry and critical passport loss', () => {
    const engine = createLiveConciergeEngine()
    expect(engine.analyze(ctxFor("I'm hungry")).signals.need).toBe('hungry')
    expect(engine.analyze(ctxFor('I lost my passport')).priority).toBe('critical')
  })
})

describe('multimodal documents', () => {
  it('extracts passport and flight fields', () => {
    const fields = extractFields({
      kind: 'passport',
      text: 'Passport Name: John Smith Nationality: Saudi Passport A12345678 Expiry 2030-05-01 Flight SV123 PNR: ABC123',
    })
    expect(fields.fullName).toMatch(/John/)
    expect(fields.passportNumber).toBe('A12345678')
    expect(fields.flightNumber).toBe('SV123')
    expect(fields.pnr).toBe('ABC123')
    expect(fields.expiration).toBe('2030-05-01')
  })

  it('extracts boarding pass through engine execute', () => {
    const engine = createMultimodalDocumentEngine()
    const text = 'Boarding pass Flight SV456 PNR: ZZ9X2A to Istanbul 2026-08-01'
    const ctx = ctxFor(text)
    const analysis = engine.analyze(ctx)
    const plan = engine.plan(ctx, analysis)
    const execution = engine.execute(ctx, plan)
    expect(execution.applied).toBe(true)
    expect(execution.memoryNotes.join(' ')).toMatch(/SV456|ZZ9X2A/)
  })
})

describe('budget v2 + risk + monitor', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
  })

  it('estimates breakdown with hidden costs', () => {
    const ctx = ctxFor('budget for Switzerland')
    ctx.memory.requirements.destination = 'Switzerland'
    ctx.memory.requirements.durationDays = 7
    ctx.memory.requirements.travelers = 2
    ctx.memory.requirements.budgetAmount = 12000
    const breakdown = estimateBreakdown(ctx)
    expect(breakdown.total).toBeGreaterThan(breakdown.flights)
    expect(breakdown.visa).toBeGreaterThan(0)
    expect(breakdown.insurance).toBeGreaterThan(0)
  })

  it('raises critical priority on long flight delays', () => {
    const engine = createTripMonitorEngine()
    const analysis = engine.analyze({
      ...ctxFor('status'),
      tripSignals: { flightDelayMinutes: 90 },
    })
    expect(analysis.priority).toBe('critical')
  })

  it('scores visa risk for embassy destinations', () => {
    const engine = createRiskEngine()
    const ctx = ctxFor('risk for Switzerland')
    ctx.memory.requirements.destination = 'Switzerland'
    const analysis = engine.analyze(ctx)
    expect(Number(analysis.signals.riskScore)).toBeGreaterThan(0.2)
  })
})

describe('platform orchestration + brain integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
  })

  it('runs platform engines for discovery turns', () => {
    const text = 'somewhere cold next month 12000 SAR'
    const memory = emptyMemory('en')
    memory.requirements.destinationFlexible = true
    memory.requirements.weatherPreference = 'cold'
    memory.requirements.budgetAmount = 12000
    memory.requirements.budgetCurrency = 'SAR'
    memory.requirements.durationDays = 7
    memory.requirements.travelers = 2
    const extracted = extractFromUserText(text, 'en')
    const understanding = understandConversation({ userText: text, memory, extracted })
    const intents = classifyBrainIntents({ userText: text, locale: 'en', understanding, extracted })
    const reasoning = runTravelReasoning({
      locale: 'en',
      requirements: memory.requirements,
      userText: text,
    })
    const result = runExecutivePlatform({
      userId: 'u51',
      userText: text,
      memory,
      understanding,
      intents,
      reasoningResult: reasoning,
    })
    expect(result.engineIds.length).toBeGreaterThan(3)
    expect(result.engineIds).toContain('explainable_decision')
    expect(result.engineIds).toContain('budget_intelligence_v2')
    expect(result.confidence).toBeGreaterThan(0.4)
  })

  it('live concierge reply via RahhalBrain', () => {
    const turn = runRahhalBrainTurn({
      conversationId: 'conv-51',
      userText: "I'm hungry near my hotel",
      messages: [userMessage("I'm hungry near my hotel")],
      userId: 'u51',
    })
    expect(turn.executivePlatform?.engineIds).toContain('live_concierge')
    expect(turn.decision.type).toBe('respond')
    expect(turn.decision.reply).toMatch(/restaurant|مطعم|Executive summary|ملخص/i)
  })

  it('planTurn attaches executivePlatform meta', async () => {
    const service = createTravelAgentService({ concierge: false })
    const result = await service.planTurn({
      conversationId: 'conv-51',
      messages: [userMessage("I'm hungry")],
    })
    expect(result.meta.executivePlatform?.engineIds).toContain('live_concierge')
    expect(result.meta.executivePlatform?.hasPrimaryReply).toBe(true)
  })
})
