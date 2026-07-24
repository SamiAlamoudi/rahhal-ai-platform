import type {
  InsightsBreakdownItem,
  InsightsCenterLocale,
} from '../types'

export function BudgetPanel({
  budgetTotalLabel,
  savingsLabel,
  costBreakdown,
  locale = 'ar',
}: {
  budgetTotalLabel: string
  savingsLabel: string
  costBreakdown: InsightsBreakdownItem[]
  locale?: InsightsCenterLocale
}) {
  return (
    <section data-testid="ic-budget" className="rahhal-ic-panel">
      <header>
        <h2>{locale === 'en' ? 'Budget overview' : 'نظرة على الميزانية'}</h2>
        <strong data-testid="ic-budget-total">{budgetTotalLabel}</strong>
      </header>
      <p data-testid="ic-savings">{savingsLabel}</p>
      <h3>{locale === 'en' ? 'Cost breakdown' : 'تفصيل التكاليف'}</h3>
      <ul className="rahhal-ic-breakdown" data-testid="ic-cost-breakdown">
        {costBreakdown.map((item) => (
          <li key={item.id}>
            <div className="rahhal-ic-breakdown__row">
              <span>{item.label}</span>
              <span>
                {item.amountLabel} · {item.percent}%
              </span>
            </div>
            <div
              className="rahhal-ic-bar"
              role="progressbar"
              aria-valuenow={item.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${item.percent}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <div
        className="rahhal-ic-chart"
        data-testid="ic-charts"
        data-placeholder="true"
      >
        {locale === 'en' ? 'Charts placeholder' : 'مخططات — واجهة'}
      </div>
    </section>
  )
}
