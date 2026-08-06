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
  reason?: string
  onSelect?: () => void
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
  reason,
  onSelect,
  className,
  children,
}: SearchResultProps) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={{ scale: 0.995 }}
      transition={springs.press}
      className={cn(
        'w-full rounded-[1.25rem] px-5 py-4 text-start transition-colors',
        highlighted
          ? 'bilamo-glass'
          : 'border border-transparent hover:border-[var(--bilamo-border)]',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-6">
        <div className="min-w-0 space-y-1">
          <h3
            className={cn(
              'tracking-[-0.03em] text-[var(--bilamo-text)]',
              highlighted ? 'text-[1.1rem] font-medium' : 'text-[0.95rem] font-normal opacity-80',
            )}
          >
            {title}
          </h3>
          {(subtitle || meta) && (
            <p className="text-[13px] text-[var(--bilamo-muted)]/85">
              {[subtitle, meta].filter(Boolean).join(' · ')}
            </p>
          )}
          {highlighted && reason ? (
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
              highlighted
                ? 'text-[1.05rem] font-medium text-[var(--bilamo-text)]'
                : 'text-[0.9rem] text-[var(--bilamo-muted)]',
            )}
          >
            {priceLabel}
          </p>
        ) : null}
      </div>
    </motion.button>
  )
}
