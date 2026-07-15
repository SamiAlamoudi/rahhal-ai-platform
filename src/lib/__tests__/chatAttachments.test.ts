import { describe, it, expect } from 'vitest'
import {
  CHAT_ATTACHMENTS_ENABLED,
  isSupportedImageMime,
  normalizeAttachments,
  uploadChatAttachment,
  validateImageAttachmentRequest,
} from '../chat/chatAttachments'

describe('chatAttachments architecture', () => {
  it('validates image mime and size', () => {
    expect(isSupportedImageMime('image/png')).toBe(true)
    expect(isSupportedImageMime('application/pdf')).toBe(false)
    expect(validateImageAttachmentRequest({
      conversationId: 'c1',
      fileName: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 1000,
    })).toBeNull()
    expect(validateImageAttachmentRequest({
      conversationId: 'c1',
      fileName: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 20 * 1024 * 1024,
    })).not.toBeNull()
  })

  it('normalizes attachment arrays safely', () => {
    const attachments = normalizeAttachments([
      { id: '1', kind: 'image', url: 'https://x/a.png', mimeType: 'image/png', name: 'a.png' },
      { id: 'bad' },
      null,
    ])
    expect(attachments).toHaveLength(1)
    expect(attachments[0].kind).toBe('image')
  })

  it('upload is deferred until storage is ready', async () => {
    expect(CHAT_ATTACHMENTS_ENABLED).toBe(false)
    const result = await uploadChatAttachment({
      conversationId: 'c1',
      fileName: 'a.png',
      mimeType: 'image/png',
      sizeBytes: 1200,
    })
    expect(result.ready).toBe(false)
    expect(result.attachment).toBeNull()
    expect(result.reason).toBeTruthy()
  })
})
