/**
 * Evolution Sprint 1 — TravelerIntentAnalyzer
 * Classify consultant intent from user text + known slots (deterministic, no API).
 */

import {
  clamp01,
  clampScore,
  emptySlice,
  type ConsultantReasoningInput,
  type TravelerIntentKind,
  type TravelerIntentResult,
  type TripPurposeHint,
} from './consultantTypes'

const PURPOSE_PATTERNS: Array<{ purpose: TripPurposeHint; re: RegExp }> = [
  { purpose: 'honeymoon', re: /honeymoon|شهر\s*عسل|زفاف|زواج/i },
  { purpose: 'family', re: /\bfamily\b|أطفال|عائلة|kids|children/i },
  { purpose: 'business', re: /\bbusiness\b|عمل|مؤتمر|meeting/i },
  { purpose: 'adventure', re: /adventure|مغامرة|hiking|trek|safari/i },
  { purpose: 'recovery', re: /relax|استجمام|راحة|spa|wellness|recovery/i },
  { purpose: 'cultural', re: /museum|ثقافة|تاريخ|heritage|cultural/i },
  { purpose: 'leisure', re: /vacation|holiday|إجازة|سياحة|trip|سفر/i },
]

function detectPurpose(text: string): TripPurposeHint {
  for (const row of PURPOSE_PATTERNS) {
    if (row.re.test(text)) return row.purpose
  }
  return 'unknown'
}

function detectIntent(text: string, knownDest: string | null | undefined): TravelerIntentKind {
  const t = text.trim()
  if (!t) return 'unclear'
  if (/أكد|احجز|ادفع|book\b|confirm|pay\b|checkout/i.test(t)) return 'book_ready'
  if (/compare|versus|vs\.?|أيهما|قارن|أفضل من/i.test(t)) return 'compare'
  // Discovery / recommendation language wins over a bare budget mention.
  if (
    /where\s+should|suggest|recommend|ideas?|أين|اقترح|وش تنصح|وين أروح|destination/i.test(t)
    || (!knownDest && /travel|trip|سفر|رحلة|holiday|vacation/i.test(t) && /ideas?|suggest|تنصح|اقترح/i.test(t))
  ) {
    return 'discover'
  }
  if (/budget|ميزانية|كم يكلف|afford|رخيص|غالي/i.test(t)) return 'budget'
  if (/instead|change|بدل|غير|refine|تعديل|أضف/i.test(t)) return 'refine'
  if (/hello|hi\b|مرحبا|السلام|thanks|شكرا/i.test(t) && t.length < 40) return 'small_talk'
  if (!knownDest && /travel|trip|سفر|رحلة|holiday|vacation/i.test(t)) return 'discover'
  if (knownDest || /plan|itinerary|جدول|خطة|أيام/i.test(t)) return 'plan'
  if (t.length < 12) return 'unclear'
  return 'plan'
}

function urgencyFromText(text: string): TravelerIntentResult['urgency'] {
  if (/urgent|asap|tomorrow|بكرة|عاجل|هذا الأسبوع/i.test(text)) return 'high'
  if (/soon|قريب|next month|الشهر الجاي/i.test(text)) return 'medium'
  return 'low'
}

export function analyzeTravelerIntent(input: ConsultantReasoningInput): TravelerIntentResult {
  const text = input.userText ?? ''
  const knownDest = input.known?.destination ?? null
  const intent = detectIntent(text, knownDest)
  const purposeHint = detectPurpose(text)
  const urgency = urgencyFromText(text)

  const missingInformation: string[] = []
  if (intent === 'unclear') missingInformation.push('clear_travel_goal')
  if (
    (intent === 'discover' || intent === 'plan')
    && purposeHint === 'unknown'
    && !/\b(family|honeymoon|business|adventure)\b|عائلة|عسل|عمل|مغامرة/i.test(text)
  ) {
    missingInformation.push('trip_purpose')
  }
  if ((intent === 'plan' || intent === 'discover') && !knownDest && intent !== 'discover') {
    missingInformation.push('destination')
  }

  let confidence = 0.55
  if (intent === 'unclear') confidence = 0.35
  if (intent === 'book_ready') confidence = 0.8
  if (intent === 'discover' || intent === 'plan') confidence = 0.7
  if (purposeHint !== 'unknown') confidence += 0.1
  if (text.trim().length > 80) confidence += 0.05

  const reasoning = [
    `Classified intent as "${intent}" from traveler wording.`,
    purposeHint !== 'unknown'
      ? `Purpose signals point to "${purposeHint}".`
      : 'Purpose not yet explicit — will avoid over-asking.',
  ]
  if (urgency !== 'low') {
    reasoning.push(`Urgency read as ${urgency}.`)
  }

  const tradeoffs = [
    intent === 'discover'
      ? 'Discovery mode delays concrete itinerary until direction is clear.'
      : 'Planning mode assumes a workable destination direction.',
  ]

  const assumptions: string[] = []
  if (!knownDest && intent === 'plan') {
    assumptions.push('Traveler may already have a destination implied outside this turn.')
  }
  if (intent === 'budget') {
    assumptions.push('Budget talk may mean constraint, not that price is the only value driver.')
  }

  const recommendationScore = clampScore(
    intent === 'unclear' ? 25 : intent === 'small_talk' ? 40 : 55 + confidence * 40,
  )

  return {
    ...emptySlice({
      confidence: clamp01(confidence),
      reasoning,
      tradeoffs,
      assumptions,
      missingInformation,
      recommendationScore,
    }),
    intent,
    purposeHint,
    urgency,
  }
}

/** @deprecated alias kept for PascalCase mission naming */
export const TravelerIntentAnalyzer = { analyze: analyzeTravelerIntent }
