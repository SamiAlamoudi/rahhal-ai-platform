/**
 * Recovery Phase 4 — Conversation Intelligence unit tests.
 * Arabic · English · mixed · RTL-friendly summaries · flag default OFF.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  analyzeConversation,
  ConversationMemory,
  detectConversationIntent,
  enrichWithConversationIntelligence,
  extractEntities,
  formatSummaryForConsultant,
  isConversationIntelligenceEnabled,
  PHASE4_CONVERSATION_INTELLIGENCE_VERSION,
  planIntelligentQuestions,
  resolveReferences,
  summarizeConversation,
  updateLiveTravelMemory,
  createEmptyLiveTravelMemory,
} from '../agent/conversationIntelligence'
import { createTravelAgentService } from '../agent/travelAgentService'
import { emptyMemory } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId = 'ci-p4'): ChatMessage {
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

describe('Phase 4 — Conversation Intelligence', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps ai.conversation_intelligence OFF by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.conversation_intelligence')).toBe(false)
    expect(isConversationIntelligenceEnabled()).toBe(false)
    expect(PHASE4_CONVERSATION_INTELLIGENCE_VERSION).toMatch(/conversation-intelligence/)
  })

  it('extracts Tokyo + October + wife + 10000 from English in one shot', () => {
    const entities = extractEntities(
      'I want Tokyo in October with my wife around ten thousand.',
    )
    expect(entities.destination).toBe('Tokyo')
    expect(entities.monthHint).toBe('October')
    expect(entities.adults).toBe(2)
    expect(entities.budgetAmount).toBe(10000)
    expect(entities.currency).toBe('SAR')
  })

  it('extracts mixed Arabic-English utterance', () => {
    const entities = extractEntities('أبغى Tokyo في أكتوبر مع زوجتي حوالي 10000 ريال')
    expect(entities.destination).toBe('Tokyo')
    expect(entities.monthHint).toBe('October')
    expect(entities.adults).toBe(2)
    expect(entities.budgetAmount).toBe(10000)
    expect(entities.currency).toBe('SAR')
  })

  it('extracts Arabic-only trip cues', () => {
    const entities = extractEntities('رحلة عائلية إلى دبي في مارس بميزانية حوالي 8000')
    expect(entities.destination).toBe('Dubai')
    expect(entities.monthHint).toBe('March')
    expect(entities.purpose).toBe('family')
    expect(entities.budgetAmount).toBe(8000)
  })

  it('detects intents across domains', () => {
    expect(detectConversationIntent('Do I need a visa for Japan?').intent).toBe('visa_question')
    expect(detectConversationIntent('Find me flights to Paris').intent).toBe('search_flights')
    expect(detectConversationIntent('فنادق هادئة في طوكيو').intent).toBe('search_hotels')
    expect(detectConversationIntent('ما الطقس في أكتوبر؟').intent).toBe('weather')
    expect(detectConversationIntent('I want to plan a full trip to Tokyo').intent).toBe(
      'complete_trip',
    )
  })

  it('resolves conversational references from live memory', () => {
    const memory = createEmptyLiveTravelMemory()
    memory.destination = 'Tokyo'
    memory.budgetAmount = 10000
    memory.currency = 'SAR'
    memory.airlines = ['Saudia']
    memory.hotelPreferences = ['quiet']
    memory.travelers = { adults: 2, children: null, infants: null, total: 2 }

    const refs = resolveReferences(
      'Same hotel there next week with the same budget on that airline',
      memory,
    )
    expect(refs.some((r) => r.phrase === 'there' && r.resolvesTo === 'Tokyo')).toBe(true)
    expect(refs.some((r) => r.kind === 'budget')).toBe(true)
    expect(refs.some((r) => r.kind === 'airline')).toBe(true)
    expect(refs.some((r) => r.kind === 'date')).toBe(true)
  })

  it('updates live travel memory continuously', () => {
    const store = new ConversationMemory()
    store.applyEntities(extractEntities('I want Tokyo with my wife'))
    store.applyEntities(extractEntities('Budget around SAR 10000 and quiet hotels'))
    const snap = store.getSnapshot()
    expect(snap.destination).toBe('Tokyo')
    expect(snap.travelers.adults).toBe(2)
    expect(snap.budgetAmount).toBe(10000)
    expect(snap.hotelPreferences).toContain('quiet')
  })

  it('builds a smart confirmation summary (Arabic RTL-friendly bullets)', () => {
    const analysis = analyzeConversation({
      userText: 'I want Tokyo in October with my wife around ten thousand. Quiet hotels.',
      locale: 'ar',
    })
    const formatted = formatSummaryForConsultant(analysis.summary, 'ar')
    expect(formatted).toContain('مما فهمتُ حتى الآن')
    expect(formatted).toContain('Tokyo')
    expect(formatted).toContain('October')
    expect(formatted).toMatch(/10[,.]?000/)
    expect(formatted).toContain('هل فهمت')
    // Bullet markers for RTL lists
    expect(formatted).toMatch(/•/)
  })

  it('plans only outcome-changing questions (max 2, never interview chain)', () => {
    const memory = updateLiveTravelMemory(
      createEmptyLiveTravelMemory(),
      extractEntities('I want Tokyo in October with my wife around ten thousand'),
    )
    const questions = planIntelligentQuestions(memory, 'en')
    expect(questions.length).toBeLessThanOrEqual(2)
    const joined = questions.map((q) => q.textEn.toLowerCase()).join(' ')
    expect(joined).not.toMatch(/\bwhat city\b/)
    expect(joined).not.toMatch(/\bwhat is your budget\b/)
    expect(questions.some((q) => q.id === 'stops_tradeoff' || q.id === 'hotel_vibe')).toBe(true)
  })

  it('proactively suggests Japan October / visa / JR Pass tips', () => {
    const analysis = analyzeConversation({
      userText: 'Plan a complete trip to Tokyo in October',
      locale: 'en',
    })
    expect(analysis.insights.length).toBeGreaterThan(0)
    expect(analysis.consultantNotes.length).toBeGreaterThan(0)
    const tipText = analysis.insights.map((i) => i.textEn).join(' ')
    expect(tipText.toLowerCase()).toMatch(/october|cherry|jr pass|visa/)
  })

  it('supports streaming partial transcripts without throwing', () => {
    const partial = analyzeConversation({
      userText: 'I want Tok',
      streaming: true,
      locale: 'en',
    })
    expect(partial.streaming).toBe(true)
    const fuller = analyzeConversation({
      userText: 'I want Tokyo in October with my wife around ten thousand',
      priorMemory: partial.memory,
      streaming: true,
      locale: 'en',
    })
    expect(fuller.memory.destination).toBe('Tokyo')
    expect(fuller.memory.travelers.adults).toBe(2)
  })

  it('enrich is a no-op when flag is OFF', () => {
    const memory = emptyMemory()
    const { conversationIntelligence, memory: next } = enrichWithConversationIntelligence({
      userText: 'I want Tokyo in October with my wife around ten thousand',
      memory,
    })
    expect(conversationIntelligence).toBeNull()
    expect(next.requirements.destination).toBeNull()
  })

  it('enrich merges entities when explicitly enabled', () => {
    const memory = emptyMemory()
    const { conversationIntelligence, memory: next } = enrichWithConversationIntelligence({
      userText: 'I want Tokyo in October with my wife around ten thousand',
      memory,
      enabled: true,
      locale: 'en',
    })
    expect(conversationIntelligence?.memory.destination).toBe('Tokyo')
    expect(next.requirements.destination).toBe('Tokyo')
    expect(next.requirements.travelers).toBe(2)
    expect(next.requirements.budgetAmount).toBe(10000)
  })

  it('planTurn attaches conversationIntelligence meta only when enabled', async () => {
    const off = createTravelAgentService({ conversationIntelligenceEnabled: false })
    const offTurn = await off.planTurn({
      conversationId: 'ci-off',
      messages: [msg('I want Tokyo in October with my wife around ten thousand', 'ci-off')],
    })
    expect(offTurn.meta.conversationIntelligence).toBeUndefined()

    const on = createTravelAgentService({ conversationIntelligenceEnabled: true })
    const onTurn = await on.planTurn({
      conversationId: 'ci-on',
      messages: [msg('I want Tokyo in October with my wife around ten thousand', 'ci-on')],
    })
    expect(onTurn.meta.conversationIntelligence?.destination).toBe('Tokyo')
    expect(onTurn.meta.conversationIntelligence?.adults).toBe(2)
    expect(onTurn.meta.conversationIntelligence?.budgetAmount).toBe(10000)
    expect(onTurn.meta.conversationIntelligence?.monthHint).toBe('October')
  })

  it('English summary path works', () => {
    const summary = summarizeConversation(
      analyzeConversation({
        userText: 'Tokyo in October, two adults, around SAR 10000, quiet hotels',
        locale: 'en',
      }).memory,
      'en',
    )
    expect(summary.bulletsEn.join(' ')).toMatch(/Tokyo/)
    expect(summary.confirmPromptEn).toMatch(/correctly/i)
  })
})
