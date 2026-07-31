import { useRef, type ChangeEvent } from 'react'
import type { ContextualAttachmentRequest } from '../../lib/chat/contextualAttachments'

interface Props {
  request: ContextualAttachmentRequest
  disabled?: boolean
  onFileSelected: (file: File) => void
}

/**
 * Single contextual attach CTA — shown only when Conversation Brain asks
 * for a specific travel document or photo.
 */
export default function ContextualAttachAction({
  request,
  disabled,
  onFileSelected,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null)

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onFileSelected(file)
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={request.accept}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        title={request.labelAr}
        aria-label={request.labelAr}
        className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 disabled:opacity-40"
      >
        {request.labelAr}
      </button>
    </>
  )
}
