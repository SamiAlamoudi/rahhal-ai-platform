import type {
  DecisionCenterLocale,
  DecisionComparisonModel,
  DecisionOptionModel,
} from '../types'

export function ComparisonCards({
  options,
  comparison,
  locale = 'ar',
}: {
  options: DecisionOptionModel[]
  comparison: DecisionComparisonModel
  locale?: DecisionCenterLocale
}) {
  return (
    <section data-testid="dc-comparison" className="rahhal-dc-panel">
      <h2>
        {locale === 'en'
          ? 'Cost / time / comfort comparison'
          : 'مقارنة التكلفة والوقت والراحة'}
      </h2>
      <div className="rahhal-dc-comparison__grid">
        {options.map((opt) => (
          <article
            key={opt.id}
            className="rahhal-dc-option"
            data-testid="dc-option-card"
            data-option-id={opt.id}
            data-tags={opt.tags.join(',')}
          >
            <header>
              <h3>{opt.title}</h3>
              <p>{opt.subtitle}</p>
            </header>
            <ul className="rahhal-dc-tags">
              {opt.tags.map((tag) => (
                <li key={tag} data-tag={tag}>
                  {tag}
                </li>
              ))}
            </ul>
            <dl>
              <div>
                <dt>{locale === 'en' ? 'Cost' : 'التكلفة'}</dt>
                <dd>{opt.costLabel}</dd>
              </div>
              <div>
                <dt>{locale === 'en' ? 'Time' : 'الوقت'}</dt>
                <dd>{opt.timeLabel}</dd>
              </div>
              <div>
                <dt>{locale === 'en' ? 'Risk' : 'المخاطر'}</dt>
                <dd data-testid="dc-risk-label">{opt.riskLabel}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="rahhal-dc-deltas" data-testid="dc-deltas">
        <span>{comparison.costDeltaLabel}</span>
        <span>{comparison.timeDeltaLabel}</span>
        <span>{comparison.comfortDeltaLabel}</span>
      </div>
      <div
        className="rahhal-dc-chart-placeholder"
        data-testid="dc-cost-chart"
        data-placeholder="true"
      >
        {locale === 'en' ? 'Cost charts placeholder' : 'مخططات التكلفة — واجهة'}
      </div>
    </section>
  )
}
