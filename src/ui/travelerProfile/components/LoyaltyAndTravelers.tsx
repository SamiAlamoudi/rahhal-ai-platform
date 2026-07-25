import type {
  TravelerContactCard,
  TravelerLoyaltyCard,
  TravelerProfileLocale,
  TravelerSavedTraveler,
} from '../types'

export interface LoyaltyAndTravelersProps {
  emergencyContacts: TravelerContactCard[]
  familyMembers: TravelerContactCard[]
  frequentFlyerPrograms: TravelerLoyaltyCard[]
  hotelLoyaltyPrograms: TravelerLoyaltyCard[]
  savedTravelers: TravelerSavedTraveler[]
  paymentMethodsPlaceholder: string
  locale: TravelerProfileLocale
}

function ContactGrid({
  items,
  testId,
}: {
  items: TravelerContactCard[]
  testId: string
}) {
  return (
    <div className="rahhal-tp-grid" style={{ margin: '0.55rem 0 0' }} data-testid={testId}>
      {items.map((c) => (
        <article key={c.id} className="rahhal-tp-card">
          <strong>{c.name}</strong>
          <span>{c.relation}</span>
          <em>{c.phoneMasked}</em>
        </article>
      ))}
    </div>
  )
}

function LoyaltyGrid({
  items,
  testId,
}: {
  items: TravelerLoyaltyCard[]
  testId: string
}) {
  return (
    <div className="rahhal-tp-grid" style={{ margin: '0.55rem 0 0' }} data-testid={testId}>
      {items.map((card) => (
        <article
          key={card.id}
          className="rahhal-tp-card"
          data-testid="tp-loyalty-card"
        >
          <strong>{card.program}</strong>
          <span>{card.tier}</span>
          <em>{card.pointsLabel}</em>
        </article>
      ))}
    </div>
  )
}

export function LoyaltyAndTravelers({
  emergencyContacts,
  familyMembers,
  frequentFlyerPrograms,
  hotelLoyaltyPrograms,
  savedTravelers,
  paymentMethodsPlaceholder,
  locale,
}: LoyaltyAndTravelersProps) {
  return (
    <>
      <div className="rahhal-tp-layout">
        <section className="rahhal-tp-panel" data-testid="tp-emergency-contacts">
          <h2>
            {locale === 'en' ? 'Emergency contacts' : 'جهات اتصال الطوارئ'}
          </h2>
          <ContactGrid items={emergencyContacts} testId="tp-emergency-list" />
        </section>
        <section className="rahhal-tp-panel" data-testid="tp-family-members">
          <h2>{locale === 'en' ? 'Family members' : 'أفراد العائلة'}</h2>
          <ContactGrid items={familyMembers} testId="tp-family-list" />
        </section>
      </div>

      <div className="rahhal-tp-layout">
        <section className="rahhal-tp-panel" data-testid="tp-frequent-flyer">
          <h2>
            {locale === 'en'
              ? 'Frequent flyer programs'
              : 'برامج المسافر المتكرر'}
          </h2>
          <LoyaltyGrid items={frequentFlyerPrograms} testId="tp-ff-list" />
        </section>
        <section className="rahhal-tp-panel" data-testid="tp-hotel-loyalty">
          <h2>
            {locale === 'en'
              ? 'Hotel loyalty programs'
              : 'برامج ولاء الفنادق'}
          </h2>
          <LoyaltyGrid items={hotelLoyaltyPrograms} testId="tp-hl-list" />
        </section>
      </div>

      <div className="rahhal-tp-layout">
        <section className="rahhal-tp-panel" data-testid="tp-saved-travelers">
          <h2>{locale === 'en' ? 'Saved travelers' : 'المسافرون المحفوظون'}</h2>
          <div className="rahhal-tp-grid" style={{ margin: '0.55rem 0 0' }}>
            {savedTravelers.map((st) => (
              <article key={st.id} className="rahhal-tp-card">
                <strong>{st.name}</strong>
                <span>{st.role}</span>
              </article>
            ))}
          </div>
        </section>
        <section className="rahhal-tp-panel" data-testid="tp-payment-methods">
          <h2>{locale === 'en' ? 'Payment methods' : 'طرق الدفع'}</h2>
          <div className="rahhal-tp-placeholder">{paymentMethodsPlaceholder}</div>
        </section>
      </div>
    </>
  )
}
