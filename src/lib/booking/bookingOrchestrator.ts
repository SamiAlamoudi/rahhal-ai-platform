import type {
  BookingSession,
  BookingItem,
  BookingStatus,
  BookingMode,
  BookingItemType,
  ProviderReference,
} from './bookingTypes'
import { RAHHAL_BOOKING_FEE } from './bookingTypes'
import type { BookingCapabilities } from './bookingCapabilities'
import {
  redirectWithCancellationCapabilities,
  redirectWithCancellationAndImportCapabilities,
  defaultBookingCapabilities,
} from './bookingCapabilities'
import type { BookingAction } from './bookingAction'
import { redirectBookingAction, disabledBookingAction, isSafeBookingUrl } from './bookingAction'

export interface CreateBookingSessionInput {
  userId: string
  travelSessionId: string | null
  currency: string
  expiresAt: string
}

export interface AddBookingItemInput {
  type: BookingItemType
  providerId: string
  providerName: string
  providerOfferId: string
  title: string
  price: number
  currency: string
  bookingUrl: string
  expiresAt: string | null
  travelerSummary: string
  metadata: Record<string, unknown>
  capabilities?: BookingCapabilities
}

export interface BookingSummary {
  subtotal: number
  fees: number
  total: number
  currency: string
  itemCount: number
}

