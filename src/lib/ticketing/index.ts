export type {
  TicketSessionStatus,
  TicketLineKind,
  TicketLineStatus,
  TicketTraveler,
  FlightSegmentDetail,
  HotelRoomDetail,
  TicketLineItem,
  TicketAuditEvent,
  PaymentSummaryForTicket,
  QrCodeDataPayload,
  ConfirmationDocument,
  TicketSession,
} from './types'
export { TICKET_SESSION_STATUS_VALUES } from './types'

export type {
  TicketProviderAdapter,
  TicketProviderCapabilities,
  TicketIssueRequest,
  TicketIssueResult,
} from './ticketProviderAdapter'

export {
  TICKET_SESSION_TRANSITIONS,
  TicketSessionTransitionError,
  canTransitionTicketSession,
  assertCanTransitionTicketSession,
  resolveTicketSessionEvent,
  isTerminalTicketStatus,
  type TicketSessionEvent,
} from './ticketSessionStateMachine'

export { MockFlightTicketProvider } from './mockFlightTicketProvider'
export { MockHotelVoucherProvider } from './mockHotelVoucherProvider'
export { buildConfirmationDocument } from './confirmationDocuments'
export {
  assessTicketingEligibility,
  buildPaymentSummary,
  buildTravelersFromOrder,
  bookingItemsToTicketLines,
  type TicketingEligibilityInput,
  type TicketingEligibilityResult,
} from './bookingPaymentTicketingBridge'
export {
  TicketOrchestrator,
  getTicketOrchestrator,
  resetTicketOrchestrator,
  type TicketOrchestratorOptions,
  type StartTicketingInput,
  type IssueTicketsResult,
} from './ticketOrchestrator'
export { maskEmail, maskPassport, maskName, sanitizeAuditMetadata } from './privacy'
