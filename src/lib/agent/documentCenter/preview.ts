/**
 * Sprint 63 — preview generator (data URL / text preview).
 */

import type { EnterpriseDocument } from './types'

export function generatePreviewUrl(doc: Pick<EnterpriseDocument, 'documentType' | 'title' | 'contentBody' | 'mimeType' | 'documentId'>): string {
  if (doc.documentType === 'PASSPORT') {
    const body = JSON.stringify({
      preview: true,
      documentId: doc.documentId,
      note: 'Passport metadata only — no raw document body.',
    })
    return `data:application/json;charset=utf-8,${encodeURIComponent(body)}`
  }
  const text = [
    `Rahhal Preview — ${doc.title}`,
    `Type: ${doc.documentType}`,
    `Id: ${doc.documentId}`,
    '',
    (doc.contentBody ?? '').slice(0, 2000),
  ].join('\n')
  if (doc.mimeType.includes('pdf')) {
    // Text stand-in preview (no PDF renderer in client module).
    return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
  }
  return `data:text/plain;charset=utf-8,${encodeURIComponent(text)}`
}

export function generateDownloadUrl(input: {
  title: string
  documentType: string
  documentId: string
  contentBody: string | null
  mimeType: string
}): string {
  if (input.documentType === 'PASSPORT' || input.contentBody == null) {
    const meta = JSON.stringify({
      documentId: input.documentId,
      title: input.title,
      metadataOnly: true,
    })
    return `data:application/json;charset=utf-8,${encodeURIComponent(meta)}`
  }
  const body = [
    `Rahhal — ${input.title}`,
    `Type: ${input.documentType}`,
    `Id: ${input.documentId}`,
    '',
    input.contentBody,
  ].join('\n')
  return `data:${input.mimeType};charset=utf-8,${encodeURIComponent(body)}`
}
