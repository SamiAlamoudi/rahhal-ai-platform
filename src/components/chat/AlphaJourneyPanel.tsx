/**
 * Bilamo Alpha — journey CTAs on assistant messages (book / pay / documents).
 * Surfaces Booking Execution + Payments meta without exposing internals.
 * Sprint 103 — also links Booking Assistant → review when ready (integration only).
 */

import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import { getDefaultPaymentsPlatformEngine } from '../../lib/agent/paymentsPlatform'
import type { AgentProviderMeta } from '../../lib/agent/types'
import {
  resolveAlphaNextStep,
} from '../../lib/alphaIntegration'
import { isBookingExecutionConfirmationEnabled } from '../../lib/bookingExecutionConfirmation'
import { getFeatureRegistry } from '../../lib/ai'

type Props = {
  message: ChatMessage
  busy?: boolean
  locale?: 'ar' | 'en'
  onCommand: (text: string) => void
}

function asAgentMeta(value: unknown): AgentProviderMeta | null {
  if (!value || typeof value !== 'object') return null
  const meta = value as AgentProviderMeta
  if (meta.kind !== 'travel_agent') return null
  return meta
}

const KIND_LABELS: Record<'ar' | 'en', Record<string, string>> = {
  ar: {
    flight: 'تذكرة الطيران',
    eticket: 'تذكرة الطيران',
    hotel_voucher: 'قسيمة الفندق',
    voucher: 'قسيمة الحجز',
    activity_voucher: 'قسيمة النشاط',
    car_rental: 'تأكيد السيارة',
    insurance_certificate: 'شهادة التأمين',
    invoice: 'الفاتورة',
    receipt: 'إيصال الدفع',
    itinerary: 'مسار الرحلة',
    confirmation: 'تأكيد الحجز',
    confirmation_pdf: 'تأكيد الحجز',
    pnr: 'مرجع الحجز (PNR)',
    refund: 'مستند الاسترداد',
  },
  en: {
    flight: 'Flight ticket',
    eticket: 'Flight ticket',
    hotel_voucher: 'Hotel voucher',
    voucher: 'Booking voucher',
    activity_voucher: 'Activity voucher',
    car_rental: 'Car rental confirmation',
    insurance_certificate: 'Insurance certificate',
    invoice: 'Invoice',
    receipt: 'Payment receipt',
    itinerary: 'Itinerary',
    confirmation: 'Booking confirmation',
    confirmation_pdf: 'Booking confirmation',
    pnr: 'Booking reference (PNR)',
    refund: 'Refund document',
  },
}

/** Hide simulated provider IDs / internal tokens from traveler-facing labels. */
function friendlyDocumentLabel(label: string, kind: string, locale: 'ar' | 'en'): string {
  const labels = KIND_LABELS[locale]
  const kindLabel = labels[kind] || labels[label.trim().toLowerCase()]
  const cleaned = label
    .replace(/\bsim[-_]?book[-_]?\S*/gi, '')
    .replace(/\bsim[-_]?\S*/gi, '')
    .replace(/\bgrid[-_]?\S*/gi, '')
    .replace(/\bharbor[-_]?\S*/gi, '')
    .replace(/\bshield[-_]?\S*/gi, '')
    .replace(/\bflights?-\d+/gi, '')
    .replace(/\bhotels?-\d+/gi, '')
    .replace(/\binsurance-\d+/gi, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-—:|]+|[\s\-—:|]+$/g, '')
    .trim()
  if (kindLabel && (!cleaned || cleaned.length < 4 || /^[a-z_]+$/i.test(cleaned) || /voucher|certificate|invoice|receipt|pnr|flight|hotel|confirmation/i.test(cleaned))) {
    if (/invoice/i.test(kind) || /invoice/i.test(label)) {
      const amount = label.match(/(\d+(?:[.,]\d+)?)\s*([A-Z]{3})/)
      if (amount) return `${kindLabel} · ${amount[1]} ${amount[2]}`
    }
    return kindLabel
  }
  if (cleaned.length >= 3) return cleaned
  return kindLabel || (locale === 'en' ? 'Travel document' : 'مستند الرحلة')
}

