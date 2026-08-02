import { IconSearch } from '../../design-system/icons/OutlinedIcons'

/** Controlled composer — DS SearchField is showcase-readonly; this stays in brain-ui. */
export function BrainComposer({
  value,
  placeholder,
  onChange,
  onSubmit,
  disabled,
}: {
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 56,
        padding: '0 16px',
        borderRadius: 'var(--ds-radius-full)',
        background: 'var(--ds-surface)',
        border: 'var(--ds-border-width) solid var(--ds-border)',
        boxShadow: 'var(--ds-shadow-sm)',
      }}
    >
      <IconSearch aria-hidden />
      <input
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit()
        }}
        style={{
          flex: 1,
          border: 0,
          outline: 'none',
          background: 'transparent',
          fontFamily: 'var(--ds-font-body)',
          fontSize: 'var(--ds-text-callout)',
          color: 'var(--ds-ink)',
        }}
      />
    </label>
  )
}
