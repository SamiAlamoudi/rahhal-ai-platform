/**
 * Attachment architecture for chat (images now, audio files for Voice later).
 * Backend Storage upload is not configured yet — callers must treat upload as deferred.
 */

export type ChatAttachmentKind = 'image' | 'audio' | 'file'

export interface ChatAttachment {
  id: string
  kind: ChatAttachmentKind
  url: string
  mimeType: string
  name?: string
  sizeBytes?: number
}

export interface AttachmentUploadRequest {
  conversationId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  /** Future: File | Blob | ArrayBuffer once Storage is wired */
  data?: unknown
}

export interface AttachmentUploadResult {
  ready: boolean
  attachment: ChatAttachment | null
  reason: string | null
}

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

export function isSupportedImageMime(mimeType: string): boolean {
  return IMAGE_MIME.has(mimeType.toLowerCase())
}

export function validateImageAttachmentRequest(input: AttachmentUploadRequest): string | null {
  if (!input.conversationId.trim()) return 'معرّف المحادثة مطلوب'
  if (!isSupportedImageMime(input.mimeType)) return 'صيغة الصورة غير مدعومة'
  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes <= 0) return 'حجم الملف غير صالح'
  if (input.sizeBytes > MAX_IMAGE_BYTES) return 'حجم الصورة أكبر من الحد المسموح (8MB)'
  return null
}

export function normalizeAttachments(raw: unknown): ChatAttachment[] {
  if (!Array.isArray(raw)) return []
  const out: ChatAttachment[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const id = typeof row.id === 'string' ? row.id : ''
    const kind = row.kind === 'image' || row.kind === 'audio' || row.kind === 'file' ? row.kind : null
    const url = typeof row.url === 'string' ? row.url : ''
    const mimeType = typeof row.mimeType === 'string' ? row.mimeType : ''
    if (!id || !kind || !url || !mimeType) continue
    out.push({
      id,
      kind,
      url,
      mimeType,
      name: typeof row.name === 'string' ? row.name : undefined,
      sizeBytes: typeof row.sizeBytes === 'number' ? row.sizeBytes : undefined,
    })
  }
  return out
}

/**
 * Planned Storage path: chat/{userId}/{conversationId}/{attachmentId}
 * Not implemented — returns a deferred result so UI/Voice can share one contract.
 */
export async function uploadChatAttachment(
  input: AttachmentUploadRequest,
): Promise<AttachmentUploadResult> {
  const validation = validateImageAttachmentRequest(input)
  if (validation) {
    return { ready: false, attachment: null, reason: validation }
  }

  // Storage bucket + RLS not provisioned yet.
  return {
    ready: false,
    attachment: null,
    reason: 'تخزين المرفقات غير مفعّل بعد — البنية جاهزة وستُربط لاحقاً',
  }
}

export const CHAT_ATTACHMENTS_ENABLED = false
