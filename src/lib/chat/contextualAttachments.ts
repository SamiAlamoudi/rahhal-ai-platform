/**
 * Recovery Phase 2.2 — Contextual attachments (UX only).
 *
 * Attachment actions stay hidden until Conversation Brain explicitly asks
 * for a travel document or photo. No Brain / provider / routing changes.
 */

export type ContextualAttachmentKind =
  | 'passport'
  | 'visa'
  | 'boarding_pass'
  | 'hotel_confirmation'
  | 'flight_ticket'
  | 'travel_insurance'
  | 'payment_receipt'
  | 'destination_photo'
  | 'landmark_photo'
  | 'hotel_photo'
  | 'image'

export interface ContextualAttachmentRequest {
  kind: ContextualAttachmentKind
  /** Arabic CTA shown in the composer, e.g. "إرفاق جواز السفر". */
  labelAr: string
  /** File input accept list. */
  accept: string
  /** True when the request is photo-oriented (vs document). */
  isImage: boolean
}

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif'
const DOCUMENT_ACCEPT = `${PHOTO_ACCEPT},application/pdf,.pdf`

const KIND_LABELS: Record<ContextualAttachmentKind, string> = {
  passport: 'إرفاق جواز السفر',
  visa: 'إرفاق التأشيرة',
  boarding_pass: 'إرفاق بطاقة الصعود',
  hotel_confirmation: 'إرفاق تأكيد الفندق',
  flight_ticket: 'إرفاق التذكرة',
  travel_insurance: 'إرفاق وثيقة التأمين',
  payment_receipt: 'إرفاق إيصال الدفع',
  destination_photo: 'إرفاق صورة الوجهة',
  landmark_photo: 'إرفاق صورة المعلم',
  hotel_photo: 'إرفاق صورة الفندق',
  image: 'إرفاق صورة',
}

const IMAGE_KINDS = new Set<ContextualAttachmentKind>([
  'destination_photo',
  'landmark_photo',
  'hotel_photo',
  'image',
])

/** More specific kinds first so "صورة الفندق" wins over generic image. */
const KIND_PATTERNS: Array<{ kind: ContextualAttachmentKind; pattern: RegExp }> = [
  {
    kind: 'passport',
    pattern: /جواز(?:\s*السفر)?|passport/i,
  },
  {
    kind: 'visa',
    pattern: /تأشير[ةه]|فيزا|\bvisa\b/i,
  },
  {
    kind: 'boarding_pass',
    pattern: /بطاقة\s*الصعود|boarding\s*pass/i,
  },
  {
    kind: 'hotel_confirmation',
    pattern: /تأكيد\s*(?:الفندق|الحجز)|hotel\s*(?:confirmation|voucher)|hotel\s*booking\s*confirm/i,
  },
  {
    kind: 'flight_ticket',
    pattern: /تذكرة(?:\s*(?:الطيران|الذهاب))?|e-?ticket|flight\s*ticket/i,
  },
  {
    kind: 'travel_insurance',
    pattern: /تأمين(?:\s*(?:السفر|الرحلي))?|travel\s*insurance|\binsurance\b/i,
  },
  {
    kind: 'payment_receipt',
    pattern: /إيصال(?:\s*(?:الدفع|الدفعه|المالي))?|payment\s*receipt|\breceipt\b/i,
  },
  {
    kind: 'hotel_photo',
    pattern: /صورة\s*(?:ل?ل?)?(?:ال)?فندق|صورة\s*(?:ال)?غرفة|hotel\s*(?:photo|picture|image)|photo\s*of\s*(?:the\s*)?hotel/i,
  },
  {
    kind: 'landmark_photo',
    pattern: /صورة\s*(?:ل?ل?)?(?:ال)?معلم|معلم\s*سياحي|landmark\s*(?:photo|picture|image)/i,
  },
  {
    kind: 'destination_photo',
    pattern: /صورة\s*(?:ل?ل?)?(?:ال)?وجه[ةه]|صورة\s*(?:ال)?مدين[ةه]|destination\s*(?:photo|picture|image)/i,
  },
  {
    kind: 'image',
    pattern: /صور[ةه]|\bphoto\b|\bpicture\b|\bimage\b/i,
  },
]

/**
 * Explicit ask verbs / phrases — mention alone (e.g. visa notes) must not open the control.
 */
const REQUEST_INTENT =
  /(?:أرفق|إرفاق|ارفق|أرسل(?:ي|ين)?|ارسلي|أرسلي|ابعث(?:ي)?|ارفع|شارك(?:ني|ي)?|هل\s+يمكنك|ممكن\s+(?:ترسل|ترفع|ترفق)|محتاج(?:ة)?\s+(?:منك\s+)?(?:ترسل|ترفع|ترفق)|أحتاج(?:ها)?\s+(?:منك\s+)?|أرسل\s+لي|please\s+(?:upload|attach|send|share|provide)|(?:upload|attach|send|share|provide)\s+(?:me\s+|your\s+|a\s+|an\s+|the\s+)?|can\s+you\s+(?:upload|attach|send|share|provide)|send\s+me|attach\s+your)/i

export function labelForAttachmentKind(kind: ContextualAttachmentKind): string {
  return KIND_LABELS[kind]
}

export function buildAttachmentRequest(kind: ContextualAttachmentKind): ContextualAttachmentRequest {
  const isImage = IMAGE_KINDS.has(kind)
  return {
    kind,
    labelAr: KIND_LABELS[kind],
    accept: isImage ? PHOTO_ACCEPT : DOCUMENT_ACCEPT,
    isImage,
  }
}

function kindFromUnknown(value: unknown): ContextualAttachmentKind | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_')
  const aliases: Record<string, ContextualAttachmentKind> = {
    passport: 'passport',
    visa: 'visa',
    boarding_pass: 'boarding_pass',
    boardingpass: 'boarding_pass',
    hotel_confirmation: 'hotel_confirmation',
    hotel_voucher: 'hotel_confirmation',
    hotelconfirmation: 'hotel_confirmation',
    flight_ticket: 'flight_ticket',
    ticket: 'flight_ticket',
    eticket: 'flight_ticket',
    e_ticket: 'flight_ticket',
    travel_insurance: 'travel_insurance',
    insurance: 'travel_insurance',
    payment_receipt: 'payment_receipt',
    receipt: 'payment_receipt',
    destination_photo: 'destination_photo',
    landmark_photo: 'landmark_photo',
    hotel_photo: 'hotel_photo',
    image: 'image',
    photo: 'image',
    picture: 'image',
  }
  return aliases[normalized] ?? null
}

/**
 * Prefer a structured Brain hint on providerMeta when present; otherwise detect
 * an explicit natural-language request in the assistant message.
 */
export function detectContextualAttachmentRequest(
  content: string | null | undefined,
  providerMeta?: Record<string, unknown> | null,
): ContextualAttachmentRequest | null {
  const meta = providerMeta ?? {}
  const structured =
    kindFromUnknown(meta.attachmentRequest)
    ?? kindFromUnknown(meta.requestedAttachment)
    ?? (isRecord(meta.attachmentRequest)
      ? kindFromUnknown(meta.attachmentRequest.kind)
      : null)
    ?? (isRecord(meta.requestedAttachment)
      ? kindFromUnknown(meta.requestedAttachment.kind)
      : null)

  if (structured) return buildAttachmentRequest(structured)

  const text = (content ?? '').trim()
  if (!text || !REQUEST_INTENT.test(text)) return null

  for (const { kind, pattern } of KIND_PATTERNS) {
    if (pattern.test(text)) return buildAttachmentRequest(kind)
  }
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
