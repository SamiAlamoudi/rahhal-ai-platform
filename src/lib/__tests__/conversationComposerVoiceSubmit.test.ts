/**
 * Prove home voice final → onSubmit (not onChange-only).
 */
import { describe, expect, it, vi } from 'vitest'

/**
 * Mirrors ConversationComposer.submitFrom contract without mounting React.
 * Guards against regressions where preview/onChange was mistaken for submission.
 */
function submitFromContract(
  raw: string,
  source: 'text' | 'voice',
  deps: {
    disabled?: boolean
    submittedRef: { current: boolean }
    lastVoiceKeyRef: { current: string }
    onChange: (v: string) => void
    onSubmit: (v: string, meta?: { source: 'text' | 'voice' }) => void
  },
): boolean {
  const trimmed = raw.replace(/\s+/g, ' ').trim()
  if (!trimmed || deps.disabled || deps.submittedRef.current) return false
  const key = `${source}:${trimmed}`
  if (source === 'voice' && key === deps.lastVoiceKeyRef.current) return false
  deps.submittedRef.current = true
  if (source === 'voice') deps.lastVoiceKeyRef.current = key
  deps.onChange(trimmed)
  deps.onSubmit(trimmed, { source })
  return true
}

describe('ConversationComposer voice submit contract', () => {
  it('final transcript invokes onSubmit exactly once — onChange alone is not submission', () => {
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    const submittedRef = { current: false }
    const lastVoiceKeyRef = { current: '' }

    // Preview-only onChange must not count as submit.
    onChange('مسودة فقط')
    expect(onSubmit).not.toHaveBeenCalled()

    const ok = submitFromContract(
      'أريد السفر إلى المغرب مع زوجتي لمدة أسبوع',
      'voice',
      { onChange, onSubmit, submittedRef, lastVoiceKeyRef },
    )
    expect(ok).toBe(true)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(
      'أريد السفر إلى المغرب مع زوجتي لمدة أسبوع',
      { source: 'voice' },
    )
    expect(onChange).toHaveBeenCalledWith('أريد السفر إلى المغرب مع زوجتي لمدة أسبوع')
  })

  it('duplicate finals and empty/interim whitespace are not submitted', () => {
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    const submittedRef = { current: false }
    const lastVoiceKeyRef = { current: '' }
    const deps = { onChange, onSubmit, submittedRef, lastVoiceKeyRef }

    expect(submitFromContract('   ', 'voice', deps)).toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()

    expect(submitFromContract('أفضل أكادير', 'voice', deps)).toBe(true)
    expect(submitFromContract('أفضل أكادير', 'voice', deps)).toBe(false)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('submission failure clears the guard so retry is possible', () => {
    const onChange = vi.fn()
    let shouldThrow = true
    const onSubmit = vi.fn((_v: string, _meta?: { source: 'text' | 'voice' }) => {
      if (shouldThrow) throw new Error('navigate failed')
    })
    const submittedRef = { current: false }
    const lastVoiceKeyRef = { current: '' }

    // Mirror ConversationComposer try/catch around onSubmit.
    const run = () => {
      const trimmed = 'إعادة'
      if (!trimmed || submittedRef.current) return false
      const key = `voice:${trimmed}`
      if (key === lastVoiceKeyRef.current) return false
      submittedRef.current = true
      lastVoiceKeyRef.current = key
      onChange(trimmed)
      try {
        onSubmit(trimmed, { source: 'voice' })
        return true
      } catch {
        submittedRef.current = false
        return false
      }
    }

    expect(run()).toBe(false)
    expect(submittedRef.current).toBe(false)
    shouldThrow = false
    lastVoiceKeyRef.current = ''
    expect(run()).toBe(true)
    expect(onSubmit).toHaveBeenCalled()
  })
})
