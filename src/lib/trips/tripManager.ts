/**
 * TripManager — Phase V My Trips & Booking Management facade.
 *
 * Aggregates booking / payment / ticketing / notification history without
 * coupling to vendor providers. Does not change TripPlan APIs or UI.
 */

import type { BookingOrchestrator } from '../booking/bookingOrchestrator'
import type { BookingSession } from '../booking/bookingTypes'
import { listOrdersByUser } from '../payment/orderManager'
import type { PaymentOrchestrator } from '../payment/orchestration/paymentOrchestrator'
import type { RahhalOrder } from '../payment/checkoutTypes'
import type { PaymentSession } from '../payment/paymentTypes'
import type { NotificationOrchestrator } from '../notifications/notificationOrchestrator'
import type { NotificationSession } from '../notifications/types'
import type { TicketOrchestrator } from '../ticketing/ticketOrchestrator'
import type { ConfirmationDocument, TicketSession } from '../ticketing/types'
import { appendTripAudit } from './audit'
import {
  aggregateBookingStatus,
  deriveManagedTripStatus,
} from './bookingStatusAggregator'
import {
  BookingHistory,
  downloadConfirmationDocument,
  toPaymentHistoryEntry,
} from './bookingHistory'
import {
  FavoriteDestinationsStore,
  getFavoriteDestinationsStore,
} from './favoriteDestinations'
import {
  getRecentSearchesStore,
  RecentSearchesStore,
} from './recentSearches'
import {
  getSavedTripsStore,
  SavedTripsStore,
} from './savedTrips'
import { TripHistory } from './tripHistory'
import {
  getTripRepository,
  TripRepository,
} from './tripRepository'
import { buildTripTimeline } from './tripTimeline'
import {
  getTravelerProfileStore,
  TravelerProfileStore,
  type UpsertTravelerProfileInput,
} from './travelerProfile'
import type {
  AggregatedBookingStatus,
  BookingHistoryEntry,
  ManagedTrip,
  ManagedTripStatus,
  NotificationHistoryEntry,
  PaymentHistoryEntry,
  TicketViewEntry,
  TravelerProfile,
  TripQuery,
  TripTimelineEvent,
  TripVersionRecord,
} from './types'

export interface TripManagerOptions {
  repository?: TripRepository
  travelers?: TravelerProfileStore
  savedTrips?: SavedTripsStore
  favoriteDestinations?: FavoriteDestinationsStore
  recentSearches?: RecentSearchesStore
  bookingOrchestrator?: BookingOrchestrator | null
  paymentOrchestrator?: PaymentOrchestrator | null
  ticketOrchestrator?: TicketOrchestrator | null
  notificationOrchestrator?: NotificationOrchestrator | null
}

export interface CreateManagedTripInput {
  userId: string
  title: string
  destination: string
  destinations?: string[]
  startDate?: string | null
  endDate?: string | null
  currency?: string
  estimatedTotal?: number | null
  travelerIds?: string[]
  tripPlanId?: string | null
  bookingSessionId?: string | null
  orderId?: string | null
  paymentSessionId?: string | null
  ticketSessionId?: string | null
  notificationSessionIds?: string[]
  itinerarySnapshot?: ManagedTrip['itinerarySnapshot']
  status?: ManagedTripStatus
}

function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function nowIso(): string {
  return new Date().toISOString()
}

export class TripManager {
  private readonly repository: TripRepository
  private readonly travelers: TravelerProfileStore
  private readonly savedTripsStore: SavedTripsStore
  private readonly favorites: FavoriteDestinationsStore
  private readonly recentSearches: RecentSearchesStore
  private readonly bookingOrchestrator: BookingOrchestrator | null
  private readonly paymentOrchestrator: PaymentOrchestrator | null
  private readonly ticketOrchestrator: TicketOrchestrator | null
  private readonly notificationOrchestrator: NotificationOrchestrator | null
  private readonly tripHistory = new TripHistory()
  private readonly bookingHistory = new BookingHistory()

