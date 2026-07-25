import type {
  MemoryCenterLocale,
  MemoryPlaceItem,
  MemoryPreferenceChip,
  MemoryStatCard,
} from '../types'

export interface PlacesAndPreferencesProps {
  knownDestinations: MemoryPlaceItem[]
  favoriteCountries: MemoryPlaceItem[]
  favoriteCities: MemoryPlaceItem[]
  favoriteHotels: MemoryPlaceItem[]
  favoriteAirlines: MemoryPlaceItem[]
  travelPreferences: MemoryPreferenceChip[]
  seatPreferences: MemoryPreferenceChip[]
  mealPreferences: MemoryPreferenceChip[]
  budgetHistory: MemoryStatCard[]
  locale: MemoryCenterLocale
}

function PlaceGrid({
  title,
  items,
  testId,
}: {
  title: string
  items: MemoryPlaceItem[]
  testId: string
}) {
  return (
    <section className="rahhal-mc-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-mc-grid" style={{ margin: '0.45rem 0 0' }}>
        {items.map((item) => (
          <article
            key={item.id}
            className="rahhal-mc-card"
            data-testid="mc-knowledge-card"
          >
            <strong>{item.name}</strong>
            <em>{item.meta}</em>
          </article>
        ))}
      </div>
    </section>
  )
}

function ChipBlock({
  title,
  items,
  testId,
}: {
  title: string
  items: MemoryPreferenceChip[]
  testId: string
}) {
  return (
    <section className="rahhal-mc-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-mc-chips">
        {items.map((chip) => (
          <span
            key={chip.id}
            className={chip.active ? 'is-active' : undefined}
            data-active={chip.active ? 'true' : 'false'}
          >
            {chip.label}
          </span>
        ))}
      </div>
    </section>
  )
}

export function PlacesAndPreferences({
  knownDestinations,
  favoriteCountries,
  favoriteCities,
  favoriteHotels,
  favoriteAirlines,
  travelPreferences,
  seatPreferences,
  mealPreferences,
  budgetHistory,
  locale,
}: PlacesAndPreferencesProps) {
  return (
    <>
      <PlaceGrid
        title={locale === 'en' ? 'Known destinations' : 'الوجهات المعروفة'}
        items={knownDestinations}
        testId="mc-known-destinations"
      />
      <div className="rahhal-mc-layout">
        <PlaceGrid
          title={locale === 'en' ? 'Favorite countries' : 'الدول المفضلة'}
          items={favoriteCountries}
          testId="mc-favorite-countries"
        />
        <PlaceGrid
          title={locale === 'en' ? 'Favorite cities' : 'المدن المفضلة'}
          items={favoriteCities}
          testId="mc-favorite-cities"
        />
      </div>
      <div className="rahhal-mc-layout">
        <PlaceGrid
          title={locale === 'en' ? 'Favorite hotels' : 'الفنادق المفضلة'}
          items={favoriteHotels}
          testId="mc-favorite-hotels"
        />
        <PlaceGrid
          title={locale === 'en' ? 'Favorite airlines' : 'شركات الطيران المفضلة'}
          items={favoriteAirlines}
          testId="mc-favorite-airlines"
        />
      </div>

      <div className="rahhal-mc-grid">
        <ChipBlock
          title={locale === 'en' ? 'Travel preferences' : 'تفضيلات السفر'}
          items={travelPreferences}
          testId="mc-travel-preferences"
        />
        <ChipBlock
          title={locale === 'en' ? 'Seat preferences' : 'تفضيلات المقعد'}
          items={seatPreferences}
          testId="mc-seat-preferences"
        />
        <ChipBlock
          title={locale === 'en' ? 'Meal preferences' : 'تفضيلات الوجبات'}
          items={mealPreferences}
          testId="mc-meal-preferences"
        />
      </div>

      <section className="rahhal-mc-panel" data-testid="mc-budget-history">
        <h2>{locale === 'en' ? 'Budget history' : 'سجل الميزانية'}</h2>
        <div className="rahhal-mc-grid" style={{ margin: '0.45rem 0 0' }}>
          {budgetHistory.map((row) => (
            <article key={row.id} className="rahhal-mc-card">
              <span>{row.label}</span>
              <strong>{row.value}</strong>
            </article>
          ))}
        </div>
        <div
          className="rahhal-mc-meter"
          data-testid="mc-progress-indicator"
          style={{ marginTop: '0.75rem' }}
        >
          <i style={{ width: '72%' }} />
        </div>
      </section>
    </>
  )
}
