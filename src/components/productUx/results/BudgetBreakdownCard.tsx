import type { BudgetPresentationView, ProductLocale } from '../../../lib/productUx'

const TIER_LABEL: Record<string, { ar: string; en: string }> = {
  budget: { ar: 'اقتصادي', en: 'Economical' },
  balanced: { ar: 'متوازن', en: 'Balanced' },
  premium: { ar: 'مميّز', en: 'Premium' },
  luxury: { ar: 'فاخر', en: 'Luxury' },
  best_value: { ar: 'أفضل قيمة', en: 'Best value' },
}

export interface BudgetBreakdownCardProps {
  budget: BudgetPresentationView
  locale?: ProductLocale
}

export function BudgetBreakdownCard({ budget, locale = 'ar' }: BudgetBreakdownCardProps) {
  const rows = [
    { label: locale === 'ar' ? 'الطيران' : 'Flights', value: budget.flights },
    { label: locale === 'ar' ? 'الفنادق' : 'Hotels', value: budget.hotels },
    { label: locale === 'ar' ? 'التنقل' : 'Transport', value: budget.transportation },
    { label: locale === 'ar' ? 'الوجبات' : 'Meals', value: budget.meals },
    { label: locale === 'ar' ? 'الأنشطة' : 'Activities', value: budget.activities },
    { label: locale === 'ar' ? 'الاحتياطي' : 'Reserve', value: budget.reserve },
  ]
  const tier = TIER_LABEL[budget.tier] ?? TIER_LABEL.balanced

  return (
    <section
      data-testid="budget-breakdown-card"
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
      aria-label={locale === 'ar' ? 'تفصيل الميزانية' : 'Budget breakdown'}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            {locale === 'ar' ? 'الميزانية' : 'Budget'}
          </h3>
          <p className="mt-0.5 text-[11px] font-semibold text-primary-700">{tier[locale]}</p>
        </div>
        <div className="text-end text-xs text-slate-500">
          {budget.totalBudget != null ? (
            <p>
              {locale === 'ar' ? 'الميزانية' : 'Budget'}: {budget.totalBudget} {budget.currency}
            </p>
          ) : null}
          <p className="text-sm font-bold text-slate-900">
            {budget.estimatedTotal} {budget.currency}
          </p>
          {budget.remaining != null ? (
            <p>
              {locale === 'ar' ? 'المتبقي' : 'Remaining'}: {budget.remaining} {budget.currency}
            </p>
          ) : null}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
        {rows.map((row) => (
          <li key={row.label} className="flex justify-between gap-3">
            <span>{row.label}</span>
            <span className="font-medium">
              {row.value} {budget.currency}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">
        {locale === 'ar' ? budget.tradeoffAr : budget.tradeoffEn}
      </p>
    </section>
  )
}
