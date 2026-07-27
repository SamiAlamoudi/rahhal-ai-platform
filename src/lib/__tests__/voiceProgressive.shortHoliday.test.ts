import { describe, expect, it } from 'vitest'
import { extractFromUserText } from '../agent/extractRequirements'
import { generateLocalConversation } from '../agent/conversationBrain/localConversationModel'
import { takeNewSpokenChunks, takeSpokenTail, splitSpokenSentences } from '../chat/voice/progressiveSpeech'
import type { TravelFacts } from '../agent/conversationBrain/travelFacts'

describe('short holiday duration + progressive speech', () => {
  it('parses عطلة قصيرة as 3 days', () => {
    const result = extractFromUserText('عطلة قصيرة', 'ar')
    expect(result.patch.durationDays).toBe(3)
  })

  it('continues after short holiday answer instead of re-asking duration', () => {
    const facts = {
      locale: 'ar',
      objective: 'collect_missing',
      known: {
        destination: 'Istanbul',
        durationDays: 3,
        budgetAmount: null,
        budgetCurrency: null,
      },
      // Stale askFields must not force a duration re-ask.
      missingSlots: ['durationDays', 'budgetAmount'],
    } as unknown as TravelFacts

    const out = generateLocalConversation({
      facts,
      userMessage: 'عطلة قصيرة',
      conversationId: 'short-1',
    })
    const blob = `${out.displayText}\n${out.spokenText}`
    expect(blob).toMatch(/ميزانية|سقف|مرنة/)
    expect(blob).not.toMatch(/عطلة قصيرة، أم أسبوع/)
  })

  it('splits spoken sentences for progressive TTS', () => {
    const { ready, rest } = splitSpokenSentences('ممتاز، سأبني الرحلة. ما الميزانية؟')
    expect(ready.length).toBe(2)
    expect(rest).toBe('')

    const first = takeNewSpokenChunks('ممتاز، سأبني الرحلة. ما الميزانية؟', 0)
    expect(first.chunks[0]).toMatch(/ممتاز/)
    const tail = takeSpokenTail('ممتاز، سأبني الرحلة. ما الميزانية؟', first.nextCursor)
    expect(tail === '' || /ميزانية/.test(tail) || first.chunks.length >= 2).toBe(true)
  })
})

describe('istanbul phrasing', () => {
  it('extracts destination from أفكر أسافر إلى إسطنبول', () => {
    const result = extractFromUserText('أفكر أسافر إلى إسطنبول', 'ar')
    expect(result.patch.destination).toBe('Istanbul')
  })
})
