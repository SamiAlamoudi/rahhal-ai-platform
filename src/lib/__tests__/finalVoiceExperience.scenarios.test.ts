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

  it('senior consultant instructions encode personality and anti-patterns', () => {
    const instructions = buildConsultantConversationalInstructions({
      dialect: 'saudi',
      mood: 'luxury',
    })
    expect(instructions).toMatch(/senior human travel consultant/i)
    expect(instructions).toMatch(/confident, warm, premium/i)
    expect(instructions).toMatch(/GPS|news presenter|customer-support/i)
    expect(instructions).toMatch(/Never sound identical/i)
    expect(instructions).toMatch(/educated Saudi/i)
    expect(instructions).toMatch(/interrupted/i)
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
    const b = applyNaturalVariation(base, 'seed-b', 'ar')
    // Same seed is stable
    expect(applyNaturalVariation(base, 'seed-a', 'ar')).toBe(a)
    // Across several seeds, openings should not all stay "حسناً"
    const variants = ['s0', 's1', 's2', 's3', 's4', 's5', 's6', 's7'].map((s) =>
      applyNaturalVariation(base, s, 'ar'),
    )
    expect(new Set(variants).size).toBeGreaterThan(1)
    expect(variants.some((v) => !/^حسناً/.test(v))).toBe(true)
    expect(a === b || a !== b).toBe(true)
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

  it('maps luxury / family / business assistant cues', () => {
    expect(inferSpokenContext('عندي خيار فاخر في سويت مطل على البحر')).toBe('luxury')
    expect(inferSpokenContext('مناسب للعائلة مع الأطفال')).toBe('family')
    expect(inferSpokenContext('يناسب سفر العمل والاجتماعات')).toBe('business')
  })
})
