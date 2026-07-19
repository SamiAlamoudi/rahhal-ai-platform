/**
 * Sprint 35 — PostBookingService
 *
 * After successful Sprint 34 payment: create My Trip (via existing TripManager),
 * generate itinerary/documents, schedule notifications, track lifecycle.
 * Does not duplicate payment / execution / planner logic.
 */

import type { PaymentResult } from '../payments'
import { CancellationManager } from './CancellationManager'
import { FlightStatusMonitor } from './FlightStatusMonitor'
import { NotificationScheduler } from './NotificationScheduler'
import { PostBookingRepository } from './PostBookingRepository'
import { RefundStatusTracker } from './RefundStatusTracker'
import { TripDocuments } from './TripDocuments'
import { TripEvents, createTripEvent, type TripEvent } from './TripEvents'
import { isTripManagementEnabled } from './TripFeatureFlags'
import { TripMetrics } from './TripMetrics'
import { TripTimeline } from './TripLifecycleTimeline'
import { TripManager, getTripManager } from './tripManager'
import type {
  CreatePostBookingTripInput,
  PostBookingTripRecord,
  TripLifecycleBucket,
  TripNotificationTrigger,
} from './postBookingTypes'

export class TripManagementError extends Error {
  readonly code: 'FEATURE_DISABLED' | 'NOT_FOUND' | 'INVALID_PAYMENT' | 'VALIDATION'

  constructor(
    code: TripManagementError['code'],
    message: string,
  ) {
    super(message)
    this.name = 'TripManagementError'
    this.code = code
  }
}

export interface PostBookingServiceOptions {
  enabled?: boolean
  tripManager?: TripManager
  repository?: PostBookingRepository
  documents?: TripDocuments
  notifications?: NotificationScheduler
  flightMonitor?: FlightStatusMonitor
  cancellations?: CancellationManager
  refunds?: RefundStatusTracker
  events?: TripEvents
  metrics?: TripMetrics
  timeline?: TripTimeline
  onEvent?: (event: TripEvent) => void
}

export class PostBookingService {
  private readonly tripManager: TripManager
  private readonly repository: PostBookingRepository
  private readonly documents: TripDocuments
  private readonly notifications: NotificationScheduler
  private readonly flightMonitor: FlightStatusMonitor
  private readonly cancellations: CancellationManager
  private readonly refunds: RefundStatusTracker
  private readonly events: TripEvents
  private readonly metrics: TripMetrics
  private readonly timeline: TripTimeline
  private readonly forceEnabled: boolean | undefined

  constructor(options: PostBookingServiceOptions = {}) {
    this.tripManager = options.tripManager ?? getTripManager()
    this.repository = options.repository ?? new PostBookingRepository()
    this.documents = options.documents ?? new TripDocuments()
    this.notifications = options.notifications ?? new NotificationScheduler()
    this.flightMonitor = options.flightMonitor ?? new FlightStatusMonitor()
    this.cancellations = options.cancellations ?? new CancellationManager(this.tripManager)
    this.refunds = options.refunds ?? new RefundStatusTracker()
    this.events = options.events ?? new TripEvents()
    this.metrics = options.metrics ?? new TripMetrics()
    this.timeline = options.timeline ?? new TripTimeline()
    this.forceEnabled = options.enabled

    if (options.onEvent) {
      this.events.on('*', options.onEvent)
    }
  }

  isEnabled(): boolean {
    if (typeof this.forceEnabled === 'boolean') return this.forceEnabled
    return isTripManagementEnabled()
  }

  /**
   * Auto-create My Trip after a successful Sprint 34 payment.
   */
  createFromPayment(
    payment: PaymentResult,
    extras?: {
      userId?: string
      destination?: string
      origin?: string | null
      hotelName?: string | null
      startDate?: string | null
      endDate?: string | null
      passengerName?: string
      travelers?: number
    },
  ): PostBookingTripRecord {
    this.assertEnabled()
    if (!payment.success || payment.session.state !== 'COMPLETED' || !payment.session.bookingRefs) {
      throw new TripManagementError(
        'INVALID_PAYMENT',
        'Payment must be COMPLETED with booking references',
      )
    }

    const existing = this.repository.getByPaymentSession(payment.session.sessionId)
    if (existing) return existing

    const refs = payment.session.bookingRefs
    return this.createMyTrip({
      userId: extras?.userId ?? payment.session.customerEmail ?? 'anonymous',
      conversationId: payment.session.intent.conversationId,
      destination: extras?.destination ?? 'Trip destination',
      origin: extras?.origin ?? null,
      hotelName: extras?.hotelName ?? null,
      startDate: extras?.startDate ?? null,
      endDate: extras?.endDate ?? null,
      currency: payment.session.pricing.currency,
      totalPaid: payment.session.pricing.total,
      travelers: extras?.travelers ?? 1,
      passengerName: extras?.passengerName ?? payment.session.customerName ?? 'Traveler',
      paymentReceiptId: payment.receipt?.receiptId ?? payment.session.receiptId,
      invoiceId: payment.invoice?.invoiceId ?? payment.session.invoiceId,
      references: {
        bookingReference: refs.bookingReference,
        tripReference: refs.tripReference,
        paymentReference: refs.paymentReference,
        flightConfirmation: refs.confirmationNumbers.flight,
        hotelConfirmation: refs.confirmationNumbers.hotel,
        executionSessionId: payment.session.intent.executionSessionId,
        paymentSessionId: payment.session.sessionId,
      },
    })
  }

