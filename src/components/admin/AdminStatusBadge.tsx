const COLOR_MAP: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700',
  completed: 'bg-emerald-100 text-emerald-700',
  confirmed: 'bg-emerald-100 text-emerald-700',
  paid: 'bg-emerald-100 text-emerald-700',
  pending: 'bg-amber-100 text-amber-700',
  ready: 'bg-sky-100 text-sky-700',
  redirected: 'bg-sky-100 text-sky-700',
  draft: 'bg-slate-100 text-slate-600',
  suspended: 'bg-rose-100 text-rose-700',
  cancelled: 'bg-slate-100 text-slate-500',
  expired: 'bg-rose-100 text-rose-600',
  failed: 'bg-rose-100 text-rose-600',
  refunded: 'bg-indigo-100 text-indigo-700',
}

interface AdminStatusBadgeProps {
  status: string
  label: string
}

export default function AdminStatusBadge({ status, label }: AdminStatusBadgeProps) {
  const color = COLOR_MAP[status] ?? 'bg-slate-100 text-slate-600'
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${color}`}>
      {label}
    </span>
  )
}
