import { memo, useMemo } from 'react'
import {
  getDisplayValue,
  SESSION_FIELD_LABELS,
  type TravelSession,
} from '../utils/travelSession'

interface Props {
  session: TravelSession
}

const PRIMARY_FIELDS: (keyof TravelSession)[] = [
  'destination',
  'departureCity',
  'departureDate',
  'durationDays',
  'adults',
  'children',
  'budgetAmount',
  'budgetCurrency',
  'tripPurpose',
]

const PREFERENCE_FIELDS: (keyof TravelSession)[] = [
  'cabinClass',
  'preferredHotelCategory',
  'accommodationPreference',
  'transportPreference',
  'directFlightPreference',
  'baggagePreference',
  'visaStatus',
  'interests',
]

function isFilled(session: TravelSession, field: keyof TravelSession): boolean {
  const val = session[field]
  if (val === null || val === undefined || val === '') return false
  if (typeof val === 'number' && val === 0) return false
  if (Array.isArray(val) && val.length === 0) return false
  return true
}

function PremiumLiveSummaryCardImpl({ session }: Props) {
  const primaryItems = useMemo(() => {
    return PRIMARY_FIELDS.map(field => ({
      field,
      label: SESSION_FIELD_LABELS[String(field)] ?? String(field),
      value: getDisplayValue(field, session),
      filled: isFilled(session, field),
    }))
  }, [session])

  const preferenceItems = useMemo(() => {
    return PREFERENCE_FIELDS.map(field => ({
      field,
      label: SESSION_FIELD_LABELS[String(field)] ?? String(field),
      value: getDisplayValue(field, session),
      filled: isFilled(session, field),
    }))
  }, [session])

  const filledCount = [...primaryItems, ...preferenceItems].filter(i => i.filled).length
  const totalCount = primaryItems.length + preferenceItems.length
  const completionPercent = Math.round((filledCount / totalCount) * 100)

  const profileReady = session.decisionProfileConfirmed

  return (
    <section
      aria-labelledby="summary-heading"
      className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📋</span>
          <h3 id="summary-heading" className="text-sm font-bold text-slate-900">ملخص رحلتك المباشر</h3>
        </div>
        {profileReady && (
          <span className="rounded-full bg-success-100 px-2.5 py-0.5 text-[10px] font-bold text-success-700">
            مؤكد
          </span>
        )}
      </div>

      {/* Completion ring */}
      <div className="mb-4 flex items-center justify-between rounded-xl bg-slate-50/60 px-4 py-3">
        <div>
          <p className="text-[10px] font-medium text-slate-400">اكتمال الملف</p>
          <p className="text-xl font-bold text-slate-800">{completionPercent}%</p>
        </div>
        <div className="relative h-12 w-12">
          <svg viewBox="0 0 44 44" className="h-12 w-12 -rotate-90">
            <circle cx="22" cy="22" r="18" fill="none" stroke="#e2e8f0" strokeWidth="3" />
            <circle
              cx="22"
              cy="22"
              r="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              className="text-primary-500 transition-all duration-700"
              strokeDasharray={`${(completionPercent / 100) * 113} 113`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-primary-600">
            {filledCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Primary fields */}
      <div className="mb-4">
        <p className="mb-2 text-[10px] font-bold text-slate-400">المعلومات الأساسية</p>
        <div className="grid grid-cols-2 gap-2">
          {primaryItems.map(item => (
            <div
              key={String(item.field)}
              className={`rounded-lg border px-3 py-2 transition-all duration-300 ${
                item.filled
                  ? 'border-emerald-100 bg-emerald-50/40'
                  : 'border-slate-100 bg-slate-50/30'
              }`}
            >
              <p className="text-[9px] font-medium text-slate-400">{item.label}</p>
              <p className={`mt-0.5 truncate text-xs font-bold ${
                item.filled ? 'text-slate-800' : 'text-slate-300'
              }`}>
                {item.filled ? item.value : '—'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Preference fields */}
      <div>
        <p className="mb-2 text-[10px] font-bold text-slate-400">التفضيلات</p>
        <div className="flex flex-wrap gap-1.5">
          {preferenceItems.map(item => (
            <span
              key={String(item.field)}
              className={`rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all duration-300 ${
                item.filled
                  ? 'border-primary-200 bg-primary-50 text-primary-700'
                  : 'border-slate-100 bg-slate-50 text-slate-300'
              }`}
            >
              {item.filled ? `${item.label}: ${item.value}` : item.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export const PremiumLiveSummaryCard = memo(PremiumLiveSummaryCardImpl)
