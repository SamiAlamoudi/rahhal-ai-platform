import type {
  JourneyProgressModel,
  JourneyTimelineLocale,
} from '../types'
import { JOURNEY_STEPS } from '../types'

export function JourneyProgress({
  progress,
  locale = 'ar',
}: {
  progress: JourneyProgressModel
  locale?: JourneyTimelineLocale
}) {
  const pct = Math.max(0, Math.min(100, progress.percent))
  return (
    <section data-testid="jt-progress" className="rahhal-jt-progress">
      <header>
        <h2>{locale === 'en' ? 'Journey progress' : 'تقدم الرحلة'}</h2>
        <span data-testid="jt-completion">{progress.completionLabel}</span>
      </header>
      <div
        className="rahhal-jt-progress__bar"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <i style={{ width: `${pct}%` }} />
      </div>
      <dl className="rahhal-jt-progress__meta">
        <div>
          <dt>{locale === 'en' ? 'Current step' : 'الخطوة الحالية'}</dt>
          <dd data-testid="jt-current-step">{progress.currentStep}</dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Remaining time' : 'الوقت المتبقي'}</dt>
          <dd data-testid="jt-remaining">{progress.remainingTimeLabel}</dd>
        </div>
        <div>
          <dt>{locale === 'en' ? 'Trip completion' : 'اكتمال الرحلة'}</dt>
          <dd>{pct}%</dd>
        </div>
      </dl>
      <ol className="rahhal-jt-progress__steps" data-testid="jt-step-rail">
        {JOURNEY_STEPS.map((step) => (
          <li
            key={step}
            data-step={step}
            className={step === progress.currentStep ? 'is-current' : undefined}
          >
            {step}
          </li>
        ))}
      </ol>
    </section>
  )
}
