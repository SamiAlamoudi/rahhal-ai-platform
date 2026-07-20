/**
 * Rahhal Alpha — journey CTAs on assistant messages (book / pay / documents).
 * Surfaces Booking Execution + Payments meta without exposing internals.
 */

import { useMemo } from 'react'
import type { ChatMessage } from '../../lib/chat/chatTypes'
import { getDefaultPaymentsPlatformEngine } from '../../lib/agent/paymentsPlatform'
import type { AgentProviderMeta } from '../../lib/agent/types'

type Props = {
  message: ChatMessage
  busy?: boolean
  onCommand: (text: string) => void
}

function asAgentMeta(value: unknown): AgentProviderMeta | null {
  if (!value || typeof value !== 'object') return null
  const meta = value as AgentProviderMeta
  if (meta.kind !== 'travel_agent') return null
  return meta
}

export default function AlphaJourneyPanel({ message, busy, onCommand }: Props) {
  const meta = asAgentMeta(message.providerMeta)
  const payments = meta?.payments
  const execution = meta?.bookingExecution
  const intelligence = meta?.bookingIntelligence

  const documents = useMemo(() => {
    if (!payments?.paymentSessionId) return []
    try {
      return getDefaultPaymentsPlatformEngine().documents.list(payments.paymentSessionId)
    } catch {
      return []
    }
  }, [payments?.paymentSessionId])

  if (!meta || (!intelligence && !execution && !payments)) return null

  const bookingReady = Boolean(intelligence?.bookingReady)
  const canBook = bookingReady && !execution
  const canPay =
    Boolean(execution && (execution.status === 'confirmed' || execution.status === 'ticketed' || execution.confirmedCount > 0))
    && (!payments || payments.status === 'failed' || payments.status === 'pending')
  const paid = payments && (payments.status === 'captured' || payments.status === 'partially_captured' || payments.status === 'refunded')

  const paymentLabel = (status: string) => {
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
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-800/60">
      <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">متابعة الرحلة</p>
      <div className="flex flex-wrap gap-2 text-[11px] text-slate-600 dark:text-slate-300">
        {intelligence && (
          <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-900">
            {bookingReady ? 'جاهز للحجز' : 'يحتاج توضيحاً'}
          </span>
        )}
        {execution && (
          <span className="rounded-full bg-white px-2 py-1 dark:bg-slate-900">
            حجز مؤكد: {execution.confirmedCount}
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
            تذاكر ومستندات جاهزة
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {canBook && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCommand('أكد الحجز الآن')}
            className="rounded-full bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
          >
            أكّد الحجز
          </button>
        )}
        {canPay && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCommand('ادفع الآن ببطاقة مدى')}
            className="rounded-full bg-primary-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-primary-700 disabled:opacity-40"
          >
            ادفع الآن
          </button>
        )}
        {paid && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCommand('أعرض ملخص التأكيد والمستندات')}
            className="rounded-full border border-primary-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-primary-800 hover:bg-primary-50 disabled:opacity-40 dark:border-primary-800 dark:bg-slate-900 dark:text-primary-100"
          >
            ملخص التأكيد
          </button>
        )}
      </div>

      {documents.length > 0 && (
        <div className="space-y-1 border-t border-slate-200 pt-2 dark:border-slate-700">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">مستندات قابلة للتحميل</p>
          <ul className="space-y-1">
            {documents.map((doc) => (
              <li key={doc.id}>
                <a
                  href={doc.downloadUrl}
                  download={`${doc.kind}-${doc.id}.txt`}
                  className="text-[11px] font-medium text-primary-700 underline-offset-2 hover:underline dark:text-primary-300"
                >
                  {doc.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
