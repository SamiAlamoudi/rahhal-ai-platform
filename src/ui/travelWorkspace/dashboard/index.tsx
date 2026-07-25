import { AlertsPanel } from '../alertsPanel'
import { BudgetSummary } from '../budgetSummary'
import { CurrencyPanel } from '../currencyPanel'
import { DailyAgenda } from '../dailyAgenda'
import { TravelCard } from '../components/TravelCard'
import { TripProgress } from '../tripProgress'
import { VisaPanel } from '../visaPanel'
import { WeatherPanel } from '../weatherPanel'
import type {
  AlertModel,
  BudgetSummaryModel,
  TimelineItemModel,
  TravelCardModel,
  TravelWorkspaceLocale,
  TripProgressPhase,
} from '../types'

export interface DashboardProps {
  locale?: TravelWorkspaceLocale
  cards: TravelCardModel[]
  agenda: TimelineItemModel[]
  alerts: AlertModel[]
  budget: BudgetSummaryModel
  progressPhase: TripProgressPhase
  progressPercent: number
}

/**
 * Premium executive dashboard — presentation cards only.
 * Emergency contacts are a placeholder block (no calling / CRM).
 */
export function Dashboard({
  locale = 'ar',
  cards,
  agenda,
  alerts,
  budget,
  progressPhase,
  progressPercent,
}: DashboardProps) {
  const flight = cards.find((c) => c.kind === 'flight')
  const hotel = cards.find((c) => c.kind === 'hotel')
  const transfer = cards.find((c) => c.kind === 'transport')
  const meeting = cards.find((c) => c.kind === 'meeting')
  const activity = cards.find((c) => c.kind === 'activity')

  return (
    <section data-testid="tw-dashboard" className="rahhal-tw-dashboard">
      <header className="rahhal-tw-dashboard__header">
        <h2>{locale === 'en' ? 'Executive dashboard' : 'لوحة تنفيذية'}</h2>
      </header>

      <div className="rahhal-tw-dashboard__grid">
        {flight ? <TravelCard card={flight} locale={locale} /> : null}
        {hotel ? <TravelCard card={hotel} locale={locale} /> : null}
        <DailyAgenda items={agenda} locale={locale} />
        {transfer ? <TravelCard card={transfer} locale={locale} /> : null}
        {meeting ? <TravelCard card={meeting} locale={locale} /> : null}
        {activity ? <TravelCard card={activity} locale={locale} /> : null}
        <TripProgress
          phase={progressPhase}
          percent={progressPercent}
          locale={locale}
        />
        <AlertsPanel alerts={alerts} locale={locale} />
        <BudgetSummary budget={budget} locale={locale} />
        <WeatherPanel locale={locale} />
        <VisaPanel locale={locale} />
        <CurrencyPanel locale={locale} />
        <article
          className="rahhal-tw-panel-card"
          data-testid="tw-emergency-contacts"
          data-placeholder="true"
        >
          <h2>{locale === 'en' ? 'Emergency contacts' : 'جهات الطوارئ'}</h2>
          <p>
            {locale === 'en'
              ? 'Emergency contacts placeholder'
              : 'جهات طوارئ — واجهة فقط'}
          </p>
        </article>
      </div>
    </section>
  )
}
