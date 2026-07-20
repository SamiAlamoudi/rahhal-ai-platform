import { memo } from 'react'
import { buildMapPreview, type MapPreviewKind } from '../../../lib/chat/conversationExperienceUi'

interface Props {
  kind: MapPreviewKind
  query: string
  label?: string
  compact?: boolean
}

function MapPreviewImpl({ kind, query, label, compact = false }: Props) {
  const preview = buildMapPreview({ kind, query, label })
  return (
    <div
      className={`overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800 ${compact ? 'mt-2' : ''}`}
      aria-label={`Map: ${preview.label}`}
    >
      <div className={`flex items-center justify-between gap-2 px-3 ${compact ? 'py-1.5' : 'py-2'}`}>
        <p className="truncate text-[11px] font-medium text-slate-600 dark:text-slate-300">{preview.label}</p>
        <a
          href={preview.openUrl}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-[11px] font-semibold text-primary-600 hover:underline"
        >
          Open map
        </a>
      </div>
      {!compact && (
        <iframe
          title={`Map preview ${preview.label}`}
          src={preview.embedUrl}
          className="h-40 w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      )}
      {compact && (
        <div className="bg-gradient-to-r from-emerald-100 to-sky-100 px-3 py-4 text-center text-[11px] text-slate-600 dark:from-slate-700 dark:to-slate-600 dark:text-slate-200">
          {kind.replace('_', ' ')} · {preview.query}
        </div>
      )}
    </div>
  )
}

export default memo(MapPreviewImpl)
