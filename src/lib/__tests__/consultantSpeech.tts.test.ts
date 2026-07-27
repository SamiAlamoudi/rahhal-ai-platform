import { describe, expect, it } from 'vitest'
import { generateLocalConversation } from '../agent/conversationBrain/localConversationModel'
import {
  polishConsultantProse,
  formatConsultantParagraphs,
  destinationLabel,
} from '../agent/conversationBrain/consultantLocale'
import { optimizeSpokenText, optimizeDisplayText } from '../agent/conversationBrain/conversationBrain'
import type { TravelFacts } from '../agent/conversationBrain/travelFacts'

describe('consultant Arabic speech', () => {
  it('local Morocco advise has no English inventory dump', () => {
    const facts = {
      locale: 'ar',
      objective: 'advise',
      known: {
        destination: 'Morocco',
        durationDays: 7,
        travelers: 2,
        travelerType: 'couple',
        budgetAmount: 10000,
        budgetCurrency: 'SAR',
      },
      missingSlots: [],
      planningDraft: {
        rankingNote: 'قراءة',
        cities: [
          { name: 'Marrakech', why: 'ثقافة وأسواق' },
          { name: 'Agadir', why: 'استرخاء وشاطئ' },
        ],
        tradeoffs: [],
        breakdown: {
          flights: { low: 1, high: 2, mid: 1, currency: 'SAR' },
          hotels: { low: 1, high: 2, mid: 1, currency: 'SAR' },
          food: { low: 1, high: 2, mid: 1, currency: 'SAR' },
          activities: { low: 1, high: 2, mid: 1, currency: 'SAR' },
          total: { low: 1, high: 2, mid: 1, currency: 'SAR' },
        },
      },
    } as unknown as TravelFacts

    const out = generateLocalConversation({
      facts,
      userMessage: 'أريد السفر إلى المغرب لمدة أسبوع مع زوجتي بميزانية عشرة آلاف ريال',
      conversationId: 'morocco-1',
    })

    const blob = `${out.displayText}\n${out.spokenText}`
    expect(blob).toMatch(/المغرب/)
    expect(blob).not.toMatch(/Morocco|SAR|Marrakech|Agadir|عندي:/i)
    expect(out.displayText).toMatch(/\n\n/)
    expect(out.spokenText.length).toBeGreaterThan(40)
  })

  it('polish strips English destination and currency tokens for ar', () => {
    expect(destinationLabel('Morocco', 'ar')).toBe('المغرب')
    expect(polishConsultantProse('Morocco, 7 days, SAR 10000', 'ar')).not.toMatch(/Morocco|SAR|days/i)
    expect(formatConsultantParagraphs('جملة أولى. جملة ثانية. جملة ثالثة. جملة رابعة.')).toContain('\n\n')
  })

  it('optimizeSpokenText + display polish Arabic dump', () => {
    const spoken = optimizeSpokenText('واضح — Morocco، 7 أيام، SAR.', 'fallback', 'ar')
    expect(spoken).not.toMatch(/Morocco|SAR/)
    expect(spoken).toMatch(/المغرب|ريال/)
    const display = optimizeDisplayText('Morocco trip\n\nbudget SAR', 'ar')
    expect(display).not.toMatch(/Morocco|SAR/)
  })
})
