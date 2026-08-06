/**
 * Bilamo Arabic Multidialect Intelligence — unit + e2e coverage.
 */

import { describe, expect, it } from 'vitest'
import {
  detectBilamoArabicDialect,
  listBilamoDialectIds,
  runBilamoArabicIntelligence,
  type BilamoArabicDialectId,
} from '../bilamo/arabic'
import {
  bilamoResultToTravelAgentTurn,
  extractBilamoEntities,
  emptyBilamoMemory,
  runBilamoIntelligenceTurn,
} from '../bilamo/intelligence'
import type { ChatMessage } from '../chat/chatTypes'

function msg(role: 'user' | 'assistant', content: string, providerMeta: Record<string, unknown> = {}): ChatMessage {
  const now = '2026-08-06T00:00:00.000Z'
  return {
    id: `${role}-${content.slice(0, 10)}`,
    conversationId: 'bilamo-dialect',
    role,
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta,
    createdAt: now,
    updatedAt: now,
  }
}

/** One natural travel request per supported dialect. */
const DIALECT_SAMPLES: Array<{
  dialect: BilamoArabicDialectId
  text: string
  expectDestination: RegExp
}> = [
  { dialect: 'saudi', text: 'أبغى أسافر لليابان أسبوع لشخصين من الرياض', expectDestination: /Japan|Tokyo|اليابان/i },
  { dialect: 'gulf', text: 'أبا أسافر دبي لمدة 5 أيام أنا وزوجتي يعطيكم العافية', expectDestination: /Dubai|دبي/i },
  { dialect: 'emirati', text: 'زين كذا نسافر باريس أسبوع عساك طيب لشخصين', expectDestination: /Paris|باريس/i },
  { dialect: 'kuwaiti', text: 'شنو نروح اسطنبول أسبوعين لشخصين', expectDestination: /Istanbul|اسطنبول/i },
  { dialect: 'qatari', text: 'ماشالله نسافر لندن 5 أيام لشخصين', expectDestination: /London|لندن/i },
  { dialect: 'bahraini', text: 'هالحين ودي أسافر القاهرة أسبوع لشخصين', expectDestination: /Cairo|القاهرة|Egypt/i },
  { dialect: 'omani', text: 'إن شاء الله طيب نسافر باريس أسبوع لشخصين', expectDestination: /Paris|باريس/i },
  { dialect: 'yemeni', text: 'يا خوي نسافر دبي أسبوع لشخصين', expectDestination: /Dubai|دبي/i },
  { dialect: 'egyptian', text: 'عايز أسافر تركيا أسبوع أنا وزوجتي', expectDestination: /Istanbul|Turkey|تركيا|اسطنبول/i },
  { dialect: 'levantine', text: 'بدي سافر باريس أسبوع بدنا اثنين', expectDestination: /Paris|باريس/i },
  { dialect: 'iraqi', text: 'شلونك أريد أروح اسطنبول أسبوع خوش لشخصين', expectDestination: /Istanbul|اسطنبول/i },
  { dialect: 'moroccan', text: 'بغيت نسافر باريس دابا أسبوع بزاف لشخصين', expectDestination: /Paris|باريس/i },
  { dialect: 'algerian', text: 'راني نسافر تونس أسبوع لشخصين', expectDestination: /Tunis|تونس/i },
  { dialect: 'tunisian', text: 'شنوة نسافر باريس برشة أسبوع لشخصين', expectDestination: /Paris|باريس/i },
  { dialect: 'sudanese', text: 'يا زول حا أمشي القاهرة أسبوع لشخصين', expectDestination: /Cairo|القاهرة|Egypt/i },
  { dialect: 'msa', text: 'أرغب في السفر إلى اليابان لمدة أسبوع لشخصين من الرياض', expectDestination: /Japan|Tokyo|اليابان/i },
]

describe('Bilamo Arabic dialect catalog', () => {
  it('lists every first-class supported dialect', () => {
    const ids = listBilamoDialectIds()
    for (const dialect of DIALECT_SAMPLES.map((s) => s.dialect)) {
      expect(ids).toContain(dialect)
    }
    expect(ids.length).toBeGreaterThanOrEqual(16)
  })
})

describe('Bilamo Arabic dialect detection', () => {
  it.each(DIALECT_SAMPLES.filter((s) => s.dialect !== 'msa'))(
    'detects $dialect from natural utterance',
    ({ dialect, text }) => {
      const detected = detectBilamoArabicDialect(text)
      expect(detected.dialect).toBe(dialect)
      expect(detected.source).toBe('detected')
      expect(detected.confidence).toBeGreaterThanOrEqual(0.42)
    },
  )

  it('defaults Latin / empty to MSA without forcing dialect', () => {
    expect(detectBilamoArabicDialect('Plan 5 days in Lisbon').source).toBe('latin')
    expect(detectBilamoArabicDialect('').dialect).toBe('msa')
  })
})

