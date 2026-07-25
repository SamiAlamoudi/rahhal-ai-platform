/**
 * Phase 3 Stage 3 — Detect proactive opportunity signals from context.
 * Heuristics only. Never invents destination/visa facts without cues.
 */

import { getSignalDefinition } from './proactiveSignals'
import type { ProactiveContextBag, ProactiveDetectedSignal, ProactiveEvidence } from './types'
import { clamp01 } from './types'

function evidence(
  kind: string,
  detail: string,
  source: ProactiveEvidence['source'],
): ProactiveEvidence {
  return { kind, detail, source }
}

export function detectProactiveSignals(
  context: ProactiveContextBag,
): ProactiveDetectedSignal[] {
  const out: ProactiveDetectedSignal[] = []
  const lower = context.userText.toLowerCase()

  if (context.hasDestinationSignal && context.destination) {
    out.push({
      signal: 'visa_reminder',
      reason: 'Destination mentioned — visa requirements may apply depending on nationality.',
      supportingEvidence: [
        evidence('destination', context.destination, 'destination'),
        evidence('user_cue', 'destination_present', 'user_text'),
      ],
      missingEvidence: getSignalDefinition('visa_reminder').commonMissing,
      baseConfidence: 0.55,
    })

    out.push({
      signal: 'currency_reminder',
      reason: 'International destination — local currency and card readiness are worth a quick check.',
      supportingEvidence: [
        evidence('destination', context.destination, 'destination'),
      ],
      missingEvidence: getSignalDefinition('currency_reminder').commonMissing,
      baseConfidence: 0.5,
    })

    out.push({
      signal: 'esim_suggestion',
      reason: 'Traveling abroad — connectivity (eSIM/SIM) often helps on arrival.',
      supportingEvidence: [
        evidence('destination', context.destination, 'destination'),
      ],
      missingEvidence: getSignalDefinition('esim_suggestion').commonMissing,
      baseConfidence: 0.45,
    })

    out.push({
      signal: 'timezone_warning',
      reason: 'Cross-border trip — timezone differences can affect flights and meetings.',
      supportingEvidence: [
        evidence('destination', context.destination, 'destination'),
      ],
      missingEvidence: getSignalDefinition('timezone_warning').commonMissing,
      baseConfidence: context.origin ? 0.55 : 0.4,
    })

    out.push({
      signal: 'travel_insurance_reminder',
      reason: 'Trip planning in progress — travel insurance is a common protective step.',
      supportingEvidence: [
        evidence('destination', context.destination, 'destination'),
      ],
      missingEvidence: getSignalDefinition('travel_insurance_reminder').commonMissing,
      baseConfidence: 0.48,
    })

    out.push({
      signal: 'airport_recommendation',
      reason: 'Destination set — confirming preferred airport/hub avoids transfer surprises.',
      supportingEvidence: [
        evidence('destination', context.destination, 'destination'),
      ],
      missingEvidence: getSignalDefinition('airport_recommendation').commonMissing,
      baseConfidence: 0.42,
    })
  }

  if (context.hasDatesSignal) {
    out.push({
      signal: 'weather_notice',
      reason: 'Travel timing mentioned — weather expectations can shape packing and activities.',
      supportingEvidence: [
        context.monthHint != null
          ? evidence('month', String(context.monthHint), 'user_text')
          : evidence('duration', String(context.durationDays ?? 'dates_cue'), 'user_text'),
      ],
      missingEvidence: getSignalDefinition('weather_notice').commonMissing.filter(
        (m) => !(m === 'travel_dates' && context.durationDays != null),
      ),
      baseConfidence: context.destination ? 0.62 : 0.45,
    })

    out.push({
      signal: 'season_advice',
      reason: 'Dates/season cues present — peak vs shoulder season can change comfort and cost.',
      supportingEvidence: [
        context.monthHint != null
          ? evidence('month', String(context.monthHint), 'user_text')
          : evidence('dates_cue', 'present', 'user_text'),
      ],
      missingEvidence: getSignalDefinition('season_advice').commonMissing,
      baseConfidence: context.monthHint != null ? 0.6 : 0.4,
    })

    out.push({
      signal: 'packing_suggestion',
      reason: 'Trip timing known enough to suggest packing themes (not a packing list of invented items).',
      supportingEvidence: [
        evidence('dates_cue', 'present', 'user_text'),
      ],
      missingEvidence: getSignalDefinition('packing_suggestion').commonMissing,
      baseConfidence: 0.4,
    })

    out.push({
      signal: 'hotel_checkin_reminder',
      reason: 'Dates in play — early check-in / late arrival policies are useful to confirm later.',
      supportingEvidence: [
        evidence('dates_cue', 'present', 'user_text'),
      ],
      missingEvidence: getSignalDefinition('hotel_checkin_reminder').commonMissing,
      baseConfidence: 0.38,
    })

    out.push({
      signal: 'alternative_timing',
      reason: 'With dates mentioned, a nearby window might improve weather or price — only if flexible.',
      supportingEvidence: [
        evidence('dates_cue', 'present', 'user_text'),
      ],
      missingEvidence: getSignalDefinition('alternative_timing').commonMissing,
      baseConfidence: 0.36,
    })
  }

  if (context.hasBudgetSignal) {
    out.push({
      signal: 'budget_optimization',
      reason: 'Budget mentioned — there may be saving opportunities without changing the destination.',
      supportingEvidence: [
        context.budgetAmount != null
          ? evidence('budget', String(context.budgetAmount), 'memory')
          : evidence('budget_cue', 'present', 'user_text'),
      ],
      missingEvidence: getSignalDefinition('budget_optimization').commonMissing,
      baseConfidence: context.budgetAmount != null ? 0.58 : 0.44,
    })
  }

  if (context.hasFamilySignal) {
    out.push({
      signal: 'family_travel',
      reason: 'Family travel cues — family-friendly hotels and transportation are often helpful.',
      supportingEvidence: [
        evidence('family_cue', 'present', 'traveler'),
      ],
      missingEvidence: getSignalDefinition('family_travel').commonMissing,
      baseConfidence: 0.64,
    })
    out.push({
      signal: 'transportation_reminder',
      reason: 'Family party — transfers and seat space are worth planning early.',
      supportingEvidence: [
        evidence('family_cue', 'present', 'traveler'),
      ],
      missingEvidence: getSignalDefinition('transportation_reminder').commonMissing,
      baseConfidence: 0.55,
    })
  }

  if (context.hasBusinessSignal) {
    out.push({
      signal: 'executive_travel',
      reason: 'Business travel cues — lounge access, protocol, and reliable transfers often matter.',
      supportingEvidence: [
        evidence('business_cue', 'present', 'traveler'),
      ],
      missingEvidence: getSignalDefinition('executive_travel').commonMissing,
      baseConfidence: 0.66,
    })
    out.push({
      signal: 'meeting_logistics',
      reason: 'Work trip cues — buffer time for meetings and airport transfers reduces risk.',
      supportingEvidence: [
        evidence('business_cue', 'present', 'traveler'),
      ],
      missingEvidence: getSignalDefinition('meeting_logistics').commonMissing,
      baseConfidence: 0.6,
    })
  }

  if (context.hasAccessibilitySignal) {
    out.push({
      signal: 'accessibility',
      reason: 'Accessibility needs mentioned — hotels, transfers, and airports should be verified.',
      supportingEvidence: [
        evidence('accessibility_cue', 'present', 'user_text'),
      ],
      missingEvidence: getSignalDefinition('accessibility').commonMissing,
      baseConfidence: 0.7,
    })
  }

  if (
    /\b(passport|expiry|expires)\b/i.test(lower)
    || /جواز|انتهاء/.test(context.userText)
  ) {
    out.push({
      signal: 'passport_expiry_reminder',
      reason: 'Passport mentioned — many destinations require 6+ months validity.',
      supportingEvidence: [
        evidence('passport_cue', 'present', 'user_text'),
      ],
      missingEvidence: getSignalDefinition('passport_expiry_reminder').commonMissing,
      baseConfidence: 0.72,
    })
  }

  // Deduplicate by signal, keep highest baseConfidence
  const bySignal = new Map<string, ProactiveDetectedSignal>()
  for (const row of out) {
    const prev = bySignal.get(row.signal)
    if (!prev || row.baseConfidence > prev.baseConfidence) {
      bySignal.set(row.signal, {
        ...row,
        baseConfidence: clamp01(row.baseConfidence),
      })
    }
  }
  return [...bySignal.values()]
}

export const ProactiveDetector = {
  detect: detectProactiveSignals,
}
