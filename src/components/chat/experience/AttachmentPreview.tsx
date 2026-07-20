import { memo } from 'react'
import type { ChatAttachment } from '../../../lib/chat/chatAttachments'
import { safeMediaUrl } from '../../../lib/ops/security/safeMediaUrl'

interface Props {
  attachment: ChatAttachment
}

function AttachmentPreviewImpl({ attachment }: Props) {
  const isImage = attachment.kind === 'image' || /\.(png|jpe?g|gif|webp)$/i.test(attachment.name ?? '')
  const isDoc = !isImage
  const safeUrl = safeMediaUrl(attachment.url)

  if (isImage && safeUrl) {
    return (
      <figure className="max-w-[220px] overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
        <img
          src={safeUrl}
          alt={attachment.name || 'Image attachment'}
          className="max-h-40 w-full object-cover"
          loading="lazy"
        />
        {attachment.name && (
          <figcaption className="truncate px-2 py-1 text-[10px] text-slate-500">{attachment.name}</figcaption>
        )}
      </figure>
    )
  }

  if (!safeUrl) {
    return (
      <span className="inline-flex max-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">
        <span className="truncate font-medium">{attachment.name || attachment.kind}</span>
      </span>
    )
  }

  return (
    <a
      href={safeUrl}
      className="inline-flex max-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      aria-label={`Document ${attachment.name || 'attachment'}`}
      rel="noopener noreferrer"
      target="_blank"
    >
      <span aria-hidden>{isDoc ? '📄' : '📎'}</span>
      <span className="truncate font-medium">{attachment.name || attachment.kind}</span>
    </a>
  )
}

export default memo(AttachmentPreviewImpl)
