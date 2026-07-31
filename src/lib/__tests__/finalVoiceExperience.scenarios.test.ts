import { describe, expect, it } from 'vitest'
import {
  buildConsultantConversationalInstructions,
  inferTripMood,
  moodToneCue,
  enrichDialectWording,
  prosodyPreferenceCue,
} from '../chat/voice/consultantConversationalStyle'
import {
  applyNaturalVariation,
  toSpokenDialogue,
  inferSpokenContext,
} from '../chat/voice/spokenDialoguePostProcessor'
import { replyInventedTravelFacts } from '../agent/conversationBrain/greetingGuard'
import { buildRealtimeTurnDetection } from '../chat/voice/realtimeTurnConfig'
import { createRealtimeQualityTracker } from '../chat/voice/realtimeQualityMetrics'

/**
 * Final Voice Experience — ChatGPT-Voice class conversational behavior.
 * Realtime architecture is not rewritten; we validate wording / mood / turn config / metrics.
 */
const SCENARIOS: Array<{
  id: string
  user: string
  expectedMood: ReturnType<typeof inferTripMood>
  sampleAssistant?: string
}> = [
  { id: 'greeting', user: 'سلام عليكم', expectedMood: 'greeting' },
  { id: 'honeymoon', user: 'أبغى أرتب شهر عسل في المالديف', expectedMood: 'honeymoon' },
  { id: 'luxury', user: 'رحلة فاخرة خمس نجوم في باريس', expectedMood: 'luxury' },
  { id: 'cheapest_flights', user: 'أبي أرخص تذاكر لتركيا', expectedMood: 'budget' },
  { id: 'cancelled_flight', user: 'رحلتي اتلغت وتأخرت في المطار', expectedMood: 'disruption' },
  { id: 'angry_customer', user: 'أنا زعلان جدا من الخدمة هذا شيء غير مقبول', expectedMood: 'angry' },
  { id: 'family', user: 'رحلة عائلية مع أطفال لصيف', expectedMood: 'family' },
  { id: 'business', user: 'سفر عمل لاجتماع يومين في دبي', expectedMood: 'business' },
  { id: 'weather', user: 'فيه عاصفة وطقس سيء هناك', expectedMood: 'weather' },
  { id: 'price_drop', user: 'السعر نزل وصار أرخص من قبل', expectedMood: 'price_drop' },
  { id: 'expensive', user: 'هذا الخيار غالي فوق الميزانية', expectedMood: 'expensive' },
  { id: 'confirmation', user: 'أكد الحجز موافق عليه', expectedMood: 'confirmation' },
  { id: 'open', user: 'ما أدري وين أسافر اقترح علي', expectedMood: 'open' },
  {
    id: 'interruption_mid_sentence',
    user: 'لحظة بس خلني أقاطعك — أبي وجهة أرخص',
    expectedMood: 'budget',
    sampleAssistant:
      'حسناً، بناءً على ما سبق يسعدني أن أقدم لكم ثلاثة خيارات فاخرة مفصلة مع جداول أسعار طويلة. أي خيار تفضلون وهل تريدون سيارة أيضاً؟',
  },
]

