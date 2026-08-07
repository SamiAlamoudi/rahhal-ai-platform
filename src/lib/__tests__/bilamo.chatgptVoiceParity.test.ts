/**
 * ChatGPT-Voice parity architecture regressions (no fallback masking).
 */
import { describe, expect, it } from 'vitest'
import { resolveDestinationIdentity } from '../agent/destinationIdentity'
import {
  coerceReplyLocale,
  composeUncertainWordConfirm,
  replyLocaleToVoiceLocale,
} from '../bilamo/speech/localeBridge'
import { understandSpeechTurn } from '../bilamo/speech/speechUnderstanding'
import {
  shouldIgnoreOrbTapDuringVoiceSubmit,
  shouldRecoverStuckThinking,
} from '../bilamo/speech/voiceSubmitGate'
import { composeRecommendation } from '../bilamo/intelligence/consultantComposer'
import { emptyBilamoMemory } from '../bilamo/intelligence/smartMemory'
import { speechLangForLocale, normalizeVoiceLocale } from '../chat/voice/voiceTypes'

describe('destination identity — never invent a capital', () => {
  it('France stays France (not Paris)', () => {
    const id = resolveDestinationIdentity('france')
    expect(id?.country).toBe('France')
    expect(id?.city).toBeNull()
    expect(id?.label).toBe('France')
  })

  it('Paris stays Paris', () => {
    const id = resolveDestinationIdentity('باريس')
    expect(id?.city).toBe('Paris')
    expect(id?.label).toBe('Paris')
  })

  it('Italy stays Italy (not Rome)', () => {
    const id = resolveDestinationIdentity('Italy')
    expect(id?.country).toBe('Italy')
    expect(id?.city).toBeNull()
  })
})

describe('multilingual ASR locale bridge', () => {
  it('does not collapse Spanish/German/Turkish to Arabic', () => {
    expect(coerceReplyLocale('es', 'ar')).toBe('es')
    expect(coerceReplyLocale('de', 'ar')).toBe('de')
    expect(coerceReplyLocale('tr', 'en')).toBe('tr')
    expect(replyLocaleToVoiceLocale('es')).toBe('es')
    expect(speechLangForLocale('de')).toBe('de-DE')
    expect(speechLangForLocale('ja')).toBe('ja-JP')
    expect(normalizeVoiceLocale('hi')).toBe('hi')
  })

  it('understands French and Spanish without Arabic fallback', () => {
    const fr = understandSpeechTurn({
      transcript: 'Je veux partir à Bali la semaine prochaine.',
      previousLanguage: 'en',
    })
    expect(fr.language).toBe('fr')
    expect(replyLocaleToVoiceLocale(fr.language)).toBe('fr')

    const es = understandSpeechTurn({
      transcript: 'Quiero viajar a Bali la próxima semana.',
      previousLanguage: 'en',
    })
    expect(es.language).toBe('es')
  })
})

describe('confidence — confirm only uncertain word', () => {
  it('composeUncertainWordConfirm never repeats a full sentence', () => {
    const ar = composeUncertainWordConfirm('Bali', 'ar')
    expect(ar.spokenText).toMatch(/Bali/)
    expect(ar.spokenText.split(/\s+/).length).toBeLessThan(6)
    const en = composeUncertainWordConfirm('Bali', 'en')
    expect(en.spokenText).toBe('Bali?')
  })
})

describe('orb FSM — stuck thinking recovery without killing submit', () => {
  it('ignores orb only while submit/busy locked', () => {
    expect(shouldIgnoreOrbTapDuringVoiceSubmit({
      voiceSubmitInFlight: true,
      sendLocked: false,
      busy: false,
      voiceState: 'processing',
      orbState: 'thinking',
    })).toBe(true)
    expect(shouldIgnoreOrbTapDuringVoiceSubmit({
      voiceSubmitInFlight: false,
      sendLocked: false,
      busy: false,
      voiceState: 'processing',
      orbState: 'thinking',
    })).toBe(false)
  })

  it('recovers stuck thinking when no live submit', () => {
    expect(shouldRecoverStuckThinking({
      voiceSubmitInFlight: false,
      sendLocked: false,
      busy: false,
      voiceState: 'processing',
      orbState: 'thinking',
    })).toBe(true)
    expect(shouldRecoverStuckThinking({
      voiceSubmitInFlight: true,
      sendLocked: false,
      busy: false,
      voiceState: 'processing',
      orbState: 'thinking',
    })).toBe(false)
  })
})

describe('recommendation — cards not paragraphs', () => {
  it('composeRecommendation keeps a single short display line', () => {
    const copy = composeRecommendation({
      locale: 'en',
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
          reason: 'Best balance of price and comfort for this trip.',
          score: 92,
          kindLabel: 'Best overall',
          baggageSummary: '23kg',
        }],
        hotels: [{
          id: 'h1',
          name: 'Ubud Lodge',
          area: 'Ubud',
          rating: 4.7,
          nightsLabel: '5 nights',
          price: 1800,
          currency: 'SAR',
          reason: 'Calm location',
          score: 90,
        }],
        context: {
          weather: 'Warm and humid',
          visa: 'Check passport',
          currency: 'IDR',
          timeDifference: '+4h',
          transfer: 'Private car',
        },
        timeline: [],
      },
    })
    expect(copy.displayText.split(/\n/).length).toBe(1)
    expect(copy.displayText.length).toBeLessThan(80)
    expect(copy.spokenText.length).toBeLessThan(120)
  })
})
