import { describe, expect, it } from 'vitest'
import {
  generateLocalConversation,
  looksLikeDeadEndAck,
  nextHardSlot,
} from '../agent/conversationBrain/localConversationModel'
import { optimizeDisplayText, optimizeSpokenText } from '../agent/conversationBrain/conversationBrain'
import type { TravelFacts } from '../agent/conversationBrain/travelFacts'

function baseFacts(over: Partial<TravelFacts> & { known?: TravelFacts['known'] }): TravelFacts {
  return {
    locale: 'ar',
    objective: 'advise',
    known: {
      destination: null,
      destinations: [],
      durationDays: null,
      travelers: null,
      travelerType: null,
      budgetAmount: null,
      budgetCurrency: null,
      origin: null,
      ...(over.known ?? {}),
    },
    missingSlots: over.missingSlots ?? [],
    ...over,
  } as TravelFacts
}

describe('destination confirm continuation', () => {
  it('never returns bare Istanbul ack — asks next slot', () => {
    const facts = baseFacts({
      objective: 'advise',
      known: { destination: 'Istanbul' },
      missingSlots: [],
    })
    const out = generateLocalConversation({
      facts,
      userMessage: 'إسطنبول',
      conversationId: 'istanbul-1',
    })
    const blob = `${out.displayText}\n${out.spokenText}`
    expect(blob).toMatch(/إسطنبول/)
    expect(blob).toMatch(/[؟?]|أسبوع|يوم|ميزانية|تميلون|مغادرة/)
    expect(looksLikeDeadEndAck(out.displayText, 'ar')).toBe(false)
    expect(looksLikeDeadEndAck(out.spokenText, 'ar')).toBe(false)
  })

  it('nextHardSlot prefers duration after destination', () => {
    expect(nextHardSlot(baseFacts({ known: { destination: 'Istanbul' }, missingSlots: [] }))).toBe(
      'durationDays',
    )
  })

  it('flags dead-end ack', () => {
    expect(looksLikeDeadEndAck('حسنًا، نركز على إسطنبول.', 'ar')).toBe(true)
    expect(
      looksLikeDeadEndAck(
        'ممتاز، سأبني الرحلة على إسطنبول.\n\nلـإسطنبول، هل تفكّرون في عطلة قصيرة، أم أسبوع كامل تقريباً؟',
        'ar',
      ),
    ).toBe(false)
  })

  it('optimize path replaces dead-end via local guard pattern', () => {
    const spoken = optimizeSpokenText(
      'ممتاز، سأبني الرحلة على إسطنبول. لـإسطنبول، هل تفكّرون في عطلة قصيرة، أم أسبوع كامل تقريباً؟',
      'fallback',
      'ar',
    )
    expect(spoken).toMatch(/إسطنبول/)
    expect(optimizeDisplayText('حسنًا — نركز على إسطنبول.', 'ar')).toMatch(/إسطنبول/)
  })
})
