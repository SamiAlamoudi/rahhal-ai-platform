import type {
  ActivityItem,
  BoardMeetingCard,
  ExecutiveLocale,
  PendingActionCard,
  ScheduleItem,
  TravelerStatusCard,
  UpcomingTripCard,
} from '../types'

export interface ExecutiveDashboardPanelsProps {
  locale?: ExecutiveLocale
  upcomingTrips: UpcomingTripCard[]
  todaySchedule: ScheduleItem[]
  boardMeetings: BoardMeetingCard[]
  travelerStatuses: TravelerStatusCard[]
  pendingActions: PendingActionCard[]
  recentActivity: ActivityItem[]
  travelProgressPercent: number
}

/** Executive summary panels — presentation only. */
export function ExecutiveDashboardPanels({
  locale = 'ar',
  upcomingTrips,
  todaySchedule,
  boardMeetings,
  travelerStatuses,
  pendingActions,
  recentActivity,
  travelProgressPercent,
}: ExecutiveDashboardPanelsProps) {
  return (
    <div data-testid="ed-dashboard-panels" className="rahhal-ed-panels">
      <section data-testid="ed-upcoming-trips">
        <h2>{locale === 'en' ? 'Upcoming trips' : 'الرحلات القادمة'}</h2>
        <ul>
          {upcomingTrips.map((t) => (
            <li key={t.id}>
              <strong>{t.destination}</strong>
              <span>
                {t.datesLabel} · {t.statusLabel}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="ed-today-schedule">
        <h2>{locale === 'en' ? "Today's schedule" : 'جدول اليوم'}</h2>
        <ul>
          {todaySchedule.map((s) => (
            <li key={s.id} data-kind={s.kind}>
              <strong>{s.timeLabel}</strong> {s.title}
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="ed-board-meetings">
        <h2>{locale === 'en' ? 'Board meetings' : 'اجتماعات المجلس'}</h2>
        <ul>
          {boardMeetings.map((m) => (
            <li key={m.id}>
              <strong>{m.title}</strong>
              <span>
                {m.timeLabel} · {m.location}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="ed-flight-timeline">
        <h2>{locale === 'en' ? 'Flight timeline' : 'جدول الطيران'}</h2>
        <ol>
          {todaySchedule
            .filter((s) => s.kind === 'flight')
            .map((s) => (
              <li key={s.id}>
                {s.timeLabel} · {s.title}
              </li>
            ))}
        </ol>
      </section>

      <section data-testid="ed-hotel-status">
        <h2>{locale === 'en' ? 'Hotel status' : 'حالة الفندق'}</h2>
        <ul>
          {todaySchedule
            .filter((s) => s.kind === 'hotel')
            .map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
        </ul>
      </section>

      <section data-testid="ed-ground-transport">
        <h2>{locale === 'en' ? 'Ground transportation' : 'النقل البري'}</h2>
        <ul>
          {todaySchedule
            .filter((s) => s.kind === 'transport')
            .map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          {todaySchedule.filter((s) => s.kind === 'transport').length === 0 ? (
            <li data-placeholder="true">
              {locale === 'en' ? 'No transfers today' : 'لا تنقلات اليوم'}
            </li>
          ) : null}
        </ul>
      </section>

      <section data-testid="ed-traveler-status">
        <h2>{locale === 'en' ? 'Traveler status' : 'حالة المسافرين'}</h2>
        <ul>
          {travelerStatuses.map((t) => (
            <li key={t.id}>
              {t.name} · {t.statusLabel}
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="ed-pending-actions">
        <h2>{locale === 'en' ? 'Pending actions' : 'إجراءات معلّقة'}</h2>
        <ul>
          {pendingActions.map((p) => (
            <li key={p.id}>
              {p.title} · {p.dueLabel}
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="ed-recent-activity">
        <h2>{locale === 'en' ? 'Recent activity' : 'النشاط الأخير'}</h2>
        <ul>
          {recentActivity.map((a) => (
            <li key={a.id}>
              {a.summary} · {a.atLabel}
            </li>
          ))}
        </ul>
      </section>

      <section data-testid="ed-travel-progress" className="rahhal-ed-summary-card">
        <h2>{locale === 'en' ? 'Travel progress' : 'تقدم السفر'}</h2>
        <div
          className="rahhal-ed-progress"
          role="progressbar"
          aria-valuenow={travelProgressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <i style={{ width: `${travelProgressPercent}%` }} />
        </div>
        <p>{travelProgressPercent}%</p>
      </section>

      <section data-testid="ed-executive-summary" className="rahhal-ed-summary-card">
        <h2>{locale === 'en' ? 'Executive summary' : 'ملخص تنفيذي'}</h2>
        <p>
          {locale === 'en'
            ? 'Presentation card summarizing upcoming travel readiness.'
            : 'بطاقة عرض تلخّص جاهزية السفر القادم.'}
        </p>
      </section>
    </div>
  )
}