  constructor(options: TripManagerOptions = {}) {
    this.repository = options.repository ?? getTripRepository()
    this.travelers = options.travelers ?? getTravelerProfileStore()
    this.savedTripsStore = options.savedTrips ?? getSavedTripsStore()
    this.favorites = options.favoriteDestinations ?? getFavoriteDestinationsStore()
    this.recentSearches = options.recentSearches ?? getRecentSearchesStore()
    this.bookingOrchestrator = options.bookingOrchestrator ?? null
    this.paymentOrchestrator = options.paymentOrchestrator ?? null
    this.ticketOrchestrator = options.ticketOrchestrator ?? null
    this.notificationOrchestrator = options.notificationOrchestrator ?? null
  }

  // ── Traveler profiles ─────────────────────────────────────────────

  upsertTraveler(input: UpsertTravelerProfileInput, existingId?: string): TravelerProfile {
    return this.travelers.upsert(input, existingId)
  }

  listTravelers(userId: string): TravelerProfile[] {
    return this.travelers.listByUser(userId)
  }

  // ── Create / list / get ───────────────────────────────────────────

  createTrip(input: CreateManagedTripInput): ManagedTrip {
    const now = nowIso()
    const destinations = input.destinations?.length
      ? [...input.destinations]
      : [input.destination]
    const status = input.status ?? 'draft'
    let trip: ManagedTrip = {
      id: generateId('trip'),
      userId: input.userId,
      version: 1,
      status,
      title: input.title.trim() || `${input.destination} trip`,
      favorite: false,
      archived: false,
      travelerIds: [...(input.travelerIds ?? [])],
      links: {
        tripPlanId: input.tripPlanId ?? null,
        savedTripId: null,
        bookingSessionIds: input.bookingSessionId ? [input.bookingSessionId] : [],
        orderIds: input.orderId ? [input.orderId] : [],
        paymentSessionIds: input.paymentSessionId ? [input.paymentSessionId] : [],
        ticketSessionIds: input.ticketSessionId ? [input.ticketSessionId] : [],
        notificationSessionIds: [...(input.notificationSessionIds ?? [])],
      },
      summary: {
        destination: input.destination,
        destinations,
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
        currency: input.currency ?? 'SAR',
        estimatedTotal: input.estimatedTotal ?? null,
        travelerCount: input.travelerIds?.length ?? 0,
        primaryBookingStatus: null,
        primaryPaymentStatus: null,
        primaryTicketStatus: null,
      },
      itinerarySnapshot: input.itinerarySnapshot
        ? structuredClone(input.itinerarySnapshot)
        : {
          title: input.title.trim() || `${input.destination} trip`,
          destinations,
          notes: null,
        },
      audit: [],
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
      archivedAt: null,
    }
    trip = {
      ...trip,
      audit: appendTripAudit(trip.audit, {
        type: 'trip.created',
        message: 'Managed trip created',
        fromStatus: null,
        toStatus: status,
        actorUserId: input.userId,
        metadata: { destination: input.destination },
      }),
    }
    const created = this.repository.create(trip)
    return this.refreshAggregate(created)
  }

  getTrip(tripId: string, userId: string): ManagedTrip | null {
    const trip = this.repository.getByIdForUser(tripId, userId)
    return trip ? this.refreshAggregate(trip) : null
  }

  listTrips(query: TripQuery): ManagedTrip[] {
    return this.repository.list(query).map((t) => this.refreshAggregate(t))
  }

  listAllUserTrips(userId: string): ManagedTrip[] {
    return this.listTrips({ userId, includeArchived: true, sortBy: 'startDate', sortDirection: 'desc' })
  }

  upcomingTrips(userId: string): ManagedTrip[] {
    return this.tripHistory.partition(this.listTrips({ userId })).upcoming
  }

  pastTrips(userId: string): ManagedTrip[] {
    return this.tripHistory.partition(this.listTrips({ userId })).past
  }

  cancelledTrips(userId: string): ManagedTrip[] {
    return this.tripHistory.partition(
      this.listTrips({ userId, status: 'cancelled', includeArchived: true }),
    ).cancelled
  }

  activeBookings(userId: string): ManagedTrip[] {
    return this.tripHistory.partition(this.listTrips({ userId })).activeBookings
  }

  searchTrips(userId: string, search: string): ManagedTrip[] {
    return this.listTrips({ userId, search, includeArchived: false })
  }

