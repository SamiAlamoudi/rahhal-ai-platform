/**
 * Booking confirmation timeline — supports future ticket issuance stages.
 */

import type { ConfirmationEvent, ConfirmationEventType, ConfirmationStatus } from './types'

const LABELS: Record<ConfirmationEventType, { en: string; ar: string }> = {
  booking_created: { en: 'Booking Created', ar: 'تم إنشاء الحجز' },
  waiting_for_supplier: { en: 'Waiting for Supplier', ar: 'بانتظار المزوّد' },
  confirming: { en: 'Confirming with Supplier', ar: 'جاري التأكيد مع المزوّد' },
  supplier_confirmed: { en: 'Supplier Confirmed', ar: 'أكّد المزوّد الحجز' },
  confirmation_failed: { en: 'Confirmation Failed', ar: 'فشل التأكيد' },
  ticket_pending: { en: 'Ticket Pending', ar: 'التذكرة قيد الإصدار' },
  completed: { en: 'Completed', ar: 'مكتمل' },
  cancelled: { en: 'Cancelled', ar: 'ملغي' },
}

function event(
  type: ConfirmationEventType,
  at: string,
  meta?: Record<string, unknown>,
): ConfirmationEvent {
  const labels = LABELS[type]
  return {
    id: `${type}-${at}`,
    type,
    at,
    labelEn: labels.en,
    labelAr: labels.ar,
    meta,
  }
}

export function buildConfirmationTimeline(input: {
  createdAt?: string | null
  status: ConfirmationStatus
  pendingAt?: string | null
  confirmingAt?: string | null
  confirmedAt?: string | null
  failedAt?: string | null
  cancelledAt?: string | null
  ticketPending?: boolean
}): ConfirmationEvent[] {
  const createdAt = input.createdAt
    ?? input.pendingAt
    ?? input.confirmingAt
    ?? input.confirmedAt
    ?? input.failedAt
    ?? input.cancelledAt
    ?? new Date().toISOString()
  const events: ConfirmationEvent[] = [event('booking_created', createdAt)]

  if (input.pendingAt || input.status === 'pending' || input.status === 'confirming' || input.status === 'confirmed') {
    events.push(event('waiting_for_supplier', input.pendingAt ?? createdAt))
  }
  if (input.confirmingAt || input.status === 'confirming') {
    events.push(event('confirming', input.confirmingAt ?? new Date().toISOString()))
  }
  if (input.status === 'confirmed' && input.confirmedAt) {
    events.push(event('supplier_confirmed', input.confirmedAt))
    if (input.ticketPending) {
      events.push(event('ticket_pending', input.confirmedAt))
    } else {
      events.push(event('completed', input.confirmedAt))
    }
  }
  if (input.status === 'failed' && input.failedAt) {
    events.push(event('confirmation_failed', input.failedAt))
  }
  if (input.status === 'cancelled' && input.cancelledAt) {
    events.push(event('cancelled', input.cancelledAt))
  }

  return events.sort((a, b) => a.at.localeCompare(b.at))
}

export function confirmationTimelineLabels(): typeof LABELS {
  return LABELS
}
