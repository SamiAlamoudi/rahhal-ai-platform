export type StatusChipTone = 'neutral' | 'info' | 'success' | 'warning'

const TONE: Record<StatusChipTone, string> = {
  neutral: 'bg-slate-100 text-slate-600',
  info: 'bg-sky-50 text-sky-700',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-800',
}

export interface StatusChipProps {
  label: string
  tone?: StatusChipTone
  className?: string
}

export function StatusChip({ label, tone = 'neutral', className = '' }: StatusChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold ${TONE[tone]} ${className}`}
    >
      {label}
    </span>
  )
}
