import { ArrowLeft, ArrowRight } from 'lucide-react'
import { SearchResult } from './SearchResult'
import { cn } from '../lib/cn'

export interface FlightCardProps {
  airline: string
  origin: string
  destination: string
  departTime: string
  arriveTime: string
  duration: string
  stopsLabel: string
  priceLabel: string
  highlighted?: boolean
  reason?: string
  /** Quiet role label: Best overall / Lowest price / Fastest */
  kindLabel?: string | null
  /** Bilamo Score 0–100 */
  score?: number | null
  baggageSummary?: string | null
  cabinLabel?: string | null
  onSelect?: () => void
  onCompare?: () => void
  onViewDetails?: () => void
  /** Traveler has chosen this option. */
  selected?: boolean
  /** Action labels locale — defaults to English. */
  locale?: 'ar' | 'en'
  /** Quieter secondary alternative row (cheapest / fastest). */
  variant?: 'hero' | 'alternative'
  className?: string
}

function airlineMark(airline: string): string {
  const cleaned = airline.trim()
  if (!cleaned) return '✈'
  const parts = cleaned.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

function localizeStops(stopsLabel: string, locale: 'ar' | 'en'): string {
  if (locale !== 'ar') return stopsLabel
  if (/nonstop|direct/i.test(stopsLabel) || /مباشر|غير متوقف/.test(stopsLabel)) return 'مباشرة'
  if (/1\s*stop/i.test(stopsLabel)) return 'توقف واحد'
  if (/(\d+)\s*stops?/i.test(stopsLabel)) {
    const n = stopsLabel.match(/(\d+)/)?.[1]
    return n ? `${n} توقفات` : stopsLabel
  }
  return stopsLabel
}

function localizeDuration(duration: string, locale: 'ar' | 'en'): string {
  if (locale !== 'ar') return duration
  return duration
    .replace(/\bh\b/gi, 'س')
    .replace(/\bm\b/gi, 'د')
    .replace(/hours?/gi, 'س')
    .replace(/mins?|minutes?/gi, 'د')
}

function localizeBaggage(baggage: string, locale: 'ar' | 'en'): string {
  if (locale !== 'ar') return baggage
  if (/carry|cabin/i.test(baggage) && /check/i.test(baggage)) return 'حقيبة مقصورة + شحن'
  if (/carry|cabin/i.test(baggage)) return 'حقيبة مقصورة'
  if (/check/i.test(baggage)) return 'حقيبة شحن'
  return baggage
}

export function FlightCard({
  airline,
  origin,
  destination,
  departTime,
  arriveTime,
  duration,
  stopsLabel,
  priceLabel,
  highlighted,
  reason,
  kindLabel,
  score,
  baggageSummary,
  cabinLabel,
  onSelect,
  onCompare,
  onViewDetails,
  selected = false,
  locale = 'en',
  variant,
  className,
}: FlightCardProps) {
  const isHero = variant ? variant === 'hero' : Boolean(highlighted || selected)
  const labels = locale === 'ar'
    ? {
        select: 'اختيار',
        compare: 'مقارنة',
        details: 'التفاصيل',
        selected: 'تم الاختيار',
        score: 'درجة بيلامو',
        bag: 'أمتعة',
        cabin: 'الدرجة',
      }
    : {
        select: 'Select',
        compare: 'Compare',
        details: 'View details',
        selected: 'Selected',
        score: 'Bilamo Score',
        bag: 'Bags',
        cabin: 'Cabin',
      }

  const stops = localizeStops(stopsLabel, locale)
  const dur = localizeDuration(duration, locale)
  const bags = baggageSummary ? localizeBaggage(baggageSummary, locale) : null
  const RouteArrow = locale === 'ar' ? ArrowLeft : ArrowRight

  const shortReason = reason
    ? reason.split(/(?<=[.!?؟])\s+/).slice(0, 2).join(' ').trim()
    : undefined

  const metaParts = isHero
    ? [
        dur,
        stops,
        bags ? `${labels.bag} ${bags}` : null,
        cabinLabel ? `${labels.cabin} ${cabinLabel}` : null,
      ]
    : [dur, stops, bags]
  const meta = metaParts.filter(Boolean).join(' · ')

  const showActions = Boolean(onSelect || onCompare || onViewDetails)
  const mark = airlineMark(airline)

  if (!isHero) {
    return (
      <div className={cn('space-y-0.5', className)} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
        <SearchResult
          title={kindLabel || `${origin} → ${destination}`}
          subtitle={`${airline} · ${meta}`}
          priceLabel={priceLabel}
          highlighted={false}
          selected={selected}
          reason={undefined}
          interactive={false}
        />
        {showActions ? (
          <div
            className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-2"
            role="group"
            aria-label={`${airline} flight actions`}
          >
            {onSelect ? (
              <button
                type="button"
                onClick={onSelect}
                disabled={selected}
                className="min-h-11 text-[13px] tracking-[-0.01em] text-[var(--bilamo-text)]/75 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)] disabled:opacity-60 disabled:no-underline"
              >
                {selected ? labels.selected : labels.select}
              </button>
            ) : null}
            {onCompare ? (
              <button
                type="button"
                onClick={onCompare}
                className="min-h-11 text-[13px] tracking-[-0.01em] text-[var(--bilamo-muted)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
              >
                {labels.compare}
              </button>
            ) : null}
            {onViewDetails ? (
              <button
                type="button"
                onClick={onViewDetails}
                className="min-h-11 text-[13px] tracking-[-0.01em] text-[var(--bilamo-muted)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
              >
                {labels.details}
              </button>
            ) : null}
          </div>
        ) : null}
        {shortReason ? (
          <p className="px-5 pb-2 text-[12.5px] leading-relaxed text-[var(--bilamo-muted)]/90">
            {shortReason}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-0.5', className)} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <div
        className={cn(
          'bilamo-glass w-full rounded-[1.35rem] px-5 py-5 text-start transition-colors',
          selected
            ? 'ring-1 ring-[color-mix(in_srgb,var(--bilamo-secondary)_55%,transparent)]'
            : null,
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--bilamo-border)] bg-[color-mix(in_srgb,var(--bilamo-text)_6%,transparent)] text-[12px] font-medium tracking-wide text-[var(--bilamo-text)]/85"
            >
              {mark}
            </div>
            <div className="min-w-0 space-y-1">
              {kindLabel ? (
                <p className="text-[12px] tracking-[-0.01em] text-[var(--bilamo-secondary)]/90">
                  {kindLabel}
                </p>
              ) : null}
              <h3 className="truncate text-[1.1rem] font-medium tracking-[-0.03em] text-[var(--bilamo-text)]">
                {airline}
              </h3>
              <p className="text-[13px] text-[var(--bilamo-muted)]/90">
                {origin} → {destination}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-end">
            <p className="tabular-nums text-[1.2rem] font-medium tracking-[-0.03em] text-[var(--bilamo-text)]">
              {priceLabel}
            </p>
            {score != null ? (
              <p className="mt-1 text-[11.5px] tracking-[-0.01em] text-[var(--bilamo-secondary)]/95">
                {labels.score} {score}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 text-[15px] tabular-nums tracking-[-0.02em] text-[var(--bilamo-text)]/90">
          <span>{departTime}</span>
          <RouteArrow className="h-3.5 w-3.5 opacity-45" strokeWidth={1.5} aria-hidden />
          <span>{arriveTime}</span>
        </div>
        <p className="mt-1.5 text-[12.5px] text-[var(--bilamo-muted)]/90">{meta}</p>

        {shortReason ? (
          <p className="mt-3 max-w-[36ch] text-[13.5px] leading-relaxed text-[var(--bilamo-text)]/72">
            {shortReason}
          </p>
        ) : null}
      </div>

      {showActions ? (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 pb-1 pt-1"
          role="group"
          aria-label={`${airline} flight actions`}
        >
          {onSelect ? (
            <button
              type="button"
              onClick={onSelect}
              disabled={selected}
              className="min-h-11 text-[13px] tracking-[-0.01em] text-[var(--bilamo-text)]/80 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)] disabled:opacity-60 disabled:no-underline"
            >
              {selected ? labels.selected : labels.select}
            </button>
          ) : null}
          {onCompare ? (
            <button
              type="button"
              onClick={onCompare}
              className="min-h-11 text-[13px] tracking-[-0.01em] text-[var(--bilamo-muted)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
            >
              {labels.compare}
            </button>
          ) : null}
          {onViewDetails ? (
            <button
              type="button"
              onClick={onViewDetails}
              className="min-h-11 text-[13px] tracking-[-0.01em] text-[var(--bilamo-muted)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--bilamo-secondary)]"
            >
              {labels.details}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
