import { describe, expect, it } from 'vitest'
import {
  PHASE1_LANGUAGE_CODES,
  PHASE1_LANGUAGE_SCENARIOS,
  buildMultilingualInstructions,
  detectConversationLanguage,
  detectExplicitLanguageSwitch,
  resolveConversationLanguage,
  languageMeta,
} from '../chat/voice/conversationLanguageLayer'
import { buildConsultantConversationalInstructions } from '../chat/voice/consultantConversationalStyle'
import { DEFAULT_VOICE_PREFS } from '../chat/voice/voiceExperiencePrefs'

const PHASE1_SAMPLES: Record<string, {
  greeting: string
  flight: string
  hotel: string
  car: string
  date: string
  price: string
  second: string
}> = {
  ar: {
    greeting: 'السلام عليكم',
    flight: 'أبغى أحجز طيران لتركيا',
    hotel: 'أحتاج فندق خمس نجوم',
    car: 'أبي سيارة إيجار في المطار',
    date: 'من ١٥ أغسطس إلى ٢٢ أغسطس',
    price: 'الميزانية ٣٠٠٠ ريال',
    second: 'تمام وأيش عن الفندق؟',
  },
  en: {
    greeting: 'Hello there',
    flight: 'I want a flight to Istanbul',
    hotel: 'Looking for a hotel near the center',
    car: 'I need a rental car at the airport',
    date: 'From August 15 to August 22',
    price: 'Budget is about 800 EUR',
    second: 'Great — what about the hotel?',
  },
  fr: {
    greeting: 'Bonjour',
    flight: 'Je veux un vol pour Istanbul',
    hotel: 'Je cherche un hôtel au centre',
    car: 'Il me faut une voiture de location',
    date: 'Du 15 août au 22 août',
    price: 'Budget environ 800 euros',
    second: 'Parfait, et pour l\'hôtel ?',
  },
  es: {
    greeting: 'Hola',
    flight: 'Quiero un vuelo a Estambul',
    hotel: 'Busco un hotel en el centro',
    car: 'Necesito un coche de alquiler',
    date: 'Del 15 de agosto al 22 de agosto',
    price: 'Presupuesto de unos 800 euros',
    second: 'Perfecto, ¿y el hotel?',
  },
  de: {
    greeting: 'Hallo',
    flight: 'Ich brauche einen Flug nach Istanbul',
    hotel: 'Ich suche ein Hotel in der Nähe',
    car: 'Ich brauche einen Mietwagen am Flughafen',
    date: 'Vom 15. August bis 22. August',
    price: 'Budget etwa 800 Euro',
    second: 'Super, und das Hotel?',
  },
  it: {
    greeting: 'Ciao',
    flight: 'Voglio un volo per Istanbul',
    hotel: 'Cerco un albergo in centro',
    car: 'Mi serve un\'auto a noleggio',
    date: 'Dal 15 agosto al 22 agosto',
    price: 'Budget circa 800 euro',
    second: 'Perfetto, e l\'hotel?',
  },
  tr: {
    greeting: 'Merhaba',
    flight: 'İstanbul\'a uçuş istiyorum',
    hotel: 'Merkeze yakın otel arıyorum',
    car: 'Havalimanından kiralık araba lazım',
    date: '15 Ağustos\'tan 22 Ağustos\'a',
    price: 'Bütçe yaklaşık 800 euro',
    second: 'Harika, otel ne olacak?',
  },
}

