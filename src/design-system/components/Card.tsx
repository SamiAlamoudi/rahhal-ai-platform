import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'
import { springs } from '../tokens'

const cardVariants = cva('relative overflow-hidden', {
  variants: {
    variant: {
      glass: 'bilamo-glass rounded-3xl',
      surface: 'rounded-3xl border border-[var(--bilamo-border)] bg-[var(--bilamo-surface)]',
      elevated:
        'rounded-3xl border border-[var(--bilamo-border)] bg-[var(--bilamo-surface-elevated)] shadow-[0_16px_48px_rgba(0,0,0,0.2)]',
      highlight:
        'rounded-3xl border border-[color-mix(in_srgb,var(--bilamo-primary)_45%,transparent)] bg-[color-mix(in_srgb,var(--bilamo-primary)_12%,var(--bilamo-surface))] shadow-[0_0_48px_var(--bilamo-glow-primary)]',
      bare: 'rounded-none border-0 bg-transparent shadow-none',
    },
    padding: {
      none: 'p-0',
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-7',
    },
  },
  defaultVariants: {
    variant: 'glass',
    padding: 'md',
  },
})

export interface CardProps
  extends Omit<HTMLMotionProps<'div'>, 'children'>,
    VariantProps<typeof cardVariants> {
  children?: ReactNode
  interactive?: boolean
}

export function Card({
  className,
  variant,
  padding,
  children,
  interactive = false,
  ...props
}: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.soft}
      whileHover={interactive ? { y: -2, scale: 1.01 } : undefined}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export { cardVariants }
