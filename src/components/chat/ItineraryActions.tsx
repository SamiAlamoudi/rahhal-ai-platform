import { useState } from 'react'
import type { TripPlan } from '../../lib/agent/types'

interface ItineraryActionsProps {
  itinerary: TripPlan
  busy?: boolean
  onSave: () => void
  onRegenerate: () => void
  onEditSubmit: (patchText: string) => void
}

export default function ItineraryActions({
  itinerary,
  busy = false,
  onSave,
  onRegenerate,
  onEditSubmit,
}: ItineraryActionsProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
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
          {locale === 'en' ? 'Regenerate' : 'إعادة التوليد'}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setEditing((v) => !v)
            setDraft(
              locale === 'en'
                ? `Edit: duration ${itinerary.durationDays} days, budget ${itinerary.estimatedBudget.amount} ${itinerary.estimatedBudget.currency}`
                : `عدّل: المدة ${itinerary.durationDays} أيام، الميزانية ${itinerary.estimatedBudget.amount} ${itinerary.estimatedBudget.currency}`,
            )
          }}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {locale === 'en' ? 'Edit' : 'تعديل'}
        </button>
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
              ? 'Describe the change (duration, budget, destination, notes)'
              : 'صف التعديل (المدة، الميزانية، الوجهة، ملاحظات)'}
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
