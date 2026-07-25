import {
  useEffect,
  useRef,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import type {
  ConversationCenterLocale,
  ConversationComposerModel,
  ConversationExternalNavTarget,
} from '../types'

export interface ComposerProps {
  model: ConversationComposerModel
  locale?: ConversationCenterLocale
  disabled?: boolean
  onChange: (value: string) => void
  onSubmit: (value: string) => void
  onQuickAction?: (id: string) => void
  /** External navigation only — never opens Voice/Knowledge inside Chat. */
  onExternalNav?: (target: ConversationExternalNavTarget) => void
}

const EXTERNAL_LABEL: Record<ConversationExternalNavTarget, { ar: string; en: string }> = {
  voice_center: { ar: 'الصوت', en: 'Voice' },
  knowledge_center: { ar: 'المعرفة', en: 'Knowledge' },
  attachment_future: { ar: 'مرفق', en: 'Attach' },
  image_future: { ar: 'صورة', en: 'Image' },
  microphone_future: { ar: 'ميكروفون', en: 'Mic' },
  camera_future: { ar: 'كاميرا', en: 'Camera' },
  location_future: { ar: 'موقع', en: 'Location' },
  export_future: { ar: 'تصدير', en: 'Export' },
  share_future: { ar: 'مشاركة', en: 'Share' },
}

/**
 * Floating auto-growing composer.
 * Voice / Knowledge buttons navigate out later — never embed those surfaces here.
 */
export function Composer({
  model,
  locale = 'ar',
  disabled = false,
  onChange,
  onSubmit,
  onQuickAction,
  onExternalNav,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !model.autoGrow) return
    el.style.height = 'auto'
    const lineHeight = 24
    const max = model.maxRows * lineHeight
    const min = model.minRows * lineHeight
    el.style.height = `${Math.min(max, Math.max(min, el.scrollHeight))}px`
  }, [model.value, model.autoGrow, model.maxRows, model.minRows])

  const submit = (event?: FormEvent) => {
    event?.preventDefault()
    const trimmed = model.value.trim()
    if (!trimmed || disabled) return
    onSubmit(trimmed)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      submit()
    }
  }

  return (
    <form
      className="rahhal-cc-composer"
      data-testid="cc-composer"
      onSubmit={submit}
    >
      <div className="rahhal-cc-composer__quick" data-testid="cc-quick-actions">
        {model.quickActions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="rahhal-cc-composer__quick-btn"
            data-quick-action={action.id}
            disabled={disabled}
            onClick={() => onQuickAction?.(action.id)}
          >
            {action.labelKey}
          </button>
        ))}
      </div>

      <div className="rahhal-cc-composer__row">
        <textarea
          ref={ref}
          className="rahhal-cc-composer__input"
          data-testid="cc-composer-input"
          rows={model.minRows}
          value={model.value}
          disabled={disabled}
          placeholder={
            locale === 'en' ? 'Message Rahhal…' : 'اكتب رسالتك لرحّال…'
          }
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button
          type="submit"
          className="rahhal-cc-composer__send"
          data-testid="cc-composer-send"
          disabled={disabled || !model.value.trim()}
        >
          {locale === 'en' ? 'Send' : 'إرسال'}
        </button>
      </div>

      <div className="rahhal-cc-composer__external" data-testid="cc-external-nav">
        {model.externalNavButtons.map((btn) => (
          <button
            key={btn.id}
            type="button"
            className="rahhal-cc-composer__external-btn"
            data-external-nav={btn.navigatesTo}
            data-testid={`cc-nav-${btn.id}`}
            disabled={disabled}
            onClick={() => onExternalNav?.(btn.navigatesTo)}
          >
            {locale === 'en'
              ? EXTERNAL_LABEL[btn.id].en
              : EXTERNAL_LABEL[btn.id].ar}
          </button>
        ))}
      </div>
    </form>
  )
}
