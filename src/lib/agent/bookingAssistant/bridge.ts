/**
 * Sprint 101 — agent bridge for Smart Booking Assistant.
 * Integrates after Alpha Experience assembly — presentation only.
 */

import {
  composeBookingAssistantExperience,
  SPRINT101_BOOKING_ASSISTANT_VERSION,
  type AlphaExperienceDTO,
  type BookingAssistantComposeInput,
  type BookingAssistantDTO,
} from '../../../core'
import type { AgentMemory } from '../types'
import { isBookingAssistantEnabled } from './feature'

export { SPRINT101_BOOKING_ASSISTANT_VERSION }

export interface AssembleBookingAssistantInput {
  conversationId?: string
  memory: AgentMemory
  alphaExperience?: AlphaExperienceDTO | null
  packageSelected?: {
    id: string
    title?: string | null
    totalPrice?: number | null
    currency?: string | null
    confidence?: number | null
  } | null
  flightOffers?: Array<Record<string, unknown>> | null
  hotelOffers?: Array<Record<string, unknown>> | null
  priceTimingAction?: string | null
  priceOpportunities?: string[] | null
  priceExplanation?: string | null
  seatsRemaining?: number | null
  roomsRemaining?: number | null
  savings?: number | null
  visaRequiredSignal?: boolean | null
  passportStatus?: 'missing' | 'expiring' | 'ok' | null
  passportExpiresAt?: string | null
  paymentMethodPresent?: boolean | null
  bookingReadyFromEngine?: boolean | null
  paymentSessionActive?: boolean | null
  bookingConfirmed?: boolean | null
  preferencesApplied?: boolean | null
  engineConfidence?: number | null
  /** Explicit override (tests). */
  enabled?: boolean
}

export interface AgentBookingAssistantMeta {
  version: string
  conversationId: string
  enabled: boolean
  sectionIds: string[]
  sectionCount: number
  readinessStatus: string | null
  readyToBook: boolean
  nextAction: string | null
  confidenceLevel: string | null
  confidenceScore: number | null
  durationMs: number
}

export interface AgentBookingAssistantAttachment {
  meta: AgentBookingAssistantMeta
  experience: BookingAssistantDTO
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function pickFlight(offers: Array<Record<string, unknown>> | null | undefined) {
  const f = offers?.[0]
  if (!f) return null
  const id = str(f.id)
  if (!id) return null
  return {
    id,
    airline: str(f.airline),
    origin: str(f.origin),
    destination: str(f.destination),
    price: num(f.price),
    currency: str(f.currency),
  }
}

function pickHotel(offers: Array<Record<string, unknown>> | null | undefined) {
  const h = offers?.[0]
  if (!h) return null
  const id = str(h.id)
  if (!id) return null
  return {
    id,
    name: str(h.name),
    price: num(h.price),
    currency: str(h.currency),
  }
}

function confidenceLevelFromScore(score: number | null | undefined): 'high' | 'medium' | 'low' | null {
  if (score == null || !Number.isFinite(score)) return null
  const s = score > 1 ? score / 100 : score
  if (s >= 0.75) return 'high'
  if (s >= 0.5) return 'medium'
  return 'low'
}

export function toBookingAssistantComposeInput(
  input: AssembleBookingAssistantInput,
): BookingAssistantComposeInput {
  const req = input.memory.requirements
  const flight = pickFlight(input.flightOffers)
  const hotel = pickHotel(input.hotelOffers)
  const alpha = input.alphaExperience
  const confScore = alpha?.confidenceScore
    ?? (typeof input.engineConfidence === 'number' ? input.engineConfidence : null)
  const confLevel = (alpha?.confidenceLevel as 'high' | 'medium' | 'low' | null | undefined)
    ?? confidenceLevelFromScore(confScore)

  return {
    conversationId: input.conversationId ?? alpha?.conversationId,
    alpha: alpha
      ? {
        enabled: alpha.enabled,
        conversationId: alpha.conversationId,
        finalRecommendation: alpha.finalRecommendation,
        confidenceLevel: alpha.confidenceLevel,
        confidenceScore: alpha.confidenceScore,
        nextAction: alpha.nextAction,
        sectionIds: [...alpha.sectionIds],
      }
      : null,
    destination: req.destination,
    origin: req.origin,
    startDate: req.startDate,
    endDate: req.endDate,
    durationDays: req.durationDays,
    travelers: req.travelers,
    budgetAmount: req.budgetAmount,
    budgetCurrency: req.budgetCurrency,
    missingFields: input.memory.missingFields.map(String),
    flightSelected: Boolean(flight),
    hotelSelected: Boolean(hotel),
    packageSelected: Boolean(input.packageSelected?.id),
    preferencesApplied: input.preferencesApplied ?? null,
    flight,
    hotel,
    packageOffer: input.packageSelected?.id
      ? {
        id: input.packageSelected.id,
        title: input.packageSelected.title ?? null,
        totalPrice: input.packageSelected.totalPrice ?? null,
        currency: input.packageSelected.currency ?? req.budgetCurrency,
        confidence: input.packageSelected.confidence ?? null,
      }
      : null,
    estimatedTotal: input.packageSelected?.totalPrice != null
      ? input.packageSelected.totalPrice
      : (flight?.price != null || hotel?.price != null)
        ? (flight?.price ?? 0) + (hotel?.price ?? 0)
        : null,
    savings: input.savings ?? null,
    currency: req.budgetCurrency
      ?? input.packageSelected?.currency
      ?? flight?.currency
      ?? hotel?.currency
      ?? 'SAR',
    confidenceScore: confScore,
    confidenceLevel: confLevel,
    confidenceLabel: null,
    priceTimingAction: input.priceTimingAction ?? null,
    priceOpportunities: input.priceOpportunities ?? null,
    priceExplanation: input.priceExplanation ?? null,
    seatsRemaining: input.seatsRemaining ?? null,
    roomsRemaining: input.roomsRemaining ?? null,
    visaRequiredSignal: input.visaRequiredSignal ?? null,
    passportStatus: input.passportStatus ?? null,
    passportExpiresAt: input.passportExpiresAt ?? null,
    paymentMethodPresent: input.paymentMethodPresent ?? null,
    bookingReadyFromEngine: input.bookingReadyFromEngine ?? null,
    paymentSessionActive: input.paymentSessionActive ?? null,
    bookingConfirmed: input.bookingConfirmed ?? null,
  }
}

export function toAgentBookingAssistantMeta(
  dto: BookingAssistantDTO,
): AgentBookingAssistantMeta {
  return {
    version: dto.version,
    conversationId: dto.conversationId,
    enabled: dto.enabled,
    sectionIds: [...dto.sectionIds],
    sectionCount: dto.sections.length,
    readinessStatus: dto.readinessStatus,
    readyToBook: dto.readyToBook,
    nextAction: dto.nextAction,
    confidenceLevel: dto.confidenceLevel,
    confidenceScore: dto.confidenceScore,
    durationMs: dto.durationMs,
  }
}

/**
 * Assemble Booking Ready Experience after Alpha Experience.
 * Flag OFF → null (legacy path unchanged).
 */
export function assembleBookingAssistant(
  input: AssembleBookingAssistantInput,
): AgentBookingAssistantAttachment | null {
  if (!isBookingAssistantEnabled({ enabled: input.enabled })) {
    return null
  }

  const composeInput = toBookingAssistantComposeInput(input)
  const experience = composeBookingAssistantExperience(composeInput, { enabled: true })

  return {
    meta: toAgentBookingAssistantMeta(experience),
    experience,
  }
}
