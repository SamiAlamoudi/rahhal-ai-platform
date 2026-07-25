/**
 * Integration Sprint 12 — journey consultant summaries.
 */

import type { JourneyResult } from './types'

export function buildJourneySummary(
  result: Pick<JourneyResult, 'stage' | 'scenario' | 'decision' | 'handoff' | 'stages'>,
): { en: string; ar: string } {
  const active = result.stages.find((s) => s.status === 'active')
  const skipped = result.stages.filter((s) => s.status === 'skipped').length
  const known = result.handoff.knownSlots.slice(0, 6).join(', ') || 'getting started'
  const avoided = result.handoff.knownSlots.length
    ? `I already know: ${known} — won’t re-ask.`
    : 'Collecting trip context.'

  const en = [
    `Journey stage: ${result.stage} (${result.scenario}).`,
    `Shared decision ${result.decision.overall}/100 — ${result.decision.rationaleEn}`,
    avoided,
    active ? `Focus: ${active.moduleId}.` : null,
    skipped > 0 ? `${skipped} modules skipped (flags OFF) but handoff is ready.` : null,
  ].filter(Boolean).join(' ')

  const ar = [
    `مرحلة الرحلة: ${result.stage} (${result.scenario}).`,
    `قرار مشترك ${result.decision.overall}/100 — ${result.decision.rationaleAr}`,
    result.handoff.knownSlots.length
      ? `أعرف مسبقاً: ${known} — لن أعيد السؤال.`
      : 'أجمع سياق الرحلة.',
    active ? `التركيز: ${active.moduleId}.` : null,
    skipped > 0 ? `${skipped} وحدات متخطاة (أعلام OFF) لكن التسليم جاهز.` : null,
  ].filter(Boolean).join(' ')

  return { en, ar }
}
