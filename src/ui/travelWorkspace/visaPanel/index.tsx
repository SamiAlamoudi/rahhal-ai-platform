import type { TravelWorkspaceLocale } from '../types'

/** Visa placeholder — no visa APIs. */
export function VisaPanel({ locale = 'ar' }: { locale?: TravelWorkspaceLocale }) {
  return (
    <section
      data-testid="tw-visa-panel"
      data-placeholder="true"
      className="rahhal-tw-panel-card"
    >
      <h2>{locale === 'en' ? 'Visa' : 'التأشيرة'}</h2>
      <p>{locale === 'en' ? 'Visa placeholder' : 'تأشيرة — واجهة فقط'}</p>
    </section>
  )
}
