/**
 * Sprint 63 — minimal uncompressed ZIP builder (no external deps).
 */

import { computeChecksum } from './checksum'
import type { EnterpriseDocument, ZipPackageResult } from './types'

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i]!
    for (let j = 0; j < 8; j += 1) {
      const mask = -(crc & 1)
      crc = (crc >>> 1) ^ (0xedb88320 & mask)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(n: number): Uint8Array {
  const b = new Uint8Array(2)
  b[0] = n & 0xff
  b[1] = (n >>> 8) & 0xff
  return b
}

function u32(n: number): Uint8Array {
  const b = new Uint8Array(4)
  b[0] = n & 0xff
  b[1] = (n >>> 8) & 0xff
  b[2] = (n >>> 16) & 0xff
  b[3] = (n >>> 24) & 0xff
  return b
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

function encodeUtf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!)
  // btoa available in browser + vitest; fallback for node.
  if (typeof btoa === 'function') return btoa(binary)
  return Buffer.from(bytes).toString('base64')
}

function safePath(doc: EnterpriseDocument, index: number): string {
  const base = `${doc.documentType}_${doc.documentId}_${doc.version}`.replace(/[^\w.-]+/g, '_')
  const ext = doc.mimeType.includes('pdf')
    ? 'pdf'
    : doc.mimeType.includes('json')
      ? 'json'
      : 'txt'
  return `${String(index + 1).padStart(2, '0')}_${base}.${ext}`
}

/** Build a real ZIP (store method) containing document bodies + manifest. */
export function buildZipPackage(input: {
  documents: EnterpriseDocument[]
  tripId?: string | null
  now?: () => number
}): ZipPackageResult {
  const now = input.now ?? (() => Date.now())
  const files: Array<{ name: string; data: Uint8Array; documentId: string; checksum: string }> = []

  const manifest = {
    tripId: input.tripId ?? null,
    generatedAt: new Date(now()).toISOString(),
    documents: input.documents.map((d) => ({
      documentId: d.documentId,
      title: d.title,
      type: d.documentType,
      version: d.version,
      checksum: d.checksum,
    })),
  }
  files.push({
    name: 'manifest.json',
    data: encodeUtf8(JSON.stringify(manifest, null, 2)),
    documentId: 'manifest',
    checksum: computeChecksum(JSON.stringify(manifest)),
  })

  input.documents.forEach((doc, i) => {
    const body =
      doc.documentType === 'PASSPORT'
        ? JSON.stringify({
            documentId: doc.documentId,
            metadataOnly: true,
            metadata: doc.metadata,
            providerReference: doc.providerReference,
          })
        : (doc.contentBody ?? doc.title)
    files.push({
      name: safePath(doc, i),
      data: encodeUtf8(body),
      documentId: doc.documentId,
      checksum: doc.checksum,
    })
  })

  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = encodeUtf8(file.name)
    const crc = crc32(file.data)
    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      file.data,
    ])
    localParts.push(local)

    const central = concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(file.data.length),
      u32(file.data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    ])
    centralParts.push(central)
    offset += local.length
  }

  const centralDir = concat(centralParts)
  const end = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ])
  const zipBytes = concat([...localParts, centralDir, end])
  const b64 = toBase64(zipBytes)
  const downloadUrl = `data:application/zip;base64,${b64}`
  const packageId = `zip_${now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
  const checksum = computeChecksum(b64)

  return {
    packageId,
    tripId: input.tripId ?? null,
    filename: `rahhal-docs-${input.tripId ?? 'pack'}-${packageId}.zip`,
    mimeType: 'application/zip',
    fileSize: zipBytes.length,
    checksum,
    downloadUrl,
    entryCount: files.length,
    entries: files.map((f) => ({
      documentId: f.documentId,
      path: f.name,
      checksum: f.checksum,
    })),
    createdAt: new Date(now()).toISOString(),
  }
}
