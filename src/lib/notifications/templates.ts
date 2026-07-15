/**
 * Deterministic notification templates for booking / payment / ticketing / trip events.
 */

import type { NotificationContent, NotificationEventType } from './types'

export interface TemplateContext {
  locale: 'ar' | 'en'
  userName?: string | null
  bookingReference?: string | null
  orderNumber?: string | null
  confirmationNumber?: string | null
  amount?: string | null
  currency?: string | null
  destination?: string | null
  tripTitle?: string | null
  extraNote?: string | null
}

export function renderNotificationContent(
  eventType: NotificationEventType,
  ctx: TemplateContext,
): NotificationContent {
  const name = ctx.userName?.trim() || (ctx.locale === 'ar' ? 'مسافرنا' : 'Traveler')
  const vars: Record<string, string> = {
    userName: name,
    bookingReference: ctx.bookingReference ?? '',
    orderNumber: ctx.orderNumber ?? '',
    confirmationNumber: ctx.confirmationNumber ?? '',
    amount: ctx.amount ?? '',
    currency: ctx.currency ?? '',
    destination: ctx.destination ?? '',
    tripTitle: ctx.tripTitle ?? '',
    extraNote: ctx.extraNote ?? '',
  }

  const copy = TEMPLATE_COPY[eventType][ctx.locale]
  const subject = fill(copy.subject, vars)
  const bodyText = fill(copy.body, vars)
  return {
    subject,
    bodyText,
    bodyHtml: `<p>${bodyText.replace(/\n/g, '<br/>')}</p>`,
    templateId: `tpl_${eventType}_v1`,
    variables: vars,
  }
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '')
}

const TEMPLATE_COPY: Record<
  NotificationEventType,
  Record<'ar' | 'en', { subject: string; body: string }>
> = {
  booking_confirmed: {
    en: {
      subject: 'Booking confirmed — {{bookingReference}}',
      body: 'Hi {{userName}}, your booking {{bookingReference}} is confirmed. Order {{orderNumber}}.',
    },
    ar: {
      subject: 'تم تأكيد الحجز — {{bookingReference}}',
      body: 'مرحباً {{userName}}، تم تأكيد حجزك {{bookingReference}}. رقم الطلب {{orderNumber}}.',
    },
  },
  booking_cancelled: {
    en: {
      subject: 'Booking cancelled — {{bookingReference}}',
      body: 'Hi {{userName}}, booking {{bookingReference}} was cancelled. {{extraNote}}',
    },
    ar: {
      subject: 'تم إلغاء الحجز — {{bookingReference}}',
      body: 'مرحباً {{userName}}، تم إلغاء الحجز {{bookingReference}}. {{extraNote}}',
    },
  },
  payment_captured: {
    en: {
      subject: 'Payment received — {{orderNumber}}',
      body: 'Hi {{userName}}, we received {{amount}} {{currency}} for order {{orderNumber}}.',
    },
    ar: {
      subject: 'تم استلام الدفع — {{orderNumber}}',
      body: 'مرحباً {{userName}}، استلمنا {{amount}} {{currency}} للطلب {{orderNumber}}.',
    },
  },
  payment_failed: {
    en: {
      subject: 'Payment failed — {{orderNumber}}',
      body: 'Hi {{userName}}, payment for order {{orderNumber}} failed. Please retry checkout.',
    },
    ar: {
      subject: 'فشل الدفع — {{orderNumber}}',
      body: 'مرحباً {{userName}}، فشل دفع الطلب {{orderNumber}}. يرجى إعادة المحاولة.',
    },
  },
  ticket_issued: {
    en: {
      subject: 'Tickets issued — {{confirmationNumber}}',
      body: 'Hi {{userName}}, your tickets are ready. Confirmation {{confirmationNumber}} for order {{orderNumber}}.',
    },
    ar: {
      subject: 'تم إصدار التذاكر — {{confirmationNumber}}',
      body: 'مرحباً {{userName}}، تذاكرك جاهزة. رقم التأكيد {{confirmationNumber}} للطلب {{orderNumber}}.',
    },
  },
  ticket_partial: {
    en: {
      subject: 'Partial ticket issuance — {{orderNumber}}',
      body: 'Hi {{userName}}, some tickets for order {{orderNumber}} failed. We will retry the remaining items. {{extraNote}}',
    },
    ar: {
      subject: 'إصدار جزئي للتذاكر — {{orderNumber}}',
      body: 'مرحباً {{userName}}، فشل إصدار بعض تذاكر الطلب {{orderNumber}}. سنعيد المحاولة. {{extraNote}}',
    },
  },
  ticket_failed: {
    en: {
      subject: 'Ticket issuance failed — {{orderNumber}}',
      body: 'Hi {{userName}}, we could not issue tickets for order {{orderNumber}}. Support will follow up.',
    },
    ar: {
      subject: 'فشل إصدار التذاكر — {{orderNumber}}',
      body: 'مرحباً {{userName}}، تعذّر إصدار تذاكر الطلب {{orderNumber}}. سيتواصل الدعم معك.',
    },
  },
  trip_reminder: {
    en: {
      subject: 'Trip reminder — {{destination}}',
      body: 'Hi {{userName}}, your trip to {{destination}} ({{tripTitle}}) is coming up. {{extraNote}}',
    },
    ar: {
      subject: 'تذكير بالرحلة — {{destination}}',
      body: 'مرحباً {{userName}}، رحلتك إلى {{destination}} ({{tripTitle}}) اقتربت. {{extraNote}}',
    },
  },
  trip_updated: {
    en: {
      subject: 'Trip plan updated — {{tripTitle}}',
      body: 'Hi {{userName}}, your trip plan {{tripTitle}} was updated. {{extraNote}}',
    },
    ar: {
      subject: 'تم تحديث خطة الرحلة — {{tripTitle}}',
      body: 'مرحباً {{userName}}، تم تحديث خطة رحلتك {{tripTitle}}. {{extraNote}}',
    },
  },
  generic: {
    en: {
      subject: 'Rahhal update',
      body: 'Hi {{userName}}, {{extraNote}}',
    },
    ar: {
      subject: 'تحديث من رحّال',
      body: 'مرحباً {{userName}}، {{extraNote}}',
    },
  },
}
