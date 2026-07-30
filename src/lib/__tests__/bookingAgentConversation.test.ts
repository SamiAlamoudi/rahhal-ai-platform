import { describe, expect, it } from 'vitest'
import { buildConsultantConversationalInstructions } from '../chat/voice/consultantConversationalStyle'
import { RAHHAL_CONVERSATION_SYSTEM_PROMPT } from '../agent/conversationBrain/systemPrompt'
import { HARD_CLARIFICATION_FIELDS, SOFT_CLARIFICATION_FIELDS, missingClarificationFields } from '../agent/clarification/smartClarification'
import { emptyRequirements } from '../agent/types'
import { toSpokenDialogue } from '../chat/voice/spokenDialoguePostProcessor'

describe('booking-agent conversation design', () => {
  it('Realtime instructions identify Rahhal as a booking agent, not a blogger/consultant lecturer', () => {
    const instructions = buildConsultantConversationalInstructions({
      language: 'ar',
      utterance: 'أريد السفر إلى تايلند لمدة أسبوع',
      previousLanguage: 'ar',
      languageFallback: 'ar',
    })
    expect(instructions).toMatch(/BOOKING AGENT/i)
    expect(instructions).toMatch(/Collect → Search → Show options → Compare → Book/)
    expect(instructions).not.toMatch(/senior human travel consultant/i)
    expect(instructions).toMatch(/20–40 spoken words|20-40 spoken words/)
    expect(instructions).toMatch(/Never repeat the traveler/i)
    expect(instructions).toMatch(/I suggest|أنصحك/)
    expect(instructions).toMatch(/Sukhumvit|Chaweng|neighborhood/i)
    expect(instructions).toMatch(/origin city\/airport/)
    expect(instructions).toMatch(/traveler count/)
    expect(instructions).not.toMatch(/trip purpose.*approximate budget.*flight preferences/i)
  })

  it('chat system prompt is booking-agent shaped', () => {
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/BOOKING AGENT/i)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Collect → Search → Show options/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/20–40 spoken words/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).not.toMatch(/Executive AI Travel Consultant/)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Never praise-only|no Great\/Excellent/i)
    expect(RAHHAL_CONVERSATION_SYSTEM_PROMPT).toMatch(/Booking\.com|Kayak|Google Flights/)
  })

  it('required booking fields block search; budget does not', () => {
    expect(HARD_CLARIFICATION_FIELDS).toEqual(['destination', 'durationDays', 'travelers'])
    expect(SOFT_CLARIFICATION_FIELDS).toContain('budgetAmount')
    expect(HARD_CLARIFICATION_FIELDS).not.toContain('budgetAmount')

    const partial = emptyRequirements()
    partial.destination = 'Thailand'
    partial.durationDays = 7
    // travelers missing → still blocking
    expect(missingClarificationFields(partial, { smart: true })).toContain('travelers')

    partial.travelers = 2
    // budget missing must NOT block first search
    expect(missingClarificationFields(partial, { smart: true })).toEqual([])
  })

  it('spoken post-processor strips praise and unsolicited advice; stays short', () => {
    const praised = toSpokenDialogue(
      'ممتاز! رائع. أنصحك تحجز بدري مع شركات موثوقة في بانكوك وسوخومفيت. الآن ما رأيك؟',
      { locale: 'ar', context: 'confirmation', variationSeed: 'book-1' },
    )
    expect(praised).not.toMatch(/^ممتاز|^رائع/)
    expect(praised).not.toMatch(/أنصحك|احجز بدري|شركات موثوقة/)
    expect(praised.length).toBeLessThan(160)

    const english = toSpokenDialogue(
      'Great! I recommend you book early with trusted companies. You should visit Sukhumvit.',
      { locale: 'en', context: 'confirmation', variationSeed: 'book-en' },
    )
    expect(english).not.toMatch(/^Great/i)
    expect(english).not.toMatch(/I recommend|You should|Book early|trusted companies/i)
  })
})
