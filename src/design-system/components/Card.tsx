import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'
import { springs } from '../tokens'

const cardVariants = cva('relative overflow-hidden', {
  variants: {
    variant: {
      glass: 'bilamo-glass rounded-[1.5rem]',
      surface: 'rounded-[1.5rem] border border-[var(--bilamo-border)] bg-[var(--bilamo-surface)]',
      elevated:
        'rounded-[1.5rem] border border-[var(--bilamo-border)] bg-[var(--bilamo-surface-elevated)] shadow-[0_14px_40px_rgba(0,0,0,0.16)]',
      highlight:
        'rounded-[1.5rem] border border-[color-mix(in_srgb,var(--bilamo-primary)_28%,transparent)] bg-[color-mix(in_srgb,var(--bilamo-primary)_8%,var(--bilamo-surface))] shadow-[0_0_36px_var(--bilamo-glow-primary)]',
      bare: 'rounded-none border-0 bg-transparent shadow-none',
    },
    padding: {
      none: 'p-0',
      sm: 'p-4',
      md: 'p-5',
      lg: 'px-6 py-5',
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
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springs.soft}
      whileHover={interactive ? { y: -1 } : undefined}
      className={cn(cardVariants({ variant, padding }), className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

export { cardVariants }
