import { memo, useMemo } from 'react'
import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { ReasoningResult } from '../utils/reasoningEngine'
import type { TravelSearchRequest } from '../utils/travelSearchRequest'

interface Props {
  rankedOptions: NormalizedTravelOption[]
  reasoningResults: Map<string, ReasoningResult>
  searchRequest: TravelSearchRequest
}

function confidenceColor(pct: number): string {
  if (pct >= 75) return 'text-emerald-600'
  if (pct >= 50) return 'text-amber-600'
  return 'text-rose-500'
}

function confidenceBarColor(pct: number): string {
  if (pct >= 75) return 'bg-emerald-500'
  if (pct >= 50) return 'bg-amber-500'
  return 'bg-rose-400'
}

function confidenceLabel(pct: number): string {
  if (pct >= 75) return 'مرتفعة'
  if (pct >= 50) return 'متوسطة'
  return 'منخفضة'
}

function DecisionConfidenceCardImpl({ rankedOptions, reasoningResults: _reasoningResults, searchRequest }: Props) {
  const data = useMemo(() => {
    const allScores = rankedOptions.map(o => o.decisionScore).filter(Boolean)
    if (allScores.length === 0) {
      return {
        avgConfidence: 0,
        dataCompleteness: searchRequest.completionPercentage,
        remainingUncertainty: 100 - searchRequest.completionPercentage,
        infoQuality: 0,
        highCount: searchRequest.highConfidence.length,
        mediumCount: searchRequest.mediumConfidence.length,
        lowCount: searchRequest.lowConfidence.length,
        scoreVariance: 0,
        missingFields: searchRequest.missingFields.length,
      }
    }

    const avgConfidence = Math.round(
      allScores.reduce((sum, s) => sum + (s?.confidence ?? 0), 0) / allScores.length
    )

    const allCategoryScores = allScores.flatMap(s => s?.categories.map(c => c.score) ?? [])
    const mean = allCategoryScores.reduce((a, b) => a + b, 0) / Math.max(allCategoryScores.length, 1)
    const variance = Math.round(
      allCategoryScores.reduce((acc, s) => acc + Math.abs(s - mean), 0) / Math.max(allCategoryScores.length, 1)
    )

    const infoQuality = Math.round(
      (searchRequest.highConfidence.length * 3 + searchRequest.mediumConfidence.length * 2 + searchRequest.lowConfidence.length * 1) /
      Math.max(searchRequest.highConfidence.length + searchRequest.mediumConfidence.length + searchRequest.lowConfidence.length, 1) * 33
    )

    return {
      avgConfidence,
      dataCompleteness: searchRequest.completionPercentage,
      remainingUncertainty: 100 - searchRequest.completionPercentage,
      infoQuality: Math.min(infoQuality, 100),
      highCount: searchRequest.highConfidence.length,
      mediumCount: searchRequest.mediumConfidence.length,
      lowCount: searchRequest.lowConfidence.length,
      scoreVariance: variance,
      missingFields: searchRequest.missingFields.length,
    }
  }, [rankedOptions, searchRequest])

  return (
    <section
      aria-labelledby="confidence-heading"
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <span className="text-base">📊</span>
        <h3 id="confidence-heading" className="text-sm font-bold text-slate-900">ثقة القرار</h3>
      </div>

      {/* Confidence gauge */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50/60 px-4 py-4">
        <div>
          <p className="text-[10px] font-medium text-slate-400">مستوى ثقة بيلامو</p>
          <p className={`text-2xl font-bold ${confidenceColor(data.avgConfidence)}`} dir="ltr">
            {data.avgConfidence}%
          </p>
          <p className={`text-xs font-medium ${confidenceColor(data.avgConfidence)}`}>
            {confidenceLabel(data.avgConfidence)}
          </p>
        </div>
        <div className="relative h-16 w-16">
          <svg viewBox="0 0 44 44" className="h-16 w-16 -rotate-90">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              className={confidenceBarColor(data.avgConfidence)}
              strokeDasharray={`${(data.avgConfidence / 100) * 113} 113`}
              style={{ transition: 'stroke-dasharray 0.7s ease-out' }}
            />
          </svg>
        </div>
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Data completeness */}
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-[10px] font-medium text-slate-400">اكتمال البيانات</p>
          <p className="mt-0.5 text-lg font-bold text-slate-800" dir="ltr">{data.dataCompleteness}%</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-sky-500 transition-all duration-700" style={{ width: `${data.dataCompleteness}%` }} />
          </div>
        </div>

        {/* Remaining uncertainty */}
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-[10px] font-medium text-slate-400">عدم اليقين المتبقي</p>
          <p className="mt-0.5 text-lg font-bold text-slate-800" dir="ltr">{data.remainingUncertainty}%</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-amber-400 transition-all duration-700" style={{ width: `${data.remainingUncertainty}%` }} />
          </div>
        </div>

        {/* Information quality */}
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-[10px] font-medium text-slate-400">جودة المعلومات</p>
          <p className="mt-0.5 text-lg font-bold text-slate-800" dir="ltr">{data.infoQuality}%</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-700" style={{ width: `${data.infoQuality}%` }} />
          </div>
        </div>

        {/* Score variance */}
        <div className="rounded-xl border border-slate-100 p-3">
          <p className="text-[10px] font-medium text-slate-400">تباين النتائج</p>
          <p className="mt-0.5 text-lg font-bold text-slate-800" dir="ltr">{data.scoreVariance}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-rose-400 transition-all duration-700" style={{ width: `${Math.min(data.scoreVariance, 100)}%` }} />
          </div>
        </div>
      </div>

      {/* Inference breakdown */}
      <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50/40 p-3">
        <p className="mb-2 text-[10px] font-bold text-slate-500">تفصيل الاستنتاجات</p>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-slate-600">عالية: <strong dir="ltr">{data.highCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-slate-600">متوسطة: <strong dir="ltr">{data.mediumCount}</strong></span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            <span className="text-slate-600">منخفضة: <strong dir="ltr">{data.lowCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Explanation */}
      <div className="mt-3 rounded-xl border border-primary-100 bg-primary-50/30 p-3">
        <p className="text-[10px] font-bold text-primary-600">تفسير الثقة</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          {data.avgConfidence >= 75
            ? 'بيلامو واثق من هذه التوصيات بناءً على البيانات المتوفرة. كلما زادت الثقة، قلّت المخاطر في الاختيار.'
            : data.avgConfidence >= 50
              ? 'بيلامو لديه ثقة متوسطة. بعض المعلومات غير مؤكدة، لذا يُنصح بمراجعة التفاصيل قبل القرار.'
              : 'بيلامو لديه ثقة منخفضة بسبب نقص المعلومات. إكمال الملف يتحسن دقة التوصيات.'}
        </p>
      </div>
    </section>
  )
}

export const DecisionConfidenceCard = memo(DecisionConfidenceCardImpl)
