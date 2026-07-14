import { memo, useMemo } from 'react'
import type { NormalizedTravelOption } from '../utils/searchOrchestrator'
import type { ReasoningResult } from '../utils/reasoningEngine'
import type { TravelSearchRequest } from '../utils/travelSearchRequest'
import { buildFullReport, scoreToStars, formatStars } from '../utils/reportFormatter'

interface Props {
  rankedOptions: NormalizedTravelOption[]
  reasoningResults: Map<string, ReasoningResult>
  searchRequest: TravelSearchRequest
}

const TYPE_LABELS: Record<string, string> = {
  flight: 'طيران',
  hotel: 'فندق',
  activity: 'نشاط',
  transportation: 'مواصلات',
}

const CATEGORY_LABELS: Record<string, string> = {
  price: 'الميزانية',
  comfort: 'الراحة',
  travelTime: 'وقت السفر',
  familySuitability: 'العائلة',
  luxury: 'الفخامة',
  destinationMatch: 'الوجهة',
  purposeMatch: 'الغرض',
  preferenceMatch: 'التفضيلات',
}

function PrintableReportImpl({ rankedOptions, reasoningResults, searchRequest }: Props) {
  const reports = useMemo(
    () => buildFullReport(rankedOptions, reasoningResults),
    [rankedOptions, reasoningResults],
  )

  const reportDate = new Date().toLocaleDateString('ar-SA')

  return (
    <div className="print-report hidden print:block" dir="rtl" aria-label="تقرير قابل للطباعة">
      {/* Header */}
      <div className="mb-6 border-b-2 border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-slate-900">رحّال — تقرير التوصيات</h1>
        <p className="mt-1 text-sm text-slate-500">تاريخ التقرير: {reportDate}</p>
      </div>

      {/* Trip summary */}
      <div className="mb-6">
        <h2 className="mb-3 text-lg font-bold text-slate-800">ملخص الرحلة</h2>
        <table className="w-full text-sm">
          <tbody>
            <tr><td className="py-1 font-semibold text-slate-600">الوجهة:</td><td className="py-1 text-slate-800">{searchRequest.destination}</td></tr>
            <tr><td className="py-1 font-semibold text-slate-600">مدينة المغادرة:</td><td className="py-1 text-slate-800">{searchRequest.departureCity}</td></tr>
            <tr><td className="py-1 font-semibold text-slate-600">المدة:</td><td className="py-1 text-slate-800">{searchRequest.durationDays} يوم</td></tr>
            <tr><td className="py-1 font-semibold text-slate-600">المسافرون:</td><td className="py-1 text-slate-800">{searchRequest.travelers.adults} بالغ، {searchRequest.travelers.children} طفل</td></tr>
            <tr><td className="py-1 font-semibold text-slate-600">الميزانية:</td><td className="py-1 text-slate-800" dir="ltr">{searchRequest.budgetAmount.toLocaleString()} {searchRequest.budgetCurrency}</td></tr>
            <tr><td className="py-1 font-semibold text-slate-600">اكتمال البيانات:</td><td className="py-1 text-slate-800" dir="ltr">{searchRequest.completionPercentage}%</td></tr>
          </tbody>
        </table>
      </div>

      {/* Ranked options */}
      <div>
        <h2 className="mb-3 text-lg font-bold text-slate-800">التوصيات المرتّبة</h2>
        {reports.map((report, i) => {
          const stars = formatStars(scoreToStars(report.overallScore))
          return (
            <div key={report.optionId} className="mb-5 border border-slate-300 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {i + 1}. {report.optionTitle}
                  </h3>
                  <p className="text-xs text-slate-500">{TYPE_LABELS[report.optionType] ?? report.optionType}</p>
                </div>
                <div className="text-left">
                  <p className="text-lg font-bold text-slate-900" dir="ltr">{report.price.toLocaleString()} {report.currency}</p>
                  <p className="text-sm text-amber-500" dir="rtl">{stars.visual}</p>
                </div>
              </div>

              <p className="mt-1 text-sm font-semibold text-slate-700">
                التقييم الإجمالي: <span dir="ltr">{report.overallScore}/100</span> — {report.recommendationLabel}
              </p>

              {/* Why Rahhal recommends */}
              {report.whyRahhalRecommends.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-600">لماذا يوصي به رحّال:</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                    {report.whyRahhalRecommends.map((text, j) => <li key={j}>{text}</li>)}
                  </ul>
                </div>
              )}

              {/* Strengths */}
              {report.advantages.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-emerald-700">نقاط القوة:</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                    {report.advantages.map((text, j) => <li key={j}>{text}</li>)}
                  </ul>
                </div>
              )}

              {/* Weaknesses */}
              {report.disadvantages.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-rose-700">نقاط الضعف:</p>
                  <ul className="mt-1 list-inside list-disc text-xs text-slate-700">
                    {report.disadvantages.map((text, j) => <li key={j}>{text}</li>)}
                  </ul>
                </div>
              )}

              {/* Best suited for */}
              {report.bestSuitedFor.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-bold text-slate-600">مناسب لـ:</p>
                  <p className="text-xs text-slate-700">{report.bestSuitedFor.join('، ')}</p>
                </div>
              )}

              {/* Category scores */}
              {(() => {
                const opt = rankedOptions.find(o => o.id === report.optionId)
                if (!opt?.decisionScore) return null
                return (
                  <div className="mt-3">
                    <p className="text-xs font-bold text-slate-600">تفصيل النقاط:</p>
                    <table className="mt-1 w-full text-xs">
                      <tbody>
                        {opt.decisionScore.categories.map(cat => (
                          <tr key={cat.category}>
                            <td className="py-0.5 text-slate-600">{CATEGORY_LABELS[cat.category] ?? cat.category}</td>
                            <td className="py-0.5 text-left font-semibold text-slate-800" dir="ltr">{cat.score}/100</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-6 border-t border-slate-300 pt-3 text-center">
        <p className="text-xs text-slate-400">هذا التقرير تم إنشاؤه بواسطة رحّال — مستشار السفر الذكي</p>
      </div>
    </div>
  )
}

export const PrintableReport = memo(PrintableReportImpl)
