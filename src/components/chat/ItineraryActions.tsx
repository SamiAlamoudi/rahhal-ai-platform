import { useState } from 'react'
import type { TripPlan } from '../../lib/agent/types'

interface ItineraryActionsProps {
  itinerary: TripPlan
  busy?: boolean
  onSave: () => void
  onRegenerate: () => void
  onRegenerateDay: (day: number) => void
  onEditSubmit: (patchText: string) => void
}

export default function ItineraryActions({
  itinerary,
  busy = false,
  onSave,
  onRegenerate,
  onRegenerateDay,
  onEditSubmit,
}: ItineraryActionsProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [day, setDay] = useState(1)
  const locale = itinerary.locale

  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-2">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onSave}
          className="rounded-lg bg-primary-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-primary-700 disabled:opacity-40"
        >
          {locale === 'en' ? 'Save plan' : 'حفظ الخطة'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onRegenerate}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {locale === 'en' ? 'Regenerate trip' : 'إعادة توليد الرحلة'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setEditing((v) => !v)
            setDraft(
              locale === 'en'
                ? `Edit: destination ${itinerary.destinations[0] || ''}, duration ${itinerary.durationDays} days, budget ${itinerary.estimatedBudget.amount} ${itinerary.estimatedBudget.currency}, ${itinerary.travelers ?? 2} travelers`
                : `عدّل: الوجهة ${itinerary.destinations[0] || ''}، المدة ${itinerary.durationDays} أيام، الميزانية ${itinerary.estimatedBudget.amount} ${itinerary.estimatedBudget.currency}، ${itinerary.travelers ?? 2} مسافرين`,
            )
          }}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {locale === 'en' ? 'Edit' : 'تعديل'}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-[11px] text-slate-500" htmlFor={`day-${itinerary.id}`}>
          {locale === 'en' ? 'Regenerate day' : 'إعادة توليد يوم'}
        </label>
        <select
          id={`day-${itinerary.id}`}
          value={day}
          disabled={busy}
          onChange={(e) => setDay(Number(e.target.value))}
          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700"
        >
          {Array.from({ length: itinerary.durationDays }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {locale === 'en' ? `Day ${n}` : `اليوم ${n}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={busy}
          onClick={() => onRegenerateDay(day)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {locale === 'en' ? 'Apply' : 'تطبيق'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <QuickEditButton
          label={locale === 'en' ? 'Edit budget' : 'تعديل الميزانية'}
          busy={busy}
          onClick={() => onEditSubmit(
            locale === 'en'
              ? `Edit: budget ${itinerary.estimatedBudget.amount} ${itinerary.estimatedBudget.currency}`
              : `عدّل: الميزانية ${itinerary.estimatedBudget.amount} ${itinerary.estimatedBudget.currency}`,
          )}
        />
        <QuickEditButton
          label={locale === 'en' ? 'Edit destination' : 'تعديل الوجهة'}
          busy={busy}
          onClick={() => onEditSubmit(
            locale === 'en'
              ? `Edit: destination ${itinerary.destinations[0] || 'Japan'}`
              : `عدّل: الوجهة ${itinerary.destinations[0] || 'اليابان'}`,
          )}
        />
        <QuickEditButton
          label={locale === 'en' ? 'Edit dates' : 'تعديل التواريخ'}
          busy={busy}
          onClick={() => onEditSubmit(
            locale === 'en'
              ? `Edit: duration ${itinerary.durationDays} days${itinerary.startDate ? ` starting ${itinerary.startDate}` : ''}`
              : `عدّل: المدة ${itinerary.durationDays} أيام${itinerary.startDate ? ` تبدأ ${itinerary.startDate}` : ''}`,
          )}
        />
        <QuickEditButton
          label={locale === 'en' ? 'Edit travelers' : 'تعديل المسافرين'}
          busy={busy}
          onClick={() => onEditSubmit(
            locale === 'en'
              ? `Edit: ${itinerary.travelers ?? 2} travelers`
              : `عدّل: ${itinerary.travelers ?? 2} مسافرين`,
          )}
        />
      </div>

      <div className="rounded-xl bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        <p>
          <span className="font-semibold">{locale === 'en' ? 'Destinations: ' : 'الوجهات: '}</span>
          {itinerary.destinations.join(locale === 'en' ? ', ' : '، ')}
        </p>
        <p>
          <span className="font-semibold">{locale === 'en' ? 'Budget: ' : 'الميزانية: '}</span>
          {itinerary.estimatedBudget.amount.toLocaleString('en-US')} {itinerary.estimatedBudget.currency}
        </p>
        <p>
          <span className="font-semibold">{locale === 'en' ? 'Days: ' : 'الأيام: '}</span>
          {itinerary.durationDays}
          {itinerary.travelers != null
            ? (locale === 'en' ? ` · ${itinerary.travelers} travelers` : ` · ${itinerary.travelers} مسافرين`)
            : ''}
        </p>
      </div>

      {editing && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (!draft.trim()) return
            onEditSubmit(draft.trim())
            setEditing(false)
          }}
        >
          <label className="block text-[11px] text-slate-500" htmlFor={`edit-${itinerary.id}`}>
            {locale === 'en'
              ? 'Describe the change (budget, destination, dates, travelers)'
              : 'صف التعديل (الميزانية، الوجهة، التواريخ، عدد المسافرين)'}
          </label>
          <textarea
            id={`edit-${itinerary.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
            >
              {locale === 'en' ? 'Apply edit' : 'تطبيق التعديل'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg px-3 py-1.5 text-[11px] text-slate-500"
            >
              {locale === 'en' ? 'Cancel' : 'إلغاء'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function QuickEditButton({
  label,
  busy,
  onClick,
}: {
  label: string
  busy: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      className="rounded-lg border border-dashed border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
    >
      {label}
    </button>
  )
}
