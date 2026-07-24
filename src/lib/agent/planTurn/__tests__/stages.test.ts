import { describe, expect, it, vi } from 'vitest'
import type { ChatMessage } from '../../../chat/chatTypes'
import { assertTurnNotAborted } from '../abortCheckpoint'
import type { PlanTurnDeps } from '../context'
import { autonomous } from '../stages/autonomous'
import { brainPipeline } from '../stages/brainPipeline'
import { concierge } from '../stages/concierge'
import { earlyIntentRouters } from '../stages/earlyIntentRouters'
import { finalSpeak } from '../stages/finalSpeak'
import { initMemory } from '../stages/initMemory'
import { llmAndTools } from '../stages/llmAndTools'
import { preBrainEnrichers } from '../stages/preBrainEnrichers'
import { presentation } from '../stages/presentation'
import { rahhalBrain } from '../stages/rahhalBrain'

function user(content: string): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'stage-c1',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-24T00:00:00.000Z',
    updatedAt: '2026-07-24T00:00:00.000Z',
  }
}

function deps(overrides: Partial<PlanTurnDeps> = {}): PlanTurnDeps {
  return {
    options: {},
    llms: {} as PlanTurnDeps['llms'],
    savePlanHook: undefined,
    conciergeService: null,
    listBookingRecords: vi.fn(async () => []),
    runToolsForPlan: vi.fn(async () => {
      throw new Error('runToolsForPlan should not run in this unit test')
    }),
    isConciergeEnabled: () => false,
    isBookingHistoryEnabled: () => false,
    isBookingConfirmationEnabled: () => false,
    isOrderManagementEnabled: () => false,
    isSmartItineraryEnabled: () => false,
    isBrainEnabled: () => false,
    isBrainHandoffEnabled: () => false,
    isTravelEngineEnabled: () => false,
    isTripPlanningEnabled: () => false,
    isExecutionEnabled: () => false,
    isSearchEnabled: () => false,
    isTripOrchestratorEnabled: () => false,
    isReasoningEnabled: () => false,
    isClarificationEnabled: () => false,
    isBrainCoreEnabled: () => false,
    isAutonomousEnabled: () => false,
    isTravelerPersonalizationOn: () => false,
    isTravelPlannerOn: () => false,
    isAdaptiveLearningOn: () => false,
    isFlowEnabled: () => false,
    ...overrides,
  }
}

describe('planTurn stage modules', () => {
  it('exports one function from every stage module', () => {
    expect(typeof initMemory).toBe('function')
    expect(typeof preBrainEnrichers).toBe('function')
    expect(typeof rahhalBrain).toBe('function')
    expect(typeof brainPipeline).toBe('function')
    expect(typeof earlyIntentRouters).toBe('function')
    expect(typeof concierge).toBe('function')
    expect(typeof llmAndTools).toBe('function')
    expect(typeof autonomous).toBe('function')
    expect(typeof presentation).toBe('function')
    expect(typeof finalSpeak).toBe('function')
  })

  it('initMemory produces the expected mutable context shape for mixed Arabic/English input', () => {
    const ctx = initMemory({
      conversationId: 'stage-c1',
      messages: [user('Plan رحلة إلى Dubai for 3 days')],
    }, deps())

    expect(ctx.input.conversationId).toBe('stage-c1')
    expect(ctx.userText).toBe('Plan رحلة إلى Dubai for 3 days')
    expect(ctx.memory.locale).toMatch(/^(ar|en)$/)
    expect(ctx.memory.requirements).toBeTruthy()
    expect(Array.isArray(ctx.memory.missingFields)).toBe(true)
    expect(ctx.toolBatch).toBeNull()
    expect(ctx.objective).toBe('general')
    expect(ctx.conciergeState).toBeNull()
  })

  it('assertTurnNotAborted throws AbortError when the signal is aborted', () => {
    const controller = new AbortController()
    controller.abort()

    expect(() => assertTurnNotAborted(controller.signal)).toThrow(/Travel agent turn aborted/)
    try {
      assertTurnNotAborted(controller.signal)
    } catch (error) {
      expect(error).toBeInstanceOf(Error)
      expect((error as Error).name).toBe('AbortError')
    }
  })

  it('preBrainEnrichers no-ops when all enrichment flags are off', () => {
    const ctx = initMemory({
      conversationId: 'stage-c1',
      messages: [user('Hello')],
    }, deps())

    preBrainEnrichers(ctx, deps())

    expect(ctx.travelPlannerResult).toBeNull()
    expect(ctx.travelerPersonalizationResult).toBeNull()
    expect(ctx.adaptiveLearningResult).toBeNull()
  })

  it('earlyIntentRouters returns null when no matching intent is enabled', async () => {
    const ctx = initMemory({
      conversationId: 'stage-c1',
      messages: [user('Hello')],
    }, deps())

    await expect(earlyIntentRouters(ctx, deps())).resolves.toBeNull()
  })

  it('rahhalBrain returns null when brain core is off (typed continue path)', async () => {
    const ctx = initMemory({
      conversationId: 'stage-c1',
      messages: [user('Hello')],
    }, deps({ isBrainCoreEnabled: () => false }))

    await expect(rahhalBrain(ctx, deps({ isBrainCoreEnabled: () => false }))).resolves.toBeNull()
  })

  it('brainPipeline is a no-op when brain integration is off', async () => {
    const ctx = initMemory({
      conversationId: 'stage-c1',
      messages: [user('Hello')],
    }, deps())
    const before = ctx.memory
    await brainPipeline(ctx, deps({ isBrainEnabled: () => false }))
    expect(ctx.memory).toBe(before)
    expect(ctx.brainMeta).toBeUndefined()
  })

  it('concierge returns null when disabled (typed continue path)', async () => {
    const ctx = initMemory({
      conversationId: 'stage-c1',
      messages: [user('Hello')],
    }, deps({ isConciergeEnabled: () => false }))

    await expect(concierge(ctx, deps({ isConciergeEnabled: () => false }))).resolves.toBeNull()
  })

  it('autonomous leaves snapshot unchanged when autonomous agent is off', () => {
    const ctx = initMemory({
      conversationId: 'stage-c1',
      messages: [user('Hello')],
    }, deps({ isAutonomousEnabled: () => false }))
    const before = ctx.autonomousSnapshot
    autonomous(ctx, deps({ isAutonomousEnabled: () => false }))
    expect(ctx.autonomousSnapshot).toBe(before)
  })

  it('presentation returns a typed final-speak handoff without invoking an LLM', () => {
    const ctx = initMemory({
      conversationId: 'stage-c1',
      messages: [user('Hello')],
    }, deps())

    const handoff = presentation(ctx)

    expect(handoff.facts).toBeTruthy()
    expect(handoff.toolHadNoResults).toBe(false)
    expect(handoff.decisionConfidence).toBe(0.78)
    expect(handoff.constitutionPreview.meta).toBeTruthy()
  })

  it('llmAndTools and finalSpeak export typed async stage runners', () => {
    expect(llmAndTools.length).toBeGreaterThanOrEqual(2)
    expect(finalSpeak.length).toBeGreaterThanOrEqual(2)
  })
})
