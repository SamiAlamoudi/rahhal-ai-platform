import { useEffect, useMemo, useState } from 'react'
import type { FlightOffer } from '../utils/contracts/models/flight'
import type { HotelOffer } from '../utils/contracts/models/hotel'
import type { TripItineraryResult } from '../utils/tripPlanner'

function formatMoney(amount: number | null, currency: string): string {
  if (amount === null || Number.isNaN(amount)) return '—'
  try {
    return new Intl.NumberFormat('ar-SA', {
      style: 'currency',
      currency: currency || 'SAR',
      maximumFractionDigits: 0,
    }).format(amount)
  } catch {
    return `${Math.round(amount).toLocaleString('ar-SA')} ${currency}`
  }
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const t = Date.parse(`${iso}T00:00:00Z`)
  if (Number.isNaN(t)) return iso
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(t))
}

function travelerLabel(summary: TripItineraryResult['summary']): string {
  const parts: string[] = []
  if (summary.travelers.adults > 0) parts.push(`${summary.travelers.adults} بالغ`)
  if (summary.travelers.children > 0) parts.push(`${summary.travelers.children} طفل`)
  if (summary.travelers.infants > 0) parts.push(`${summary.travelers.infants} رضيع`)
  return parts.join(' · ') || '—'
}

function sourceLabel(source: string): string {
  if (source === 'real') return 'مباشر'
  if (source === 'fallback') return 'احتياطي'
  if (source === 'mock') return 'تجريبي'
  return '—'
}

