import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { brand, springs } from '../tokens'

export interface LogoProps {
  className?: string
  markOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: { mark: 28, text: 'text-lg' },
  md: { mark: 36, text: 'text-2xl' },
  lg: { mark: 44, text: 'text-3xl' },
} as const

export function Logo({ className, markOnly = false, size = 'md' }: LogoProps) {
  const s = SIZES[size]
  return (
    <motion.div
      className={cn('inline-flex items-center gap-3', className)}
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.gentle}
    >
      <span
        className="relative inline-flex items-center justify-center rounded-2xl"
        style={{ width: s.mark, height: s.mark }}
        aria-hidden
      >
        <span
          className="absolute inset-0 rounded-2xl opacity-80"
          style={{
            background:
              'linear-gradient(135deg, var(--bilamo-primary), var(--bilamo-secondary))',
            filter: 'blur(8px)',
          }}
        />
        <span
          className="relative flex h-full w-full items-center justify-center rounded-2xl text-sm font-semibold text-white"
          style={{
            background:
              'linear-gradient(145deg, color-mix(in srgb, var(--bilamo-primary) 90%, white), var(--bilamo-primary))',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
          }}
        >
          B
        </span>
      </span>
      {!markOnly ? (
        <span
          className={cn(
            'font-semibold tracking-tight text-[var(--bilamo-text)]',
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
