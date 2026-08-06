import { memo, useMemo } from 'react'
import {
  getNextBestQuestion,
  getNextOptionalQuestion,
  getMissingFields,
  isDecisionProfileReady,
  SESSION_FIELD_LABELS,
  type TravelSession,
} from '../utils/travelSession'

interface Props {
  session: TravelSession
}

function confidenceLevel(session: TravelSession): { label: string; color: string; percent: number } {
  const knownFields = session.completedFields.length
  const totalTracked = session.explicitFields.length + session.inferredFields.length
  if (totalTracked === 0) return { label: 'غير محدد', color: 'text-slate-400', percent: 0 }
  const ratio = Math.min(knownFields / Math.max(totalTracked, 1), 1)
  if (ratio >= 0.8) return { label: 'مرتفعة', color: 'text-emerald-600', percent: Math.round(ratio * 100) }
  if (ratio >= 0.5) return { label: 'متوسطة', color: 'text-amber-600', percent: Math.round(ratio * 100) }
  return { label: 'منخفضة', color: 'text-rose-500', percent: Math.round(ratio * 100) }
}

function recommendationQuality(session: TravelSession): { label: string; stars: string } {
  if (session.completionPercentage >= 90) return { label: 'ممتازة', stars: '★★★★★' }
  if (session.completionPercentage >= 70) return { label: 'جيدة جداً', stars: '★★★★☆' }
  if (session.completionPercentage >= 50) return { label: 'جيدة', stars: '★★★☆☆' }
  if (session.completionPercentage >= 30) return { label: 'محدودة', stars: '★★☆☆☆' }
  return { label: 'ضعيفة', stars: '★☆☆☆☆' }
}

function ProgressiveConversationCardImpl({ session }: Props) {
  const nextQuestion = useMemo(() => getNextBestQuestion(session), [session])
  const optionalQuestion = useMemo(() => getNextOptionalQuestion(session), [session])
  const missingFields = useMemo(() => getMissingFields(session), [session])
  const profileReady = useMemo(() => isDecisionProfileReady(session), [session])
  const confidence = useMemo(() => confidenceLevel(session), [session])
  const quality = useMemo(() => recommendationQuality(session), [session])

  const collectedCount = session.completedFields.length
  const totalCount = collectedCount + missingFields.length
  const collectedPercent = totalCount > 0 ? Math.round((collectedCount / totalCount) * 100) : 0

  return (
    <section
      aria-labelledby="conversation-heading"
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <h3 id="conversation-heading" className="text-sm font-bold text-slate-900">
            تقدّم المحادثة
          </h3>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${confidence.color}`}>
          ثقة: {confidence.label}
        </span>
      </div>

      {/* Completion progress bar */}
      <div className="mb-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">اكتمال البيانات</span>
          <span className="text-xs font-bold text-primary-600">{session.completionPercentage}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
          role="progressbar"
          aria-valuenow={session.completionPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="نسبة اكتمال البيانات"
        >
          <div
            className="h-full rounded-full bg-gradient-to-l from-primary-400 to-primary-600 transition-all duration-700 ease-out"
            style={{ width: `${session.completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Collected vs Missing */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-emerald-50 p-3">
          <p className="text-[10px] font-medium text-emerald-500">المعلومات المجموعة</p>
          <p className="mt-0.5 text-lg font-bold text-emerald-700">{collectedCount}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-emerald-200/60">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${collectedPercent}%` }} />
          </div>
        </div>
        <div className="rounded-xl bg-rose-50 p-3">
          <p className="text-[10px] font-medium text-rose-500">المعلومات الناقصة</p>
          <p className="mt-0.5 text-lg font-bold text-rose-700">{missingFields.length}</p>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-rose-200/60">
            <div className="h-full rounded-full bg-rose-500 transition-all duration-500" style={{ width: `${100 - collectedPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Missing fields list */}
      {missingFields.length > 0 && !profileReady && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold text-slate-600">الحقول الناقصة:</p>
          <div className="flex flex-wrap gap-1.5">
            {missingFields.map(field => (
              <span
                key={field}
                className="rounded-full border border-rose-100 bg-rose-50/50 px-2.5 py-1 text-[10px] font-medium text-rose-500"
              >
                {SESSION_FIELD_LABELS[field] ?? field}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recommendation quality */}
      <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500">جودة التوصية المتوقعة</span>
          <div className="flex items-center gap-1.5">
            <span className="text-sm tracking-wider text-amber-400" dir="rtl">{quality.stars}</span>
            <span className="text-xs font-bold text-slate-700">{quality.label}</span>
          </div>
        </div>
      </div>

      {/* Next required question */}
      {nextQuestion && !profileReady && (
        <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4">
          <p className="text-xs font-bold text-primary-700">السؤال التالي المطلوب</p>
          <p className="mt-1.5 text-sm font-medium text-slate-700">{nextQuestion.text}</p>
          <div className="mt-3 flex items-start gap-2 border-t border-primary-100 pt-3">
            <span className="text-sm leading-6 text-primary-400">💡</span>
            <div>
              <p className="text-[10px] font-medium text-primary-500">لماذا أسأل هذا؟</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{nextQuestion.reason}</p>
            </div>
          </div>
        </div>
      )}

      {/* Profile ready but optional questions */}
      {profileReady && optionalQuestion && (
        <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4">
          <p className="text-xs font-bold text-amber-700">سؤال اختياري — يمكنك الإجابة أو تخطّيه</p>
          <p className="mt-1.5 text-sm font-medium text-slate-700">{optionalQuestion.text}</p>
        </div>
      )}

      {/* Profile ready and no more questions */}
      {profileReady && !optionalQuestion && (
        <div className="rounded-xl border border-success-200 bg-success-50 p-4 text-center">
          <p className="text-sm font-bold text-success-700">
            اكتملت كل المعلومات الأساسية! بيلامو جاهز للبحث.
          </p>
        </div>
      )}
    </section>
  )
}

export const ProgressiveConversationCard = memo(ProgressiveConversationCardImpl)
