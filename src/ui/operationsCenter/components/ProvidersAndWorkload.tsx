import type {
  OperationsActivityItem,
  OperationsAgentWorkload,
  OperationsCenterLocale,
  OperationsProviderCard,
  OperationsSlaMetric,
  OperationsTimelineItem,
} from '../types'

export interface ProvidersAndWorkloadProps {
  providers: OperationsProviderCard[]
  slaMetrics: OperationsSlaMetric[]
  agentWorkload: OperationsAgentWorkload[]
  activityFeed: OperationsActivityItem[]
  auditTimeline: OperationsTimelineItem[]
  calendarDays: string[]
  mapPlaceholder: string
  chartPlaceholder: string
  locale: OperationsCenterLocale
}

export function ProvidersAndWorkload({
  providers,
  slaMetrics,
  agentWorkload,
  activityFeed,
  auditTimeline,
  calendarDays,
  mapPlaceholder,
  chartPlaceholder,
  locale,
}: ProvidersAndWorkloadProps) {
  return (
    <>
      <div className="rahhal-oc-layout">
        <section className="rahhal-oc-panel" data-testid="oc-provider-status">
          <h2>{locale === 'en' ? 'Provider status' : 'حالة المزودين'}</h2>
          <div className="rahhal-oc-grid" style={{ margin: '0.45rem 0 0' }}>
            {providers.map((p) => (
              <article
                key={p.id}
                className="rahhal-oc-card"
                data-testid="oc-provider-card"
              >
                <strong>{p.name}</strong>
                <span>{p.statusLabel}</span>
                <em>SLA {p.slaLabel}</em>
              </article>
            ))}
          </div>
        </section>

        <section className="rahhal-oc-panel" data-testid="oc-sla-metrics">
          <h2>{locale === 'en' ? 'SLA metrics' : 'مقاييس SLA'}</h2>
          {slaMetrics.map((m) => (
            <div key={m.id} style={{ marginBottom: '0.55rem' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                }}
              >
                <span className="rahhal-oc-muted">{m.label}</span>
                <strong>{m.valueLabel}</strong>
              </div>
              <div className="rahhal-oc-bar" data-testid="oc-progress-bar">
                <i style={{ width: `${m.percent}%` }} />
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="rahhal-oc-panel" data-testid="oc-agent-workload">
        <h2>{locale === 'en' ? 'Agent workload' : 'حمل الوكلاء'}</h2>
        <div className="rahhal-oc-grid" style={{ margin: '0.45rem 0 0' }}>
          {agentWorkload.map((a) => (
            <article key={a.id} className="rahhal-oc-card">
              <strong>{a.name}</strong>
              <span>{a.loadLabel}</span>
              <div className="rahhal-oc-bar">
                <i style={{ width: `${a.percent}%` }} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <div className="rahhal-oc-layout">
        <section className="rahhal-oc-panel" data-testid="oc-activity-feed">
          <h2>{locale === 'en' ? 'Activity feed' : 'سجل النشاط'}</h2>
          <ul className="rahhal-oc-feed">
            {activityFeed.map((item) => (
              <li key={item.id}>
                <span>{item.actor}</span>
                <strong>{item.action}</strong>
              </li>
            ))}
          </ul>
        </section>

        <section className="rahhal-oc-panel" data-testid="oc-audit-timeline">
          <h2>{locale === 'en' ? 'Audit timeline' : 'الجدول الزمني للتدقيق'}</h2>
          <ul className="rahhal-oc-timeline">
            {auditTimeline.map((item) => (
              <li key={item.id}>
                <em
                  style={{
                    color: 'var(--rahhal-oc-accent)',
                    fontStyle: 'normal',
                  }}
                >
                  {item.whenLabel}
                </em>
                <strong>{item.title}</strong>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="rahhal-oc-layout">
        <section className="rahhal-oc-panel" data-testid="oc-calendar">
          <h2>{locale === 'en' ? 'Calendar' : 'التقويم'}</h2>
          <div className="rahhal-oc-calendar">
            {calendarDays.map((day, index) => (
              <span key={day} className={index < 2 ? 'is-active' : undefined}>
                {day}
              </span>
            ))}
          </div>
        </section>
        <section className="rahhal-oc-panel" data-testid="oc-map">
          <h2>{locale === 'en' ? 'Map' : 'الخريطة'}</h2>
          <div className="rahhal-oc-placeholder">{mapPlaceholder}</div>
        </section>
      </div>

      <section className="rahhal-oc-panel" data-testid="oc-charts">
        <h2>
          {locale === 'en' ? 'Charts' : 'المخططات'}
        </h2>
        <div className="rahhal-oc-placeholder">{chartPlaceholder}</div>
      </section>
    </>
  )
}
