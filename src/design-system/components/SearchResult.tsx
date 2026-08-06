import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { springs } from '../tokens'
import { Card } from './Card'

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
      whileTap={{ scale: 0.99 }}
      transition={springs.press}
      className={cn('w-full text-start', className)}
    >
      <Card
        variant={highlighted ? 'highlight' : 'glass'}
        padding="lg"
        interactive
        className="w-full"
      >
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0 space-y-1.5">
            {highlighted ? (
              <p className="text-[11px] font-medium tracking-[0.04em] text-[var(--bilamo-secondary)]">
                Suggested
              </p>
            ) : null}
            <h3 className="text-[1.05rem] font-medium tracking-[-0.025em] text-[var(--bilamo-text)]">
              {title}
            </h3>
            {subtitle ? (
              <p className="text-[13.5px] text-[var(--bilamo-muted)]">{subtitle}</p>
            ) : null}
            {meta ? (
              <p className="text-[12.5px] text-[var(--bilamo-muted)]/90">{meta}</p>
            ) : null}
            {reason ? (
              <p className="pt-1.5 text-[13.5px] leading-relaxed text-[var(--bilamo-text)]/75">
                {reason}
              </p>
            ) : null}
            {children}
          </div>
          {priceLabel ? (
            <p className="shrink-0 text-[1.05rem] font-medium tracking-[-0.02em] text-[var(--bilamo-text)]">
              {priceLabel}
            </p>
          ) : null}
        </div>
      </Card>
    </motion.button>
  )
}
