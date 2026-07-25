import type { CSSProperties } from 'react'
import type { TravelerCompletionStep, TravelerProfileLocale } from '../types'

export interface ProfileOverviewProps {
  displayName: string
  headline: string
  overview: string
  profileCompletionPercent: number
  completionTimeline: TravelerCompletionStep[]
  locale: TravelerProfileLocale
}

export function ProfileOverview({
  displayName,
  headline,
  overview,
  profileCompletionPercent,
  completionTimeline,
  locale,
}: ProfileOverviewProps) {
  const initial = displayName.trim().charAt(0) || 'ر'
  const ringStyle = {
    '--ring': `${Math.max(0, Math.min(100, profileCompletionPercent))}%`,
  } as CSSProperties

  return (
    <div className="rahhal-tp-layout">
      <section
        className="rahhal-tp-panel rahhal-tp-overview"
        data-testid="tp-overview"
      >
        <div className="rahhal-tp-avatar" aria-hidden>
          {initial}
        </div>
        <div>
          <h2>{displayName}</h2>
          <p className="rahhal-tp-muted">{headline}</p>
          <p style={{ marginTop: '0.45rem' }}>{overview}</p>
        </div>
      </section>

      <section
        className="rahhal-tp-panel"
        data-testid="tp-profile-completion"
      >
        <h2>
          {locale === 'en' ? 'Profile completion' : 'اكتمال الملف'}
        </h2>
        <div
          className="rahhal-tp-ring"
          data-testid="tp-progress-ring"
          style={ringStyle}
        >
          <strong>{profileCompletionPercent}%</strong>
        </div>
        <ul className="rahhal-tp-timeline" data-testid="tp-completion-timeline">
          {completionTimeline.map((step) => (
            <li key={step.id} className={step.done ? 'is-done' : undefined}>
              {step.label}
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
