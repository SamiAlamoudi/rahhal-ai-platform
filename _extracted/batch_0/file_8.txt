import { memo, useMemo } from 'react'
import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { ReasoningResult } from '../utils/reasoningEngine'
import type { ScoreCategory } from '../utils/decisionScoreEngine'
import { scoreToStars, formatStars, type OptionReport } from '../utils/reportFormatter'

interface Props {
  options: NormalizedTravelOption[]
  reasoningResults: Map<string, ReasoningResult>
  reports: OptionReport[]
  onRemove: (id: string) => void
}

const COMPARE_FIELDS: { key: ScoreCategory; label: string }[] = [
  { key: 'price', label: 'مطابقة الميزانية' },
  { key: 'comfort', label: 'جودة الراحة' },
  { key: 'travelTime', label: 'كفاءة الوقت' },
  { key: 'familySuitability', label: 'ملاءمة العائلة' },
  { key: 'luxury', label: 'الفخامة' },
  { key: 'destinationMatch', label: 'مطابقة الوجهة' },
  { key: 'purposeMatch', label: 'مطابقة الغرض' },
  { key: 'preferenceMatch', label: 'مطابقة التفضيلات' },
]

function getScore(option: NormalizedTravelOption, cat: ScoreCategory): number {
  return option.decisionScore?.categories.find(c => c.category === cat)?.score ?? 0
}

function bestValue(options: NormalizedTravelOption[], cat: ScoreCategory): number {
  if (options.length === 0) return 0
  return Math.max(...options.map(o => getScore(o, cat)))
}

function scoreColor(score: number, isBest: boolean): string {
  if (isBest) return 'font-bold text-emerald-600 bg-emerald-50'
  if (score >= 75) return 'text-slate-700'
  if (score >= 50) return 'text-amber-600'
  return 'text-rose-500'
}

function ComparisonTableImpl({ options, reports, onRemove }: Props) {
  const bestScores = useMemo(() => {
    const map = new Map<ScoreCategory, number>()
    for (const f of COMPARE_FIELDS) {
      map.set(f.key, bestValue(options, f.key))
    }
    return map
  }, [options])

  const bestPrice = useMemo(() => options.length > 0 ? Math.min(...options.map(o => o.price)) : 0, [options])
  const bestOverall = useMemo(() => options.length > 0 ? Math.max(...options.map(o => o.decisionScore?.weightedAverage ?? 0)) : 0, [options])

  if (options.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 py-10 text-center">
        <span className="text-3xl">≡</span>
        <p className="mt-2 text-sm text-slate-500">اختر خيارين على الأقل للمقارنة</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm" role="region" aria-label="جدول المقارنة">
      <table className="w-full text-right text-xs">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/50">
            <th scope="col" className="p-3 font-bold text-slate-700">المعيار</th>
            {options.map(opt => {
              const report = reports.find(r => r.optionId === opt.id)
              return (
                <th key={opt.id} scope="col" className="border-r border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-slate-800">{opt.title}</p>
                      {report && (
                        <p className="mt-0.5 text-[10px] text-slate-400">{report.recommendationLabel}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(opt.id)}
                      className="shrink-0 rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
                      aria-label={`إزالة ${opt.title} من المقارنة`}
                    >
                      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {/* Price row */}
          <tr className="border-b border-slate-50">
            <th scope="row" className="p-3 font-semibold text-slate-600">💰 السعر</th>
            {options.map(opt => {
              const isBest = opt.price === bestPrice
              return (
                <td key={opt.id} className={`border-r border-slate-50 p-3 ${isBest ? 'bg-emerald-50/40 font-bold text-emerald-600' : 'text-slate-700'}`} dir="ltr">
                  {opt.price.toLocaleString()} {opt.currency}
                  {isBest && <span className="mr-1 text-[9px]">✓</span>}
                </td>
              )
            })}
          </tr>

          {/* Overall score row */}
          <tr className="border-b border-slate-50 bg-slate-50/30">
            <th scope="row" className="p-3 font-semibold text-slate-600">⭐ التقييم الإجمالي</th>
            {options.map(opt => {
              const score = opt.decisionScore?.weightedAverage ?? 0
              const isBest = score === bestOverall
              return (
                <td key={opt.id} className={`border-r border-slate-50 p-3 ${scoreColor(score, isBest)}`} dir="ltr">
                  {score}/100
                  {isBest && <span className="mr-1 text-[9px]">✓</span>}
                </td>
              )
            })}
          </tr>

          {/* Category score rows */}
          {COMPARE_FIELDS.map(field => (
            <tr key={field.key} className="border-b border-slate-50">
              <th scope="row" className="p-3 font-semibold text-slate-600">{field.label}</th>
              {options.map(opt => {
                const score = getScore(opt, field.key)
                const isBest = score === bestScores.get(field.key)
                const stars = scoreToStars(score)
                const starsDisp = formatStars(stars)
                return (
                  <td key={opt.id} className={`border-r border-slate-50 p-3 ${scoreColor(score, isBest)}`}>
                    <div className="flex items-center gap-1.5">
                      <span dir="ltr">{score}/100</span>
                      {isBest && <span className="text-[9px] text-emerald-500">✓</span>}
                    </div>
                    <span className="text-[10px] tracking-wider text-amber-300" dir="rtl">{starsDisp.visual}</span>
                  </td>
                )
              })}
            </tr>
          ))}

          {/* Rating row */}
          <tr>
            <th scope="row" className="p-3 font-semibold text-slate-600">التقييم</th>
            {options.map(opt => (
              <td key={opt.id} className="border-r border-slate-50 p-3 text-slate-700" dir="ltr">
                {opt.rating !== null ? `${opt.rating}/5` : '—'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

export const ComparisonTable = memo(ComparisonTableImpl)