  filterByStatus(userId: string, status: ManagedTripStatus | ManagedTripStatus[]): ManagedTrip[] {
    return this.listTrips({ userId, status, includeArchived: status === 'archived' || (Array.isArray(status) && status.includes('archived')) })
  }

  filterByDestination(userId: string, destination: string): ManagedTrip[] {
    return this.listTrips({ userId, destination })
  }

  filterByTraveler(userId: string, travelerIdOrName: string): ManagedTrip[] {
    const profiles = this.travelers.listByUser(userId)
    const exact = profiles.find((p) => p.id === travelerIdOrName)
    if (exact) {
      return this.listTrips({ userId, travelerId: exact.id, includeArchived: true })
    }
    const needle = travelerIdOrName.trim().toLowerCase()
    const matchingIds = new Set(
      profiles
        .filter((p) => `${p.firstName} ${p.lastName}`.toLowerCase().includes(needle))
        .map((p) => p.id),
    )
    return this.listAllUserTrips(userId).filter((t) => t.travelerIds.some((id) => matchingIds.has(id)))
  }

  sortTrips(
    userId: string,
    sortBy: TripQuery['sortBy'],
    sortDirection: TripQuery['sortDirection'] = 'desc',
  ): ManagedTrip[] {
    return this.listTrips({ userId, sortBy, sortDirection, includeArchived: false })
  }

  // ── Detail views ──────────────────────────────────────────────────

  getBookingDetails(tripId: string, userId: string): BookingHistoryEntry[] {
    const trip = this.requireOwned(tripId, userId)
    const sessions = this.resolveBookings(trip)
    return this.bookingHistory.listBookings(sessions)
  }

  getPaymentHistory(tripId: string, userId: string): PaymentHistoryEntry[] {
    const trip = this.requireOwned(tripId, userId)
    const orders = this.resolveOrders(trip, userId)
    return orders.map((o) => {
      const payment = o.paymentSessionId
        ? this.paymentOrchestrator?.getSession(o.paymentSessionId) ?? null
        : null
      return toPaymentHistoryEntry(o, payment?.customerEmail ?? null)
    })
  }

  getIssuedTickets(tripId: string, userId: string): TicketViewEntry[] {
    const trip = this.requireOwned(tripId, userId)
    return this.bookingHistory.listTickets(this.resolveTickets(trip))
  }

  getHotelVouchers(tripId: string, userId: string): TicketViewEntry['hotelVouchers'] {
    return this.getIssuedTickets(tripId, userId).flatMap((t) => t.hotelVouchers)
  }

  getNotificationHistory(tripId: string, userId: string): NotificationHistoryEntry[] {
    const trip = this.requireOwned(tripId, userId)
    return this.bookingHistory.listNotifications(this.resolveNotifications(trip, userId))
  }

  downloadConfirmation(tripId: string, userId: string, ticketSessionId?: string): ConfirmationDocument | null {
    const trip = this.requireOwned(tripId, userId)
    const tickets = this.resolveTickets(trip)
    const ticket = ticketSessionId
      ? tickets.find((t) => t.id === ticketSessionId) ?? null
      : tickets.find((t) => t.status === 'issued' || t.status === 'delivered') ?? tickets[0] ?? null
    if (!ticket) return null
    return downloadConfirmationDocument(ticket)
  }

  getTimeline(tripId: string, userId: string): TripTimelineEvent[] {
    const trip = this.requireOwned(tripId, userId)
    return buildTripTimeline({
      trip,
      bookings: this.resolveBookings(trip),
      orders: this.resolveOrders(trip, userId),
      payments: this.resolvePayments(trip),
      tickets: this.resolveTickets(trip),
      notifications: this.resolveNotifications(trip, userId),
    })
  }

  getAggregatedStatus(tripId: string, userId: string): AggregatedBookingStatus {
    const trip = this.requireOwned(tripId, userId)
    return aggregateBookingStatus({
      trip,
      booking: this.resolveBookings(trip)[0] ?? null,
      order: this.resolveOrders(trip, userId)[0] ?? null,
      payment: this.resolvePayments(trip)[0] ?? null,
      ticket: this.resolveTickets(trip)[0] ?? null,
    })
  }

