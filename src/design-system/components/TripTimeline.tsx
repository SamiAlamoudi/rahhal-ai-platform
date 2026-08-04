import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { springs } from '../tokens'

export interface TripTimelineItem {
  id: string
  time: string
  title: string
  detail?: string
  kind?: 'flight' | 'hotel' | 'activity' | 'transfer' | 'note'
}

export interface TripTimelineProps {
  items: TripTimelineItem[]
  className?: string
}

const KIND_DOT: Record<NonNullable<TripTimelineItem['kind']>, string> = {
  flight: 'bg-[var(--bilamo-secondary)]',
  hotel: 'bg-[var(--bilamo-primary)]',
  activity: 'bg-[var(--bilamo-success)]',
  transfer: 'bg-[var(--bilamo-muted)]',
  note: 'bg-white/40',
}

export function TripTimeline({ items, className }: TripTimelineProps) {
  return (
    <ol className={cn('relative space-y-0', className)}>
      {items.map((item, index) => (
        <motion.li
          key={item.id}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...springs.soft, delay: index * 0.05 }}
          className="relative flex gap-4 pb-8 last:pb-0"
        >
          {index < items.length - 1 ? (
            <span className="absolute start-[7px] top-4 bottom-0 w-px bg-[var(--bilamo-border)]" />
          ) : null}
          <span
            className={cn(
              'relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ring-4 ring-[var(--bilamo-bg)]',
              KIND_DOT[item.kind ?? 'note'],
            )}
          />
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--bilamo-muted)]">
              {item.time}
            </p>
            <p className="text-base font-semibold tracking-tight text-[var(--bilamo-text)]">
              {item.title}
            </p>
            {item.detail ? (
              <p className="text-sm leading-relaxed text-[var(--bilamo-muted)]">{item.detail}</p>
            ) : null}
          </div>
        </motion.li>
      ))}
    </ol>
  )
}
