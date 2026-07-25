import type { TravelerPreferenceChip, TravelerProfileLocale } from '../types'

export interface PreferencesPanelProps {
  travelPreferences: TravelerPreferenceChip[]
  preferredAirlines: TravelerPreferenceChip[]
  preferredHotels: TravelerPreferenceChip[]
  preferredSeat: string
  mealPreferences: TravelerPreferenceChip[]
  locale: TravelerProfileLocale
}

function ChipBlock({
  title,
  items,
  testId,
}: {
  title: string
  items: TravelerPreferenceChip[]
  testId: string
}) {
  return (
    <section className="rahhal-tp-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-tp-chips">
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

export function PreferencesPanel({
  travelPreferences,
  preferredAirlines,
  preferredHotels,
  preferredSeat,
  mealPreferences,
  locale,
}: PreferencesPanelProps) {
  return (
    <div className="rahhal-tp-grid">
      <ChipBlock
        title={locale === 'en' ? 'Travel preferences' : 'تفضيلات السفر'}
        items={travelPreferences}
        testId="tp-travel-preferences"
      />
      <ChipBlock
        title={locale === 'en' ? 'Preferred airlines' : 'شركات الطيران المفضلة'}
        items={preferredAirlines}
        testId="tp-preferred-airlines"
      />
      <ChipBlock
        title={locale === 'en' ? 'Preferred hotels' : 'الفنادق المفضلة'}
        items={preferredHotels}
        testId="tp-preferred-hotels"
      />
      <section className="rahhal-tp-panel" data-testid="tp-preferred-seat">
        <h2>{locale === 'en' ? 'Preferred seat' : 'المقعد المفضل'}</h2>
        <p>{preferredSeat}</p>
      </section>
      <ChipBlock
        title={locale === 'en' ? 'Meal preferences' : 'تفضيلات الوجبات'}
        items={mealPreferences}
        testId="tp-meal-preferences"
      />
    </div>
  )
}
