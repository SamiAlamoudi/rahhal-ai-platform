/**
 * Multimodal Document Engine — extract travel facts from text/OCR payloads.
 */

import type {
  DocumentInput,
  ExecutiveEngine,
  ExecutiveEngineContext,
  ExecutiveEngineMetadata,
} from '../platform/engineContract'

export interface ExtractedDocumentFields {
  fullName: string | null
  passportNumber: string | null
  nationality: string | null
  expiration: string | null
  flightNumber: string | null
  pnr: string | null
  hotel: string | null
  dates: string[]
  destination: string | null
  documentKind: DocumentInput['kind']
}

export function createMultimodalDocumentEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'multimodal_document',
    version: '1.0.0',
    name: 'Multimodal Document Engine',
    description: 'Extracts passport, visa, boarding pass, and voucher fields into memory.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const docs = resolveDocuments(ctx)
      const findings = docs.map((doc) => `doc:${doc.kind}`)
      return {
        engineId: 'multimodal_document',
        findings,
        signals: { documentCount: docs.length },
        priority: docs.length > 0 ? 'medium' : 'low',
      }
    },

    plan(ctx, analysis) {
      if (analysis.findings.length === 0) {
        return { engineId: 'multimodal_document', actions: [], alternatives: [] }
      }
      return {
        engineId: 'multimodal_document',
        actions: [{
          id: 'extract_fields',
          description: ctx.locale === 'ar'
            ? 'استخراج الحقول إلى الذاكرة'
            : 'Extract fields into memory',
          priority: 'medium',
        }],
        alternatives: [],
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'multimodal_document',
          applied: false,
          effects: [],
          replyFragment: null,
          alerts: [],
          recommendations: [],
          memoryNotes: [],
          nextBestAction: null,
          metadata: {},
        }
      }

      const docs = resolveDocuments(ctx)
      const extracted = docs.map((doc) => extractFields(doc))
      const notes: string[] = []
      for (const row of extracted) {
        if (row.passportNumber) {
          notes.push(ctx.locale === 'ar'
            ? `جواز: ${mask(row.passportNumber)}`
            : `Passport: ${mask(row.passportNumber)}`)
        }
        if (row.flightNumber) {
          notes.push(ctx.locale === 'ar'
            ? `رحلة: ${row.flightNumber}`
            : `Flight: ${row.flightNumber}`)
        }
        if (row.pnr) notes.push(`PNR: ${row.pnr}`)
        if (row.hotel) {
          notes.push(ctx.locale === 'ar' ? `فندق: ${row.hotel}` : `Hotel: ${row.hotel}`)
        }
        if (row.destination) {
          notes.push(ctx.locale === 'ar'
            ? `وجهة: ${row.destination}`
            : `Destination: ${row.destination}`)
        }
        if (row.expiration) {
          notes.push(ctx.locale === 'ar'
            ? `انتهاء: ${row.expiration}`
            : `Expiry: ${row.expiration}`)
        }
      }

      const fragment = notes.length
        ? (ctx.locale === 'ar'
          ? `استخرجت من المستند: ${notes.slice(0, 3).join(' · ')}`
          : `Extracted from document: ${notes.slice(0, 3).join(' · ')}`)
        : null

      return {
        engineId: 'multimodal_document',
        applied: extracted.length > 0,
        effects: extracted.length ? ['populate_memory_from_documents'] : [],
        replyFragment: fragment,
        alerts: extracted
          .filter((row) => row.expiration && isExpiringSoon(row.expiration, ctx.now))
          .map((row) => ({
            priority: 'high' as const,
            message: ctx.locale === 'ar'
              ? `مستند ينتهي قريباً (${row.expiration})`
              : `Document expiring soon (${row.expiration})`,
            category: 'document',
          })),
        recommendations: [],
        memoryNotes: notes,
        nextBestAction: fragment
          ? (ctx.locale === 'ar'
            ? 'هل أثبّت هذه البيانات في ملفك؟'
            : 'Should I lock these details into your profile?')
          : null,
        metadata: { extracted },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.findings.length > 0 ? 0.8 : 0.15
    },
  }
}

