import type {
  TravelerProfileField,
  TravelerProfileLocale,
  TravelerPreferenceChip,
} from '../types'

export interface PersonalInfoPanelProps {
  personalInfo: TravelerProfileField[]
  languages: TravelerPreferenceChip[]
  currencies: TravelerPreferenceChip[]
  timeZone: string
  locale: TravelerProfileLocale
}

function ChipRow({
  items,
  testId,
}: {
  items: TravelerPreferenceChip[]
  testId: string
}) {
  return (
    <div className="rahhal-tp-chips" data-testid={testId}>
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
  )
}

export function PersonalInfoPanel({
  personalInfo,
  languages,
  currencies,
  timeZone,
  locale,
}: PersonalInfoPanelProps) {
  return (
    <div className="rahhal-tp-layout">
      <section className="rahhal-tp-panel" data-testid="tp-personal-info">
        <h2>
          {locale === 'en' ? 'Personal information' : 'المعلومات الشخصية'}
        </h2>
        <ul className="rahhal-tp-fields">
          {personalInfo.map((field) => (
            <li key={field.id}>
              <span>{field.label}</span>
              <strong>{field.value}</strong>
            </li>
          ))}
        </ul>
      </section>

      <div className="rahhal-tp-grid" style={{ margin: 0 }}>
        <section className="rahhal-tp-panel" data-testid="tp-languages">
          <h2>{locale === 'en' ? 'Languages' : 'اللغات'}</h2>
          <ChipRow items={languages} testId="tp-language-chips" />
        </section>
        <section className="rahhal-tp-panel" data-testid="tp-currencies">
          <h2>{locale === 'en' ? 'Currencies' : 'العملات'}</h2>
          <ChipRow items={currencies} testId="tp-currency-chips" />
        </section>
        <section className="rahhal-tp-panel" data-testid="tp-timezone">
          <h2>{locale === 'en' ? 'Time zone' : 'المنطقة الزمنية'}</h2>
          <p>{timeZone}</p>
        </section>
      </div>
    </div>
  )
}
