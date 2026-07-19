import type { Passenger, PassengerField, PassengerValidationResult } from '../../lib/passengers'
import { PassengerForm } from './PassengerForm'

export interface PassengerFormListProps {
  passengers: Passenger[]
  locale?: 'ar' | 'en'
  /** Per-passenger field messages keyed by passenger id. */
  errorsByPassenger?: Record<string, PassengerValidationResult['fieldMessages']>
  onChange: (id: string, field: PassengerField, value: string) => void
}

export function PassengerFormList({
  passengers,
  locale = 'en',
  errorsByPassenger = {},
  onChange,
}: PassengerFormListProps) {
  if (passengers.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        {locale === 'ar' ? 'لا يوجد مسافرون لهذا الحجز.' : 'No passengers for this booking.'}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {passengers.map((passenger, index) => (
        <PassengerForm
          key={passenger.id}
          passenger={passenger}
          index={index}
          locale={locale}
          fieldMessages={errorsByPassenger[passenger.id]}
          onChange={onChange}
        />
      ))}
    </div>
  )
}
