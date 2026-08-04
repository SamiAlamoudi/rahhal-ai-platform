import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '../lib/cn'

const fieldClass =
  'w-full rounded-2xl border border-[var(--bilamo-border)] bg-[color-mix(in_srgb,var(--bilamo-surface)_80%,transparent)] px-4 py-3 text-[var(--bilamo-text)] outline-none backdrop-blur-md placeholder:text-[var(--bilamo-muted)] transition-[border-color,box-shadow] focus:border-[color-mix(in_srgb,var(--bilamo-primary)_55%,transparent)] focus:shadow-[0_0_0_3px_var(--bilamo-glow-primary)]'

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
        <span className="font-medium tracking-tight text-[var(--bilamo-muted)]">{label}</span>
      ) : null}
      <input ref={ref} id={inputId} className={cn(fieldClass, className)} {...props} />
      {hint ? <span className="text-xs text-[var(--bilamo-muted)]">{hint}</span> : null}
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
        <span className="font-medium tracking-tight text-[var(--bilamo-muted)]">{label}</span>
      ) : null}
      <textarea
        ref={ref}
        id={inputId}
        className={cn(fieldClass, 'min-h-[120px] resize-none', className)}
        {...props}
      />
    </label>
  )
})