describe('conversation language layer', () => {
  it('lists Phase 1 languages and scenario checklist', () => {
    expect(PHASE1_LANGUAGE_CODES.sort()).toEqual(
      ['ar', 'de', 'en', 'es', 'fr', 'it', 'tr'].sort(),
    )
    expect(PHASE1_LANGUAGE_SCENARIOS).toContain('mid_conversation_switch')
    expect(PHASE1_LANGUAGE_SCENARIOS).toContain('interruption')
    expect(DEFAULT_VOICE_PREFS.language).toBe('auto')
  })

  it('detects Phase 1 languages from natural samples', () => {
    for (const code of PHASE1_LANGUAGE_CODES) {
      const sample = PHASE1_SAMPLES[code]!
      expect(detectConversationLanguage(sample.greeting).language, code).toBe(code)
      expect(detectConversationLanguage(sample.flight).language, code).toBe(code)
    }
  })

  it('handles explicit mid-conversation language switch', () => {
    expect(detectExplicitLanguageSwitch("Let's continue in English.")).toBe('en')
    expect(detectExplicitLanguageSwitch('خلينا نكمل بالإنجليزي')).toBe('en')
    expect(detectExplicitLanguageSwitch('Parlons en français')).toBe('fr')

    const switched = resolveConversationLanguage({
      preference: 'auto',
      utterance: "Let's continue in English.",
      previousLanguage: 'ar',
    })
    expect(switched.language).toBe('en')
    expect(switched.source).toBe('explicit_switch')
    expect(switched.switched).toBe(true)
  })

  it('preserves trip-context instruction on language switch', () => {
    const { instructions, resolution } = buildMultilingualInstructions({
      preference: 'auto',
      utterance: "Let's continue in English.",
      previousLanguage: 'ar',
    })
    expect(resolution.switched).toBe(true)
    expect(instructions).toMatch(/WITHOUT losing destination, dates, travelers, budget/i)
    expect(instructions).toMatch(/proper names|airports|airlines|hotels/i)
    expect(instructions).toMatch(/Do NOT translate Arabic wording literally/i)
  })

  it('falls back politely for Phase 2 languages', () => {
    const r = resolveConversationLanguage({
      preference: 'auto',
      utterance: '日本語で話して',
      previousLanguage: 'en',
      fallbackPreference: 'en',
    })
    // Explicit Japanese switch is phase 2 → fallback
    const switchJa = resolveConversationLanguage({
      preference: 'auto',
      utterance: 'speak japanese please',
      previousLanguage: 'en',
      fallbackPreference: 'en',
    })
    expect(switchJa.fallbackTo).toBe('en')
    expect(switchJa.notFullyOptimized).toBe(true)
    expect(r.language === 'en' || r.language === 'ja').toBe(true)
  })

  it('does not mark Phase 1 languages production-ready until verified', () => {
    for (const code of PHASE1_LANGUAGE_CODES) {
      expect(languageMeta(code).productionReady, code).toBe(false)
    }
  })

  it('builds consultant instructions covering Phase 1 scenario intents per language', () => {
    for (const code of PHASE1_LANGUAGE_CODES) {
      const sample = PHASE1_SAMPLES[code]!
      for (const utterance of [
        sample.greeting,
        sample.flight,
        sample.hotel,
        sample.car,
        sample.date,
        sample.price,
        sample.second,
      ]) {
        const instructions = buildConsultantConversationalInstructions({
          language: 'auto',
          utterance,
          previousLanguage: code === 'ar' ? null : 'ar',
          dialect: 'auto',
        })
        expect(instructions, `${code}:${utterance}`).toMatch(/MULTILINGUAL CONVERSATION/)
        expect(instructions, `${code}:${utterance}`).toMatch(/Speak this turn in:/i)
        // Interruption discipline remains across languages
        expect(instructions).toMatch(/If interrupted/i)
      }
    }
  })

  it('settings override locks language until explicit switch', () => {
    const locked = resolveConversationLanguage({
      preference: 'fr',
      utterance: 'I want a flight',
      previousLanguage: 'fr',
    })
    expect(locked.language).toBe('fr')
    expect(locked.source).toBe('preference')

    const override = resolveConversationLanguage({
      preference: 'fr',
      utterance: 'speak english please',
      previousLanguage: 'fr',
    })
    expect(override.language).toBe('en')
    expect(override.source).toBe('explicit_switch')
  })
})
