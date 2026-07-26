/**
 * Sprint 55 — Travel Consultant Intelligence (conversation quality).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { createMockAgentToolRegistry } from '../agent/tools/stubs'
import { generateLocalConversation } from '../agent/conversationBrain/localConversationModel'
import { buildTravelFacts } from '../agent/conversationBrain/travelFacts'
import { emptyMemory, emptyRequirements } from '../agent/types'
import { mergeRequirements } from '../agent/memory'
import { extractSoftSignals } from '../concierge/softSignals'
import {
  buildConsultantFactNotes,
  CONSULTANT_BANNED_AR,
  inferDiscoveryFromText,
} from '../consultantIntelligence'
import { buildTravelConsultantInstructions } from '../realtimeVoice/travelConsultantPrompt'
import { RAHHAL_CONVERSATION_SYSTEM_PROMPT } from '../agent/conversationBrain/systemPrompt'
import type { ChatMessage } from '../chat/chatTypes'

function user(content: string, conversationId = 's55'): ChatMessage {
  const now = new Date().toISOString()
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

describe('Sprint 55 — discovery intelligence', () => {
  it('infers beach from أحب البحر', () => {
    const d = inferDiscoveryFromText('أحب البحر')
    expect(d.travelStyle).toBe('Beach')
    expect(d.mustHaves).toContain('beach')
  })

  it('infers crowd avoidance + quiet hotels from أكره الزحام', () => {
    const d = inferDiscoveryFromText('أكره الزحام')
    expect(d.dealBreakers).toEqual(expect.arrayContaining([
      'crowds',
      'peak_season_crowds',
      'noisy_hotels',
    ]))
    expect(d.notes).toContain('prefer_quiet_hotels')
  })

  it('infers culture + local food from أحب الأسواق الشعبية', () => {
    const d = inferDiscoveryFromText('أحب الأسواق الشعبية')
    expect(d.travelStyle).toBe('Culture')
    expect(d.activities).toEqual(expect.arrayContaining(['culture', 'walking_tours']))
    expect(d.foodPreferences).toContain('local_cuisine')
  })

  it('infers honeymoon romantic luxury stack', () => {
    const d = inferDiscoveryFromText('أريد شهر عسل')
    expect(d.tripPurpose).toBe('honeymoon')
    expect(d.mustHaves).toEqual(expect.arrayContaining([
      'romantic',
      'privacy',
      'luxury',
      'special_experiences',
    ]))
  })

  it('softSignals merge discovery cues', () => {
    const soft = extractSoftSignals('أكره الزحام وأحب البحر', 'ar')
    expect(soft.mustHaves).toContain('beach')
    expect(soft.dealBreakers).toEqual(expect.arrayContaining(['crowds']))
  })
})

describe('Sprint 55 — consultant voice', () => {
  it('local model avoids banned عندي phrasing and recommends with WHY', () => {
    const memory = emptyMemory('ar')
    memory.requirements = mergeRequirements(emptyRequirements(), {
      destination: 'Morocco',
      destinations: ['Morocco'],
      durationDays: 7,
      budgetAmount: 5000,
      budgetCurrency: 'SAR',
    })
    const facts = buildTravelFacts({
      memory,
      objective: 'propose_options',
      missingSlots: [],
      optionHints: [
        'أكادير — أكثر هدوءاً في الصيف، وأسعار المنتجعات فيها عادة أفضل من مراكش.',
        'مراكش — ثقافة وأسواق.',
      ],
      recommendations: [
        'هل تميل أكثر للأجواء الشاطئية مثل أغادير، أم المدن التاريخية مثل مراكش؟',
      ],
    })
    const result = generateLocalConversation({
      facts,
      userMessage: 'أريد السفر للمغرب',
      conversationId: 's55-voice',
    })
    for (const banned of CONSULTANT_BANNED_AR) {
      expect(result.displayText).not.toContain(banned)
      expect(result.spokenText).not.toContain(banned)
    }
    expect(result.displayText).toMatch(/أرشح/)
    expect(result.displayText).toMatch(/أكادير|مراكش/)
    expect(result.spokenText).toBeTruthy()
  })

  it('empathy + proactive notes for honeymoon', () => {
    const notes = buildConsultantFactNotes({
      locale: 'ar',
      userText: 'نريد شهر عسل في المغرب',
      destination: 'Morocco',
      tripPurpose: 'honeymoon',
      travelerType: 'couple',
    })
    expect(notes.join(' ')).toMatch(/مبروك/)
    expect(notes.join(' ')).toMatch(/أزواج|خصوصية|هدوء/)
  })

  it('text system prompt and realtime voice share consultant personality bans', () => {
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/عندي/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/أرشح/)
    const voice = buildTravelConsultantInstructions('ar')
    expect(voice).toMatch(/مستشار سفر/)
    expect(voice).toMatch(/سؤال واحد|one purposeful|ASK ONLY one/i)
    expect(voice).toMatch(/أرشح لك|I recommend/i)
  })
})

describe('Sprint 55 — planTurn consultant feel', () => {
  beforeEach(() => resetFeatureRegistry())

  it('Morocco turn praises destination, asks one trade-off city question, no inventory dump', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 's55-morocco',
      messages: [user('أريد السفر للمغرب', 's55-morocco')],
    })
    expect(turn.tripPlan).toBeFalsy()
    expect(turn.meta.tripState?.cardsAllowed).toBe(false)
    expect(turn.reply).toMatch(/المغرب|Morocco/)
    expect(turn.reply).toMatch(/أغادير|أكادير|مراكش|Agadir|Marrakech/)
    expect(turn.reply).not.toMatch(/عندي/)
    expect(turn.reply).not.toMatch(/إليك الخيارات|هذه هي النتائج/)
    expect((turn.reply.match(/[?؟]/g) ?? []).length).toBeGreaterThan(0)
    expect(turn.meta.spokenText).toBeTruthy()
    // Voice + text same engine: spoken is a short form of the same consultant turn.
    expect(turn.meta.spokenText!.length).toBeLessThan(turn.reply.length + 80)
  })

  it('preserves memory across turns and never re-asks Morocco after city lock', async () => {
    const service = createTravelAgentService({
      tools: createMockAgentToolRegistry(),
      smartClarificationEnabled: true,
      travelReasoningEnabled: false,
    })
    const cid = 's55-memory'
    const t1 = await service.planTurn({
      conversationId: cid,
      messages: [user('أريد السفر للمغرب', cid)],
    })
    const t2 = await service.planTurn({
      conversationId: cid,
      messages: [
        user('أريد السفر للمغرب', cid),
        {
          ...user('a', cid),
          id: 'a1',
          role: 'assistant',
          content: t1.reply,
          providerMeta: t1.meta as unknown as Record<string, unknown>,
        },
        user('مع زوجتي لمدة أسبوع بميزانية 10000 ريال وأحب البحر', cid),
      ],
    })
    expect(t2.meta.tripState?.destinationCountry).toBe('Morocco')
    expect(t2.meta.tripState?.budget).toBe(10000)
    expect(t2.meta.tripState?.travelStyle).toBe('Beach')
    expect(t2.meta.tripState?.relationship).toBe('couple')
    expect(t2.meta.tripState?.primaryMissing).toBe('destinationCity')
    // Must not re-ask destination or run a form census; budget may appear in value framing.
    expect(t2.reply).not.toMatch(/كم الميزانية|Budget\?|ما المدينة\؟|كم عدد الأيام/)
    expect(t2.reply).toMatch(/أغادير|أكادير|مراكش|Agadir|Marrakech|شاطئ|beach/i)
  })
})
