import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
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
      whileTap={{ scale: 0.985 }}
      transition={springs.snappy}
      className={cn('w-full text-start', className)}
    >
      <Card
        variant={highlighted ? 'highlight' : 'glass'}
        padding="md"
        interactive
        className="w-full"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {highlighted ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--bilamo-secondary)]">
                <Sparkles className="h-3.5 w-3.5" />
                Top recommendation
              </span>
            ) : null}
            <h3 className="truncate text-lg font-semibold tracking-tight text-[var(--bilamo-text)]">
              {title}
            </h3>
            {subtitle ? (
              <p className="text-sm text-[var(--bilamo-muted)]">{subtitle}</p>
            ) : null}
            {meta ? <p className="text-xs text-[var(--bilamo-muted)]">{meta}</p> : null}
            {reason ? (
              <p className="pt-2 text-sm leading-relaxed text-[var(--bilamo-text)]/80">{reason}</p>
            ) : null}
            {children}
          </div>
          {priceLabel ? (
            <div className="shrink-0 text-end">
              <p className="text-lg font-semibold tracking-tight text-[var(--bilamo-text)]">
                {priceLabel}
              </p>
            </div>
          ) : null}
        </div>
      </Card>
    </motion.button>
  )
}
