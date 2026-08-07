/**
 * Root-cause regressions: voice submit must not be killed by orb/soft-stop races.
 */
import { describe, expect, it } from 'vitest'
import { understandSpeechTurn } from '../bilamo/speech/speechUnderstanding'
import {
  shouldBargeInFromOrb,
  shouldIgnoreOrbTapDuringVoiceSubmit,
} from '../bilamo/speech/voiceSubmitGate'
import { sanitizeArabicVoiceTranscript } from '../chat/voice/sanitizeArabicVoiceTranscript'

describe('voice submit race (real-device second-tap drop)', () => {
  it('ignores orb tap while voice submit is in flight (processing, not yet busy)', () => {
    expect(
      shouldIgnoreOrbTapDuringVoiceSubmit({
        voiceSubmitInFlight: true,
        sendLocked: false,
        busy: false,
        voiceState: 'processing',
        orbState: 'thinking',
      }),
    ).toBe(true)
  })

  it('does not barge-in during processing submit (former stuck-recovery bug)', () => {
    expect(
      shouldBargeInFromOrb({
        voiceSubmitInFlight: true,
        sendLocked: false,
        busy: false,
        voiceState: 'processing',
        orbState: 'thinking',
      }),
    ).toBe(false)
  })

  it('allows barge-in only while actually speaking', () => {
    expect(
      shouldBargeInFromOrb({
        voiceSubmitInFlight: false,
        sendLocked: false,
        busy: false,
        voiceState: 'speaking',
        orbState: 'speaking',
      }),
    ).toBe(true)
  })
})

describe('French / Latin must not be emptied by Arabic sanitizer', () => {
  it('understandSpeechTurn keeps French Bali utterance intact', () => {
    const text = 'Je veux partir à Bali la semaine prochaine avec ma femme.'
    // Arabic sanitizer alone would risk stripping/emptying short Latin tokens.
    expect(sanitizeArabicVoiceTranscript('à Bali')).toBeFalsy()
    const understood = understandSpeechTurn({ transcript: text, previousLanguage: 'en' })
    expect(understood.language).toBe('fr')
    expect(understood.displayTranscript).toMatch(/Bali/i)
    expect(understood.normalizedForExtract).toMatch(/Bali/i)
    expect(understood.normalizedForExtract.length).toBeGreaterThan(10)
  })
})
