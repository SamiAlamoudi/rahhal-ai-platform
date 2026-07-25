import type {
  TravelerDocumentCard,
  TravelerPassportCard,
  TravelerProfileLocale,
} from '../types'

export interface DocumentsPanelProps {
  travelDocuments: TravelerDocumentCard[]
  passports: TravelerPassportCard[]
  visaPlaceholder: string
  boardingPassPlaceholder: string
  locale: TravelerProfileLocale
}

export function DocumentsPanel({
  travelDocuments,
  passports,
  visaPlaceholder,
  boardingPassPlaceholder,
  locale,
}: DocumentsPanelProps) {
  return (
    <>
      <section
        className="rahhal-tp-panel"
        data-testid="tp-travel-documents"
        style={{ maxWidth: 'var(--rahhal-tp-max, 72rem)', marginInline: 'auto', marginBottom: '0.85rem' }}
      >
        <h2>{locale === 'en' ? 'Travel documents' : 'وثائق السفر'}</h2>
        <div className="rahhal-tp-grid" style={{ margin: '0.55rem 0 0' }}>
          {travelDocuments.map((doc) => (
            <article
              key={doc.id}
              className="rahhal-tp-card"
              data-testid="tp-document-card"
            >
              <strong>{doc.title}</strong>
              <span>{doc.subtitle}</span>
              <em>{doc.statusLabel}</em>
            </article>
          ))}
        </div>
      </section>

      <section
        className="rahhal-tp-panel"
        data-testid="tp-multiple-passports"
        style={{ maxWidth: 'var(--rahhal-tp-max, 72rem)', marginInline: 'auto', marginBottom: '0.85rem' }}
      >
        <h2>{locale === 'en' ? 'Multiple passports' : 'جوازات متعددة'}</h2>
        <div className="rahhal-tp-grid" style={{ margin: '0.55rem 0 0' }}>
          {passports.map((pp) => (
            <article
              key={pp.id}
              className="rahhal-tp-card"
              data-testid="tp-passport-card"
            >
              <strong>{pp.country}</strong>
              <span>{pp.numberMasked}</span>
              <em>{pp.expiresLabel}</em>
            </article>
          ))}
        </div>
      </section>

      <div className="rahhal-tp-layout">
        <section className="rahhal-tp-panel" data-testid="tp-visa">
          <h2>{locale === 'en' ? 'Visa' : 'التأشيرة'}</h2>
          <div className="rahhal-tp-placeholder">{visaPlaceholder}</div>
        </section>
        <section className="rahhal-tp-panel" data-testid="tp-boarding-pass">
          <h2>{locale === 'en' ? 'Boarding pass' : 'بطاقة الصعود'}</h2>
          <div className="rahhal-tp-placeholder">{boardingPassPlaceholder}</div>
        </section>
      </div>
    </>
  )
}
