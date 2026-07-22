import type { BookingTravelerDraft, TravelerConfirmationResult } from '../../core'

export interface TravelerConfirmationFormProps {
  travelers: BookingTravelerDraft[]
  validation: TravelerConfirmationResult | null
  onChange: (travelers: BookingTravelerDraft[]) => void
  onAddTraveler?: () => void
  className?: string
}

/**
 * Sprint 102 — traveler confirmation step with required-field validation display.
 */
export function TravelerConfirmationForm({
  travelers,
  validation,
  onChange,
  onAddTraveler,
  className = '',
}: TravelerConfirmationFormProps) {
  const update = (id: string, patch: Partial<BookingTravelerDraft>) => {
    onChange(travelers.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const errorFor = (travelerId: string, field: string): string | null => {
    const hit = validation?.errors.find((e) => e.travelerId === travelerId && e.field === field)
    return hit?.message ?? null
  }

  return (
    <div
      data-testid="booking-assistant-traveler-form"
      className={`space-y-5 ${className}`}
    >
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Traveler confirmation</h2>
          <p className="text-sm text-slate-600">
            Complete required traveler details before booking.
          </p>
        </div>
        {onAddTraveler && (
          <button
            type="button"
            data-testid="booking-assistant-add-traveler"
            onClick={onAddTraveler}
            className="text-sm font-medium text-teal-800 hover:text-teal-950"
          >
            Add traveler
          </button>
        )}
      </div>

      {travelers.map((traveler, index) => (
        <fieldset
          key={traveler.id}
          data-testid={`booking-assistant-traveler-${index}`}
          className="space-y-3 border-t border-slate-200 pt-4"
        >
          <legend className="text-sm font-semibold text-slate-800">
            Traveler {index + 1}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="First name"
              value={traveler.firstName}
              error={errorFor(traveler.id, 'firstName')}
              testId={`traveler-${index}-firstName`}
              onChange={(v) => update(traveler.id, { firstName: v })}
            />
            <Field
              label="Last name"
              value={traveler.lastName}
              error={errorFor(traveler.id, 'lastName')}
              testId={`traveler-${index}-lastName`}
              onChange={(v) => update(traveler.id, { lastName: v })}
            />
            <Field
              label="Date of birth"
              value={traveler.dateOfBirth ?? ''}
              error={errorFor(traveler.id, 'dateOfBirth')}
              testId={`traveler-${index}-dateOfBirth`}
              type="date"
              onChange={(v) => update(traveler.id, { dateOfBirth: v || null })}
            />
            <Field
              label="Nationality"
              value={traveler.nationality ?? ''}
              error={errorFor(traveler.id, 'nationality')}
              testId={`traveler-${index}-nationality`}
              onChange={(v) => update(traveler.id, { nationality: v || null })}
            />
            <Field
              label="Passport number"
              value={traveler.passportNumber ?? ''}
              error={errorFor(traveler.id, 'passportNumber')}
              testId={`traveler-${index}-passportNumber`}
              onChange={(v) => update(traveler.id, { passportNumber: v || null })}
            />
            <Field
              label="Passport expiry"
              value={traveler.passportExpiry ?? ''}
              error={null}
              testId={`traveler-${index}-passportExpiry`}
              type="date"
              onChange={(v) => update(traveler.id, { passportExpiry: v || null })}
            />
          </div>
        </fieldset>
      ))}
    </div>
  )
}

function Field(props: {
  label: string
  value: string
  error: string | null
  testId: string
  type?: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600">{props.label}</span>
      <input
        data-testid={props.testId}
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className={`w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-700/30 ${
          props.error ? 'border-rose-400' : 'border-slate-300'
        }`}
      />
      {props.error && (
        <span className="block text-xs text-rose-600">{props.error}</span>
      )}
    </label>
  )
}
