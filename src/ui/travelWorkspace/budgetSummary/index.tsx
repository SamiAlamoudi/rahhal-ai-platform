import type { BudgetSummaryModel, TravelWorkspaceLocale } from '../types'

export function BudgetSummary({
  budget,
  locale = 'ar',
}: {
  budget: BudgetSummaryModel
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-budget-summary" className="rahhal-tw-panel-card">
      <h2>{locale === 'en' ? 'Budget summary' : 'ملخص الميزانية'}</h2>
      <dl>
        <div>
          <dt>{locale === 'en' ? 'Total' : 'الإجمالي'}</dt>
          <dd>
            {budget.totalLabel} {budget.currencyCode}
          </dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Spent' : 'المصروف'}</dt>
          <dd>{budget.spentLabel}</dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Remaining' : 'المتبقي'}</dt>
          <dd>{budget.remainingLabel}</dd>
        </div>
      </dl>
    </section>
  )
}
