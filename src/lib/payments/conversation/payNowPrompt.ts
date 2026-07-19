/**
 * Sprint 34 — Conversation pay-now copy helpers.
 * No planning logic — formats totals already produced by UnifiedTravelPlanner / execution.
 */

import { isPaymentsPlatformEnabled } from '../PaymentFeatureFlags'
import type { SupportedCurrency } from '../types'

export interface PayNowOffer {
  summaryLine: string
  questionLine: string
  combinedText: string
  suggestedAction: {
    id: 'pay_now'
    label: string
    commandHint: string
  }
  total: number
  currency: SupportedCurrency | string
}

export function formatMoneyAmount(total: number, currency: string, locale: 'ar' | 'en'): string {
  const formatted = new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(Math.round(total))
  return `${formatted} ${currency}`
}

/**
 * Build the conversational offer:
 * "I found the best itinerary. The total is 5,320 SAR. Would you like to pay now?"
 */
export function buildPayNowOffer(input: {
  total: number
  currency: string
  locale?: 'ar' | 'en'
  itineraryFoundLine?: string
}): PayNowOffer {
  const locale = input.locale === 'ar' ? 'ar' : 'en'
  const money = formatMoneyAmount(input.total, input.currency, locale)

  if (locale === 'ar') {
    const summaryLine = input.itineraryFoundLine ?? 'وجدت أفضل خطة سفر لك.'
    const questionLine = `المجموع ${money}. هل تود الدفع الآن؟`
    return {
      summaryLine,
      questionLine,
      combinedText: `${summaryLine}\n\n${questionLine}`,
      suggestedAction: {
        id: 'pay_now',
        label: 'ادفع الآن',
        commandHint: 'Pay now',
      },
      total: input.total,
      currency: input.currency,
    }
  }

  const summaryLine = input.itineraryFoundLine ?? 'I found the best itinerary.'
  const questionLine = `The total is ${money}. Would you like to pay now?`
  return {
    summaryLine,
    questionLine,
    combinedText: `${summaryLine}\n\n${questionLine}`,
    suggestedAction: {
      id: 'pay_now',
      label: 'Pay now',
      commandHint: 'Pay now',
    },
    total: input.total,
    currency: input.currency,
  }
}

export function shouldOfferPayNow(options?: { paymentsPlatformEnabled?: boolean }): boolean {
  return isPaymentsPlatformEnabled(options)
}