export default function AlphaJourneyPanel({ message, busy, locale = 'ar', onCommand }: Props) {
  const navigate = useNavigate()
  const meta = asAgentMeta(message.providerMeta)
  const payments = meta?.payments
  const execution = meta?.bookingExecution
  const intelligence = meta?.bookingIntelligence
  const en = locale === 'en'

  const documents = useMemo(() => {
    if (!payments?.paymentSessionId) return []
    try {
      return getDefaultPaymentsPlatformEngine().documents.list(payments.paymentSessionId)
    } catch {
      return []
    }
  }, [payments?.paymentSessionId])

  const nextStep = useMemo(() => {
    if (!meta) return null
    return resolveAlphaNextStep({
      meta,
      bookingExecutionEnabled: isBookingExecutionConfirmationEnabled(),
      myTripsEnabled: getFeatureRegistry().isEnabled('ui.my_trips')
        || getFeatureRegistry().isEnabled('ai.my_trips_dashboard'),
      locale,
    })
  }, [meta, locale])

  if (!meta || (!intelligence && !execution && !payments && !meta.bookingAssistant && !meta.alphaTravelerExperience)) {
    return null
  }

  const bookingReady = Boolean(intelligence?.bookingReady || meta.bookingAssistant?.readyToBook)
  const canBook = bookingReady && !execution && !nextStep
  const canPay =
    Boolean(execution && (execution.status === 'confirmed' || execution.status === 'ticketed' || execution.confirmedCount > 0))
    && (!payments || payments.status === 'failed' || payments.status === 'pending')
  const paid = payments && (payments.status === 'captured' || payments.status === 'partially_captured' || payments.status === 'refunded')

  const paymentLabel = (status: string) => {
    if (en) {
      switch (status) {
        case 'captured':
        case 'partially_captured':
          return 'Paid'
        case 'pending':
          return 'Payment pending'
        case 'failed':
          return 'Payment failed'
        case 'refunded':
          return 'Refunded'
        default:
          return 'Payment'
      }
    }
    switch (status) {
      case 'captured':
      case 'partially_captured':
        return 'تم الدفع'
      case 'pending':
        return 'بانتظار الدفع'
      case 'failed':
        return 'تعذّر الدفع'
      case 'refunded':
        return 'تم الاسترداد'
      default:
        return 'الدفع'
    }
  }

  return (
    <div
      className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/60"
      data-testid="alpha-journey-panel"
    >
      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
        {en ? 'Continue your trip' : 'متابعة الرحلة'}
      </p>
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        {intelligence && (
          <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-900">
            {bookingReady
              ? (en ? 'Ready to book' : 'جاهز للحجز')
              : (intelligence.clarification?.trim()
                || (en ? 'Needs a bit more detail' : 'يحتاج توضيحاً'))}
          </span>
        )}
        {execution && execution.confirmedCount > 0 && (
          <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-900">
            {en ? `Booked: ${execution.confirmedCount}` : `حجز مؤكد: ${execution.confirmedCount}`}
          </span>
        )}
        {payments && (
          <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-900">
            {paymentLabel(payments.status)}
            {payments.amount > 0 ? ` · ${payments.amount} ${payments.currency}` : ''}
          </span>
        )}
        {paid && (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-100">
            {en ? 'Tickets & documents ready' : 'تذاكر ومستندات جاهزة'}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {nextStep && (
          <button
            type="button"
            disabled={busy}
            data-testid="alpha-journey-next-step"
            onClick={() => navigate(nextStep.path, { state: nextStep.state })}
            className="rounded-full bg-teal-800 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-teal-900 disabled:opacity-40"
          >
            {nextStep.label}
          </button>
        )}
        {canBook && (
          <button
            type="button"
            disabled={busy}
            data-testid="alpha-confirm-booking"
            onClick={() => onCommand(en ? 'Confirm booking now' : 'أكد الحجز الآن')}
            className="rounded-full bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
          >
            {en ? 'Confirm booking' : 'أكّد الحجز'}
          </button>
        )}
        {canPay && (
          <button
            type="button"
            disabled={busy}
            data-testid="alpha-pay-now"
            onClick={() => onCommand(en ? 'Pay now' : 'ادفع الآن')}
            className="rounded-full bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
          >
            {en ? 'Pay now' : 'ادفع الآن'}
          </button>
        )}
        {paid && (
          <button
            type="button"
            disabled={busy}
            data-testid="alpha-confirmation-summary"
            onClick={() => onCommand(en ? 'Show confirmation summary and documents' : 'أعرض ملخص التأكيد والمستندات')}
            className="rounded-full border border-primary-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-primary-800 hover:bg-primary-50 disabled:opacity-40 dark:border-primary-800 dark:bg-slate-900 dark:text-primary-100"
          >
            {en ? 'Confirmation summary' : 'ملخص التأكيد'}
          </button>
        )}
      </div>

      {documents.length > 0 && (
        <div className="space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            {en ? 'Downloadable documents' : 'مستندات قابلة للتحميل'}
          </p>
          <ul className="space-y-1">
            {documents.map((doc) => {
              const label = friendlyDocumentLabel(doc.label, doc.kind, locale)
              return (
                <li key={doc.id}>
                  <a
                    href={doc.downloadUrl}
                    download={`${doc.kind}-${doc.id}.txt`}
                    className="text-[11px] font-medium text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
                  >
                    {label}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
