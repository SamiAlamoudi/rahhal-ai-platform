/**
 * Sprint 39 — Conversation helpers for travel documents / visa questions.
 */

import { isTravelDocumentsEnabled } from '../TravelDocumentsFeatureFlags'
import type { TravelDocumentsPlatform } from '../TravelDocumentsPlatform'
import { isTravelDocumentsResult } from '../TravelDocumentsPlatform'
import type { DestinationRulesInput, TravelPurpose } from '../types'

export type DocumentConversationQueryKind =
  | 'can_travel_to'
  | 'need_visa'
  | 'passport_expiry'
  | 'transit_visa'
  | 'what_documents'
  | 'vaccination_requirements'

export function detectDocumentConversationQuery(
  userText: string,
): DocumentConversationQueryKind | null {
  const lower = userText.toLowerCase().trim()

  if (
    /can i transit|transit through|layover in/.test(lower)
    || /عبور عبر|ترانزيت/.test(lower)
  ) {
    return 'transit_visa'
  }
  if (
    /passport expires|expires in \d+|my passport expire/.test(lower)
    || /جواز السفر ينتهي|صلاحية الجواز/.test(lower)
  ) {
    return 'passport_expiry'
  }
  if (
    /do i need a visa|need a visa|visa (for|to)|visa required/.test(lower)
    || /هل أحتاج تأشيرة|أحتاج فيزا/.test(lower)
  ) {
    return 'need_visa'
  }
  if (
    /what documents|which documents|documents do i need|what do i need/.test(lower)
    || /ما هي المستندات|ما الوثائق/.test(lower)
  ) {
    return 'what_documents'
  }
  if (
    /vaccination|vaccine|yellow fever|health certificate/.test(lower)
    || /تطعيم|شهادة صحية/.test(lower)
  ) {
    return 'vaccination_requirements'
  }
  if (
    /can i travel to|travel to [a-z]|allowed to visit|enter [a-z]/.test(lower)
    || /هل يمكنني السفر إلى|أسافر إلى/.test(lower)
  ) {
    return 'can_travel_to'
  }
  return null
}

export function extractDestinationFromText(userText: string): string | null {
  const patterns = [
    /(?:travel to|visit|enter|to|through|via|for)\s+([A-Za-z][A-Za-z\s]+?)(?:\?|$|\.)/i,
    /السفر إلى\s+([^\s؟]+)/,
  ]
  for (const pattern of patterns) {
    const match = userText.match(pattern)
    if (match?.[1]) return cleanDestination(match[1])
  }
  // Common bare destinations
  const known = [
    'japan',
    'tokyo',
    'london',
    'uk',
    'united kingdom',
    'usa',
    'united states',
    'thailand',
    'bangkok',
    'dubai',
    'uae',
    'france',
    'germany',
    'italy',
    'spain',
    'brazil',
    'schengen',
  ]
  const lower = userText.toLowerCase()
  for (const name of known) {
    if (lower.includes(name)) return name
  }
  return null
}

export function extractTransitFromText(userText: string): string[] {
  const match = userText.match(/transit through\s+([A-Za-z][A-Za-z\s]+?)(?:\?|$|\.)/i)
  if (match?.[1]) return [cleanDestination(match[1])]
  if (/london|uk|united kingdom/.test(userText.toLowerCase()) && /transit|layover/.test(userText.toLowerCase())) {
    return ['London']
  }
  return []
}

export function extractPassportMonths(userText: string): number | null {
  const match = userText.match(/expires?(?:\s+in)?\s+(\d+)\s*(months?|days?)/i)
  if (!match) return null
  const n = Number(match[1])
  if (!Number.isFinite(n)) return null
  return /day/i.test(match[2]) ? Math.round(n / 30) : n
}

