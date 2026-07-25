import type {
  BookingDocumentCard,
  BookingHubLocale,
  BookingPriceRow,
  BookingTravelerAssignment,
} from '../types'

export interface DocumentsFinanceProps {
  visaStatus: BookingDocumentCard[]
  documents: BookingDocumentCard[]
  tickets: BookingDocumentCard[]
  invoices: BookingDocumentCard[]
  refunds: BookingDocumentCard[]
  paymentSummaryLabel: string
  travelerAssignments: BookingTravelerAssignment[]
  priceBreakdown: BookingPriceRow[]
  locale: BookingHubLocale
}

function DocBlock({
  title,
  items,
  testId,
}: {
  title: string
  items: BookingDocumentCard[]
  testId: string
}) {
  return (
    <section className="rahhal-bh-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-bh-grid" style={{ margin: '0.45rem 0 0' }}>
        {items.map((doc) => (
          <article key={doc.id} className="rahhal-bh-card">
            <strong>{doc.title}</strong>
            <em>{doc.statusLabel}</em>
          </article>
        ))}
      </div>
    </section>
  )
}

export function DocumentsFinance({
  visaStatus,
  documents,
  tickets,
  invoices,
  refunds,
  paymentSummaryLabel,
  travelerAssignments,
  priceBreakdown,
  locale,
}: DocumentsFinanceProps) {
  return (
    <>
      <div className="rahhal-bh-layout">
        <DocBlock
          title={locale === 'en' ? 'Visa status' : 'حالة التأشيرة'}
          items={visaStatus}
          testId="bh-visa-status"
        />
        <DocBlock
          title={locale === 'en' ? 'Documents' : 'المستندات'}
          items={documents}
          testId="bh-documents"
        />
      </div>
      <div className="rahhal-bh-grid">
        <DocBlock
          title={locale === 'en' ? 'Tickets' : 'التذاكر'}
          items={tickets}
          testId="bh-tickets"
        />
        <DocBlock
          title={locale === 'en' ? 'Invoices' : 'الفواتير'}
          items={invoices}
          testId="bh-invoices"
        />
        <DocBlock
          title={locale === 'en' ? 'Refunds' : 'الاستردادات'}
          items={refunds}
          testId="bh-refunds"
        />
      </div>

      <div className="rahhal-bh-layout">
        <section className="rahhal-bh-panel" data-testid="bh-payment-summary">
          <h2>{locale === 'en' ? 'Payment summary' : 'ملخص الدفع'}</h2>
          <p>{paymentSummaryLabel}</p>
        </section>
        <section
          className="rahhal-bh-panel"
          data-testid="bh-traveler-assignment"
        >
          <h2>
            {locale === 'en' ? 'Traveler assignment' : 'تعيين المسافرين'}
          </h2>
          <ul className="rahhal-bh-list">
            {travelerAssignments.map((row) => (
              <li key={row.id}>
                <span>{row.traveler}</span>
                <strong>{row.bookingLabel}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rahhal-bh-panel" data-testid="bh-price-breakdown">
        <h2>{locale === 'en' ? 'Price breakdown' : 'تفصيل السعر'}</h2>
        <ul className="rahhal-bh-breakdown">
          {priceBreakdown.map((row) => (
            <li key={row.id}>
              <div className="rahhal-bh-breakdown__row">
                <span>{row.label}</span>
                <strong>{row.amountLabel}</strong>
              </div>
              <div className="rahhal-bh-bar">
                <i style={{ width: `${row.percent}%` }} />
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
