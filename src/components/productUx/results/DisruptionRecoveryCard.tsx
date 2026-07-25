import type { ProductLocale } from '../../../lib/productUx'

export interface DisruptionRecoveryCardProps {
  locale?: ProductLocale
  title?: string
  recommendation: string
  onAccept?: () => void
}

export function DisruptionRecoveryCard({
  locale = 'ar',
  title,
  recommendation,
  onAccept,
}: DisruptionRecoveryCardProps) {
  const heading =
    title ?? (locale === 'ar' ? 'توصية التعافي من التعطيل' : 'Disruption recovery recommendation')

  return (
    <section
      data-testid="disruption-recovery-card"
      className="rounded-2xl border border-rose-200/70 bg-rose-50/50 p-4 shadow-sm"
    >
      <h3 className="text-sm font-bold text-slate-900">{heading}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-700">{recommendation}</p>
      {onAccept ? (
        <button
          type="button"
          onClick={onAccept}
          className="mt-3 min-h-10 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
        >
          {locale === 'ar' ? 'اعتماد التوصية' : 'Accept recommendation'}
        </button>
      ) : null}
    </section>
  )
}
