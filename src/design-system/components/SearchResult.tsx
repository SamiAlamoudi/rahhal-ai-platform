import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { springs } from '../tokens'

export interface SearchResultProps {
  title: string
  subtitle?: string
  meta?: string
  priceLabel?: string
  highlighted?: boolean
  /** Explicit traveler selection — quieter than hero highlight. */
  selected?: boolean
  reason?: string
  /** When set with interactive=false, the row is not a button (actions live outside). */
  onSelect?: () => void
  /** Default true when onSelect is provided. Set false when sibling action buttons own selection. */
  interactive?: boolean
  className?: string
  children?: ReactNode
}

/**
 * Recommendation row — not a booking card.
 * Highlighted option leads; others stay quiet.
 */
export function SearchResult({
  title,
  subtitle,
  meta,
  priceLabel,
  highlighted = false,
  selected = false,
  reason,
  onSelect,
  interactive,
  className,
  children,
}: SearchResultProps) {
  const isButton = interactive !== false && Boolean(onSelect)
  const body = (
    <div className="flex items-baseline justify-between gap-6">
      <div className="min-w-0 space-y-1">
        <h3
          className={cn(
            'tracking-[-0.03em] text-[var(--bilamo-text)]',
            highlighted || selected
              ? 'text-[1.1rem] font-medium'
              : 'text-[0.95rem] font-normal opacity-80',
          )}
        >
          {title}
          {selected ? (
            <span className="ms-2 text-[12px] font-normal tracking-[-0.01em] text-[var(--bilamo-secondary)]">
              ·
            </span>
          ) : null}
        </h3>
        {(subtitle || meta) && (
          <p className="text-[13px] text-[var(--bilamo-muted)]/85">
            {[subtitle, meta].filter(Boolean).join(' · ')}
          </p>
        )}
        {(highlighted || selected) && reason ? (
          <p className="pt-2 text-[13.5px] leading-relaxed text-[var(--bilamo-text)]/70">
            {reason}
          </p>
        ) : null}
        {children}
      </div>
      {priceLabel ? (
        <p
          className={cn(
            'shrink-0 tabular-nums tracking-[-0.02em]',
            highlighted || selected
              ? 'text-[1.05rem] font-medium text-[var(--bilamo-text)]'
              : 'text-[0.9rem] text-[var(--bilamo-muted)]',
          )}
        >
          {priceLabel}
        </p>
      ) : null}
    </div>
  )

  const surface = cn(
    'w-full rounded-[1.25rem] px-5 py-4 text-start transition-colors',
    selected
      ? 'bilamo-glass ring-1 ring-[color-mix(in_srgb,var(--bilamo-secondary)_55%,transparent)]'
      : highlighted
        ? 'bilamo-glass'
        : 'border border-transparent hover:border-[var(--bilamo-border)]',
    className,
  )

  if (isButton) {
    return (
      <motion.button
        type="button"
        onClick={onSelect}
        whileTap={{ scale: 0.995 }}
        transition={springs.press}
        className={surface}
      >
        {body}
      </motion.button>
    )
  }

  return (
    <motion.div layout transition={springs.soft} className={surface}>
      {body}
    </motion.div>
  )
}
