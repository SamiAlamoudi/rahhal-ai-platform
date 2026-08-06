import type { ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'
import { springs } from '../tokens'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 font-medium tracking-[-0.02em] outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--bilamo-secondary)_45%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bilamo-bg)] disabled:pointer-events-none disabled:opacity-35',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--bilamo-primary)] text-white shadow-[0_6px_22px_var(--bilamo-glow-primary)] hover:brightness-[1.06]',
        secondary: 'bilamo-glass text-[var(--bilamo-text)]',
        ghost:
          'bg-transparent text-[var(--bilamo-muted)]/70 hover:bg-white/[0.04] hover:text-[var(--bilamo-muted)]',
        danger: 'bg-[var(--bilamo-danger)] text-white',
        voice:
          'bg-[var(--bilamo-primary)] text-white shadow-[0_0_32px_var(--bilamo-glow-primary)]',
      },
      size: {
        sm: 'h-9 rounded-xl px-3 text-sm',
        md: 'h-11 rounded-2xl px-5 text-sm',
        lg: 'h-12 rounded-2xl px-6 text-[15px]',
        icon: 'h-14 w-14 rounded-full',
        iconSm: 'h-10 w-10 rounded-full',
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
      whileHover={{ scale: 1.015 }}
      whileTap={{ scale: 0.975 }}
      transition={springs.press}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export { buttonVariants }