  createMyTrip(input: CreatePostBookingTripInput): PostBookingTripRecord {
    this.assertEnabled()
    if (!input.destination) {
      throw new TripManagementError('VALIDATION', 'destination is required')
    }
    if (!input.references.bookingReference) {
      throw new TripManagementError('VALIDATION', 'bookingReference is required')
    }

    const managed = this.tripManager.createTrip({
      userId: input.userId,
      title: input.title ?? `${input.destination} trip`,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      currency: input.currency,
      estimatedTotal: input.totalPaid,
      paymentSessionId: input.references.paymentSessionId ?? undefined,
      status: 'upcoming',
      itinerarySnapshot: {
        title: input.title ?? `${input.destination} trip`,
        destinations: [input.destination],
        notes: `Booking ${input.references.bookingReference}`,
      },
    })

    const documents = this.documents.generateBundle(input, managed.id)
    const now = new Date().toISOString()

    let record: PostBookingTripRecord = {
      tripId: managed.id,
      userId: input.userId,
      conversationId: input.conversationId ?? null,
      references: { ...input.references },
      lifecycle: 'Upcoming',
      managedStatus: managed.status,
      destination: input.destination,
      hotelName: input.hotelName ?? null,
      origin: input.origin ?? null,
      documents,
      flightStatus: null,
      refundStatus: 'none',
      refundedAmount: 0,
      currency: input.currency,
      totalPaid: input.totalPaid,
      notifications: [],
      createdAt: now,
      updatedAt: now,
    }

    this.metrics.recordTripCreated()
    this.metrics.recordItineraryGenerated()
    this.metrics.recordDocumentsGenerated()
    this.emit('TripCreated', managed.id, {
      bookingReference: input.references.bookingReference,
    })
    this.emit('ItineraryGenerated', managed.id, {
      itineraryId: documents.itinerary.itineraryId,
    })
    this.emit('DocumentsGenerated', managed.id, {
      hasTicket: Boolean(documents.eTicket),
      hasVoucher: Boolean(documents.hotelVoucher),
    })

    // Booking confirmed + payment received notifications
    record = this.scheduleAndMaybeSend(record, 'booking_confirmed')
    record = this.scheduleAndMaybeSend(record, 'payment_received')
    record = this.scheduleAndMaybeSend(record, 'check_in_reminder', hoursFromNow(24))
    record = this.scheduleAndMaybeSend(record, 'hotel_check_in_reminder', hoursFromNow(36))
    record = this.scheduleAndMaybeSend(record, 'boarding_reminder', hoursFromNow(48))

    return this.repository.save(record)
  }

  getTrip(tripId: string): PostBookingTripRecord | null {
    return this.repository.get(tripId)
  }

  listUserTrips(userId: string): PostBookingTripRecord[] {
    return this.timeline.orderForDisplay(this.repository.listByUser(userId))
  }

  getActiveTrips(userId: string): PostBookingTripRecord[] {
    const partitioned = this.timeline.partitionPostBooking(this.repository.listByUser(userId))
    this.metrics.setActiveTrips(partitioned.Active.length)
    return this.timeline.orderForDisplay([...partitioned.Active, ...partitioned.Upcoming])
  }

  getTimelineBuckets(userId: string) {
    return this.timeline.partitionPostBooking(this.repository.listByUser(userId))
  }

  async refreshFlightStatus(tripId: string): Promise<PostBookingTripRecord> {
    this.assertEnabled()
    const record = this.require(tripId)
    const confirmation = record.references.flightConfirmation
    if (!confirmation) {
      throw new TripManagementError('VALIDATION', 'Trip has no flight confirmation')
    }

    const status = await this.flightMonitor.check({
      flightConfirmation: confirmation,
      origin: record.origin,
      destination: record.destination,
    })
    this.metrics.recordFlightStatusCheck()

    let next: PostBookingTripRecord = {
      ...record,
      flightStatus: status,
      updatedAt: new Date().toISOString(),
    }

    if (status.status === 'delayed') {
      next = this.scheduleAndMaybeSend(next, 'flight_delay')
    }
    if (status.status === 'gate_change') {
      next = this.scheduleAndMaybeSend(next, 'gate_change')
      if (next.documents.boardingPass) {
        next = {
          ...next,
          documents: {
            ...next.documents,
            boardingPass: {
              ...next.documents.boardingPass,
              gate: status.gate,
              generatedAt: new Date().toISOString(),
            },
          },
        }
      }
    }

    this.emit('FlightStatusUpdated', tripId, {
      status: status.status,
      delayMinutes: status.delayMinutes,
      gate: status.gate,
    })
    return this.repository.save(next)
  }

  markActive(tripId: string): PostBookingTripRecord {
    return this.setLifecycle(tripId, 'Active', 'active')
  }