  listVersions(tripId: string, userId: string): TripVersionRecord[] {
    this.requireOwned(tripId, userId)
    return this.repository.listVersions(tripId, userId)
  }

  // ── Mutations ─────────────────────────────────────────────────────

  /** Cancel booking (mock) and mark trip cancelled. */
  cancelBooking(tripId: string, userId: string, reason?: string): ManagedTrip {
    let trip = this.requireOwned(tripId, userId)
    if (trip.status === 'cancelled') return trip

    for (const bookingId of trip.links.bookingSessionIds) {
      this.bookingOrchestrator?.cancelBookingSession(bookingId)
    }

    const now = nowIso()
    trip = {
      ...trip,
      status: 'cancelled',
      cancelledAt: now,
      summary: {
        ...trip.summary,
        primaryBookingStatus: 'cancelled',
      },
      audit: appendTripAudit(trip.audit, {
        type: 'trip.booking_cancelled',
        message: reason ? `Booking cancelled: ${reason}` : 'Booking cancelled (mock)',
        fromStatus: trip.status,
        toStatus: 'cancelled',
        actorUserId: userId,
      }),
    }
    return this.repository.update(trip)
  }

  /** Rebook previous trip — new draft with cloned itinerary snapshot. */
  rebook(tripId: string, userId: string): ManagedTrip {
    const source = this.requireOwned(tripId, userId)
    const created = this.createTrip({
      userId,
      title: `${source.title} (rebook)`,
      destination: source.summary.destination,
      destinations: source.summary.destinations,
      startDate: source.summary.startDate,
      endDate: source.summary.endDate,
      currency: source.summary.currency,
      estimatedTotal: source.summary.estimatedTotal,
      travelerIds: source.travelerIds,
      tripPlanId: source.links.tripPlanId,
      itinerarySnapshot: source.itinerarySnapshot
        ? {
          ...source.itinerarySnapshot,
          notes: `Rebooked from ${source.id}`,
        }
        : null,
      status: 'draft',
    })
    const withAudit = {
      ...created,
      audit: appendTripAudit(created.audit, {
        type: 'trip.rebooked_from',
        message: `Rebooked from trip ${source.id}`,
        actorUserId: userId,
        metadata: { sourceTripId: source.id },
      }),
    }
    return this.repository.update(withAudit)
  }

  /** Duplicate itinerary — clone without live booking/payment/ticket links. */
  duplicateItinerary(tripId: string, userId: string): ManagedTrip {
    const source = this.requireOwned(tripId, userId)
    const created = this.createTrip({
      userId,
      title: `${source.title} (copy)`,
      destination: source.summary.destination,
      destinations: source.summary.destinations,
      startDate: source.summary.startDate,
      endDate: source.summary.endDate,
      currency: source.summary.currency,
      estimatedTotal: source.summary.estimatedTotal,
      travelerIds: [...source.travelerIds],
      tripPlanId: source.links.tripPlanId,
      itinerarySnapshot: source.itinerarySnapshot
        ? structuredClone(source.itinerarySnapshot)
        : null,
      status: 'draft',
    })
    const withAudit = {
      ...created,
      audit: appendTripAudit(created.audit, {
        type: 'trip.duplicated_from',
        message: `Duplicated itinerary from ${source.id}`,
        actorUserId: userId,
        metadata: { sourceTripId: source.id },
      }),
    }
    return this.repository.update(withAudit)
  }

  archiveTrip(tripId: string, userId: string): ManagedTrip {
    let trip = this.requireOwned(tripId, userId)
    if (trip.archived && trip.status === 'archived') return trip
    const from = trip.status
    trip = {
      ...trip,
      archived: true,
      status: 'archived',
      archivedAt: nowIso(),
      audit: appendTripAudit(trip.audit, {
        type: 'trip.archived',
        message: 'Trip archived',
        fromStatus: from,
        toStatus: 'archived',
        actorUserId: userId,
      }),
    }
    return this.repository.update(trip)
  }

  favoriteTrip(tripId: string, userId: string, favorite = true): ManagedTrip {
    let trip = this.requireOwned(tripId, userId)
    trip = {
      ...trip,
      favorite,
      audit: appendTripAudit(trip.audit, {
        type: favorite ? 'trip.favorited' : 'trip.unfavorited',
        message: favorite ? 'Trip marked favorite' : 'Trip unmarked favorite',
        actorUserId: userId,
      }),
    }
    return this.repository.update(trip)
  }

