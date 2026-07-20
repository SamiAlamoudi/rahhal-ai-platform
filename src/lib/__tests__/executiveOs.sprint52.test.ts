/**
 * Sprint 52 — Executive Operating System tests.
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
import { extractFromUserText } from '../agent/extractRequirements'
import {
  understandConversation,
  classifyBrainIntents,
  runRahhalBrainTurn,
} from '../brain/core'
import {
  isExecutiveOsEnabled,
  isExecutivePlatformEnabled,
  runExecutivePlatform,
  createDefaultExecutiveEngines,
  createOsEngines,
  createAllExecutiveEngines,
  selectEnginesForTurn,
  getAllDestinationIntelligence,
  buildTravelGraph,
  detectTravelGoal,
  selectExecutiveStrategy,
  optimizeDecisions,
  paretoOptimal,
  resetExecutiveOsCache,
  createDecisionOptimizerEngine,
  createMultiObjectiveOptimizerEngine,
  createPredictionEngine,
  createSmartNegotiationEngine,
  createSelfReviewEngine,
  createExecutiveStrategyEngine,
} from '../brain/executive'
import type { ExecutiveEngineContext } from '../brain/executive/platform'
import type { ChatMessage } from '../chat/chatTypes'

function userMessage(content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-52',
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
    userId: 'u52',
    userText: text,
    locale,
    memory,
    understanding,
    intents,
    reasoningResult: null,
    profile: getPreferenceEngine().getProfile('u52'),
    executiveContext: null,
    now: new Date('2026-07-20T12:00:00Z'),
  }
}

describe('Sprint 52 feature flag', () => {
  beforeEach(() => resetFeatureRegistry())

  it('enables ai.executive_os by default with platform dependency', () => {
    expect(isExecutiveOsEnabled()).toBe(true)
    expect(isExecutivePlatformEnabled()).toBe(true)
    getFeatureRegistry().setEnabled('ai.executive_platform', false)
    expect(isExecutiveOsEnabled()).toBe(false)
  })
})

describe('global knowledge + travel graph', () => {
  beforeEach(() => {
    resetExecutiveOsCache()
    resetPreferenceEngine()
  })

  it('builds destination intelligence for the catalog', () => {
    const all = getAllDestinationIntelligence(7)
    expect(all.length).toBeGreaterThan(5)
    const row = all[0]!
    expect(row).toMatchObject({
      weather: expect.any(String),
      visa: expect.any(String),
      safety: expect.any(Number),
      luxuryScore: expect.any(Number),
      riskScore: expect.any(Number),
      averageDailyCostSar: expect.any(Number),
    })
  })

  it('builds a reusable travel graph with hotels, airlines, activities', () => {
    const graph = buildTravelGraph(7)
    expect(graph.nodes.length).toBeGreaterThan(20)
    expect(graph.edges.length).toBeGreaterThan(20)
    const kinds = new Set(graph.nodes.map((n) => n.kind))
    expect(kinds.has('destination')).toBe(true)
    expect(kinds.has('airport')).toBe(true)
    expect(kinds.has('hotel')).toBe(true)
    expect(kinds.has('airline')).toBe(true)
    expect(kinds.has('activity')).toBe(true)
    expect(kinds.has('visa_regime')).toBe(true)
  })
})

describe('decision + multi-objective optimizers', () => {
  beforeEach(() => {
    resetExecutiveOsCache()
    resetPreferenceEngine()
    resetFeatureRegistry()
  })

  it('scores, ranks, and rejects weak options', () => {
    const ctx = ctxFor('Somewhere cold for a family vacation under 10000 SAR')
    ctx.memory.requirements.budgetAmount = 10000
    ctx.memory.requirements.destinationFlexible = true
    const current = getPreferenceEngine().getProfile('u52')
    getPreferenceEngine().upsertProfile({
      ...current,
      userId: 'u52',
      travelStyle: {
        ...current.travelStyle,
        rejectedDestinations: ['Geneva'],
      },
    })
    ctx.profile = getPreferenceEngine().getProfile('u52')

    const goal = detectTravelGoal(ctx)
    expect(goal).toBe('family')
    const { strongest, rejected, ranked } = optimizeDecisions({
      memory: ctx.memory,
      profile: ctx.profile,
      reasoningResult: null,
      goal,
      month: 1,
    })
    expect(ranked.length).toBeGreaterThan(0)
    expect(strongest.length).toBeGreaterThan(0)
    expect(strongest.length).toBeLessThanOrEqual(3)
    expect(rejected.some((row) => /geneva/i.test(row.name))).toBe(true)

    const pareto = paretoOptimal(ranked)
    expect(pareto.length).toBeGreaterThan(0)
    expect(pareto.length).toBeLessThanOrEqual(ranked.length)
  })

  it('OS optimizer engines honor the executive contract', () => {
    const engines = [
      createDecisionOptimizerEngine(),
      createMultiObjectiveOptimizerEngine(),
      createPredictionEngine(),
      createExecutiveStrategyEngine(),
    ]
    const ctx = ctxFor('Plan a luxury honeymoon')
    for (const engine of engines) {
      const analysis = engine.analyze(ctx)
      const plan = engine.plan(ctx, analysis)
      const execution = engine.execute(ctx, plan)
      expect(execution.engineId).toBe(engine.metadata().engineId)
      expect(engine.confidence(ctx, analysis)).toBeGreaterThan(0)
    }
  })
})

describe('strategy lazy selection', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
  })

  it('selects fewer engines for fast strategy than deep', () => {
    const all = createAllExecutiveEngines({ includeOs: true })
    const fastCtx = ctxFor('quick short answer please')
    const deepCtx = ctxFor('Compare destinations in detail and explain why for my next trip')

    expect(selectExecutiveStrategy(fastCtx)).toBe('fast')
    expect(selectExecutiveStrategy(deepCtx)).toBe('deep')

    const fastSelected = selectEnginesForTurn(all, {
      userText: fastCtx.userText,
      hasReasoning: true,
      hasTripPlan: false,
      discoveryMode: true,
      osEnabled: true,
      strategyContext: fastCtx,
    })
    const deepSelected = selectEnginesForTurn(all, {
      userText: deepCtx.userText,
      hasReasoning: true,
      hasTripPlan: false,
      discoveryMode: true,
      osEnabled: true,
      strategyContext: deepCtx,
    })

    expect(fastSelected.map((e) => e.metadata().engineId)).toContain('executive_strategy')
    expect(fastSelected.map((e) => e.metadata().engineId)).not.toContain('multi_objective_optimizer')
    expect(deepSelected.map((e) => e.metadata().engineId)).toContain('multi_objective_optimizer')
    expect(deepSelected.map((e) => e.metadata().engineId)).toContain('travel_graph')
    expect(deepSelected.length).toBeGreaterThan(fastSelected.length)
  })

  it('keeps platform-only default engines at length 10', () => {
    expect(createDefaultExecutiveEngines()).toHaveLength(10)
    expect(createOsEngines()).toHaveLength(10)
    expect(createAllExecutiveEngines({ includeOs: true })).toHaveLength(20)
  })
})

describe('negotiation + prediction + self review', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
    resetExecutiveOsCache()
  })

  it('negotiates instead of hard no', () => {
    const engine = createSmartNegotiationEngine()
    const ctx = ctxFor('No Geneva, too expensive for my budget')
    ctx.memory.requirements.budgetAmount = 5000
    const analysis = engine.analyze(ctx)
    expect(analysis.signals.needsNegotiation).toBe(true)
    const execution = engine.execute(ctx, engine.plan(ctx, analysis))
    expect(execution.applied).toBe(true)
    expect(execution.replyFragment).toMatch(/Instead of a hard no|بدل الرفض/i)
    expect(execution.recommendations.length).toBeGreaterThan(0)
  })

  it('predicts traveler needs with confidence', () => {
    const engine = createPredictionEngine()
    const ctx = ctxFor('Family beach trip')
    ctx.memory.requirements.budgetAmount = 12000
    const execution = engine.execute(ctx, engine.plan(ctx, engine.analyze(ctx)))
    const prediction = execution.metadata.prediction as {
      acceptProbability: number
      likelyBudget: number
      confidence: number
    }
    expect(prediction.acceptProbability).toBeGreaterThan(0)
    expect(prediction.likelyBudget).toBe(12000)
    expect(prediction.confidence).toBeGreaterThan(0.4)
  })

  it('self-review improves conflicting replies once', () => {
    const engine = createSelfReviewEngine()
    const ctx = ctxFor('Somewhere nice')
    const current = getPreferenceEngine().getProfile('u52')
    getPreferenceEngine().upsertProfile({
      ...current,
      userId: 'u52',
      travelStyle: {
        ...current.travelStyle,
        rejectedDestinations: ['Geneva'],
      },
    })
    ctx.profile = getPreferenceEngine().getProfile('u52')
    expect(engine.metadata().engineId).toBe('self_review')

    const platform = runExecutivePlatform({
      userId: 'u52',
      userText: 'Find me a cold luxury destination, not Geneva',
      memory: {
        ...emptyMemory('en'),
        requirements: {
          ...emptyMemory('en').requirements,
          destinationFlexible: true,
          budgetAmount: 20000,
          weatherPreference: 'cold',
        },
      },
      understanding: understandConversation({
        userText: 'Find me a cold luxury destination, not Geneva',
        memory: emptyMemory('en'),
        extracted: extractFromUserText('Find me a cold luxury destination, not Geneva', 'en'),
      }),
      intents: classifyBrainIntents({
        userText: 'Find me a cold luxury destination, not Geneva',
        locale: 'en',
        understanding: understandConversation({
          userText: 'Find me a cold luxury destination, not Geneva',
          memory: emptyMemory('en'),
          extracted: extractFromUserText('Find me a cold luxury destination, not Geneva', 'en'),
        }),
        extracted: extractFromUserText('Find me a cold luxury destination, not Geneva', 'en'),
      }),
      reasoningResult: null,
      osEnabled: true,
      enabled: true,
    })

    expect(platform.os).toBeTruthy()
    expect(platform.os?.strategy).toBeTruthy()
    expect(platform.engineIds).toContain('executive_strategy')
    expect(platform.engineIds).toContain('self_review')
    expect(platform.primaryReply).toBeTruthy()
  })
})

describe('RahhalBrain + planTurn OS integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
    resetExecutiveOsCache()
  })

  it('runRahhalBrainTurn executes executive_os module', () => {
    const memory = {
      ...emptyMemory('en'),
      requirements: {
        ...emptyMemory('en').requirements,
        destinationFlexible: true,
        weatherPreference: 'cold',
        budgetAmount: 15000,
      },
    }
    const turn = runRahhalBrainTurn({
      conversationId: 'c52',
      userText: "I'm hungry near the hotel and need a pharmacy",
      memory,
      messages: [{ role: 'user', content: "I'm hungry near the hotel and need a pharmacy" }],
      userId: 'u52',
    })
    expect(turn.meta.modulesExecuted).toContain('executive_platform')
    expect(turn.meta.modulesExecuted).toContain('executive_os')
    expect(turn.executivePlatform?.os?.engineIds.length).toBeGreaterThan(0)
  })

  it('planTurn attaches executiveOs meta', async () => {
    const service = createTravelAgentService()
    const result = await service.planTurn({
      conversationId: 'c52-meta',
      messages: [userMessage('quick tip: lost my passport help')],
    })
    expect(result.meta.executivePlatform?.engineIds.length).toBeGreaterThan(0)
    expect(result.meta.executiveOs?.strategy).toBeTruthy()
  })
})