  markCompleted(tripId: string): PostBookingTripRecord {
    let record = this.setLifecycle(tripId, 'Completed', 'completed')
    record = this.scheduleAndMaybeSend(record, 'trip_completed')
    this.metrics.setCompletedTrips(
      this.repository.listByUser(record.userId).filter((r) => r.lifecycle === 'Completed').length,
    )
    return this.repository.save(record)
  }

  cancelTrip(tripId: string, reason?: string): PostBookingTripRecord {
    this.assertEnabled()
    const current = this.require(tripId)
    const { record, result } = this.cancellations.cancelPostBooking(current, reason)
    try {
      this.cancellations.cancelManagedTrip(tripId, current.userId, reason)
    } catch {
      // Managed trip cancel is best-effort when TripManager lacks session wiring.
    }
    this.metrics.recordCancellation()
    this.emit('TripCancelled', tripId, { reason: result.reason })
    this.emit('TripLifecycleChanged', tripId, { lifecycle: 'Cancelled' })
    return this.repository.save(record)
  }

  updateRefundStatus(
    tripId: string,
    action: 'request' | 'processing' | 'partial' | 'completed' | 'failed',
    amount?: number,
  ): PostBookingTripRecord {
    this.assertEnabled()
    let record = this.require(tripId)
    switch (action) {
      case 'request':
        record = this.refunds.request(record)
        break
      case 'processing':
        record = this.refunds.markProcessing(record)
        break
      case 'partial':
        record = this.refunds.markPartial(record, amount ?? 0)
        break
      case 'completed':
        record = this.refunds.markCompleted(record, amount ?? record.totalPaid)
        break
      case 'failed':
        record = this.refunds.markFailed(record)
        break
    }
    this.metrics.recordRefundTracked()
    this.emit('RefundStatusUpdated', tripId, {
      status: record.refundStatus,
      refundedAmount: record.refundedAmount,
    })
    return this.repository.save(record)
  }

  getMetricsSnapshot() {
    return this.metrics.snapshot()
  }

  getEventBus() {
    return this.events
  }

  getNotificationScheduler() {
    return this.notifications
  }

  getTripManager() {
    return this.tripManager
  }

  private setLifecycle(
    tripId: string,
    lifecycle: TripLifecycleBucket,
    managedStatus: PostBookingTripRecord['managedStatus'],
  ): PostBookingTripRecord {
    this.assertEnabled()
    const record = this.require(tripId)
    const next: PostBookingTripRecord = {
      ...record,
      lifecycle,
      managedStatus,
      updatedAt: new Date().toISOString(),
    }
    this.emit('TripLifecycleChanged', tripId, { lifecycle })
    return this.repository.save(next)
  }

  private scheduleAndMaybeSend(
    record: PostBookingTripRecord,
    trigger: TripNotificationTrigger,
    scheduledFor?: string,
  ): PostBookingTripRecord {
    const scheduled = this.notifications.schedule({
      tripId: record.tripId,
      userId: record.userId,
      trigger,
      destination: record.destination,
      bookingReference: record.references.bookingReference,
      scheduledFor,
    })
    this.metrics.recordNotificationScheduled()
    this.emit('NotificationScheduled', record.tripId, {
      trigger,
      notificationId: scheduled.notificationId,
    })

    const notifications = [...record.notifications, scheduled]
    // Immediate triggers are dispatched now; reminders stay scheduled.
    const immediate: TripNotificationTrigger[] = [
      'booking_confirmed',
      'payment_received',
      'gate_change',
      'flight_delay',
      'trip_completed',
    ]
    if (immediate.includes(trigger)) {
      void this.notifications.dispatch(scheduled.notificationId, record.userId).then(() => {
        this.metrics.recordNotificationSent()
        this.emit('NotificationSent', record.tripId, {
          notificationId: scheduled.notificationId,
          trigger,
        })
      })
    }

    return {
      ...record,
      notifications,
      updatedAt: new Date().toISOString(),
    }
  }

  private require(tripId: string): PostBookingTripRecord {
    const record = this.repository.get(tripId)
    if (!record) {
      throw new TripManagementError('NOT_FOUND', `Trip ${tripId} not found`)
    }
    return record
  }

  private emit(
    type: Parameters<typeof createTripEvent>[0],
    tripId: string,
    data?: Record<string, unknown>,
  ): void {
    this.events.emit(createTripEvent(type, tripId, data))
  }

  private assertEnabled(): void {
    if (!this.isEnabled()) {
      throw new TripManagementError(
        'FEATURE_DISABLED',
        'Trip management is disabled (brain.trip_management)',
      )
    }
  }
}

export function createPostBookingService(
  options?: PostBookingServiceOptions,
): PostBookingService {
  return new PostBookingService(options)
}

let sharedPostBookingService: PostBookingService | null = null

export function getPostBookingService(): PostBookingService {
  if (!sharedPostBookingService) {
    sharedPostBookingService = new PostBookingService()
  }
  return sharedPostBookingService
}

export function resetPostBookingService(): void {
  sharedPostBookingService = null
}

function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600_000).toISOString()
}
