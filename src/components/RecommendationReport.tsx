import type { OptionReport } from '../utils/reportFormatter'
import { formatStars } from '../utils/reportFormatter'

function StarRow({ rating, label }: { rating: { stars: number; label: string }; label: string }) {
  const { visual, label: starLabel } = formatStars(rating)
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm tracking-wider text-amber-400" dir="rtl">{visual}</span>
        <span className="text-xs font-bold text-slate-600">{starLabel}</span>
      </div>
    </div>
  )
}

interface Props {
  report: OptionReport
  rank: number
}

export default function RecommendationReport({ report, rank }: Props) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-shadow hover:shadow-md">
      {/* Header */}
      <div className="border-b border-slate-50 bg-gradient-to-l from-slate-50/50 to-white px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                {rank}
              </span>
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {report.typeLabel}
              </span>
            </div>
            <h3 className="mt-2 text-sm font-bold text-slate-900">{report.optionTitle}</h3>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-sm font-bold text-primary-600">
                {report.price.toLocaleString()} {report.currency}
              </span>
              {report.rating !== null && (
                <span className="text-xs font-medium text-amber-500">★ {report.rating}</span>
              )}
            </div>
          </div>
          <div className="shrink-0 text-left">
            <div className="flex items-center justify-end gap-1">
              <span className="text-2xl font-bold text-primary-600">{report.overallScore}</span>
              <span className="text-xs font-medium text-slate-400">/100</span>
            </div>
            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${report.recommendationColor}`}>
              {report.recommendationLabel}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {/* Why Rahhal recommends it */}
        {report.whyRahhalRecommends.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span className="text-primary-500">💡</span>
              لماذا توصي رحّال بهذا الخيار
            </h4>
            <div className="space-y-1.5">
              {report.whyRahhalRecommends.map((text, i) => (
                <p key={i} className="text-xs leading-relaxed text-slate-600">
                  • {text}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Advantages & Disadvantages */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {report.advantages.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                <span>✓</span>
                المزايا
              </h4>
              <div className="space-y-1.5">
                {report.advantages.map((text, i) => (
                  <p key={i} className="text-xs leading-relaxed text-slate-600">
                    • {text}
                  </p>
                ))}
              </div>
            </div>
          )}
          {report.disadvantages.length > 0 && (
            <div>
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-rose-500">
                <span>⚠</span>
                عيوب محتملة
              </h4>
              <div className="space-y-1.5">
                {report.disadvantages.map((text, i) => (
                  <p key={i} className="text-xs leading-relaxed text-slate-600">
                    • {text}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Best suited for */}
        {report.bestSuitedFor.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <span className="text-sky-500">🎯</span>
              الأنسب لـ
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {report.bestSuitedFor.map((text, i) => (
                <span
                  key={i}
                  className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-medium text-sky-700"
                >
                  {text}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Star ratings grid */}
        <div className="rounded-xl border border-slate-50 bg-slate-50/40 divide-y divide-slate-50">
          <StarRow rating={report.budgetSuitability} label="ملاءمة الميزانية" />
          <StarRow rating={report.comfortLevel} label="مستوى الراحة" />
          <StarRow rating={report.timeEfficiency} label="كفاءة الوقت" />
          <StarRow rating={report.overallValue} label="القيمة الإجمالية" />
        </div>

        {/* Detail texts */}
        {report.budgetSuitabilityText.length > 0 && (
          <div className="space-y-1">
            {report.budgetSuitabilityText.map((text, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-slate-500">• {text}</p>
            ))}
          </div>
        )}
        {report.comfortText.length > 0 && (
          <div className="space-y-1">
            {report.comfortText.map((text, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-slate-500">• {text}</p>
            ))}
          </div>
        )}
        {report.timeText.length > 0 && (
          <div className="space-y-1">
            {report.timeText.map((text, i) => (
              <p key={i} className="text-[11px] leading-relaxed text-slate-500">• {text}</p>
            ))}
          </div>
        )}

        {/* Why not other options */}
        {report.whyNotOthers && (
          <div className="rounded-xl border border-primary-100 bg-primary-50/40 px-4 py-3">
            <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-primary-700">
              <span>🤔</span>
              لماذا لا تختار الخيارات الأخرى؟
            </h4>
            <p className="text-xs leading-relaxed text-slate-600">{report.whyNotOthers}</p>
          </div>
        )}
      </div>
    </article>
  )
}