  linkDomainIds(
    tripId: string,
    userId: string,
    links: Partial<{
      bookingSessionId: string
      orderId: string
      paymentSessionId: string
      ticketSessionId: string
      notificationSessionId: string
      savedTripId: string
    }>,
  ): ManagedTrip {
    let trip = this.requireOwned(tripId, userId)
    const nextLinks = { ...trip.links }
    if (links.bookingSessionId && !nextLinks.bookingSessionIds.includes(links.bookingSessionId)) {
      nextLinks.bookingSessionIds = [...nextLinks.bookingSessionIds, links.bookingSessionId]
    }
    if (links.orderId && !nextLinks.orderIds.includes(links.orderId)) {
      nextLinks.orderIds = [...nextLinks.orderIds, links.orderId]
    }
    if (links.paymentSessionId && !nextLinks.paymentSessionIds.includes(links.paymentSessionId)) {
      nextLinks.paymentSessionIds = [...nextLinks.paymentSessionIds, links.paymentSessionId]
    }
    if (links.ticketSessionId && !nextLinks.ticketSessionIds.includes(links.ticketSessionId)) {
      nextLinks.ticketSessionIds = [...nextLinks.ticketSessionIds, links.ticketSessionId]
    }
    if (links.notificationSessionId && !nextLinks.notificationSessionIds.includes(links.notificationSessionId)) {
      nextLinks.notificationSessionIds = [...nextLinks.notificationSessionIds, links.notificationSessionId]
    }
    if (links.savedTripId) nextLinks.savedTripId = links.savedTripId
    trip = {
      ...trip,
      links: nextLinks,
      audit: appendTripAudit(trip.audit, {
        type: 'trip.links_updated',
        message: 'Trip domain links updated',
        actorUserId: userId,
        metadata: { ...links },
      }),
    }
    return this.refreshAggregate(this.repository.update(trip))
  }

  // ── Saved / favorites / recent searches ───────────────────────────

  saveTrip(userId: string, tripId: string): ReturnType<SavedTripsStore['save']> {
    const trip = this.requireOwned(tripId, userId)
    const saved = this.savedTripsStore.save({
      userId,
      title: trip.title,
      destination: trip.summary.destination,
      tripId: trip.id,
      payload: {
        itinerarySnapshot: trip.itinerarySnapshot,
        summary: trip.summary,
      },
    })
    this.linkDomainIds(tripId, userId, { savedTripId: saved.id })
    return saved
  }

  listSavedTrips(userId: string) {
    return this.savedTripsStore.listByUser(userId)
  }

  addFavoriteDestination(userId: string, destination: string) {
    return this.favorites.add(userId, destination)
  }

  listFavoriteDestinations(userId: string) {
    return this.favorites.listByUser(userId)
  }

  recordSearch(userId: string, query: string, destination?: string | null) {
    return this.recentSearches.add({ userId, query, destination })
  }

  listRecentSearches(userId: string) {
    return this.recentSearches.listByUser(userId)
  }

  // ── Internals ─────────────────────────────────────────────────────

  private requireOwned(tripId: string, userId: string): ManagedTrip {
    const trip = this.repository.getByIdForUser(tripId, userId)
    if (!trip) throw new Error('Trip not found or ownership denied')
    return trip
  }

  private resolveBookings(trip: ManagedTrip): BookingSession[] {
    if (!this.bookingOrchestrator) return []
    const out: BookingSession[] = []
    for (const id of trip.links.bookingSessionIds) {
      const session = this.bookingOrchestrator.getBookingSession(id)
      if (session && session.userId === trip.userId) out.push(session)
    }
    return out
  }

  private resolveOrders(trip: ManagedTrip, userId: string): RahhalOrder[] {
    const byUser = listOrdersByUser(userId)
    if (trip.links.orderIds.length) {
      return byUser.filter((o) => trip.links.orderIds.includes(o.id))
    }
    // Infer via booking linkage when order ids not stored yet
    const bookingIds = new Set(trip.links.bookingSessionIds)
    return byUser.filter((o) => {
      // orders don't always store bookingSessionId — match via payment bridge metadata if present
      const metaBooking = typeof o.cart.items[0]?.metadata?.bookingSessionId === 'string'
        ? o.cart.items[0].metadata.bookingSessionId as string
        : null
      return metaBooking ? bookingIds.has(metaBooking) : false
    })
  }

