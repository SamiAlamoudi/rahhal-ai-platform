import type { TravelWorkspaceLocale } from '../types'

/** Map preview placeholder — no maps SDK / Amadeus geo. */
export function MapPreview({ locale = 'ar' }: { locale?: TravelWorkspaceLocale }) {
  return (
    <section
      data-testid="tw-map-preview"
      data-placeholder="true"
      className="rahhal-tw-map"
    >
      <h2>{locale === 'en' ? 'Map preview' : 'معاينة الخريطة'}</h2>
      <div className="rahhal-tw-map__canvas">
        {locale === 'en' ? 'Map placeholder' : 'خريطة — واجهة فقط'}
      </div>
    </section>
  )
}
