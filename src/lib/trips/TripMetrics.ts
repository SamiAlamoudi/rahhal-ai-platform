/**
 * Sprint 35 — Trip management metrics.
 */

export interface TripMetricsSnapshot {
  tripsCreated: number
  itinerariesGenerated: number
  documentsGenerated: number
  notificationsScheduled: number
  notificationsSent: number
  cancellations: number
  refundsTracked: number
  flightStatusChecks: number
  activeTrips: number
  completedTrips: number
}

export class TripMetrics {
  private tripsCreated = 0
  private itinerariesGenerated = 0
  private documentsGenerated = 0
  private notificationsScheduled = 0
  private notificationsSent = 0
  private cancellations = 0
  private refundsTracked = 0
  private flightStatusChecks = 0
  private activeTrips = 0
  private completedTrips = 0

  recordTripCreated(): void {
    this.tripsCreated += 1
  }

  recordItineraryGenerated(): void {
    this.itinerariesGenerated += 1
  }

  recordDocumentsGenerated(): void {
    this.documentsGenerated += 1
  }

  recordNotificationScheduled(): void {
    this.notificationsScheduled += 1
  }

  recordNotificationSent(): void {
    this.notificationsSent += 1
  }

  recordCancellation(): void {
    this.cancellations += 1
  }

  recordRefundTracked(): void {
    this.refundsTracked += 1
  }

  recordFlightStatusCheck(): void {
    this.flightStatusChecks += 1
  }

  setActiveTrips(count: number): void {
    this.activeTrips = Math.max(0, count)
  }

  setCompletedTrips(count: number): void {
    this.completedTrips = Math.max(0, count)
  }

  snapshot(): TripMetricsSnapshot {
    return {
      tripsCreated: this.tripsCreated,
      itinerariesGenerated: this.itinerariesGenerated,
      documentsGenerated: this.documentsGenerated,
      notificationsScheduled: this.notificationsScheduled,
      notificationsSent: this.notificationsSent,
      cancellations: this.cancellations,
      refundsTracked: this.refundsTracked,
      flightStatusChecks: this.flightStatusChecks,
      activeTrips: this.activeTrips,
      completedTrips: this.completedTrips,
    }
  }

  reset(): void {
    this.tripsCreated = 0
    this.itinerariesGenerated = 0
    this.documentsGenerated = 0
    this.notificationsScheduled = 0
    this.notificationsSent = 0
    this.cancellations = 0
    this.refundsTracked = 0
    this.flightStatusChecks = 0
    this.activeTrips = 0
    this.completedTrips = 0
  }
}
