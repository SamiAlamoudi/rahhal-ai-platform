import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { brand, springs } from '../tokens'

export interface LogoProps {
  className?: string
  /** @deprecated Mark competes with the Orb — wordmark is the brand signal. */
  markOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZES = {
  sm: 'text-[1.125rem]',
  md: 'text-[1.5rem]',
  lg: 'text-[1.75rem]',
} as const

/**
 * Wordmark only.
 * The Orb is Bilamo’s identity — a mark would dilute it.
 */
export function Logo({ className, size = 'md' }: LogoProps) {
  return (
    <motion.div
      className={cn('inline-flex items-center justify-center', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ ...springs.gentle, delay: 0.05 }}
    >
      <span
        className={cn(
          'font-medium tracking-[-0.045em] text-[var(--bilamo-text)]',
          SIZES[size],
        )}
      >
        {brand.name}
      </span>
    </motion.div>
  )
}
