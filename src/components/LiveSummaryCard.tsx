import {
  getDisplayValue,
  SESSION_FIELD_LABELS,
  type TravelSession,
} from '../utils/travelSession'

const SUMMARY_FIELDS: (keyof TravelSession)[] = [
  'destination',
  'adults',
  'budgetAmount',
  'durationDays',
  'departureDate',
  'departureCity',
  'children',
  'tripPurpose',
  'visaStatus',
]

interface Props {
  session: TravelSession
}

export default function LiveSummaryCard({ session }: Props) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-base">📋</span>
        <h2 className="text-sm font-bold text-slate-900">ملخص رحلتك</h2>
      </div>
      <div className="flex flex-wrap gap-2">
        {SUMMARY_FIELDS.map(field => {
          const val = session[field]
          const known = val !== null && val !== undefined && val !== '' && !(typeof val === 'number' && val === 0)
          const label = SESSION_FIELD_LABELS[String(field)] ?? String(field)
          const display = known ? getDisplayValue(field, session) : label
          return (
            <div
              key={String(field)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300 ${
                known
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-slate-50 text-slate-400 border border-slate-100'
              }`}
            >
              <span className={`text-[10px] ${known ? 'text-emerald-500' : 'text-slate-300'}`}>
                {known ? '✓' : '○'}
              </span>
              <span className={known ? 'font-bold' : ''}>
                {known ? `${label}: ${display}` : label}
              </span>
            </div>
          )
        })}
      </div>
    </section>
  )
}