describe('final voice experience scenarios', () => {
  it('infers trip mood for every required conversation scenario', () => {
    for (const s of SCENARIOS) {
      expect(inferTripMood(s.user), s.id).toBe(s.expectedMood)
      expect(moodToneCue(s.expectedMood).length).toBeGreaterThan(10)
    }
  })

  it('booking-agent instructions encode ChatGPT-Voice class presence without consultant lectures', () => {
    const instructions = buildConsultantConversationalInstructions({
      dialect: 'saudi',
      language: 'ar',
      utterance: 'أبغى رحلة فاخرة',
      mood: 'luxury',
      speed: 'natural',
      energy: 'lively',
    })
    expect(instructions).toMatch(/BOOKING AGENT/i)
    expect(instructions).toMatch(/ChatGPT-Voice|ChatGPT Voice/i)
    expect(instructions).toMatch(/ZERO process narration|ZERO NARRATION|zero process narration/i)
    expect(instructions).toMatch(/PROSODY|Vary pitch/i)
    expect(instructions).toMatch(/GPS|IVR|news presenter|customer-support/i)
    expect(instructions).toMatch(/MULTILINGUAL|DIALECT ADAPTATION|Saudi/i)
    expect(instructions).toMatch(/interrupted/i)
    expect(instructions).toMatch(/Collect → Search → Show options/i)
    expect(instructions).not.toMatch(/guide, recommend, compare/i)
  })

  it('major dialect wording guidance differs without fixed one-style Arabic', () => {
    const saudi = enrichDialectWording('saudi')
    const egyptian = enrichDialectWording('egyptian')
    const levantine = enrichDialectWording('levantine')
    const fusha = enrichDialectWording('fusha')
    expect(saudi).toMatch(/Saudi|نجدي|حجازي|خليجي/i)
    expect(egyptian).toMatch(/Egyptian|مصرية/i)
    expect(levantine).toMatch(/Levantine|شامية/i)
    expect(fusha).toMatch(/Modern Standard|فصحى|MSA/i)
    expect(saudi).not.toEqual(egyptian)
  })

  it('prosody cues change with speed and energy', () => {
    const calm = prosodyPreferenceCue({ speed: 'slow', energy: 'calm' })
    const lively = prosodyPreferenceCue({ speed: 'fast', energy: 'lively' })
    expect(calm).toMatch(/slower|calm/i)
    expect(lively).toMatch(/quicker|lively/i)
    expect(calm).not.toEqual(lively)
  })

  it('uses semantic_vad without auto-create or auto-interrupt', () => {
    const td = buildRealtimeTurnDetection()
    expect(td.type).toBe('semantic_vad')
    expect(td.interrupt_response).toBe(false)
    expect(td.create_response).toBe(false)
  })

  it('realtime quality tracker records interruption and turn latencies', () => {
    const q = createRealtimeQualityTracker()
    q.markSpeechStarted(true)
    q.markSpeechStopped()
    q.markResponseCreated()
    q.markFirstAssistantAudio()
    q.markResponseDone()
    const snap = q.snapshot()
    expect(snap.interruptCount).toBeGreaterThanOrEqual(1)
    expect(snap.conversationOverlapCount).toBeGreaterThanOrEqual(1)
    expect(snap.turnDetectionLatencyMs).not.toBeNull()
    expect(snap.firstAudioLatencyMs).not.toBeNull()
    expect(snap.averageResponseTimeMs).not.toBeNull()
  })

  it('spoken post-processor keeps greeting human and non-hallucinating', () => {
    const spoken = toSpokenDialogue('وعليكم السلام، حياك الله. وين حاب تسافر؟', { locale: 'ar' })
    expect(replyInventedTravelFacts(spoken)).toEqual([])
    expect(spoken.length).toBeLessThan(120)
    expect(inferSpokenContext(spoken)).toBe('greeting')
  })

  it('strips process narration and AI-answer scripts', () => {
    const spoken = toSpokenDialogue(
      'خلني أقارن الأسعار أول… أستطيع مساعدتك. الخيار المباشر أوضح.',
      { locale: 'ar', variationSeed: 'narr-1', context: 'recommendation' },
    )
    expect(spoken).not.toMatch(/خلني أقارن|أستطيع مساعدتك|I'm searching|Let me search/i)
    expect(spoken).toMatch(/خيار|مباشر|أوضح|جميل|تمام|بصراحة|فكرة/)
  })

  it('interruption-style article dump becomes short spoken dialogue with one question', () => {
    const sample = SCENARIOS.find((s) => s.id === 'interruption_mid_sentence')!.sampleAssistant!
    const spoken = toSpokenDialogue(sample, { locale: 'ar', maxChars: 200 })
    expect(spoken).not.toMatch(/بناءً على ما سبق|يسعدني أن أقدم/)
    expect((spoken.match(/[؟?]/g) || []).length).toBeLessThanOrEqual(1)
    expect(spoken.length).toBeLessThan(sample.length)
  })

  it('natural variation changes robotic openings without inventing facts', () => {
    const base = 'حسناً، خلنا نرتب رحلتك.'
    const a = applyNaturalVariation(base, 'seed-a', 'ar')
    expect(applyNaturalVariation(base, 'seed-a', 'ar')).toBe(a)
    const variants = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'].map((s) =>
      applyNaturalVariation(base, s, 'ar'),
    )
    expect(new Set(variants).size).toBeGreaterThan(1)
    expect(variants.some((v) => !v.startsWith('حسناً'))).toBe(true)
    expect(replyInventedTravelFacts(a)).toEqual([])
  })

  it('mood cues encode required emotion mapping', () => {
    expect(moodToneCue('greeting')).toMatch(/warm/i)
    expect(moodToneCue('luxury')).toMatch(/excited|refined/i)
    expect(moodToneCue('family')).toMatch(/friendly/i)
    expect(moodToneCue('business')).toMatch(/professional/i)
    expect(moodToneCue('disruption')).toMatch(/empathy/i)
    expect(moodToneCue('angry')).toMatch(/de-escalat/i)
    expect(moodToneCue('weather')).toMatch(/concerned/i)
    expect(moodToneCue('price_drop')).toMatch(/happy/i)
    expect(moodToneCue('expensive')).toMatch(/careful/i)
    expect(moodToneCue('confirmation')).toMatch(/confident/i)
  })

  it('strips customer-support openers and keeps one question', () => {
    const spoken = toSpokenDialogue(
      'وعليكم السلام! كيف أقدر أساعدك اليوم؟ وين حاب تسافر؟ وهل تفضل أوروبا؟',
      { locale: 'ar' },
    )
    expect(spoken).not.toMatch(/كيف أقدر أساعدك/)
    expect((spoken.match(/[؟?]/g) || []).length).toBeLessThanOrEqual(1)
  })
})
