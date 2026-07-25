import type { DecisionCenterLocale, DecisionOptionModel } from '../types'

export function ScoreBars({
  options,
  locale = 'ar',
}: {
  options: DecisionOptionModel[]
  locale?: DecisionCenterLocale
}) {
  return (
    <section data-testid="dc-score-bars" className="rahhal-dc-panel">
      <h2>{locale === 'en' ? 'Travel score' : 'درجة السفر'}</h2>
      <ul>
        {options.map((opt) => (
          <li key={opt.id}>
            <div className="rahhal-dc-score__label">
              <span>{opt.title}</span>
              <strong>{opt.travelScore}</strong>
            </div>
            <div
              className="rahhal-dc-score__bar"
              role="progressbar"
              aria-valuenow={opt.travelScore}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <i style={{ width: `${opt.travelScore}%` }} />
            </div>
            <div className="rahhal-dc-score__sub">
              {locale === 'en' ? 'Comfort' : 'الراحة'} {opt.comfortScore}
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
