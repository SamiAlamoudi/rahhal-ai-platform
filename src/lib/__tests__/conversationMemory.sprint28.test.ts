/**
 * Sprint 28 — Conversation Memory & Context Engine tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import type { ChatMessage } from '../chat/chatTypes'
import {
  AITripOrchestrator,
  applyEnrichedPatch,
  buildFollowUpQuestions,
  ContextAssembler,
  ConversationMemoryService,
  ConversationSummarizer,
  createEmptyEnrichedMemory,
  detectMissingPreferenceSlots,
  getOrCreateMemoryContextEngine,
  isBrainContextMemoryEnabled,
  MemoryContextEngine,
  MemoryExtractor,
  mergeLongTermIntoSession,
  resetBrainIntegrationSessions,
  resetMemoryContextEngine,
  sanitizeMemoryForPublic,
  UserPreferenceStore,
} from '../brain'
import { applySensitiveExpiration } from '../brain/memory/expiration'
import { emptyTravelPreferenceProfile } from '../brain/memory/userPreferenceStore'

function userMessage(content: string, conversationId = 'c-s28'): ChatMessage {
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

function enableContextMemoryChain(): void {
  const registry = getFeatureRegistry()
  registry.setEnabled('brain.enabled', true)
  registry.setEnabled('brain.concierge', true)
  registry.setEnabled('brain.travel_engine', true)
  registry.setEnabled('brain.trip_planning', true)
  registry.setEnabled('brain.execution', true)
  registry.setEnabled('brain.search', true)
  registry.setEnabled('brain.trip_orchestrator', true)
  registry.setEnabled('brain.context_memory', true)
}

describe('Sprint 28 feature flags', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetMemoryContextEngine()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetMemoryContextEngine()
  })

  it('registers brain.context_memory disabled by default', () => {
    expect(getFeatureRegistry().isEnabled('brain.context_memory')).toBe(false)
    expect(isBrainContextMemoryEnabled()).toBe(false)
  })

  it('requires brain.trip_orchestrator before brain.context_memory', () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.context_memory', true)
    expect(registry.isEnabled('brain.context_memory')).toBe(false)
    enableContextMemoryChain()
    expect(registry.isEnabled('brain.context_memory')).toBe(true)
    expect(isBrainContextMemoryEnabled()).toBe(true)
  })
})

describe('Sprint 28 MemoryExtractor', () => {
  it('extracts airlines, cabin, seats, meals, loyalty, and accessibility', () => {
    const result = MemoryExtractor({
      text: 'I prefer Saudia business class, window seat, halal meal, Alfursan, and need wheelchair assistance',
      locale: 'en',
    })
    expect(result.sessionPatch.airlinePreferences).toContain('Saudia')
    expect(result.sessionPatch.cabinClass).toBe('business')
    expect(result.sessionPatch.seatPreferences).toContain('window')
    expect(result.sessionPatch.mealPreferences).toContain('halal')
    expect(result.sessionPatch.loyaltyPrograms?.some((l) => l.program === 'Alfursan')).toBe(
      true,
    )
    expect(result.sessionPatch.accessibilityRequirements).toContain('wheelchair')
    expect(result.longTermPatch.preferredAirlines).toContain('Saudia')
    expect(result.longTermPatch.loyaltyPrograms).toContain('Alfursan')
  })

  it('extracts hotel brands and family members', () => {
    const result = MemoryExtractor({
      text: 'Book Hilton for my family of 2 adults and 2 kids, with my wife',
      locale: 'en',
    })
    expect(result.sessionPatch.hotelPreferences).toContain('Hilton')
    expect(result.sessionPatch.familyMembers?.length).toBeGreaterThan(0)
    expect(result.sessionPatch.travelers?.count).toBeGreaterThanOrEqual(2)
  })

  it('stores passport/nationality only when explicitly provided', () => {
    const inferred = MemoryExtractor({
      text: 'Find flights to Dubai from Riyadh',
      locale: 'en',
    })
    expect(inferred.sessionPatch.passportNationality).toBeUndefined()
    expect(inferred.explicitSensitiveDisclosure).toBe(false)

    const explicit = MemoryExtractor({
      text: 'My nationality is Saudi and I need visa check for Turkey',
      locale: 'en',
    })
    expect(explicit.explicitSensitiveDisclosure).toBe(true)
    expect(explicit.sessionPatch.passportNationality?.explicitlyProvided).toBe(true)
    expect(explicit.sessionPatch.passportNationality?.nationality).toMatch(/Saudi/i)
  })
})

describe('Sprint 28 ConversationMemoryService (short-term)', () => {
  it('persists and retrieves session memory across turns', () => {
    const service = ConversationMemoryService({
      policy: { shortTermTtlMs: 60_000 },
    })
    service.getOrCreate({ conversationId: 'c1', userId: 'u1', locale: 'en' })
    service.updateMemory('c1', {
      destination: 'Dubai',
      destinations: ['Dubai'],
      cabinClass: 'business',
      seatPreferences: ['window'],
    })
    service.appendTurn({
      conversationId: 'c1',
      role: 'user',
      content: 'Business to Dubai, window please',
      intent: 'SearchFlights',
    })
    const loaded = service.get('c1')
    expect(loaded?.memory.destination).toBe('Dubai')
    expect(loaded?.memory.cabinClass).toBe('business')
    expect(loaded?.memory.seatPreferences).toContain('window')
    expect(loaded?.turnCount).toBe(1)
    expect(loaded?.history.turns).toHaveLength(1)
  })

  it('expires short-term sessions by TTL', () => {
    let now = 1_000_000
    const service = ConversationMemoryService({
      policy: { shortTermTtlMs: 1000 },
      now: () => now,
    })
    service.getOrCreate({ conversationId: 'exp', locale: 'en' })
    expect(service.get('exp')).not.toBeNull()
    now += 2000
    expect(service.get('exp')).toBeNull()
    expect(service.purgeExpired()).toBe(0)
  })

  it('clears sensitive fields after sensitive TTL', () => {
    const memory = applyEnrichedPatch(createEmptyEnrichedMemory('s1', 'en'), {
      passportNationality: {
        nationality: 'Saudi',
        passportCountry: 'Saudi',
        explicitlyProvided: true,
      },
      loyaltyPrograms: [{ program: 'Alfursan', memberNumber: 'ABC12345' }],
    })
    memory.updatedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const cleared = applySensitiveExpiration(memory, {
      shortTermTtlMs: 24 * 60 * 60 * 1000,
      longTermTtlMs: null,
      sensitiveTtlMs: 2 * 60 * 60 * 1000,
      summarizeAfterTurns: 12,
      recentTurnWindow: 6,
    })
    expect(cleared.passportNationality.explicitlyProvided).toBe(false)
    expect(cleared.loyaltyPrograms[0]?.memberNumber).toBeNull()
  })
})

describe('Sprint 28 UserPreferenceStore (long-term)', () => {
  it('persists preferences without loyalty member numbers', () => {
    const store = UserPreferenceStore({ personalizationAllowed: true })
    store.merge('user-1', {
      preferredAirlines: ['Emirates'],
      cabinClass: 'business',
      seatPreferences: ['aisle'],
      loyaltyPrograms: ['Skywards'],
      nationality: 'Emirati',
      allowSensitiveRetention: true,
    })
    const profile = store.get('user-1')
    expect(profile?.preferredAirlines).toContain('Emirates')
    expect(profile?.cabinClass).toBe('business')
    expect(profile?.loyaltyPrograms).toEqual(['Skywards'])
    expect(profile?.nationality).toBe('Emirati')
  })

  it('blocks personalization when privacy gate is off', () => {
    const store = UserPreferenceStore({ personalizationAllowed: false })
    expect(store.merge('user-2', { preferredAirlines: ['Saudia'] })).toBeNull()
    expect(store.get('user-2')).toBeNull()
  })

  it('omits nationality when sensitive retention is disallowed', () => {
    const store = UserPreferenceStore({
      personalizationAllowed: true,
      allowSensitiveRetention: false,
    })
    store.merge('user-3', {
      nationality: 'Saudi',
      preferredAirlines: ['Saudia'],
      allowSensitiveRetention: false,
    })
    expect(store.get('user-3')?.nationality).toBeNull()
    expect(store.get('user-3')?.preferredAirlines).toContain('Saudia')
  })
})

describe('Sprint 28 ContextAssembler + follow-ups', () => {
  it('merges long-term into session without overwriting session answers', () => {
    const session = applyEnrichedPatch(createEmptyEnrichedMemory('c', 'en'), {
      airlinePreferences: ['Saudia'],
      cabinClass: 'economy',
    })
    const longTerm = emptyTravelPreferenceProfile('u')
    longTerm.preferredAirlines = ['Emirates']
    longTerm.cabinClass = 'business'
    longTerm.seatPreferences = ['window']
    const merged = mergeLongTermIntoSession(session, longTerm)
    expect(merged.airlinePreferences).toEqual(['Saudia'])
    expect(merged.cabinClass).toBe('economy')
    expect(merged.seatPreferences).toContain('window')
  })

  it('asks only the minimum follow-up and never passport proactively', () => {
    const memory = createEmptyEnrichedMemory('c', 'en')
    const missing = detectMissingPreferenceSlots({
      memory,
      intent: 'SearchFlights',
      maxQuestions: 1,
    })
    expect(missing).toEqual(['destination'])
    expect(missing).not.toContain('passportNationality')
    const questions = buildFollowUpQuestions({
      missingSlots: ['passportNationality', 'destination'],
      locale: 'en',
      max: 2,
    })
    expect(questions).toHaveLength(1)
    expect(questions[0]).toMatch(/where/i)
  })

  it('reconstructs working memory from persisted short + long term', () => {
    const short = ConversationMemoryService()
    const long = UserPreferenceStore()
    short.getOrCreate({ conversationId: 'recon', userId: 'u9', locale: 'en' })
    short.updateMemory('recon', { destination: 'Paris', destinations: ['Paris'] })
    long.merge('u9', { preferredAirlines: ['Air France'], cabinClass: 'business' })
    const assembler = ContextAssembler()
    const working = assembler.reconstruct({
      conversationId: 'recon',
      shortTerm: short.get('recon'),
      longTerm: long.get('u9'),
      locale: 'en',
    })
    expect(working.destination).toBe('Paris')
    expect(working.airlinePreferences).toContain('Air France')
    expect(working.cabinClass).toBe('business')
  })
})

describe('Sprint 28 ConversationSummarizer (long conversations)', () => {
  it('summarizes after many turns and windows recent history', () => {
    const summarizer = ConversationSummarizer({
      policy: { summarizeAfterTurns: 6, recentTurnWindow: 2 },
      locale: 'en',
    })
    const service = ConversationMemoryService()
    let state = service.getOrCreate({ conversationId: 'long', locale: 'en' })
    state = service.updateMemory('long', {
      destination: 'Tokyo',
      destinations: ['Tokyo'],
      origin: 'Riyadh',
      cabinClass: 'business',
      airlinePreferences: ['Saudia'],
    })!

    for (let i = 0; i < 8; i += 1) {
      state = service.appendTurn({
        conversationId: 'long',
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `turn ${i}`,
        intent: 'SearchFlights',
      })!
    }

    expect(summarizer.shouldSummarize(state.turnCount, null)).toBe(true)
    const { summary, recentHistory } = summarizer.summarize({
      conversationId: 'long',
      history: state.history,
      memory: state.memory,
      locale: 'en',
    })
    expect(summary.text).toMatch(/Tokyo|Riyadh|business|Saudia/i)
    expect(summary.keyFacts.length).toBeGreaterThan(0)
    expect(recentHistory.turns.length).toBeLessThanOrEqual(2)
    const publicMem = sanitizeMemoryForPublic(state.memory)
    expect(JSON.stringify(publicMem)).not.toMatch(/memberNumber.:.[A-Z0-9]{5}/)
  })
})

describe('Sprint 28 MemoryContextEngine integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetMemoryContextEngine()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetMemoryContextEngine()
  })

  it('runs a full turn: extract → persist → assemble → follow-ups', () => {
    const engine = MemoryContextEngine({
      enabled: true,
      personalizationAllowed: true,
      allowSensitiveRetention: true,
    })
    const first = engine.runTurn({
      conversationId: 'eng-1',
      userId: 'traveler-1',
      locale: 'en',
      userText:
        'Flights from Riyadh to Dubai, Saudia business, window seat, Alfursan member',
      intent: 'SearchFlights',
    })
    expect(first.shortTerm.memory.origin).toBe('Riyadh')
    expect(first.shortTerm.memory.destination).toBe('Dubai')
    expect(first.shortTerm.memory.cabinClass).toBe('business')
    expect(first.shortTerm.memory.seatPreferences).toContain('window')
    expect(first.longTerm?.preferredAirlines).toContain('Saudia')
    expect(first.context.workingMemory.airlinePreferences).toContain('Saudia')

    const second = engine.runTurn({
      conversationId: 'eng-1',
      userId: 'traveler-1',
      locale: 'en',
      userText: 'Also prefer Hilton and halal meals',
      intent: 'SearchHotels',
    })
    expect(second.shortTerm.memory.hotelPreferences).toContain('Hilton')
    expect(second.shortTerm.memory.mealPreferences).toContain('halal')
    expect(second.shortTerm.turnCount).toBeGreaterThanOrEqual(2)
  })

  it('reconstructs context across engine instances via shared stores', () => {
    const short = ConversationMemoryService()
    const long = UserPreferenceStore({ personalizationAllowed: true })
    const a = MemoryContextEngine({
      enabled: true,
      shortTerm: short,
      longTerm: long,
    })
    a.runTurn({
      conversationId: 'shared',
      userId: 'u-shared',
      locale: 'en',
      userText: 'I prefer Emirates and aisle seats',
      intent: 'GeneralConversation',
    })
    const b = MemoryContextEngine({
      enabled: true,
      shortTerm: short,
      longTerm: long,
    })
    const assembled = b.assembleOnly({
      conversationId: 'shared',
      userId: 'u-shared',
      locale: 'en',
    })
    expect(assembled?.workingMemory.airlinePreferences).toContain('Emirates')
    expect(assembled?.workingMemory.seatPreferences).toContain('aisle')
    expect(assembled?.longTerm?.preferredAirlines).toContain('Emirates')
  })
})

describe('Sprint 28 AITripOrchestrator integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetMemoryContextEngine()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetMemoryContextEngine()
  })

  it('attaches memory engine result when context memory is on', async () => {
    enableContextMemoryChain()
    const orch = AITripOrchestrator({
      enabled: true,
      contextMemory: true,
      bookingFlow: false,
      runPipeline: async () =>
        ({
          context: {
            conversationId: 'orch-mem',
            memory: createEmptyEnrichedMemory('orch-mem', 'en'),
            history: { conversationId: 'orch-mem', turns: [] },
            goals: {
              primaryIntent: 'SearchFlights',
              secondaryIntents: [],
              tripPurpose: null,
              mustHave: [],
              niceToHave: [],
            },
            preferences: {
              pace: null,
              style: null,
              interests: [],
              avoid: [],
              notes: null,
            },
            lastIntent: 'SearchFlights',
            missingFields: [],
            locale: 'en',
          },
          classification: {
            intent: 'SearchFlights',
            confidence: 0.9,
            signals: [],
          },
          extraction: { patch: {}, entities: {} },
          missingFields: [],
          plan: {
            summary: 'ok',
            assistantGoal: 'search',
            missingFields: [],
            action: 'search_flights',
            uiHints: {
              showMemoryPanel: false,
              showIntentChip: false,
              highlightMissing: [],
              suggestedReplies: [],
              contextualReply: null,
            },
            searchRequests: [],
            bookingRequests: [],
            recommendations: [],
            intent: 'SearchFlights',
            confidence: 0.9,
            travelPlan: null,
          },
          domain: null,
          planning: null,
          execution: null,
          search: null,
        }) as never,
    })

    const result = await orch.runTurn({
      conversationId: 'orch-mem',
      userText: 'Find Saudia flights to Dubai, window seat please',
      locale: 'en',
      userId: 'orch-user',
      bypassCache: true,
    })
    expect(result.error).toBeNull()
    expect(result.memory).toBeTruthy()
    const mem = result.memory as {
      shortTerm: { memory: { airlinePreferences: string[]; seatPreferences: string[] } }
      followUpQuestions: string[]
    }
    expect(mem.shortTerm.memory.airlinePreferences).toContain('Saudia')
    expect(mem.shortTerm.memory.seatPreferences).toContain('window')
  })

  it('leaves memory null when context memory is off (compat)', async () => {
    const orch = AITripOrchestrator({
      enabled: true,
      contextMemory: false,
      bookingFlow: false,
      runPipeline: async () =>
        ({
          context: {
            conversationId: 'orch-off',
            memory: createEmptyEnrichedMemory('orch-off', 'en'),
            history: { conversationId: 'orch-off', turns: [] },
            goals: {
              primaryIntent: 'GeneralConversation',
              secondaryIntents: [],
              tripPurpose: null,
              mustHave: [],
              niceToHave: [],
            },
            preferences: {
              pace: null,
              style: null,
              interests: [],
              avoid: [],
              notes: null,
            },
            lastIntent: 'GeneralConversation',
            missingFields: [],
            locale: 'en',
          },
          classification: {
            intent: 'GeneralConversation',
            confidence: 0.5,
            signals: [],
          },
          extraction: { patch: {}, entities: {} },
          missingFields: [],
          plan: {
            summary: 'ok',
            assistantGoal: 'chat',
            missingFields: [],
            action: 'acknowledge',
            uiHints: {
              showMemoryPanel: false,
              showIntentChip: false,
              highlightMissing: [],
              suggestedReplies: [],
              contextualReply: null,
            },
            searchRequests: [],
            bookingRequests: [],
            recommendations: [],
            intent: 'GeneralConversation',
            confidence: 0.5,
            travelPlan: null,
          },
          domain: null,
          planning: null,
          execution: null,
          search: null,
        }) as never,
    })
    const result = await orch.runTurn({
      conversationId: 'orch-off',
      userText: 'hello',
      locale: 'en',
      bypassCache: true,
    })
    expect(result.memory).toBeNull()
  })
})

describe('Sprint 28 agent path when flag OFF', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetMemoryContextEngine()
  })
  afterEach(() => {
    resetFeatureRegistry()
    resetBrainIntegrationSessions()
    resetMemoryContextEngine()
  })

  it('does not attach memory meta when context memory chain is off', async () => {
    const registry = getFeatureRegistry()
    registry.setEnabled('brain.enabled', true)
    registry.setEnabled('brain.concierge', true)
    // trip orchestrator / context memory remain off
    const agent = createTravelAgentService({
      brainEnabled: true,
      brainTripOrchestratorEnabled: false,
    })
    const turn = await agent.planTurn({
      conversationId: 'agent-off',
      messages: [userMessage('Plan a trip to Dubai', 'agent-off')],
    })
    expect(turn.meta.brain?.memory).toBeFalsy()
  })
})

describe('Sprint 28 singleton reset', () => {
  it('getOrCreateMemoryContextEngine resets cleanly', () => {
    const a = getOrCreateMemoryContextEngine('t', { enabled: true })
    a.runTurn({
      conversationId: 'x',
      userText: 'prefer Saudia',
      locale: 'en',
      userId: 'u',
    })
    resetMemoryContextEngine()
    const b = getOrCreateMemoryContextEngine('t', { enabled: true })
    expect(b.getShortTerm('x')).toBeNull()
  })
})
