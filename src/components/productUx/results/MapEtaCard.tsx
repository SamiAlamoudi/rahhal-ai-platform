import type { ProductLocale } from '../../../lib/productUx'

export interface MapEtaCardProps {
  locale?: ProductLocale
  label: string
  etaLabel: string
  query?: string
}

export function MapEtaCard({ locale = 'ar', label, etaLabel, query }: MapEtaCardProps) {
  return (
    <section
      data-testid="map-eta-card"
      className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
      aria-label={locale === 'ar' ? 'خريطة ووقت الوصول' : 'Map and ETA'}
    >
      <h3 className="text-sm font-bold text-slate-900">{label}</h3>
      <p className="mt-1 text-xs text-slate-500">
        {locale === 'ar' ? 'الوقت المتوقع' : 'ETA'}: {etaLabel}
      </p>
      <div
        className="mt-3 flex h-24 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-sky-50 text-xs text-slate-500"
        aria-hidden
      >
        {query || (locale === 'ar' ? 'معاينة الخريطة' : 'Map preview')}
      </div>
    </section>
  )
}
