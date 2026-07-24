import type { DocumentItemModel, TravelWorkspaceLocale } from '../types'

const LABELS: Record<DocumentItemModel['kind'], { ar: string; en: string }> = {
  passport: { ar: 'جواز السفر', en: 'Passport' },
  visa: { ar: 'التأشيرة', en: 'Visa' },
  insurance: { ar: 'التأمين', en: 'Insurance' },
  hotel_voucher: { ar: 'قسيمة الفندق', en: 'Hotel voucher' },
  flight_ticket: { ar: 'تذكرة الطيران', en: 'Flight ticket' },
  meeting: { ar: 'مستندات الاجتماع', en: 'Meeting documents' },
  file: { ar: 'ملفات', en: 'Files' },
}

export function DocumentsPanel({
  documents,
  locale = 'ar',
}: {
  documents: DocumentItemModel[]
  locale?: TravelWorkspaceLocale
}) {
  return (
    <section data-testid="tw-documents-panel" className="rahhal-tw-section">
      <h2>{locale === 'en' ? 'Documents' : 'المستندات'}</h2>
      <ul className="rahhal-tw-docs">
        {documents.map((doc) => (
          <li
            key={doc.id}
            data-doc-kind={doc.kind}
            data-placeholder={doc.placeholder ? 'true' : 'false'}
          >
            {locale === 'en' ? LABELS[doc.kind].en : LABELS[doc.kind].ar}
          </li>
        ))}
      </ul>
    </section>
  )
}
