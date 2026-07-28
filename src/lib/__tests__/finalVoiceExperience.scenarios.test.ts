import { describe, expect, it } from 'vitest'
import {
  buildConsultantConversationalInstructions,
  inferTripMood,
  moodToneCue,
  enrichDialectWording,
} from '../chat/voice/consultantConversationalStyle'
import {
  applyNaturalVariation,
  toSpokenDialogue,
  inferSpokenContext,
} from '../chat/voice/spokenDialoguePostProcessor'
import { replyInventedTravelFacts } from '../agent/conversationBrain/greetingGuard'

/**
 * Final Voice Experience — scenario validation (conversational behavior only).
 * Realtime engine is not exercised here; we validate wording / mood / spoken shape.
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

  it('senior consultant instructions encode think-together personality', () => {
    const instructions = buildConsultantConversationalInstructions({
      dialect: 'saudi',
      mood: 'luxury',
    })
    expect(instructions).toMatch(/senior human travel consultant/i)
    expect(instructions).toMatch(/premium|confident, warm/i)
    expect(instructions).toMatch(/THINK BEFORE|thinking TOGETHER/i)
    expect(instructions).toMatch(/خلني أشوف|جميل|فكرة حلوة/)
    expect(instructions).toMatch(/أقارن الأسعار|رحلات المباشرة|أعطني ثواني/)
    expect(instructions).toMatch(/GPS|news presenter|customer-support|AI that answers/i)
    expect(instructions).toMatch(/Never sound identical|freshly generated/i)
    expect(instructions).toMatch(/educated Saudi/i)
    expect(instructions).toMatch(/interrupted/i)
    expect(instructions).toMatch(/أستطيع|يمكنني|يسعدني/)
  })

  it('Saudi / Gulf / Neutral dialect wording differs', () => {
    const saudi = enrichDialectWording('saudi')
    const gulf = enrichDialectWording('gulf')
    const white = enrichDialectWording('white')
    expect(saudi).toMatch(/حياك|خلنا|أبشري/)
    expect(gulf).toMatch(/Gulf/i)
    expect(white).toMatch(/Neutral|بيضاء|clear/i)
    expect(saudi).not.toEqual(gulf)
  })

  it('spoken post-processor keeps greeting human and non-hallucinating', () => {
    const spoken = toSpokenDialogue('وعليكم السلام، حياك الله. وين حاب تسافر؟', { locale: 'ar' })
    expect(replyInventedTravelFacts(spoken)).toEqual([])
    expect(spoken.length).toBeLessThan(120)
    expect(inferSpokenContext(spoken)).toBe('greeting')
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
    // Same seed is stable
    expect(applyNaturalVariation(base, 'seed-a', 'ar')).toBe(a)
    // Across several seeds, openings should not all stay "حسناً"
    const variants = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'].map((s) =>
      applyNaturalVariation(base, s, 'ar'),
    )
    expect(new Set(variants).size).toBeGreaterThan(1)
    expect(variants.some((v) => !v.startsWith('حسناً'))).toBe(true)
    expect(replyInventedTravelFacts(a)).toEqual([])
  })

  it('mood cues encode required emotion mapping', () => {
    expect(moodToneCue('greeting')).toMatch(/warm/i)
    expect(moodToneCue('luxury')).toMatch(/elegant/i)
    expect(moodToneCue('family')).toMatch(/friendly/i)
    expect(moodToneCue('business')).toMatch(/professional/i)
    expect(moodToneCue('disruption')).toMatch(/empathy/i)
    expect(moodToneCue('angry')).toMatch(/de-escalat/i)
    expect(moodToneCue('honeymoon')).toMatch(/celebratory|warm/i)
    expect(moodToneCue('budget')).toMatch(/practical|value/i)
  })

  it('strips customer-support openers and keeps one question', () => {
    const spoken = toSpokenDialogue(
      'وعليكم السلام! كيف أقدر أساعدك اليوم؟ وين حاب تسافر؟ وهل تفضل أوروبا؟',
      { locale: 'ar' },
    )
    expect(spoken).not.toMatch(/كيف أقدر أساعدك/)
    expect((spoken.match(/[؟?]/g) || []).length).toBeLessThanOrEqual(1)
  })

  it('maps luxury / family / business assistant cues', () => {
    expect(inferSpokenContext('عندي خيار فاخر في سويت مطل على البحر')).toBe('luxury')
    expect(inferSpokenContext('مناسب للعائلة مع الأطفال')).toBe('family')
    expect(inferSpokenContext('يناسب سفر العمل والاجتماعات')).toBe('business')
  })

  it('strips AI-answer scripts and adds a thinking breath on cold dumps', () => {
    const spoken = toSpokenDialogue(
      'أستطيع مساعدتك في اختيار الفندق. عندي خيارين مناسبين قريبين من الوسط.',
      { locale: 'ar', variationSeed: 'cold-dump-1', context: 'recommendation' },
    )
    expect(spoken).not.toMatch(/أستطيع مساعدتك|يمكنني|يسعدني/)
    expect(spoken).toMatch(/جميل|تمام|خلني|لحظة|فكرة|بصراحة|على حسب|أشوف|أقارن|ثواني|خيار/)
  })

  it('thinking breaths vary across seeds for the same cold content', () => {
    const cold = 'عندي فندق مناسب قريب من الوسط.'
    const variants = ['t0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9'].map((s) =>
      toSpokenDialogue(cold, { locale: 'ar', variationSeed: s, context: 'recommendation' }),
    )
    expect(new Set(variants).size).toBeGreaterThan(1)
  })
})
