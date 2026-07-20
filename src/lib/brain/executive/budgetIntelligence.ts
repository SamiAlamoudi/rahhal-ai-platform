/**
 * Phase 2 — Budget Intelligence.
 * Explainable budget fit warnings for executive recommendations.
 */

import type { TravelReasoningResult } from '../../agent/reasoning/types'
import type { AgentLocale } from '../../agent/types'
import type { ExecutiveContext } from './types'

export function collectBudgetWarnings(
  result: TravelReasoningResult,
  context: ExecutiveContext,
): string[] {
  if (context.budgetSar == null) return []

  const warnings: string[] = []
  const rows = [result.primary, ...result.alternatives, ...result.rejected].filter(Boolean)

  for (const row of rows) {
    if (!row) continue
    if (row.budgetFit === 'over') {
      const line = context.locale === 'ar'
        ? `${row.nameAr || row.name}: التكلفة التقديرية ≈ ${formatSar(row.estimatedTripCostSar)} — أعلى من ميزانيتك`
        : `${row.name} exceeds your budget (≈ ${formatSar(row.estimatedTripCostSar)} SAR)`
      if (!warnings.includes(line)) warnings.push(line)
    }
    if (row.budgetFit === 'tight' && context.budgetSensitivity === 'strict') {
      const line = context.locale === 'ar'
        ? `${row.nameAr || row.name}: قد تضيق الميزانية`
        : `${row.name} may be tight on your stated budget`
      if (!warnings.includes(line)) warnings.push(line)
    }
  }

  return warnings.slice(0, 4)
}

export function executiveBudgetLine(
  candidate: NonNullable<TravelReasoningResult['primary']>,
  locale: AgentLocale,
): string | null {
  if (candidate.budgetFit === 'over') {
    return locale === 'ar'
      ? `${candidate.nameAr || candidate.name} تتجاوز ميزانيتك`
      : `${candidate.name} exceeds your budget`
  }
  if (candidate.budgetFit === 'under' || candidate.budgetFit === 'fit') {
    return null
  }
  return null
}

function formatSar(value: number | null): string {
  if (value == null) return '?'
  return Math.round(value).toLocaleString('en-US')
}