function FlightOfferCard({
  offer,
  selected,
  onSelect,
}: {
  offer: FlightOffer
  selected: boolean
  onSelect: () => void
}) {
  const first = offer.itinerary.segments[0]
  const last = offer.itinerary.segments[offer.itinerary.segments.length - 1]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-right overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md ${
        selected ? 'border-primary-200 ring-1 ring-primary-100' : 'border-slate-100 hover:border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{offer.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {first?.origin ?? '—'} → {last?.destination ?? '—'}
            {offer.itinerary.stops === 0 ? ' · مباشر' : ` · ${offer.itinerary.stops} توقف`}
          </p>
        </div>
        <div className="text-left">
          <p className="text-base font-bold text-primary-700">{formatMoney(offer.price, offer.currency)}</p>
          {selected && (
            <p className="mt-0.5 text-[10px] font-bold text-primary-500">مختار</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3 text-[11px] text-slate-500">
        {first?.carrier && <span className="rounded-full bg-slate-50 px-2 py-1">{first.carrier}</span>}
        {first?.cabin && <span className="rounded-full bg-slate-50 px-2 py-1">{first.cabin}</span>}
        {offer.itinerary.baggageIncluded && (
          <span className="rounded-full bg-success-50 px-2 py-1 text-success-700">أمتعة مشمولة</span>
        )}
      </div>
    </button>
  )
}

function HotelOfferCard({
  offer,
  selected,
  onSelect,
}: {
  offer: HotelOffer
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full text-right overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:shadow-md ${
        selected ? 'border-primary-200 ring-1 ring-primary-100' : 'border-slate-100 hover:border-slate-200'
      }`}
    >
      <div className="flex items-start justify-between gap-3 border-b border-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-slate-900">{offer.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {offer.location || offer.area || '—'}
            {offer.hotelStars > 0 ? ` · ${offer.hotelStars}★` : ''}
          </p>
        </div>
        <div className="text-left">
          <p className="text-base font-bold text-primary-700">{formatMoney(offer.price, offer.currency)}</p>
          {selected && (
            <p className="mt-0.5 text-[10px] font-bold text-primary-500">مختار</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-4 py-3 text-[11px] text-slate-500">
        {offer.breakfastIncluded && (
          <span className="rounded-full bg-slate-50 px-2 py-1">إفطار</span>
        )}
        {offer.freeCancellation && (
          <span className="rounded-full bg-success-50 px-2 py-1 text-success-700">إلغاء مجاني</span>
        )}
        {offer.familyFriendly && (
          <span className="rounded-full bg-slate-50 px-2 py-1">مناسب للعائلة</span>
        )}
        {offer.rating != null && (
          <span className="rounded-full bg-slate-50 px-2 py-1">تقييم {offer.rating}</span>
        )}
      </div>
    </button>
  )
}

export interface TripBookingSelection {
  flight: FlightOffer
  hotel: HotelOffer
  estimatedTotal: number
  currency: string
}

export interface TripItineraryResultsProps {
  result: TripItineraryResult
  onContinueToBooking?: (selection: TripBookingSelection) => void
  continuing?: boolean
  continueError?: string | null
}

export default function TripItineraryResults({
  result,
  onContinueToBooking,
  continuing = false,
  continueError = null,
}: TripItineraryResultsProps) {
  const { summary, estimatedCost, flights, hotels, selectedFlight, selectedHotel, sources, errors } = result
  const domainErrors = errors.filter((e) => e.domain !== 'validation')

  const [pickedFlightId, setPickedFlightId] = useState<string | null>(selectedFlight?.id ?? flights[0]?.id ?? null)
  const [pickedHotelId, setPickedHotelId] = useState<string | null>(selectedHotel?.id ?? hotels[0]?.id ?? null)

  useEffect(() => {
    setPickedFlightId(selectedFlight?.id ?? flights[0]?.id ?? null)
    setPickedHotelId(selectedHotel?.id ?? hotels[0]?.id ?? null)
  }, [result.requestId, selectedFlight?.id, selectedHotel?.id, flights, hotels])

  const pickedFlight = useMemo(
    () => flights.find((f) => f.id === pickedFlightId) ?? null,
    [flights, pickedFlightId],
  )
  const pickedHotel = useMemo(
    () => hotels.find((h) => h.id === pickedHotelId) ?? null,
    [hotels, pickedHotelId],
  )

  const packageTotal =
    pickedFlight && pickedHotel ? pickedFlight.price + pickedHotel.price : null
  const canContinue = !!pickedFlight && !!pickedHotel && !!onContinueToBooking

  return (
    <div className="space-y-6" role="region" aria-label="خطة الرحلة">
      <section className="overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900">ملخص الرحلة</h2>
          <div className="flex gap-1.5 text-[10px] font-bold text-slate-400">
            <span className="rounded-full bg-slate-50 px-2 py-1">طيران: {sourceLabel(sources.flight)}</span>
            <span className="rounded-full bg-slate-50 px-2 py-1">فندق: {sourceLabel(sources.hotel)}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-medium text-slate-400">من</p>
            <p className="text-sm font-bold text-slate-800">{summary.origin}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400">إلى</p>
            <p className="text-sm font-bold text-slate-800">{summary.destination}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400">المسافرون</p>
            <p className="text-sm font-bold text-slate-800">{travelerLabel(summary)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400">المغادرة</p>
            <p className="text-sm font-bold text-slate-800">{formatDate(summary.departureDate)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400">العودة</p>
            <p className="text-sm font-bold text-slate-800">{formatDate(summary.returnDate)}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400">المدة</p>
            <p className="text-sm font-bold text-slate-800">{summary.nights} ليلة · {summary.durationDays} يوم</p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-primary-100 bg-gradient-to-bl from-primary-50/50 to-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-slate-900">التكلفة التقديرية للباقة</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <p className="text-[10px] font-medium text-slate-400">الطيران</p>
            <p className="text-sm font-bold text-slate-800">
              {formatMoney(pickedFlight?.price ?? estimatedCost.flight, estimatedCost.currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400">الفندق</p>
            <p className="text-sm font-bold text-slate-800">
              {formatMoney(pickedHotel?.price ?? estimatedCost.hotel, estimatedCost.currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400">الإجمالي</p>
            <p className="text-base font-bold text-primary-700">
              {formatMoney(packageTotal ?? estimatedCost.total, estimatedCost.currency)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-slate-400">الميزانية</p>
            <p className="text-sm font-bold text-slate-800">{formatMoney(estimatedCost.budgetAmount, estimatedCost.currency)}</p>
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
          اختر رحلة فندق واحدةثم واصل إلى مراجعة الحجز. لا يشمل الدفع في هذه المرحلة.
        </p>
      </section>

      {domainErrors.length > 0 && (
        <div className="rounded-2xl border border-amber-100 bg-amber-50/70 px-5 py-3">
          <p className="text-xs font-bold text-amber-800">تنبيهات جزئية من المزوّدين</p>
          <ul className="mt-1 space-y-0.5 text-xs text-amber-700">
            {domainErrors.map((err, i) => (
              <li key={`${err.domain}-${i}`}>
                {err.domain === 'flight' ? 'الطيران' : 'الفندق'}: {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">رحلات الطيران</h2>
          <span className="text-xs text-slate-400">{flights.length} خيار</span>
        </div>
        {flights.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-center">
            <p className="text-sm text-slate-500">لا توجد رحلات متاحة لهذه الخطة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {flights.map((offer) => (
              <FlightOfferCard
                key={offer.id}
                offer={offer}
                selected={pickedFlightId === offer.id}
                onSelect={() => setPickedFlightId(offer.id)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">الفنادق</h2>
          <span className="text-xs text-slate-400">{hotels.length} خيار</span>
        </div>
        {hotels.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-5 text-center">
            <p className="text-sm text-slate-500">لا توجد فنادق متاحة لهذه الخطة حالياً.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hotels.map((offer) => (
              <HotelOfferCard
                key={offer.id}
                offer={offer}
                selected={pickedHotelId === offer.id}
                onSelect={() => setPickedHotelId(offer.id)}
              />
            ))}
          </div>
        )}
      </section>

      {onContinueToBooking && (
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
          {!canContinue && (
            <p className="text-center text-xs text-amber-700">اختر رحلة طيران وفندقًا واحدًا للمتابعة.</p>
          )}
          {continueError && (
            <p className="text-center text-xs font-medium text-rose-600">{continueError}</p>
          )}
          <button
            type="button"
            disabled={!canContinue || continuing}
            onClick={() => {
              if (!pickedFlight || !pickedHotel) return
              onContinueToBooking({
                flight: pickedFlight,
                hotel: pickedHotel,
                estimatedTotal: pickedFlight.price + pickedHotel.price,
                currency: summary.currency,
              })
            }}
            className="w-full rounded-2xl bg-primary-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary-600/25 transition-all hover:bg-primary-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
          >
            {continuing ? 'جاري إنشاء جلسة الحجز...' : 'المتابعة إلى الحجز'}
          </button>
        </div>
      )}
    </div>
  )
}
