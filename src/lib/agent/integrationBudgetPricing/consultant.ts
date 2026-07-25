/**
 * Integration Sprint 9 — natural financial consultant summaries.
 */

import { formatMoney } from './currency'
import type { BudgetPricingResult } from './types'

export function buildBudgetPricingSummary(
  result: Pick<
    BudgetPricingResult,
    'intent' | 'envelope' | 'breakdown' | 'tradeoffs' | 'primary' | 'flexible' | 'options'
  >,
): { en: string; ar: string } {
  const envelope = result.envelope
  const breakdown = result.breakdown
  const primary = result.primary

  if (!envelope || !breakdown) {
    return {
      en: 'Share your budget (e.g. SAR 6000) and I’ll build a financial plan with trade-offs.',
      ar: 'شارك ميزانيتك (مثل 6000 ر.س) وسأبني خطة مالية مع المقايضات.',
    }
  }

  const trade = result.tradeoffs[0]
  const flex = result.flexible[0]
  const enParts = [
    primary
      ? `I’d steer toward ${primary.labelEn} (score ${primary.score}/100) · est. ${formatMoney(breakdown.estimatedTotal, breakdown.currency)}.`
      : `Estimated trip spend ~${formatMoney(breakdown.estimatedTotal, breakdown.currency)}.`,
    `Envelope: ${formatMoney(envelope.total.amount, envelope.total.currency)} total · ${formatMoney(envelope.perDay.amount, envelope.total.currency)}/day · reserve ${formatMoney(envelope.emergencyReserve.amount, envelope.total.currency)}.`,
    trade ? trade.detailEn : null,
    !breakdown.withinBudget && flex
      ? `If needed: ${flex.titleEn} could save ~${formatMoney(flex.estimatedSavings, flex.currency)}.`
      : null,
  ].filter(Boolean)

  const arParts = [
    primary
      ? `أميل إلى ${primary.labelAr} (درجة ${primary.score}/100) · تقدير ${formatMoney(breakdown.estimatedTotal, breakdown.currency)}.`
      : `تقدير إنفاق الرحلة نحو ${formatMoney(breakdown.estimatedTotal, breakdown.currency)}.`,
    `الإطار: ${formatMoney(envelope.total.amount, envelope.total.currency)} إجمالي · ${formatMoney(envelope.perDay.amount, envelope.total.currency)}/يوم · احتياطي ${formatMoney(envelope.emergencyReserve.amount, envelope.total.currency)}.`,
    trade ? trade.detailAr : null,
    !breakdown.withinBudget && flex
      ? `عند الحاجة: ${flex.titleAr} قد يوفّر نحو ${formatMoney(flex.estimatedSavings, flex.currency)}.`
      : null,
  ].filter(Boolean)

  return { en: enParts.join(' '), ar: arParts.join(' ') }
}
