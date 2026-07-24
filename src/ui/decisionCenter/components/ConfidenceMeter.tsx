import type { DecisionCenterLocale } from '../types'

export function ConfidenceMeter({
  confidence,
  locale = 'ar',
}: {
  confidence: number
  locale?: DecisionCenterLocale
}) {
  const pct = Math.round(Math.max(0, Math.min(1, confidence)) * 100)
  return (
    <section data-testid="dc-confidence" className="rahhal-dc-meter">
      <h2>{locale === 'en' ? 'Confidence score' : 'درجة الثقة'}</h2>
      <div
        className="rahhal-dc-meter__ring"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ ['--meter' as string]: `${pct}%` }}
      >
        <span data-testid="dc-confidence-value">{pct}%</span>
      </div>
    </section>
  )
}
