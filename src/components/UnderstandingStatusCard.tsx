import {
  getDisplayValue,
  SESSION_FIELD_LABELS,
  SESSION_FIELD_ICONS,
  type TravelSession,
} from '../utils/travelSession'

const FIELDS_TO_SHOW: (keyof TravelSession)[] = [
  'destination',
  'departureCity',
  'departureDate',
  'durationDays',
  'adults',
  'children',
  'budgetAmount',
  'tripPurpose',
  'visaStatus',
]

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'ثقة مرتفعة',
  medium: 'ثقة متوسطة',
  low: 'يحتاج تأكيد',
  none: 'يحتاج تأكيد',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-500',
  none: 'bg-slate-100 text-slate-500',
}

interface Props {
  session: TravelSession
}

export default function UnderstandingStatusCard({ session }: Props) {
  const knownExplicit = FIELDS_TO_SHOW.filter(f => {
    const val = session[f]
    return val !== null && val !== undefined && val !== '' && !(typeof val === 'number' && val === 0)
  })

  const inferredToShow = session.inferredFields.filter(f => {
    return FIELDS_TO_SHOW.includes(f as keyof TravelSession) === false
  }).slice(0, 4) as (keyof TravelSession)[]

  if (knownExplicit.length === 0 && inferredToShow.length === 0) return null

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <span className="text-lg">🧠</span>
        <h2 className="text-base font-bold text-slate-900">ما فهمه رحّال</h2>
      </div>

      {knownExplicit.length > 0 && (
        <div className="mb-4">
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-3.5 w-1 rounded-full bg-primary-500" />
            <h3 className="text-xs font-bold text-slate-600">معلومات ذكرتها</h3>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {knownExplicit.map(field => (
              <div key={String(field)} className="flex items-start gap-2.5 rounded-xl bg-slate-50 px-4 py-3">
                <span className="text-base leading-none">{SESSION_FIELD_ICONS[String(field)] ?? '📌'}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-400">{SESSION_FIELD_LABELS[String(field)] ?? field}</p>
                  <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{getDisplayValue(field, session)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {inferredToShow.length > 0 && (
        <div>
          <div className="mb-2.5 flex items-center gap-2">
            <span className="h-3.5 w-1 rounded-full bg-amber-400" />
            <h3 className="text-xs font-bold text-slate-600">استنتاجات رحّال</h3>
          </div>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {inferredToShow.map(field => {
              const conf = session.inferenceConfidence?.[String(field)] ?? session.fieldConfidence?.[String(field)] ?? ''
              const confText = CONFIDENCE_LABELS[conf] ?? ''
              const confColor = CONFIDENCE_COLORS[conf] ?? CONFIDENCE_COLORS.none
              return (
                <div key={String(field)} className="flex items-start justify-between gap-2 rounded-xl bg-amber-50/40 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-400">{SESSION_FIELD_LABELS[String(field)] ?? field}</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{getDisplayValue(field, session)}</p>
                  </div>
                  {confText && (
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${confColor}`}>
                      {confText}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