export function answerDocumentQuery(input: {
  kind: DocumentConversationQueryKind
  platform: TravelDocumentsPlatform
  userId: string
  userText: string
  locale?: 'en' | 'ar'
  nationality?: string
  defaults?: Partial<DestinationRulesInput>
}): string {
  const locale = input.locale ?? 'en'
  const destination =
    extractDestinationFromText(input.userText)
    ?? input.defaults?.destination
    ?? 'Japan'
  const transitCountries =
    input.kind === 'transit_visa'
      ? extractTransitFromText(input.userText)
      : input.defaults?.transitCountries

  let passportExpiry = input.defaults?.passportExpiry
  const months = extractPassportMonths(input.userText)
  if (months != null) {
    const d = new Date()
    d.setUTCMonth(d.getUTCMonth() + months)
    passportExpiry = d.toISOString().slice(0, 10)
  }

  const payload: DestinationRulesInput & { userId: string } = {
    userId: input.userId,
    nationality: input.nationality ?? input.defaults?.nationality ?? 'SA',
    residenceCountry: input.defaults?.residenceCountry,
    destination,
    transitCountries,
    purpose: (input.defaults?.purpose ?? 'tourism') as TravelPurpose,
    tripDurationDays: input.defaults?.tripDurationDays ?? 7,
    age: input.defaults?.age,
    passportExpiry,
    blankPages: input.defaults?.blankPages ?? 3,
    machineReadable: input.defaults?.machineReadable ?? true,
    hasTravelInsurance: input.defaults?.hasTravelInsurance,
    vaccinationRecords: input.defaults?.vaccinationRecords,
    serviceKinds: input.defaults?.serviceKinds,
  }

  const result = input.platform.evaluate(payload, locale)
  if (!isTravelDocumentsResult(result)) return result.message

  if (input.kind === 'passport_expiry') {
    const p = result.rules.passport
    if (locale === 'ar') {
      return p.valid
        ? `جواز سفرك ساري (${p.expiresInDays ?? '؟'} يوماً متبقية).\n${result.explanation}`
        : `تنبيه جواز السفر: ${p.blockingIssues.join('; ')}`
    }
    return p.valid
      ? `Your passport remains acceptable for ${result.rules.destination} (${p.expiresInDays ?? '?'} days left).\n${result.explanation}`
      : `Passport warning: ${p.blockingIssues.join('; ')}. ${p.warnings.join('; ')}`
  }

  if (input.kind === 'need_visa') {
    return [
      result.rules.visa.summary + '.',
      ...result.rules.visa.notes.slice(0, 3),
      result.rules.visa.processingDaysMin != null
        ? `Typical processing: ${result.rules.visa.processingDaysMin}-${result.rules.visa.processingDaysMax} days.`
        : null,
      `Estimated approval probability: ${(result.rules.visa.approvalProbability * 100).toFixed(0)}%.`,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (input.kind === 'transit_visa') {
    return result.rules.visa.transitVisaRequired
      ? `A transit visa may be required for your layover. ${result.rules.visa.notes.join(' ')}`
      : 'No transit visa is required for this itinerary based on your nationality.'
  }

  if (input.kind === 'vaccination_requirements') {
    return [
      result.rules.vaccination.summary + '.',
      ...result.rules.vaccination.required.map((r) => `Required: ${r.vaccine} — ${r.reason}`),
      ...result.rules.vaccination.recommended.map((r) => `Recommended: ${r.vaccine} — ${r.reason}`),
      result.rules.vaccination.medicalDeclarationRequired
        ? 'A medical declaration may be required.'
        : null,
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (input.kind === 'what_documents') {
    const required = result.rules.requirements.filter((r) => r.required)
    return [
      result.explanation,
      'Document checklist:',
      ...required.map((r) => `• ${r.title}: ${r.detail}`),
    ].join('\n')
  }

  // can_travel_to
  return result.explanation
}

export function shouldHandleDocumentQueries(options?: {
  travelDocumentsEnabled?: boolean
}): boolean {
  return isTravelDocumentsEnabled(options)
}

function cleanDestination(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/[?.!]+$/, '').trim()
}
