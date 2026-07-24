import type { TravelWorkspaceLocale } from '../types'

/** Currency placeholder — no FX APIs. */
export function CurrencyPanel({ locale = 'ar' }: { locale?: TravelWorkspaceLocale }) {
  return (
    <section
      data-testid="tw-currency-panel"
      data-placeholder="true"
      className="rahhal-tw-panel-card"
    >
      <h2>{locale === 'en' ? 'Currency' : 'العملة'}</h2>
      <p>{locale === 'en' ? 'Currency placeholder' : 'عملة — واجهة فقط'}</p>
    </section>
  )
}
