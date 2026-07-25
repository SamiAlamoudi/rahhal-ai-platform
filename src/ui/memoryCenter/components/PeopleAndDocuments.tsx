import type {
  MemoryCenterLocale,
  MemoryDocumentCard,
  MemoryPersonCard,
  MemoryPlaceItem,
} from '../types'

export interface PeopleAndDocumentsProps {
  familyMembers: MemoryPersonCard[]
  emergencyContacts: MemoryPersonCard[]
  passports: MemoryDocumentCard[]
  visaHistory: MemoryDocumentCard[]
  savedPlaces: MemoryPlaceItem[]
  savedTrips: MemoryPlaceItem[]
  locale: MemoryCenterLocale
}

function PersonGrid({
  title,
  items,
  testId,
}: {
  title: string
  items: MemoryPersonCard[]
  testId: string
}) {
  return (
    <section className="rahhal-mc-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-mc-grid" style={{ margin: '0.45rem 0 0' }}>
        {items.map((person) => (
          <article
            key={person.id}
            className="rahhal-mc-card"
            data-testid="mc-relationship-card"
          >
            <strong>{person.name}</strong>
            <em>{person.relation}</em>
          </article>
        ))}
      </div>
    </section>
  )
}

export function PeopleAndDocuments({
  familyMembers,
  emergencyContacts,
  passports,
  visaHistory,
  savedPlaces,
  savedTrips,
  locale,
}: PeopleAndDocumentsProps) {
  return (
    <>
      <div className="rahhal-mc-layout">
        <PersonGrid
          title={locale === 'en' ? 'Family members' : 'أفراد العائلة'}
          items={familyMembers}
          testId="mc-family-members"
        />
        <PersonGrid
          title={locale === 'en' ? 'Emergency contacts' : 'جهات الطوارئ'}
          items={emergencyContacts}
          testId="mc-emergency-contacts"
        />
      </div>

      <div className="rahhal-mc-layout">
        <section className="rahhal-mc-panel" data-testid="mc-passports">
          <h2>{locale === 'en' ? 'Passports' : 'الجوازات'}</h2>
          <div className="rahhal-mc-grid" style={{ margin: '0.45rem 0 0' }}>
            {passports.map((doc) => (
              <article key={doc.id} className="rahhal-mc-card">
                <strong>{doc.title}</strong>
                <em>{doc.statusLabel}</em>
              </article>
            ))}
          </div>
        </section>
        <section className="rahhal-mc-panel" data-testid="mc-visa-history">
          <h2>{locale === 'en' ? 'Visa history' : 'سجل التأشيرات'}</h2>
          <div className="rahhal-mc-grid" style={{ margin: '0.45rem 0 0' }}>
            {visaHistory.map((doc) => (
              <article key={doc.id} className="rahhal-mc-card">
                <strong>{doc.title}</strong>
                <em>{doc.statusLabel}</em>
              </article>
            ))}
          </div>
        </section>
      </div>

      <div className="rahhal-mc-layout">
        <section className="rahhal-mc-panel" data-testid="mc-saved-places">
          <h2>{locale === 'en' ? 'Saved places' : 'الأماكن المحفوظة'}</h2>
          <div className="rahhal-mc-grid" style={{ margin: '0.45rem 0 0' }}>
            {savedPlaces.map((p) => (
              <article key={p.id} className="rahhal-mc-card">
                <strong>{p.name}</strong>
                <em>{p.meta}</em>
              </article>
            ))}
          </div>
        </section>
        <section className="rahhal-mc-panel" data-testid="mc-saved-trips">
          <h2>{locale === 'en' ? 'Saved trips' : 'الرحلات المحفوظة'}</h2>
          <div className="rahhal-mc-grid" style={{ margin: '0.45rem 0 0' }}>
            {savedTrips.map((p) => (
              <article key={p.id} className="rahhal-mc-card">
                <strong>{p.name}</strong>
                <em>{p.meta}</em>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  )
}
