import { memo, useMemo } from 'react'
import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { ReasoningResult } from '../utils/reasoningEngine'
import type { FinalDecisionScore, ScoreCategory } from '../utils/decisionScoreEngine'
import { scoreToStars, formatStars } from '../utils/reportFormatter'

interface Props {
  option: NormalizedTravelOption
  reasoning: ReasoningResult
}

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  price: 'مطابقة الميزانية',
  comfort: 'جودة الراحة',
  travelTime: 'كفاءة وقت السفر',
  familySuitability: 'ملاءمة العائلة',
  luxury: 'مستوى الفخامة',
  destinationMatch: 'مطابقة الوجهة',
  purposeMatch: 'مطابقة الغرض',
  preferenceMatch: 'مطابقة التفضيلات',
}

const CATEGORY_ICONS: Record<ScoreCategory, string> = {
  price: '💰',
  comfort: '🛋️',
  travelTime: '⏱️',
  familySuitability: '👨‍👩‍👧',
  luxury: '💎',
  destinationMatch: '📍',
  purposeMatch: '🎯',
  preferenceMatch: '⚙️',
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600 bg-emerald-50'
  if (score >= 50) return 'text-amber-600 bg-amber-50'
  return 'text-rose-500 bg-rose-50'
}

function barColor(score: number): string {
  if (score >= 75) return 'bg-emerald-500'
  if (score >= 50) return 'bg-amber-500'
  return 'bg-rose-400'
}

function ScoreBreakdownCardImpl({ option, reasoning }: Props) {
  const score: FinalDecisionScore | null = option.decisionScore

  const categories = useMemo(() => {
    if (!score) return []
    return score.categories
  }, [score])

  const overallStars = scoreToStars(score?.weightedAverage ?? 0)
  const starsDisplay = formatStars(overallStars)

  return (
    <div
      role="region"
      aria-label={`تفصيل النقاط لـ ${option.title}`}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {categories.map(cat => {
        const stars = scoreToStars(cat.score)
        const starsDisp = formatStars(stars)
        return (
          <div
            key={cat.category}
            className="rounded-xl border border-slate-100 bg-white p-3.5 transition-all duration-200 hover:border-slate-200 hover:shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm" aria-hidden>{CATEGORY_ICONS[cat.category]}</span>
                <span className="text-xs font-semibold text-slate-700">
                  {CATEGORY_LABELS[cat.category] ?? cat.category}
                </span>
              </div>
              <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${scoreColor(cat.score)}`} dir="ltr">
                {cat.score}/100
              </span>
            </div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] tracking-wider text-amber-400" dir="rtl" aria-label={`${stars.label}`}>
                {starsDisp.visual}
              </span>
              <span className="text-[10px] text-slate-400">{stars.label}</span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={cat.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={CATEGORY_LABELS[cat.category]}
            >
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${barColor(cat.score)}`}
                style={{ width: `${cat.score}%` }}
              />
            </div>
            {cat.reason && (
              <p className="mt-1.5 text-[10px] leading-relaxed text-slate-400">{cat.reason}</p>
            )}
          </div>
        )
      })}

      {/* Overall experience */}
      <div className="rounded-xl border border-primary-100 bg-primary-50/40 p-3.5 sm:col-span-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm" aria-hidden>✨</span>
            <span className="text-xs font-bold text-primary-700">التجربة الإجمالية المقدّرة</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] tracking-wider text-amber-400" dir="rtl">{starsDisplay.visual}</span>
            <span className="text-xs font-bold text-primary-600" dir="ltr">{score?.weightedAverage ?? 0}/100</span>
          </div>
        </div>
        <p className="mt-1.5 text-[10px] leading-relaxed text-primary-500">
          {reasoning.recommendationSummary[0]
            ? reasoning.recommendationSummary[0].key.includes('excellent') ? 'خيار استثنائي يلبي معظم احتياجاتك'
              : reasoning.recommendationSummary[0].key.includes('recommended') ? 'خيار قوي يلبي احتياجاتك الأساسية'
              : 'خيار مقبول مع بعض التنازلات'
            : 'تقييم إجمالي بناءً على جميع المعايير'}
        </p>
      </div>
    </div>
  )
}

export const ScoreBreakdownCard = memo(ScoreBreakdownCardImpl)
