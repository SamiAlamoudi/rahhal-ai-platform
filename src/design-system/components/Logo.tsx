import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { brand, springs } from '../tokens'

export interface LogoProps {
  className?: string
  markOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: { mark: 22, text: 'text-[1.05rem]', gap: 'gap-2.5' },
  md: { mark: 26, text: 'text-[1.35rem]', gap: 'gap-3' },
  lg: { mark: 30, text: 'text-[1.65rem]', gap: 'gap-3.5' },
} as const

/** Quiet wordmark — brand presence without app-icon energy. */
export function Logo({ className, markOnly = false, size = 'md' }: LogoProps) {
  const s = SIZES[size]
  return (
    <motion.div
      className={cn('inline-flex items-center', s.gap, className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...springs.gentle, delay: 0.04 }}
    >
      <span
        className="relative inline-flex shrink-0 items-center justify-center rounded-full"
        style={{ width: s.mark, height: s.mark }}
        aria-hidden
      >
        <span
          className="absolute inset-[-20%] rounded-full opacity-70"
          style={{
            background:
              'radial-gradient(circle, var(--bilamo-glow-primary), transparent 70%)',
          }}
        />
        <span
          className="relative h-full w-full rounded-full"
          style={{
            background:
              'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), transparent 42%), linear-gradient(145deg, color-mix(in srgb, var(--bilamo-primary) 85%, white), var(--bilamo-primary) 55%, color-mix(in srgb, var(--bilamo-primary) 70%, #22d3ee))',
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,0.35), 0 6px 18px var(--bilamo-glow-primary)',
          }}
        />
      </span>
      {!markOnly ? (
        <span
          className={cn(
            'font-medium tracking-[-0.035em] text-[var(--bilamo-text)]',
            s.text,
          )}
        >
          {brand.name}
        </span>
      ) : (
        <span className="sr-only">{brand.name}</span>
      )}
    </motion.div>
  )
}
