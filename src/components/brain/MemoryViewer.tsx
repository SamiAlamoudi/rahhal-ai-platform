import type { BrainMemorySlot, ConversationMemory } from '../../lib/brain'

export interface MemoryViewerProps {
  memory: ConversationMemory
  missingFields?: BrainMemorySlot[]
  className?: string
}

export function MemoryViewer({
  memory,
  missingFields = [],
  className = '',
}: MemoryViewerProps) {
  const rows: Array<[string, string]> = [
    ['destination', memory.destination ?? '—'],
    ['origin', memory.origin ?? '—'],
    [
      'budget',
      memory.budget.flexible
        ? 'flexible'
        : memory.budget.amount != null
          ? `${memory.budget.amount} ${memory.budget.currency ?? ''}`.trim()
          : '—',
    ],
    [
      'dates',
      memory.travelDates.startDate && memory.travelDates.endDate
        ? `${memory.travelDates.startDate}→${memory.travelDates.endDate}`
        : memory.travelDates.durationDays != null
          ? `${memory.travelDates.durationDays}d`
          : memory.travelDates.flexible
            ? 'flexible'
            : '—',
    ],
    [
      'travelers',
      memory.travelers.count != null
        ? `${memory.travelers.count}` +
          (memory.travelers.adults != null
            ? ` (A${memory.travelers.adults}/C${memory.travelers.children ?? 0}/I${memory.travelers.infants ?? 0})`
            : '')
        : '—',
    ],
    ['cabin', memory.cabinClass ?? '—'],
    ['airlines', memory.airlinePreferences.join(', ') || '—'],
    [
      'hotel',
      memory.hotelRequirement == null
        ? memory.hotelPreferences.join(', ') || '—'
        : `${memory.hotelRequirement ? 'yes' : 'no'}${
            memory.hotelPreferences.length
              ? ` · ${memory.hotelPreferences.join(', ')}`
              : ''
          }`,
    ],
    ['activities', memory.activities.join(', ') || '—'],
    ['visa', memory.visaRequirements ?? '—'],
    ['lang', memory.conversationLanguage],
    ['currency', memory.currency ?? memory.budget.currency ?? '—'],
  ]

  return (
    <section
      data-testid="brain-memory-viewer"
      className={`rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ${className}`}
    >
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Memory
      </h3>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-slate-400">{k}</dt>
            <dd className="truncate font-medium text-slate-800">{v}</dd>
          </div>
        ))}
      </dl>
      {missingFields.length > 0 ? (
        <p className="mt-2 text-[10px] text-amber-700">
          Missing: {missingFields.join(', ')}
        </p>
      ) : null}
      {memory.askedFields.length > 0 ? (
        <p className="mt-1 text-[10px] text-slate-400">
          Asked: {memory.askedFields.join(', ')}
        </p>
      ) : null}
    </section>
  )
}
