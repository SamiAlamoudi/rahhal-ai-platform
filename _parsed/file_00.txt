import type { TravelSession } from '../utils/travelSession'

interface Props {
  session: TravelSession
}

function statusText(completion: number): string {
  if (completion >= 100) return 'الخطة جاهزة للتأكيد'
  if (completion >= 60) return 'الخطة شبه مكتملة'
  return 'نحتاج بعض المعلومات'
}

function statusColor(completion: number): string {
  if (completion >= 100) return 'text-success-600'
  if (completion >= 60) return 'text-primary-600'
  return 'text-amber-600'
}

export default function PlanningProgressCard({ session }: Props) {
  const completion = session.completionPercentage
  const status = statusText(completion)

  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📊</span>
          <h2 className="text-sm font-bold text-slate-900">اكتمال خطة الرحلة</h2>
        </div>
        <span className={`text-sm font-bold ${statusColor(completion)}`}>
          {status}
        </span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-l from-primary-400 to-primary-600 transition-all duration-700 ease-out"
          style={{ width: `${completion}%` }}
        />
      </div>
      <p className="mt-1.5 text-left text-xs font-medium text-slate-400">{completion}%</p>
    </section>
  )
}