describe('Bilamo Arabic normalization', () => {
  it('maps dialect want verbs to canonical أريد / السفر', () => {
    const samples = ['أبغى أسافر', 'ودي أسافر', 'حاب أسافر', 'عايز أسافر', 'بدي أسافر', 'بغيت نسافر']
    for (const text of samples) {
      const result = runBilamoArabicIntelligence(text)
      expect(result.normalizedText).toMatch(/أريد|السفر/)
      expect(result.originalText).toBe(text)
      expect(result.applied.intent).toBe(true)
    }
  })

  it('normalizes traveler family / couple / infant wording', () => {
    const couple = runBilamoArabicIntelligence('أبي أسافر دبي أنا وزوجتي')
    expect(couple.hints.travelers).toBe(2)
    expect(couple.hints.travelerType).toBe('couple')
    expect(couple.normalizedText).toMatch(/لشخصين/)

    const family = runBilamoArabicIntelligence('ودي أسافر مع العائلة إلى باريس')
    expect(family.hints.travelerType).toBe('family')
    expect(family.hints.travelers).toBeGreaterThanOrEqual(3)

    const infant = runBilamoArabicIntelligence('بدي أسافر مع رضيع')
    expect(infant.hints.infants).toBe(1)
  })

  it('normalizes relative Arabic dates', () => {
    const cases = [
      ['بعد العيد', 'after_eid'],
      ['الأسبوع الجاي', 'next_week'],
      ['بعد أسبوعين', 'after_two_weeks'],
      ['آخر الشهر', 'end_of_month'],
      ['بداية أغسطس', 'early_august'],
      ['منتصف سبتمبر', 'mid_september'],
      ['نهاية السنة', 'end_of_year'],
      ['بكره بالليل', 'tomorrow_evening'],
      ['هذا الصيف', 'this_summer'],
    ] as const
    for (const [text, hint] of cases) {
      const result = runBilamoArabicIntelligence(`أريد السفر ${text}`)
      expect(result.hints.relativeDateHint).toBe(hint)
      expect(result.applied.dates).toBe(true)
    }
  })

  it('handles city variants, clitics, and missing hamza', () => {
    const result = runBilamoArabicIntelligence('أبغى أسافر للرياض و القاهره و دبى')
    expect(result.normalizedText).toMatch(/الرياض/)
    expect(result.normalizedText).toMatch(/القاهرة/)
    expect(result.normalizedText).toMatch(/دبي/)
  })

  it('strips diacritics without changing display original', () => {
    const raw = 'أُرِيدُ السَّفَرَ إِلَى بَارِيس'
    const result = runBilamoArabicIntelligence(raw)
    expect(result.originalText).toBe(raw)
    expect(result.normalizedText).not.toMatch(/[\u064B-\u065F]/)
  })
})

describe('Bilamo extraction uses normalized text (not dialect wording)', () => {
  it('extracts destination and travelers from Saudi dialect without re-asking destination', () => {
    const memory = emptyBilamoMemory('ar')
    const extracted = extractBilamoEntities({
      userText: 'أبغى أسافر لليابان أسبوع لشخصين من الرياض',
      memory,
    })
    expect(extracted.arabic.detection.dialect).toBe('saudi')
    expect(extracted.requirements.destination).toMatch(/Japan|Tokyo|اليابان/i)
    expect(extracted.requirements.travelers).toBe(2)
    expect(extracted.requirements.durationDays).toBe(7)
    expect(extracted.requirements.origin).toMatch(/Riyadh|الرياض|RUH/i)
  })
})

describe('Bilamo Arabic multidialect e2e', () => {
  it.each(DIALECT_SAMPLES)(
    '$dialect natural request reaches intelligence without dialect imitation',
    async ({ dialect, text, expectDestination }) => {
      const turn = await runBilamoIntelligenceTurn({
        conversationId: 'bilamo-dialect',
        userText: text,
        messages: [msg('user', text)],
      })
      expect(turn).not.toBeNull()
      expect(turn!.arabic?.detection.dialect).toBe(dialect)
      expect(String(turn!.requirements.destination || turn!.requirements.destinations[0] || '')).toMatch(
        expectDestination,
      )
      // Response stays clear modern Arabic / English — not dialect theatre.
      expect(turn!.displayText).not.toMatch(/عايز|بدّي|أبغى|شنو|بشحال|يا زول/)
      expect(turn!.askedSlot).not.toBe('destination')
      // Party size remembered when stated.
      if (/لشخصين|أنا وزوجتي|بدنا اثنين/.test(text)) {
        expect(turn!.requirements.travelers).toBe(2)
      }
    },
  )

  it('memory prevents duplicate destination questions after dialect turn', async () => {
    const firstText = 'عايز أسافر باريس أسبوع أنا وزوجتي'
    const first = await runBilamoIntelligenceTurn({
      conversationId: 'bilamo-dialect',
      userText: firstText,
      messages: [msg('user', firstText)],
    })
    expect(first).not.toBeNull()
    const turned = bilamoResultToTravelAgentTurn(first!)
    const follow = await runBilamoIntelligenceTurn({
      conversationId: 'bilamo-dialect',
      userText: 'ممكن نبكّر يوم؟',
      messages: [
        msg('user', firstText),
        msg('assistant', first!.displayText, turned.meta as unknown as Record<string, unknown>),
        msg('user', 'ممكن نبكّر يوم؟'),
      ],
    })
    expect(follow!.askedSlot).not.toBe('destination')
    expect(String(follow!.requirements.destination || '')).toMatch(/Paris|باريس/i)
    expect(follow!.requirements.travelers).toBe(2)
  })
})

describe('Bilamo Arabic intelligence performance', () => {
  it('normalizes dialect samples in negligible time', () => {
    const started = performance.now()
    for (let i = 0; i < 200; i += 1) {
      for (const sample of DIALECT_SAMPLES) {
        runBilamoArabicIntelligence(sample.text)
      }
    }
    const elapsed = performance.now() - started
    // 200 × 16 pure-regex passes should stay well under 250ms on CI.
    expect(elapsed).toBeLessThan(250)
  })
})
