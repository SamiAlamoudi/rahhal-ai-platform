import type { InsightsCenterLocale, InsightsPlaceItem } from '../types'

export function PlacesPanel({
  countries,
  cities,
  airlines,
  hotels,
  locale = 'ar',
}: {
  countries: InsightsPlaceItem[]
  cities: InsightsPlaceItem[]
  airlines: InsightsPlaceItem[]
  hotels: InsightsPlaceItem[]
  locale?: InsightsCenterLocale
}) {
  return (
    <div className="rahhal-ic-places" data-testid="ic-places">
      <PlaceList
        testId="ic-countries"
        title={locale === 'en' ? 'Visited countries' : 'الدول المزارة'}
        items={countries}
      />
      <PlaceList
        testId="ic-cities"
        title={locale === 'en' ? 'Visited cities' : 'المدن المزارة'}
        items={cities}
      />
      <PlaceList
        testId="ic-airlines"
        title={locale === 'en' ? 'Favorite airlines' : 'شركات الطيران المفضلة'}
        items={airlines}
      />
      <PlaceList
        testId="ic-hotels"
        title={locale === 'en' ? 'Favorite hotels' : 'الفنادق المفضلة'}
        items={hotels}
      />
      <section
        className="rahhal-ic-panel"
        data-testid="ic-heatmap"
        data-placeholder="true"
      >
        <h2>{locale === 'en' ? 'Heat map' : 'خريطة حرارية'}</h2>
        <p>{locale === 'en' ? 'Heat map placeholder' : 'خريطة حرارية — واجهة'}</p>
      </section>
    </div>
  )
}

function PlaceList({
  title,
  items,
  testId,
}: {
  title: string
  items: InsightsPlaceItem[]
  testId: string
}) {
  return (
    <section className="rahhal-ic-panel" data-testid={testId}>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.name} · {item.count}
          </li>
        ))}
      </ul>
    </section>
  )
}
