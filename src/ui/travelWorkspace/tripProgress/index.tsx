import type { TripProgressPhase, TravelWorkspaceLocale } from '../types'
import { TRIP_PROGRESS_PHASES } from '../types'

export function TripProgress({
  phase,
  percent,
  locale = 'ar',
}: {
  phase: TripProgressPhase
  percent: number
  locale?: TravelWorkspaceLocale
}) {
  const idx = TRIP_PROGRESS_PHASES.indexOf(phase)
  return (
    <section data-testid="tw-trip-progress" className="rahhal-tw-progress">
      <header>
        <h2>{locale === 'en' ? 'Trip progress' : 'تقدم الرحلة'}</h2>
        <span>{Math.max(0, Math.min(100, percent))}%</span>
      </header>
      <div
        className="rahhal-tw-progress__bar"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
      </div>
      <ol className="rahhal-tw-progress__phases" data-testid="tw-progress-phases">
        {TRIP_PROGRESS_PHASES.map((p, i) => (
          <li
            key={p}
            data-phase={p}
            className={i <= idx ? 'is-active' : undefined}
            aria-current={p === phase ? 'step' : undefined}
          >
            {p}
          </li>
        ))}
      </ol>
    </section>
  )
}
