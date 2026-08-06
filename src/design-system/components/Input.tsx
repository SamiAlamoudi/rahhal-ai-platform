import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const fieldClass =
  'w-full rounded-2xl border border-[var(--bilamo-border)] bg-[color-mix(in_srgb,var(--bilamo-surface)_55%,transparent)] px-4 py-3 text-[15px] leading-relaxed tracking-[-0.01em] text-[var(--bilamo-text)] outline-none backdrop-blur-md placeholder:text-[var(--bilamo-muted)]/55 transition-[border-color,box-shadow] focus:border-[color-mix(in_srgb,var(--bilamo-primary)_35%,transparent)] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--bilamo-glow-primary)_55%,transparent)]'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, hint, id, ...props },
  ref,
) {
  const inputId = id ?? props.name
  return (
    <label className="flex w-full flex-col gap-2 text-sm" htmlFor={inputId}>
      {label ? (
        <span className="text-[13px] font-medium tracking-[-0.01em] text-[var(--bilamo-muted)]">
          {label}
        </span>
      ) : null}
      <input ref={ref} id={inputId} className={cn(fieldClass, className)} {...props} />
      {hint ? <span className="text-[12px] text-[var(--bilamo-muted)]/80">{hint}</span> : null}
    </label>
  )
})

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, label, id, ...props },
  ref,
) {
  const inputId = id ?? props.name
  return (
    <label className="flex w-full flex-col gap-2 text-sm" htmlFor={inputId}>
      {label ? (
        <span className="text-[13px] font-medium tracking-[-0.01em] text-[var(--bilamo-muted)]">
          {label}
        </span>
      ) : null}
      <textarea
        ref={ref}
        id={inputId}
        className={cn(fieldClass, 'min-h-[104px] resize-none', className)}
        {...props}
      />
    </label>
  )
})
