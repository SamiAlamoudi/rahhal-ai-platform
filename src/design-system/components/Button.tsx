import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'
import { springs } from '../tokens'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium tracking-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--bilamo-secondary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bilamo-bg)] disabled:pointer-events-none disabled:opacity-40',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--bilamo-primary)] text-white shadow-[0_8px_28px_var(--bilamo-glow-primary)] hover:brightness-110',
        secondary:
          'bilamo-glass text-[var(--bilamo-text)] hover:border-[var(--bilamo-glass-border)]',
        ghost:
          'bg-transparent text-[var(--bilamo-muted)] hover:bg-white/5 hover:text-[var(--bilamo-text)]',
        danger: 'bg-[var(--bilamo-danger)] text-white',
        voice:
          'bg-[var(--bilamo-primary)] text-white shadow-[0_0_40px_var(--bilamo-glow-primary)]',
      },
      size: {
        sm: 'h-9 rounded-xl px-3 text-sm',
        md: 'h-11 rounded-2xl px-5 text-sm',
        lg: 'h-14 rounded-2xl px-6 text-base',
        icon: 'h-14 w-14 rounded-full',
        iconSm: 'h-11 w-11 rounded-full',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
)

export interface ButtonProps
  extends Omit<HTMLMotionProps<'button'>, 'children'>,
    VariantProps<typeof buttonVariants> {
  children?: ReactNode
}

export function Button({
  className,
  variant,
  size,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <motion.button
      type={type}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      transition={springs.snappy}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export { buttonVariants }
