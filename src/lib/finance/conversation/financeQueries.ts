/**
 * Sprint 41 — Conversation helpers for finance / revenue / settlement queries.
 */

import { isFinancePlatformEnabled } from '../FinanceFeatureFlags'
import type { FinancePlatform } from '../FinancePlatform'

export type FinanceConversationQueryKind =
  | 'finance_revenue_month'
  | 'finance_profit_destination'
  | 'finance_highest_margin_supplier'
  | 'finance_unpaid_settlements'
  | 'finance_refund_losses'
  | 'finance_vat_report'

export function detectFinanceConversationQuery(
  userText: string,
): FinanceConversationQueryKind | null {
  const lower = userText.toLowerCase().trim()

  if (
    /how much revenue|revenue (did|this month)|rahhal generate.*revenue|generate this month/.test(
      lower,
    )
    || /كم الإيرادات|إيرادات هذا الشهر/.test(lower)
  ) {
    return 'finance_revenue_month'
  }
  if (
    /profit from|our profit|profit (in|for)|what was our profit/.test(lower)
    || /ربح من|أرباح/.test(lower)
  ) {
    return 'finance_profit_destination'
  }
  if (
    /highest margin|produced the highest margin|supplier.*highest margin|best margin/.test(lower)
    || /أعلى هامش|أعلى ربحية/.test(lower)
  ) {
    return 'finance_highest_margin_supplier'
  }
  if (
    /unpaid settlements?|show unpaid|outstanding settlements?/.test(lower)
    || /تسويات غير مدفوعة|التسويات المعلقة/.test(lower)
  ) {
    return 'finance_unpaid_settlements'
  }
  if (
    /refund losses?|show refund loss/.test(lower)
    || /خسائر الاسترداد|خسائر الاسترجاع/.test(lower)
  ) {
    return 'finance_refund_losses'
  }
  if (
    /how much vat|vat should be reported|vat (report|payable)|gst (report|payable)/.test(lower)
    || /ضريبة القيمة المضافة|كم ضريبة/.test(lower)
  ) {
    return 'finance_vat_report'
  }
  return null
}

export function extractDestinationFromFinanceQuery(userText: string): string {
  const fromMatch = userText.match(/profit from\s+([A-Za-z\u0600-\u06FF]+)/i)
  if (fromMatch?.[1]) return fromMatch[1]
  const known = ['Paris', 'Dubai', 'London', 'Tokyo', 'Riyadh', 'Cairo']
  for (const city of known) {
    if (userText.toLowerCase().includes(city.toLowerCase())) return city
  }
  return 'Paris'
}

export function answerFinanceQuery(input: {
  kind: FinanceConversationQueryKind
  platform: FinancePlatform
  userText?: string
  currency?: string
}): string {
  const currency = input.currency ?? 'SAR'
  switch (input.kind) {
    case 'finance_revenue_month':
      return input.platform.answerRevenueThisMonth(currency)
    case 'finance_profit_destination':
      return input.platform.answerProfitFromDestination(
        extractDestinationFromFinanceQuery(input.userText ?? ''),
        currency,
      )
    case 'finance_highest_margin_supplier':
      return input.platform.answerHighestMarginSupplier(currency)
    case 'finance_unpaid_settlements':
      return input.platform.answerUnpaidSettlements(currency)
    case 'finance_refund_losses':
      return input.platform.answerRefundLosses(currency)
    case 'finance_vat_report':
      return input.platform.answerVatReport(currency)
    default:
      return 'I could not answer that finance question.'
  }
}

export function shouldHandleFinanceQueries(options?: {
  financePlatformEnabled?: boolean
}): boolean {
  return isFinancePlatformEnabled(options)
}
