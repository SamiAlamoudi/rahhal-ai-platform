import { describe, expect, it } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import { RAHHAL_CONVERSATION_SYSTEM_PROMPT } from '../agent/conversationBrain/systemPrompt'
import { buildConsultantConversationalInstructions } from '../chat/voice/consultantConversationalStyle'
import { toSpokenDialogue } from '../chat/voice/spokenDialoguePostProcessor'
import { emptyRequirements } from '../agent/types'
import { missingClarificationFields } from '../agent/clarification/smartClarification'

/**
 * Architecture contract: one turn owner.
 * User speech → Final ASR → Intent extraction → Booking search → Results → One streamed response.
 */
describe('single-owner conversation pipeline', () => {
  it('acceptance utterance extracts origin, destination, dates, travelers, Business cabin', () => {
    const r = extractFromUserText(
      'Riyadh to Tokyo, 3 Aug to 13 Aug, two passengers, Business.',
    )
    expect(r.patch.origin).toBe('Riyadh')
    expect(r.patch.destination).toBe('Tokyo')
    expect(r.patch.destinations).toEqual(['Tokyo'])
    expect(r.patch.destinationCity).toBe('Tokyo')
    expect(r.patch.destinationCountry).toBe('Japan')
    expect(r.patch.startDate).toMatch(/-08-03$/)
    expect(r.patch.endDate).toMatch(/-08-13$/)
    expect(r.patch.travelers).toBe(2)
    expect(r.patch.cabinPreference).toBe('business')
    // Bare Business must NOT be treated as a work-trip purpose.
    expect(r.patch.tripPurpose).not.toBe('business')
  })

  it('bare Business / بزنس selects Business Class cabin', () => {
    expect(extractFromUserText('Business').patch.cabinPreference).toBe('business')
    expect(extractFromUserText('بزنس').patch.cabinPreference).toBe('business')
    expect(extractFromUserText('Business trip to London').patch.tripPurpose).toBe('business')
  })

  it('acceptance fields are search-ready (no hard clarification blockers)', () => {
    const r = extractFromUserText(
      'Riyadh to Tokyo, 3 Aug to 13 Aug, two passengers, Business.',
    )
    const req = { ...emptyRequirements(), ...r.patch }
    // Budget must not block; destination + dates + travelers are present.
    expect(missingClarificationFields(req, { smart: true })).toEqual([])
  })

  it('prompts ban website referrals and consultant lectures', () => {
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Booking\.com|Kayak|Google Flights/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Business Class|cabin/i)
    const instructions = buildConsultantConversationalInstructions({
      language: 'ar',
      utterance: 'من الرياض إلى طوكيو',
      previousLanguage: 'ar',
      languageFallback: 'ar',
    })
    expect(instructions).toMatch(/Booking\.com|Kayak|Google Flights/)
    expect(instructions).toMatch(/BOOKING AGENT/i)
    expect(instructions).not.toMatch(/senior human travel consultant/i)
  })

  it('spoken post-processor strips website referrals', () => {
    const spoken = toSpokenDialogue(
      'You can use Booking.com or Kayak to compare. Here are options.',
      { locale: 'en', context: 'recommendation', variationSeed: 'web-1' },
    )
    expect(spoken).not.toMatch(/Booking\.com|Kayak/i)
  })
})