export interface BookingReadinessResult {
  ready: boolean
  status: BookingStatus
  warnings: string[]
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `bk_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export function deriveBookingCapabilities(
  _itemType: BookingItemType,
  bookingUrl: string,
  cancellationAvailable: boolean,
): BookingCapabilities {
  const hasUrl = !!bookingUrl && isSafeBookingUrl(bookingUrl)
  if (!hasUrl) {
    return defaultBookingCapabilities()
  }
  if (cancellationAvailable) {
    return redirectWithCancellationAndImportCapabilities()
  }
  return redirectWithCancellationCapabilities()
}

function isItemExpired(item: BookingItem): boolean {
  if (!item.expiresAt) return false
  return new Date(item.expiresAt).getTime() < Date.now()
}

function isSessionExpired(session: BookingSession): boolean {
  return new Date(session.expiresAt).getTime() < Date.now()
}

export class BookingOrchestrator {
  private sessions: Map<string, BookingSession> = new Map()
  private lastError: string | null = null

  getLastError(): string | null {
    return this.lastError
  }

  createBookingSession(input: CreateBookingSessionInput): BookingSession {
    const now = nowIso()
    const session: BookingSession = {
      id: generateId(),
      userId: input.userId,
      travelSessionId: input.travelSessionId,
      status: 'draft',
      items: [],
      subtotal: 0,
      fees: RAHHAL_BOOKING_FEE,
      total: 0,
      currency: input.currency,
      selectedBookingMode: 'redirect',
      providerReferences: [],
      createdAt: now,
      updatedAt: now,
      expiresAt: input.expiresAt,
      redirectedAt: null,
      confirmedAt: null,
    }
    this.sessions.set(session.id, session)
    this.lastError = null
    return this.cloneSession(session)
  }

  /**
   * Hydrate an existing booking session (e.g. loaded from Supabase) into memory.
   * Replaces any prior memory copy with the same id.
   */
  importSession(session: BookingSession): BookingSession {
    const clone = this.cloneSession(session)
    this.sessions.set(clone.id, clone)
    this.lastError = null
    return this.cloneSession(clone)
  }

  /**
   * Confirm the traveler's flight+hotel selection without payment.
   * Sets confirmedAt and keeps status as selected.
   */
  confirmSelection(sessionId: string): BookingSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.lastError = 'Session not found'
      return null
    }
    if (isSessionExpired(session)) {
      session.status = 'expired'
      this.lastError = 'Session expired'
      return this.cloneSession(session)
    }
    if (session.status === 'cancelled' || session.status === 'expired') {
      this.lastError = `Cannot confirm selection from status: ${session.status}`
      return this.cloneSession(session)
    }
    if (session.items.length === 0) {
      this.lastError = 'No items in session'
      return this.cloneSession(session)
    }
    const hasFlight = session.items.some((item) => item.type === 'flight')
    const hasHotel = session.items.some((item) => item.type === 'hotel')
    if (!hasFlight || !hasHotel) {
      this.lastError = 'Selection must include one flight and one hotel'
      return this.cloneSession(session)
    }

    session.status = 'selected'
    session.confirmedAt = nowIso()
    session.updatedAt = nowIso()
    this.lastError = null
    return this.cloneSession(session)
  }

  getBookingSession(sessionId: string): BookingSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return this.cloneSession(session)
  }

  addBookingItem(sessionId: string, input: AddBookingItemInput): { session: BookingSession | null; error: string | null } {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.lastError = 'Session not found'
      return { session: null, error: 'Session not found' }
    }
    if (isSessionExpired(session)) {
      session.status = 'expired'
      this.lastError = 'Session expired'
      return { session: this.cloneSession(session), error: 'Session expired' }
    }

    const duplicate = session.items.find(
      item =>
        item.type === input.type &&
        item.providerId === input.providerId &&
        item.providerOfferId === input.providerOfferId,
    )
    if (duplicate) {
      this.lastError = 'Duplicate booking item'
      return { session: this.cloneSession(session), error: 'Duplicate booking item' }
    }

    if (input.currency !== session.currency) {
      this.lastError = `Currency mismatch: item ${input.currency} vs session ${session.currency}`
      return { session: this.cloneSession(session), error: 'Currency mismatch' }
    }

    const caps = input.capabilities ?? deriveBookingCapabilities(input.type, input.bookingUrl, false)
    const mode: BookingMode = caps.supportsRedirect ? 'redirect' : 'redirect'

    const item: BookingItem = {
      id: generateId(),
      type: input.type,
      providerId: input.providerId,
      providerName: input.providerName,
      providerOfferId: input.providerOfferId,
      title: input.title,
      price: input.price,
      currency: input.currency,
      bookingUrl: input.bookingUrl,
      bookingMode: mode,
      expiresAt: input.expiresAt,
      travelerSummary: input.travelerSummary,
      selectedAt: nowIso(),
      metadata: input.metadata,
    }

    session.items.push(item)
    if (session.status === 'draft') {
      session.status = 'selected'
    }
    this.recalculate(session)
    session.updatedAt = nowIso()
    this.lastError = null
    return { session: this.cloneSession(session), error: null }
  }

  removeBookingItem(sessionId: string, itemId: string): BookingSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.lastError = 'Session not found'
      return null
    }
    session.items = session.items.filter(item => item.id !== itemId)
    session.providerReferences = session.providerReferences.filter(
      ref => !session.items.some(item => item.providerId === ref.providerId),
    )
    if (session.items.length === 0 && session.status !== 'cancelled' && session.status !== 'expired') {
      session.status = 'draft'
    }
    this.recalculate(session)
    session.updatedAt = nowIso()
    this.lastError = null
    return this.cloneSession(session)
  }

  updateBookingItem(sessionId: string, itemId: string, updates: Partial<Pick<BookingItem, 'bookingUrl' | 'price' | 'expiresAt' | 'metadata'>>): BookingSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.lastError = 'Session not found'
      return null
    }
    const item = session.items.find(i => i.id === itemId)
    if (!item) {
      this.lastError = 'Item not found'
      return null
    }
    if (updates.bookingUrl !== undefined) item.bookingUrl = updates.bookingUrl
    if (updates.price !== undefined) item.price = updates.price
    if (updates.expiresAt !== undefined) item.expiresAt = updates.expiresAt
    if (updates.metadata !== undefined) item.metadata = { ...item.metadata, ...updates.metadata }
    this.recalculate(session)
    session.updatedAt = nowIso()
    this.lastError = null
    return this.cloneSession(session)
  }

  calculateBookingSummary(sessionId: string): BookingSummary | null {
    const session = this.sessions.get(sessionId)
    if (!session) return null
    return {
      subtotal: session.subtotal,
      fees: session.fees,
      total: session.total,
      currency: session.currency,
      itemCount: session.items.length,
    }
  }

  determineBookingMode(sessionId: string): BookingMode {
    const session = this.sessions.get(sessionId)
    if (!session) return 'redirect'
    return 'redirect'
  }

  validateBookingReadiness(sessionId: string): BookingReadinessResult {
    const session = this.sessions.get(sessionId)
    if (!session) {
      return { ready: false, status: 'draft', warnings: ['Session not found'] }
    }

    const warnings: string[] = []

    if (isSessionExpired(session)) {
      session.status = 'expired'
      return { ready: false, status: 'expired', warnings: ['Session has expired'] }
    }

    if (session.status === 'cancelled') {
      return { ready: false, status: 'cancelled', warnings: ['Session is cancelled'] }
    }

    if (session.items.length === 0) {
      return { ready: false, status: session.status, warnings: ['No items in session'] }
    }

    const expiredItems = session.items.filter(isItemExpired)
    if (expiredItems.length > 0) {
      warnings.push(`${expiredItems.length} item(s) have expired`)
    }

    const itemsWithoutUrl = session.items.filter(item => !item.bookingUrl)
    if (itemsWithoutUrl.length > 0) {
      warnings.push(`${itemsWithoutUrl.length} item(s) missing booking URL`)
    }

    const currencies = new Set(session.items.map(item => item.currency))
    if (currencies.size > 1 || !currencies.has(session.currency)) {
      warnings.push('Currency mismatch detected')
    }

    const ready = warnings.length === 0
    if (ready && session.status !== 'redirected') {
      session.status = 'ready_to_redirect'
    }

    session.updatedAt = nowIso()
    return { ready, status: session.status, warnings }
  }

  prepareRedirect(sessionId: string): BookingAction | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.lastError = 'Session not found'
      return null
    }

    if (isSessionExpired(session)) {
      session.status = 'expired'
      this.lastError = 'Session expired'
      return disabledBookingAction('redirect', '', '', 'session_expired')
    }

    if (session.status === 'cancelled') {
      this.lastError = 'Session cancelled'
      return disabledBookingAction('redirect', '', '', 'session_cancelled')
    }

    if (session.items.length === 0) {
      this.lastError = 'No items'
      return disabledBookingAction('redirect', '', '', 'no_items')
    }

    const firstItem = session.items[0]
    const readiness = this.validateBookingReadiness(sessionId)
    if (!readiness.ready) {
      this.lastError = readiness.warnings.join('; ')
      if (!firstItem.bookingUrl) {
        return disabledBookingAction('redirect', firstItem.providerId, firstItem.providerName, 'redirect_url_missing', readiness.warnings)
      }
      if (!isSafeBookingUrl(firstItem.bookingUrl)) {
        return disabledBookingAction('redirect', firstItem.providerId, firstItem.providerName, 'redirect_invalid_url', readiness.warnings)
      }
    }

    const action = redirectBookingAction(
      firstItem.providerId,
      firstItem.providerName,
      firstItem.bookingUrl,
      firstItem.expiresAt,
      readiness.warnings,
    )

    if (action.allowed) {
      session.status = 'ready_to_redirect'
      session.updatedAt = nowIso()
    }

    this.lastError = null
    return action
  }

  markRedirected(sessionId: string): BookingSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.lastError = 'Session not found'
      return null
    }
    if (session.status !== 'ready_to_redirect' && session.status !== 'selected') {
      this.lastError = `Cannot redirect from status: ${session.status}`
      return this.cloneSession(session)
    }
    session.status = 'redirected'
    session.redirectedAt = nowIso()
    session.updatedAt = nowIso()

    const providers = new Map<string, ProviderReference>()
    for (const item of session.items) {
      if (!providers.has(item.providerId)) {
        providers.set(item.providerId, {
          providerId: item.providerId,
          providerName: item.providerName,
          providerBookingReference: null,
          redirectUrl: item.bookingUrl,
        })
      }
    }
    session.providerReferences = Array.from(providers.values())

    this.lastError = null
    return this.cloneSession(session)
  }

  expireBookingSession(sessionId: string): BookingSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.lastError = 'Session not found'
      return null
    }
    if (session.status === 'confirmed' || session.status === 'redirected') {
      this.lastError = `Cannot expire session in status: ${session.status}`
      return this.cloneSession(session)
    }
    session.status = 'expired'
    session.updatedAt = nowIso()
    this.lastError = null
    return this.cloneSession(session)
  }

  cancelBookingSession(sessionId: string): BookingSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.lastError = 'Session not found'
      return null
    }
    if (session.status === 'confirmed') {
      this.lastError = 'Cannot cancel confirmed session'
      return this.cloneSession(session)
    }
    session.status = 'cancelled'
    session.updatedAt = nowIso()
    this.lastError = null
    return this.cloneSession(session)
  }

  addProviderReference(sessionId: string, providerId: string, reference: string): BookingSession | null {
    const session = this.sessions.get(sessionId)
    if (!session) {
      this.lastError = 'Session not found'
      return null
    }
    const ref = session.providerReferences.find(r => r.providerId === providerId)
    if (ref) {
      ref.providerBookingReference = reference
    } else {
      session.providerReferences.push({
        providerId,
        providerName: '',
        providerBookingReference: reference,
        redirectUrl: null,
      })
    }
    session.status = 'pending_provider_confirmation'
    session.updatedAt = nowIso()
    this.lastError = null
    return this.cloneSession(session)
  }

  getAllSessions(): BookingSession[] {
    return Array.from(this.sessions.values()).map(s => this.cloneSession(s))
  }

  getSessionsByUser(userId: string): BookingSession[] {
    return Array.from(this.sessions.values())
      .filter(s => s.userId === userId)
      .map(s => this.cloneSession(s))
  }

  private recalculate(session: BookingSession): void {
    session.subtotal = session.items.reduce((sum, item) => sum + item.price, 0)
    session.fees = RAHHAL_BOOKING_FEE
    session.total = session.subtotal + session.fees
  }

  private cloneSession(session: BookingSession): BookingSession {
    return {
      ...session,
      items: session.items.map(item => ({ ...item, metadata: { ...item.metadata } })),
      providerReferences: session.providerReferences.map(ref => ({ ...ref })),
    }
  }

  _internalGetSession(sessionId: string): BookingSession | undefined {
    return this.sessions.get(sessionId)
  }
}

let cachedOrchestrator: BookingOrchestrator | null = null

export function getBookingOrchestrator(): BookingOrchestrator {
  if (cachedOrchestrator) return cachedOrchestrator
  cachedOrchestrator = new BookingOrchestrator()
  return cachedOrchestrator
}

export function resetBookingOrchestrator(): void {
  cachedOrchestrator = null
}