  private resolvePayments(trip: ManagedTrip): PaymentSession[] {
    if (!this.paymentOrchestrator) return []
    const ids = new Set(trip.links.paymentSessionIds)
    for (const order of listOrdersByUser(trip.userId)) {
      if (trip.links.orderIds.includes(order.id) && order.paymentSessionId) {
        ids.add(order.paymentSessionId)
      }
    }
    return [...ids]
      .map((id) => this.paymentOrchestrator!.getSession(id))
      .filter((s): s is PaymentSession => Boolean(s))
  }

  private resolveTickets(trip: ManagedTrip): TicketSession[] {
    if (!this.ticketOrchestrator) return []
    const linked = trip.links.ticketSessionIds
      .map((id) => this.ticketOrchestrator!.getSession(id))
      .filter((s): s is TicketSession => Boolean(s))
    if (linked.length) return linked

    const all = this.ticketOrchestrator.listSessions()
    const bookingIds = new Set(trip.links.bookingSessionIds)
    const orderIds = new Set(trip.links.orderIds)
    return all.filter(
      (t) => bookingIds.has(t.bookingSessionId) || orderIds.has(t.orderId),
    )
  }

  private resolveNotifications(trip: ManagedTrip, userId: string): NotificationSession[] {
    if (!this.notificationOrchestrator) return []
    const all = this.notificationOrchestrator.listSessions()
      .filter((n) => n.recipient.userId === userId)
    if (trip.links.notificationSessionIds.length) {
      const set = new Set(trip.links.notificationSessionIds)
      return all.filter((n) => set.has(n.id))
    }
    const bookingIds = new Set(trip.links.bookingSessionIds)
    const orderIds = new Set(trip.links.orderIds)
    const ticketIds = new Set(trip.links.ticketSessionIds)
    const tripPlanId = trip.links.tripPlanId
    return all.filter((n) => {
      const r = n.related
      return (r.bookingSessionId && bookingIds.has(r.bookingSessionId))
        || (r.orderId && orderIds.has(r.orderId))
        || (r.ticketSessionId && ticketIds.has(r.ticketSessionId))
        || (tripPlanId && r.tripPlanId === tripPlanId)
    })
  }

  private refreshAggregate(trip: ManagedTrip): ManagedTrip {
    const booking = this.resolveBookings(trip)[0] ?? null
    const order = this.resolveOrders(trip, trip.userId)[0] ?? null
    const payment = this.resolvePayments(trip)[0] ?? null
    const ticket = this.resolveTickets(trip)[0] ?? null
    const aggregated = aggregateBookingStatus({ trip, booking, order, payment, ticket })
    const derived = deriveManagedTripStatus({
      archived: trip.archived,
      cancelled: aggregated.cancelled || trip.status === 'cancelled',
      endDate: trip.summary.endDate,
      startDate: trip.summary.startDate,
      paid: aggregated.paid,
      bookingStatus: aggregated.bookingStatus,
    })
    // Only auto-derive when not explicitly archived/cancelled already stored
    const status = trip.archived || trip.status === 'cancelled' || trip.status === 'archived'
      ? trip.status
      : derived

    return {
      ...trip,
      status,
      summary: {
        ...trip.summary,
        primaryBookingStatus: aggregated.bookingStatus,
        primaryPaymentStatus: aggregated.paymentStatus,
        primaryTicketStatus: aggregated.ticketStatus,
        travelerCount: trip.travelerIds.length || trip.summary.travelerCount,
        estimatedTotal: order?.cart.total ?? booking?.total ?? trip.summary.estimatedTotal,
      },
    }
  }
}

let defaultManager: TripManager | null = null

export function getTripManager(options?: TripManagerOptions): TripManager {
  if (!defaultManager) {
    defaultManager = new TripManager(options)
  }
  return defaultManager
}

export function resetTripManager(): void {
  defaultManager = null
}
