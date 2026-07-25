import type {
  OperationsCenterLocale,
  OperationsIncidentCard,
  OperationsPriority,
  OperationsQueueCard,
  OperationsTravelerCard,
} from '../types'

export interface QueuesAndIncidentsProps {
  travelerRequests: OperationsTravelerCard[]
  supportQueue: OperationsQueueCard[]
  incidents: OperationsIncidentCard[]
  emergencyItems: OperationsIncidentCard[]
  approvalQueue: OperationsQueueCard[]
  bookingQueue: OperationsQueueCard[]
  visaQueue: OperationsQueueCard[]
  notificationsQueue: OperationsQueueCard[]
  locale: OperationsCenterLocale
}

function PriorityChip({
  priority,
}: {
  priority: OperationsPriority
}) {
  return (
    <div className="rahhal-oc-chips">
      <span
        className={
          priority === 'high' || priority === 'critical'
            ? `is-${priority}`
            : undefined
        }
      >
        {priority}
      </span>
    </div>
  )
}

function QueueBlock({
  title,
  items,
  testId,
}: {
  title: string
  items: OperationsQueueCard[]
  testId: string
}) {
  return (
    <section className="rahhal-oc-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-oc-grid" style={{ margin: '0.45rem 0 0' }}>
        {items.map((item) => (
          <article
            key={item.id}
            className="rahhal-oc-card"
            data-testid="oc-queue-card"
          >
            <strong>{item.title}</strong>
            <span>{item.meta}</span>
            <em>{item.countLabel}</em>
            <PriorityChip priority={item.priority} />
          </article>
        ))}
      </div>
    </section>
  )
}

function IncidentBlock({
  title,
  items,
  testId,
}: {
  title: string
  items: OperationsIncidentCard[]
  testId: string
}) {
  return (
    <section className="rahhal-oc-panel" data-testid={testId}>
      <h2>{title}</h2>
      <div className="rahhal-oc-grid" style={{ margin: '0.45rem 0 0' }}>
        {items.map((item) => (
          <article
            key={item.id}
            className="rahhal-oc-card"
            data-testid="oc-incident-card"
          >
            <strong>{item.title}</strong>
            <span>{item.severityLabel}</span>
            <em>{item.statusLabel}</em>
          </article>
        ))}
      </div>
    </section>
  )
}

export function QueuesAndIncidents({
  travelerRequests,
  supportQueue,
  incidents,
  emergencyItems,
  approvalQueue,
  bookingQueue,
  visaQueue,
  notificationsQueue,
  locale,
}: QueuesAndIncidentsProps) {
  return (
    <>
      <section className="rahhal-oc-panel" data-testid="oc-traveler-requests">
        <h2>
          {locale === 'en' ? 'Traveler requests' : 'طلبات المسافرين'}
        </h2>
        <div className="rahhal-oc-grid" style={{ margin: '0.45rem 0 0' }}>
          {travelerRequests.map((req) => (
            <article
              key={req.id}
              className="rahhal-oc-card"
              data-testid="oc-traveler-card"
            >
              <strong>{req.name}</strong>
              <span>{req.requestLabel}</span>
              <PriorityChip priority={req.priority} />
            </article>
          ))}
        </div>
      </section>

      <div className="rahhal-oc-layout">
        <QueueBlock
          title={locale === 'en' ? 'Support queue' : 'طابور الدعم'}
          items={supportQueue}
          testId="oc-support-queue"
        />
        <IncidentBlock
          title={locale === 'en' ? 'Incident center' : 'مركز الحوادث'}
          items={incidents}
          testId="oc-incident-center"
        />
      </div>

      <IncidentBlock
        title={locale === 'en' ? 'Emergency dashboard' : 'لوحة الطوارئ'}
        items={emergencyItems}
        testId="oc-emergency-dashboard"
      />

      <div className="rahhal-oc-grid">
        <QueueBlock
          title={locale === 'en' ? 'Approval queue' : 'طابور الموافقات'}
          items={approvalQueue}
          testId="oc-approval-queue"
        />
        <QueueBlock
          title={locale === 'en' ? 'Booking queue' : 'طابور الحجوزات'}
          items={bookingQueue}
          testId="oc-booking-queue"
        />
        <QueueBlock
          title={locale === 'en' ? 'Visa queue' : 'طابور التأشيرات'}
          items={visaQueue}
          testId="oc-visa-queue"
        />
        <QueueBlock
          title={
            locale === 'en' ? 'Notifications queue' : 'طابور الإشعارات'
          }
          items={notificationsQueue}
          testId="oc-notifications-queue"
        />
      </div>
    </>
  )
}
