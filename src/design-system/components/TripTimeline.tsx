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
          transition={{ ...springs.soft, delay: index * 0.04 }}
          className="relative flex gap-4 pb-7 last:pb-0"
        >
          {index < items.length - 1 ? (
            <span className="absolute start-[5px] top-3 bottom-0 w-px bg-[var(--bilamo-border)]" />
          ) : null}
          <span
            className={cn(
              'relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-[3px] ring-[var(--bilamo-bg)]',
              KIND_DOT[item.kind ?? 'note'],
            )}
          />
          <div className="min-w-0 space-y-1">
            <p className="text-[12px] tracking-[-0.01em] text-[var(--bilamo-muted)]">
              {item.time}
            </p>
            <p className="text-[15px] font-medium tracking-[-0.02em] text-[var(--bilamo-text)]">
              {item.title}
            </p>
            {item.detail ? (
              <p className="text-[13.5px] leading-relaxed text-[var(--bilamo-muted)]/90">
                {item.detail}
              </p>
            ) : null}
          </div>
        </motion.li>
      ))}
    </ol>
  )
}
