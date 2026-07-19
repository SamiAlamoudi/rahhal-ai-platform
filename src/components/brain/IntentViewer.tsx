import type { TravelIntent } from '../../lib/brain'

export interface IntentViewerProps {
  intent: TravelIntent | null
  confidence?: number | null
  signals?: string[]
  className?: string
}

export function IntentViewer({
  intent,
  confidence = null,
  signals = [],
  className = '',
}: IntentViewerProps) {
  return (
    <section
      data-testid="brain-intent-viewer"
      className={`rounded-xl border border-slate-100 bg-slate-50/80 p-2.5 ${className}`}
    >
      <h3 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Intent
      </h3>
      <p className="font-semibold text-slate-900">{intent ?? '—'}</p>
      {confidence != null ? (
        <p className="mt-0.5 text-[10px] text-slate-500">
          confidence {(confidence * 100).toFixed(0)}%
        </p>
      ) : null}
      {signals.length > 0 ? (
        <p className="mt-1 truncate text-[10px] text-slate-400">
          signals: {signals.join(' · ')}
        </p>
      ) : null}
    </section>
  )
}
