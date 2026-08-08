/**
 * Multilingual speech understanding + reply-language regressions.
 */
import { describe, expect, it } from 'vitest'
import { detectReplyLocale } from '../agent/locale'
import { extractBilamoEntities } from '../bilamo/intelligence/entityExtraction'
import { emptyBilamoMemory } from '../bilamo/intelligence/smartMemory'
import { composeGreeting, composeRecommendation } from '../bilamo/intelligence/consultantComposer'
import { understandSpeechTurn } from '../bilamo/speech/speechUnderstanding'
import { resolveDestinationIdentity } from '../agent/destinationIdentity'

describe('speech understanding — language + destinations', () => {
  it('French Bali next week with wife → FR + Bali + 2 travelers', () => {
    const text = 'Je veux partir à Bali la semaine prochaine avec ma femme.'
    const understood = understandSpeechTurn({ transcript: text, previousLanguage: 'ar' })
    expect(understood.language).toBe('fr')
    expect(understood.normalizedIntent).toMatch(/Bali|lang:fr/)

    const turn = extractBilamoEntities({
      userText: understood.normalizedForExtract || text,
      memory: emptyBilamoMemory('en'),
    })
    expect(String(turn.requirements.destination)).toMatch(/Bali/i)
    expect(turn.requirements.travelers).toBe(2)
    expect(turn.requirements.datesFlexible === true || turn.requirements.startDate != null).toBe(true)

    const greeting = composeGreeting('fr')
    expect(greeting.spokenText).toMatch(/Bonjour|voyage/i)
    expect(greeting.spokenText).not.toMatch(/[\u0600-\u06FF]/)
  })

  it('Arabic Japan next week with wife → AR + Japan + 2 travelers', () => {
    const text = 'أبغى أروح اليابان الأسبوع الجاي أنا وزوجتي'
    const understood = understandSpeechTurn({ transcript: text })
    expect(understood.language).toBe('ar')
    const turn = extractBilamoEntities({
      userText: understood.normalizedForExtract || text,
      memory: emptyBilamoMemory('ar'),
    })
    expect(String(turn.requirements.destination)).toMatch(/Japan|اليابان/i)
    expect(String(turn.requirements.destination)).not.toMatch(/Yemen|اليمن/i)
    expect(turn.requirements.travelers).toBe(2)
  })

  it('Moroccan Arabic Agadir preserved', () => {
    const text = 'بغيت نمشي لأكادير الأسبوع الجاي'
    const understood = understandSpeechTurn({ transcript: text })
    expect(understood.language).toBe('ar')
    const id = resolveDestinationIdentity(understood.normalizedForExtract || text)
    expect(id?.label).toMatch(/Agadir|أكادير/i)
  })

  it('English Paris next Friday stays English', () => {
    const text = 'I want to fly to Paris next Friday.'
    expect(detectReplyLocale(text)).toBe('en')
    const turn = extractBilamoEntities({
      userText: text,
      memory: emptyBilamoMemory('en'),
    })
    expect(String(turn.requirements.destination)).toMatch(/Paris/i)
    const greeting = composeGreeting('en')
    expect(greeting.spokenText).toMatch(/Welcome|Where/i)
    expect(greeting.spokenText).not.toMatch(/[\u0600-\u06FF]/)
  })

  it('two-turn language switch FR → AR', () => {
    const fr = understandSpeechTurn({
      transcript: 'Bonjour, je voudrais aller à Bali la semaine prochaine.',
      previousLanguage: 'en',
    })
    expect(fr.language).toBe('fr')
    const ar = understandSpeechTurn({
      transcript: 'أريد السفر إلى اليابان الأسبوع القادم.',
      previousLanguage: fr.language,
    })
    expect(ar.language).toBe('ar')
    expect(composeGreeting(ar.language).spokenText).toMatch(/[\u0600-\u06FF]/)
  })

  it('French recommendation copy stays French', () => {
    const copy = composeRecommendation({
      locale: 'fr',
      assumedSolo: false,
      requirements: {
        ...emptyBilamoMemory('en').agent.requirements,
        destination: 'Bali',
        destinations: ['Bali'],
        travelers: 2,
      },
      search: {
        flights: [{
          id: 'f1',
          airline: 'Garuda',
          origin: 'RUH',
          destination: 'DPS',
          departTime: '10:00',
          arriveTime: '22:00',
          duration: '12h',
          stopsLabel: '1 stop',
          price: 3200,
          currency: 'SAR',
          reason: 'Best overall timing.',
          score: 0.9,
        }],
        hotels: [],
        timeline: [],
        context: { weather: null, visa: null, currency: null, timeDifference: null, transfer: null },
        flightsMeta: { mode: 'demo', error: null, stale: false, bestScore: 0.9 },
      },
    })
    expect(copy.spokenText).toMatch(/Bali|Garuda|options/i)
    expect(copy.spokenText).not.toMatch(/[\u0600-\u06FF]/)
    expect(copy.displayText).not.toMatch(/هذا ما أختاره/)
  })

  it('strips English ASR pollution without changing Arabic destination', () => {
    const understood = understandSpeechTurn({
      transcript: 'أريد السفر Down إلى اليمن',
    })
    expect(understood.displayTranscript).not.toMatch(/Down/i)
    expect(understood.normalizedForExtract).toMatch(/اليمن/)
    expect(understood.normalizedForExtract).not.toMatch(/Japan|اليابان/)
  })
})
