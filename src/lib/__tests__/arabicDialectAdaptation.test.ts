import { describe, expect, it } from 'vitest'
import {
  ARABIC_DIALECT_CATALOG,
  buildDialectAdaptationInstructions,
  detectArabicDialect,
  resolveSpokenDialect,
} from '../chat/voice/arabicDialectAdaptation'
import { DEFAULT_VOICE_PREFS } from '../chat/voice/voiceExperiencePrefs'
import { buildConsultantConversationalInstructions } from '../chat/voice/consultantConversationalStyle'

describe('arabic dialect adaptation layer', () => {
  it('catalog covers required major dialects', () => {
    const ids = new Set(ARABIC_DIALECT_CATALOG.map((d) => d.id))
    for (const id of [
      'auto',
      'fusha',
      'saudi',
      'emirati',
      'kuwaiti',
      'qatari',
      'bahraini',
      'omani',
      'egyptian',
      'levantine',
      'iraqi',
      'yemeni',
      'moroccan',
      'algerian',
      'tunisian',
    ]) {
      expect(ids.has(id as never), id).toBe(true)
    }
  })

  it('defaults preference to auto (MSA when unknown)', () => {
    expect(DEFAULT_VOICE_PREFS.dialect).toBe('auto')
    const unknown = detectArabicDialect('أريد السفر الأسبوع القادم')
    expect(unknown.dialect).toBe('fusha')
    expect(unknown.source).toBe('default_msa')
  })

  it('detects Egyptian / Levantine / Saudi soft markers', () => {
    expect(detectArabicDialect('عايز أحجز تذكرة كده').dialect).toBe('egyptian')
    expect(detectArabicDialect('بدّي أسافر هلق كيفك').dialect).toBe('levantine')
    expect(detectArabicDialect('أبغى أرتب رحلتي وين تحب').dialect).toBe('saudi')
  })

  it('preference wins over detection unless auto', () => {
    const locked = resolveSpokenDialect({
      preference: 'fusha',
      utterance: 'عايز أحجز كده',
    })
    expect(locked.dialect).toBe('fusha')
    expect(locked.source).toBe('preference')

    const adapted = resolveSpokenDialect({
      preference: 'auto',
      utterance: 'عايز أحجز كده',
    })
    expect(adapted.dialect).toBe('egyptian')
    expect(adapted.source).toBe('detected')
  })

  it('instructions forbid fixed style, mixing, and stereotypes', () => {
    const block = buildDialectAdaptationInstructions({
      preference: 'auto',
      utterance: 'بدّي رحلة',
    })
    expect(block).toMatch(/Never mix unrelated dialects/i)
    expect(block).toMatch(/Modern Standard Arabic|فصحى|levantine|الشامية/i)
    expect(block).toMatch(/no exaggeration|stereotypes/i)

    const instructions = buildConsultantConversationalInstructions({
      dialect: 'auto',
      utterance: 'عايز أروح مصر',
    })
    expect(instructions).toMatch(/DIALECT ADAPTATION|Active dialect/i)
    expect(instructions).toMatch(/egyptian|المصرية/i)
  })
})
