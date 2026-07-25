import type { ProductLocale } from '../../../lib/productUx'

export interface SuggestedRepliesProps {
  locale?: ProductLocale
  replies: string[]
  onSelect: (text: string) => void
  disabled?: boolean
}

export function SuggestedReplies({
  locale = 'ar',
  replies,
  onSelect,
  disabled,
}: SuggestedRepliesProps) {
  if (!replies.length) return null
  return (
    <div
      className="flex flex-wrap gap-2"
      data-testid="suggested-replies"
      aria-label={locale === 'ar' ? 'ردود مقترحة' : 'Suggested replies'}
    >
      {replies.map((reply) => (
        <button
          key={reply}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(reply)}
          className="min-h-10 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:border-primary-300 hover:bg-primary-50/60 disabled:opacity-40"
        >
          {reply}
        </button>
      ))}
    </div>
  )
}
