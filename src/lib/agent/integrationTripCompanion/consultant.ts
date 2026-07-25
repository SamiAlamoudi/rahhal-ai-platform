/**
 * Integration Sprint 7 — natural companion summaries (not raw JSON dumps).
 */

import type { TripCompanionResult } from './types'
import { answerCompanionAssistant } from './assistant'

export function buildTripCompanionSummary(
  result: Pick<
    TripCompanionResult,
    | 'session'
    | 'timeline'
    | 'notifications'
    | 'disruptions'
    | 'replanned'
    | 'context'
    | 'location'
    | 'emergency'
    | 'assistantIntent'
  >,
): { ar: string; en: string } {
  if (result.emergency) {
    const e = result.emergency
    return {
      en: `${e.titleEn}: ${e.stepsEn.slice(0, 2).join(' ')} Live emergency lookup is not connected yet.`,
      ar: `${e.titleAr}: ${e.stepsAr.slice(0, 2).join(' ')} البحث المباشر للطوارئ غير متصل بعد.`,
    }
  }

  const answered = answerCompanionAssistant({
    intent: result.assistantIntent === 'unknown' ? 'status' : result.assistantIntent,
    session: result.session,
    timeline: result.timeline,
    context: result.context,
    location: result.location,
    locale: 'en',
  })

  const disruption = result.disruptions[0]
  const notif = result.notifications[0]
  const enParts = [
    answered.en,
    disruption
      ? (result.replanned
        ? `I rebuilt your timeline after: ${disruption.detailEn}`
        : disruption.detailEn)
      : null,
    notif ? `Reminder queued: ${notif.titleEn}.` : null,
  ].filter(Boolean)

  const arParts = [
    answered.ar,
    disruption
      ? (result.replanned
        ? `أعدّت الجدول بعد: ${disruption.detailAr}`
        : disruption.detailAr)
      : null,
    notif ? `تذكير جاهز: ${notif.titleAr}.` : null,
  ].filter(Boolean)

  return { en: enParts.join(' '), ar: arParts.join(' ') }
}
