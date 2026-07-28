import { describe, expect, it } from 'vitest'
import {
  inferSpokenContext,
  splitSpokenBreaths,
  toSpokenDialogue,
} from '../chat/voice/spokenDialoguePostProcessor'
import { buildConsultantConversationalInstructions } from '../chat/voice/consultantConversationalStyle'

describe('spoken dialogue post-processor', () => {
  it('compresses long article-like Arabic into short spoken breaths', () => {
    const written = [
      'بناءً على ما سبق، يسعدني أن أقدم لكم ملخصاً شاملاً حول خيارات السفر المتاحة.',
      'أولاً: الفندق في وسط المدينة ويتميز بإطلالة رائعة.',
      'ثانياً: هناك خيار آخر أرخص لكنه أبعد قليلاً عن الشاطئ.',
      'ثالثاً: يمكنكم أيضاً اختيار باقة الإفطار مع إلغاء مجاني.',
      'في الختام، أخبروني أي خيار تفضلون وهل تريدون أيضاً سيارة؟ وهل الميزانية مرنة؟',
    ].join('\n\n')

    const spoken = toSpokenDialogue(written, { locale: 'ar', maxChars: 220 })
    expect(spoken.length).toBeLessThan(written.length)
    expect(spoken.length).toBeLessThanOrEqual(230)
    expect(spoken).not.toMatch(/بناءً على ما سبق|يسعدني أن أقدم|في الختام/)
    // One question max
    const q = (spoken.match(/[؟?]/g) || []).length
    expect(q).toBeLessThanOrEqual(1)
  })

  it('keeps a concise greeting conversational', () => {
    const spoken = toSpokenDialogue('وعليكم السلام، حياك الله. وين حاب تسافر؟', { locale: 'ar' })
    expect(spoken).toContain('وعليكم السلام')
    expect(spoken).toMatch(/تسافر|وين/)
  })

  it('converts bullet lists into ordinal spoken dialogue', () => {
    const written = [
      'عندي ثلاثة خيارات:',
      '- أوفر سعر',
      '- موقع أفضل',
      '- يشمل الإفطار',
    ].join('\n')
    const spoken = toSpokenDialogue(written, { locale: 'ar', maxChars: 260 })
    expect(spoken).toMatch(/الأول/)
    expect(spoken).not.toMatch(/^[-*]/m)
  })

  it('splits into spoken breaths', () => {
    const breaths = splitSpokenBreaths('حياك الله. خلني أرتب لك الخيارات. وين تفضل؟')
    expect(breaths.length).toBeGreaterThanOrEqual(2)
  })

  it('infers spoken context', () => {
    expect(inferSpokenContext('وعليكم السلام، حياك الله')).toBe('greeting')
    expect(inferSpokenContext('أنصحك بالخيار الثاني لموقعه')).toBe('recommendation')
  })
})

describe('consultant conversational style', () => {
  it('requires spoken not narrated behavior and interruption handling', () => {
    const instructions = buildConsultantConversationalInstructions({ dialect: 'saudi' })
    expect(instructions).toMatch(/SPEAK, do not narrate/i)
    expect(instructions).toMatch(/ONE question/i)
    expect(instructions).toMatch(/interrupted/i)
    expect(instructions).toMatch(/Never invent/i)
    expect(instructions).toMatch(/natural pauses|short spoken sentences/i)
  })
})