function resolveDocuments(ctx: ExecutiveEngineContext): DocumentInput[] {
  if (ctx.documents && ctx.documents.length > 0) return ctx.documents
  const text = ctx.userText.trim()
  if (looksLikeDocument(text)) {
    return [{ kind: detectKind(text), text }]
  }
  return []
}

export function looksLikeDocument(text: string): boolean {
  return /passport|boarding pass|pnr|e-?ticket|voucher|visa|جواز|تأشيرة|بطاقة صعود|تأكيد حجز/i.test(text)
    || /\b[A-Z]{1,3}\d{3,4}\b/.test(text)
    || /\b[A-Z0-9]{6}\b/.test(text) && /flight|pnr|booking/i.test(text)
}

export function detectKind(text: string): DocumentInput['kind'] {
  const lower = text.toLowerCase()
  if (/passport|جواز/.test(lower)) return 'passport'
  if (/visa|تأشيرة|تاشيرة/.test(lower)) return 'visa'
  if (/boarding pass|بطاقة صعود/.test(lower)) return 'boarding_pass'
  if (/voucher|hotel confirmation|تأكيد فندق/.test(lower)) return 'hotel_voucher'
  if (/flight|e-?ticket|pnr|تأكيد طيران/.test(lower)) return 'flight_confirmation'
  if (/pdf/.test(lower)) return 'pdf'
  return 'unknown'
}

export function extractFields(doc: DocumentInput): ExtractedDocumentFields {
  const text = doc.text
  const passportNumber = text.match(/\b([A-Z]{1,2}\d{6,9})\b/)?.[1] ?? null
  const flightNumber = text.match(/\b([A-Z]{2}\d{2,4})\b/)?.[1] ?? null
  const pnr = text.match(/\bPNR[:\s-]*([A-Z0-9]{6})\b/i)?.[1]
    ?? text.match(/\bRecord locator[:\s-]*([A-Z0-9]{6})\b/i)?.[1]
    ?? null
  const expiration = text.match(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/)?.[1]
    ?? text.match(/\b(\d{1,2}[-/.]\d{1,2}[-/.]20\d{2})\b/)?.[1]
    ?? null
  const nationality = text.match(/\bNationality[:\s]+([A-Za-z ]{2,30})/i)?.[1]?.trim()
    ?? text.match(/جنسية[:\s]+([^\n,]+)/)?.[1]?.trim()
    ?? null
  const fullName = text.match(/\bName[:\s]+([A-Za-z ]{3,40})/i)?.[1]?.trim()
    ?? text.match(/الاسم[:\s]+([^\n,]+)/)?.[1]?.trim()
    ?? null
  const hotel = text.match(/\bHotel[:\s]+([A-Za-z0-9 &'-]{3,50})/i)?.[1]?.trim()
    ?? text.match(/فندق[:\s]+([^\n,]+)/)?.[1]?.trim()
    ?? null
  const destination = text.match(/\b(?:to|destination)[:\s]+([A-Za-z ]{2,30})/i)?.[1]?.trim()
    ?? text.match(/إلى[:\s]+([^\n,]+)/)?.[1]?.trim()
    ?? null
  const dates = [...text.matchAll(/\b(20\d{2}[-/.]\d{1,2}[-/.]\d{1,2})\b/g)].map((m) => m[1]!)

  return {
    fullName,
    passportNumber,
    nationality,
    expiration,
    flightNumber,
    pnr,
    hotel,
    dates: [...new Set(dates)],
    destination,
    documentKind: doc.kind === 'unknown' ? detectKind(text) : doc.kind,
  }
}

function mask(value: string): string {
  if (value.length <= 4) return '****'
  return `${value.slice(0, 2)}****${value.slice(-2)}`
}

function isExpiringSoon(raw: string, now: Date): boolean {
  const parsed = Date.parse(raw.replace(/\./g, '-'))
  if (Number.isNaN(parsed)) return false
  const days = (parsed - now.getTime()) / (1000 * 60 * 60 * 24)
  return days >= 0 && days <= 180
}
