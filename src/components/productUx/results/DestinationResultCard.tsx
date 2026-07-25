import type { DestinationResultView, ProductLocale } from '../../../lib/productUx'

export interface DestinationResultCardProps {
  destination: DestinationResultView
  locale?: ProductLocale
  onSelect?: (id: string) => void
}

export function DestinationResultCard({
  destination,
  locale = 'ar',
  onSelect,
}: DestinationResultCardProps) {
  return (
    <article
      data-testid={`destination-result-${destination.id}`}
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
    >
      <h3 className="text-sm font-bold text-slate-900">{destination.name}</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-600">{destination.reason}</p>
      {(destination.seasonHint || destination.budgetFit) && (
        <p className="mt-2 text-[11px] text-slate-500">
          {[destination.seasonHint, destination.budgetFit].filter(Boolean).join(' · ')}
        </p>
      )}
      {onSelect ? (
        <button
          type="button"
          onClick={() => onSelect(destination.id)}
          className="mt-3 min-h-10 rounded-xl bg-primary-600 px-3 text-xs font-bold text-white hover:bg-primary-700"
        >
          {locale === 'ar' ? 'استكشف' : 'Explore'}
        </button>
      ) : null}
    </article>
  )
}
