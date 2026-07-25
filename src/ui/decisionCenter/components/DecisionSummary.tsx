import type { DecisionCenterLocale, DecisionType } from '../types'
import { DECISION_TYPES } from '../types'

const TYPE_LABEL: Record<DecisionType, { ar: string; en: string }> = {
  flight_choice: { ar: 'اختيار الرحلة', en: 'Flight choice' },
  hotel_choice: { ar: 'اختيار الفندق', en: 'Hotel choice' },
  transportation: { ar: 'التنقل', en: 'Transportation' },
  activity: { ar: 'نشاط', en: 'Activity' },
  restaurant: { ar: 'مطعم', en: 'Restaurant' },
  meeting_time: { ar: 'وقت الاجتماع', en: 'Meeting time' },
  budget_recommendation: { ar: 'توصية الميزانية', en: 'Budget recommendation' },
  travel_route: { ar: 'مسار السفر', en: 'Travel route' },
}

export function DecisionSummary({
  decisionType,
  summary,
  whyRecommended,
  recommendationReason,
  pros,
  cons,
  riskIndicators,
  timelineImpact,
  locale = 'ar',
  onTypeChange,
}: {
  decisionType: DecisionType
  summary: string
  whyRecommended: string
  recommendationReason: string
  pros: string[]
  cons: string[]
  riskIndicators: string[]
  timelineImpact: string[]
  locale?: DecisionCenterLocale
  onTypeChange?: (type: DecisionType) => void
}) {
  return (
    <section data-testid="dc-summary" className="rahhal-dc-panel">
      <header className="rahhal-dc-summary__header">
        <h2>{locale === 'en' ? 'Decision summary' : 'ملخص القرار'}</h2>
        <select
          data-testid="dc-decision-type"
          value={decisionType}
          onChange={(e) => onTypeChange?.(e.target.value as DecisionType)}
        >
          {DECISION_TYPES.map((type) => (
            <option key={type} value={type}>
              {locale === 'en' ? TYPE_LABEL[type].en : TYPE_LABEL[type].ar}
            </option>
          ))}
        </select>
      </header>

      <article data-testid="dc-recommendation-card" className="rahhal-dc-rec">
        <p data-testid="dc-summary-text">{summary}</p>
      </article>

      <div className="rahhal-dc-sections">
        <div data-testid="dc-why">
          <h3>{locale === 'en' ? 'Why this recommendation' : 'لماذا هذه التوصية'}</h3>
          <p>{whyRecommended}</p>
        </div>
        <div data-testid="dc-reason">
          <h3>{locale === 'en' ? 'Recommendation reason' : 'سبب التوصية'}</h3>
          <p>{recommendationReason}</p>
        </div>
        <div data-testid="dc-pros">
          <h3>{locale === 'en' ? 'Pros' : 'الإيجابيات'}</h3>
          <ul>
            {pros.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div data-testid="dc-cons">
          <h3>{locale === 'en' ? 'Cons' : 'السلبيات'}</h3>
          <ul>
            {cons.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div data-testid="dc-risks">
          <h3>{locale === 'en' ? 'Risk indicators' : 'مؤشرات المخاطر'}</h3>
          <ul>
            {riskIndicators.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div data-testid="dc-timeline-impact">
          <h3>{locale === 'en' ? 'Timeline impact' : 'أثر الجدول الزمني'}</h3>
          <ul>
            {timelineImpact.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
