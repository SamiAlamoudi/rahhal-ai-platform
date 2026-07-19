/**
 * Sprint 15 — Order Management Engine + Payment Preparation.
 *
 * Orders are created from confirmed BookingSessions.
 * PaymentSessions reference Orders. BookingSession remains SoT.
 */

export type {
  ManagedOrder,
  ManagedOrderStatus,
  ManagedPaymentStatus,
  OrderTimelineEvent,
  OrderTimelineEventType,
  OrderFareBreakdown,
  OrderItinerarySummary,
  CreateOrderFromBookingInput,
  CreateOrderFromBookingResult,
} from './types'
export {
  toManagedOrderStatus,
  toManagedPaymentStatus,
  managedStatusToOrderStatus,
  mapOrderStatus,
  mapPaymentStatus,
  MANAGED_ORDER_STATUS_LABELS,
  MANAGED_PAYMENT_STATUS_LABELS,
  orderCheckoutPath,
} from './types'

export {
  createOrderFromBooking,
  toManagedOrder,
  findOrderByBookingSessionId,
  findManagedOrderBySessionId,
  listManagedOrdersForUser,
  listManagedOrdersForCustomer,
  getManagedOrder,
  persistManagedOrderLink,
  clearBookingOrderIndex,
} from './orderFromBooking'

export {
  buildOrderTimeline,
  orderTimelineLabels,
  activeOrderTimelineType,
} from './orderTimeline'

export {
  createPaymentSession,
  createPaymentSessionForOrder,
  resumePaymentSession,
  expirePaymentSession,
  retryPaymentSession,
  markMockPaymentPaid,
  getActivePaymentSessionForOrder,
  getPaymentSessionById,
  paymentStatusForOrder,
  clearPaymentSessionStore,
  DuplicatePaymentAttemptError,
} from './paymentSessionManager'
export type {
  CreatePaymentSessionInput,
  PaymentSessionResult,
  CreatePaymentSessionResult,
} from './paymentSessionManager'

export type {
  PaymentGatewayAdapter,
  PaymentGatewayId,
  PaymentPrepareRequest,
  PaymentPrepareResult,
  PaymentGatewayCapabilities,
} from './paymentGateways/types'
/** Docs / barrel aliases for gateway port naming. */
export type {
  PaymentGatewayAdapter as PaymentGatewayPort,
  PaymentPrepareRequest as CreateGatewaySessionInput,
  PaymentPrepareResult as GatewaySessionResult,
} from './paymentGateways/types'
export {
  getPaymentGateway,
  listPaymentGateways,
  registerPaymentGateway,
  resetPaymentGatewayRegistry,
} from './paymentGateways'
export { MockPaymentGatewayAdapter, createMockPaymentGateway } from './paymentGateways/mockGateway'
/** Alias for MockPaymentGatewayAdapter. */
export { MockPaymentGatewayAdapter as MockPaymentGateway } from './paymentGateways/mockGateway'

export const MOCK_PAYMENT_GATEWAY_ID = 'mock' as const

export {
  answerHowMuchWillIPay,
  answerIsOrderReady,
  answerShowCheckout,
  answerPaymentStatus,
  buildOrderConciergeReply,
} from './orderConcierge'
export type { OrderConciergeIntent } from './orderConcierge'

export { buildCheckoutReviewModel } from './checkoutReview'
export type { CheckoutReviewModel } from './checkoutReview'
