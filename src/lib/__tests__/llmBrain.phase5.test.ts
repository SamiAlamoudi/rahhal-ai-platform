/**
 * Recovery Phase 5 — LLM Conversation Brain tests.
 * Dialects · mixed language · long chats · corrections · flag OFF · regression.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  detectArabicDialect,
  enrichWithLlmConversationBrain,
  isLlmConversationBrainEnabled,
  PHASE5_LLM_CONVERSATION_BRAIN_VERSION,
  runLlmConversationBrain,
} from '../agent/llmBrain'
import { createTravelAgentService } from '../agent/travelAgentService'
import { emptyMemory } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'

function msg(content: string, conversationId = 'llm-p5'): ChatMessage {
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

describe('Phase 5 — LLM Conversation Brain', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps ai.llm_conversation_brain OFF by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.llm_conversation_brain')).toBe(false)
    expect(isLlmConversationBrainEnabled()).toBe(false)
    expect(PHASE5_LLM_CONVERSATION_BRAIN_VERSION).toMatch(/llm-conversation-brain/)
  })

  it('detects Arabic dialects', () => {
    expect(detectArabicDialect('أبي اليابان')).toBe('saudi')
    expect(detectArabicDialect('شلون أروح دبي؟')).toBe('gulf')
    expect(detectArabicDialect('أشتي أسافر صنعاء')).toBe('yemeni')
    expect(detectArabicDialect('عايز أروح اسكندرية')).toBe('egyptian')
    expect(detectArabicDialect('بدي إجازة بلبنان')).toBe('levant')
    expect(detectArabicDialect('بغيت نمشي لمراكش')).toBe('moroccan')
    expect(detectArabicDialect('Hotel قريب من المترو')).toBe('mixed')
  })

  it('understands Saudi dialect trip cues (LLM-first)', () => {
    const result = runLlmConversationBrain({
      userText: 'أبي اليابان. خلها أكتوبر. ميزانيتي عشرة.',
      locale: 'ar',
    })
    expect(result.usedRulesFallback).toBe(false)
    expect(result.debug.providerMode).toBe('mock_llm')
    expect(result.memory.destination).toBe('Japan')
    expect(result.memory.monthHint).toBe('October')
    expect(result.memory.budgetAmount).toBe(10000)
    expect(result.dialect).toBe('saudi')
  })

  it('understands Gulf / Yemeni / Egyptian / Levant / Moroccan utterances', () => {
    expect(runLlmConversationBrain({ userText: 'يبي رحلة لدبي', locale: 'ar' }).dialect).toMatch(
      /gulf|saudi|msa/,
    )
    expect(runLlmConversationBrain({ userText: 'أشتي أسافر', locale: 'ar' }).dialect).toBe('yemeni')
    expect(runLlmConversationBrain({ userText: 'عايز فندق في القاهرة', locale: 'ar' }).intent).toBe(
      'search_hotels',
    )
    expect(runLlmConversationBrain({ userText: 'بدي أغير الجو', locale: 'ar' }).intent).toBe(
      'travel_inspiration',
    )
    expect(runLlmConversationBrain({ userText: 'بغيت نمشي بعيد', locale: 'ar' }).dialect).toBe(
      'moroccan',
    )
  })

  it('handles mixed Arabic-English and transit preference', () => {
    const result = runLlmConversationBrain({
      userText: 'مو مشكلة لو ترانزيت. Business class. Hotel قريب من المترو.',
      locale: 'ar',
    })
    expect(result.dialect).toBe('mixed')
    expect(result.memory.stopoverPreference).toBe('flexible')
    expect(result.memory.flightPreferences.join(' ')).toMatch(/business|one-stop/i)
    expect(result.memory.hotelPreferences).toContain('near-metro')
  })

  it('reasons about cold inspiration like a consultant', () => {
    const result = runLlmConversationBrain({
      userText: 'I want somewhere cold.',
      locale: 'en',
    })
    expect(result.intent).toBe('travel_inspiration')
    expect(result.reasoning.destinationStrategy).toMatch(/Georgia|Switzerland|Hokkaido/i)
    expect(result.toolDecision.tool).toBe('continue_conversation')
    expect(result.response.displayText.toLowerCase()).toMatch(/cold|georgia|switzerland|hokkaido/)
    expect(result.response.displayText).toMatch(/never invented|لا اختلاق/i)
  })

  it('is proactive about Japan October / visa / JR Pass risks', () => {
    const result = runLlmConversationBrain({
      userText: 'Plan Tokyo in October with my wife around ten thousand',
      locale: 'en',
    })
    expect(result.memory.destination).toBe('Tokyo')
    expect(result.reasoning.seasonNotes.join(' ')).toMatch(/October|autumn|cherry/i)
    expect(result.reasoning.riskNotes.join(' ')).toMatch(/passport|visa/i)
    expect(result.reasoning.proactiveTips.join(' ')).toMatch(/JR Pass|holiday|typhoon/i)
  })

  it('assigns confidence and asks when low', () => {
    const vague = runLlmConversationBrain({ userText: 'hi', locale: 'en' })
    expect(['low', 'medium', 'high']).toContain(vague.confidence)
    if (vague.confidence === 'low' || vague.toolDecision.tool === 'ask_question') {
      expect(vague.response.displayText.length).toBeGreaterThan(10)
    }
  })

  it('supports rules fallback path', () => {
    const result = runLlmConversationBrain({
      userText: 'I want Tokyo in October',
      forceRulesFallback: true,
      locale: 'en',
    })
    expect(result.usedRulesFallback).toBe(true)
    expect(result.debug.providerMode).toBe('rules_fallback')
    expect(result.memory.destination).toBe('Tokyo')
  })

  it('tracks reasoning stages for debug observability', () => {
    const result = runLlmConversationBrain({
      userText: 'أبي طوكيو',
      locale: 'ar',
    })
    const ids = result.debug.stages.map((s) => s.id)
    expect(ids).toEqual([
      'memory',
      'context',
      'intent',
      'entities',
      'travel_reasoning',
      'tool_decision',
      'compose',
      'confidence',
    ])
  })

  it('handles corrections and multi-turn memory updates', () => {
    const turn1 = runLlmConversationBrain({
      userText: 'أبي اليابان',
      locale: 'ar',
      turn: 1,
    })
    const turn2 = runLlmConversationBrain({
      userText: 'خلها أكتوبر بدل مارس',
      priorMemory: turn1.memory,
      recentTexts: ['أبي اليابان'],
      locale: 'ar',
      turn: 2,
    })
    expect(turn2.state.corrections.length).toBeGreaterThan(0)
    expect(turn2.memory.destination).toBe('Japan')
    expect(turn2.memory.monthHint).toBe('October')
    expect(turn2.state.compressedFacts.some((f) => f.startsWith('destination='))).toBe(true)
  })

  it('enrich is a no-op when flag is OFF', () => {
    const { llmBrain, memory } = enrichWithLlmConversationBrain({
      userText: 'أبي اليابان',
      memory: emptyMemory(),
    })
    expect(llmBrain).toBeNull()
    expect(memory.requirements.destination).toBeNull()
  })

  it('enrich merges when explicitly enabled', () => {
    const { llmBrain, memory } = enrichWithLlmConversationBrain({
      userText: 'أبي اليابان. ميزانيتي عشرة.',
      memory: emptyMemory(),
      enabled: true,
      locale: 'ar',
    })
    expect(llmBrain?.memory.destination).toBe('Japan')
    expect(memory.requirements.destination).toBe('Japan')
    expect(memory.requirements.budgetAmount).toBe(10000)
  })

  it('planTurn attaches llmBrain meta only when enabled', async () => {
    const off = createTravelAgentService({ llmConversationBrainEnabled: false })
    const offTurn = await off.planTurn({
      conversationId: 'llm-off',
      messages: [msg('أبي اليابان', 'llm-off')],
    })
    expect(offTurn.meta.llmBrain).toBeUndefined()

    const on = createTravelAgentService({ llmConversationBrainEnabled: true })
    const onTurn = await on.planTurn({
      conversationId: 'llm-on',
      messages: [msg('أبي اليابان. خلها أكتوبر.', 'llm-on')],
    })
    expect(onTurn.meta.llmBrain?.destination).toBe('Japan')
    expect(onTurn.meta.llmBrain?.providerMode).toBe('mock_llm')
    expect(onTurn.meta.llmBrain?.stageCount).toBe(8)
    expect(onTurn.meta.llmBrain?.debugStages?.length).toBe(8)
  })

  it('does not invent bookings or prices in composed reply', () => {
    const result = runLlmConversationBrain({
      userText: 'Book me the cheapest flight to Tokyo for $99 confirmed',
      locale: 'en',
    })
    expect(result.response.displayText.toLowerCase()).not.toMatch(/confirmed booking #/)
    expect(result.response.displayText).toMatch(/never invented|search tools/i)
  })
})
