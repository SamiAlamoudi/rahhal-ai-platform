import type { TravelSearchRequest } from './travelSearchRequest'
import type { NormalizedTravelOption } from './searchOrchestrator'
import type {
  FinalDecisionScore,
  CategoryScoreDetail,
  RecommendationLevel,
  ScoreCategory,
} from './decisionScoreEngine'

// ── Reasoning data models ──────────────────────────────────────────────────

export interface ReasoningItem {
  key: string
  params: Record<string, string | number>
}

export interface ReasoningSection {
  key: string
  titleKey: string
  items: ReasoningItem[]
}

export interface ReasoningResult {
  optionId: string
  optionTitle: string
  optionType: string
  recommendation: RecommendationLevel
  weightedAverage: number
  confidence: number
  recommendationSummary: ReasoningItem[]
  strengths: ReasoningSection
  weaknesses: ReasoningSection
  budgetAnalysis: ReasoningSection
  familySuitability: ReasoningSection
  travelTimeAnalysis: ReasoningSection
  comfortAnalysis: ReasoningSection
  destinationMatch: ReasoningSection
  purposeMatch: ReasoningSection
  confidenceExplanation: ReasoningSection
  riskWarnings: ReasoningSection
  decisionExplanation: ReasoningItem[]
}

export type ReasoningGenerator = (
  option: NormalizedTravelOption,
  request: TravelSearchRequest,
) => ReasoningResult

export type ReasoningFormatter = (result: ReasoningResult) => string

// ── Helpers ────────────────────────────────────────────────────────────────

function getCategory(score: FinalDecisionScore, cat: ScoreCategory): CategoryScoreDetail | undefined {
  return score.categories.find(c => c.category === cat)
}

function scoreOf(score: FinalDecisionScore, cat: ScoreCategory): number {
  return getCategory(score, cat)?.score ?? 0
}

function hasChildren(req: TravelSearchRequest): boolean {
  return req.travelers.children > 0 || req.travelers.infants > 0
}

function optionLabel(option: NormalizedTravelOption): string {
  switch (option.type) {
    case 'flight': return 'flight'
    case 'hotel': return 'hotel'
    case 'activity': return 'activity'
    case 'transportation': return 'transportation'
  }
}

// ── Strengths ──────────────────────────────────────────────────────────────

export function generateStrengths(
  option: NormalizedTravelOption,
): ReasoningSection {
  const items: ReasoningItem[] = []
  const score = option.decisionScore
  if (!score) return emptySection('strengths', 'section.strengths')

  const threshold = 75
  const cats: ScoreCategory[] = [
    'price', 'comfort', 'travelTime', 'familySuitability',
    'luxury', 'destinationMatch', 'purposeMatch', 'preferenceMatch',
  ]

  for (const cat of cats) {
    const detail = getCategory(score, cat)
    if (detail && detail.score >= threshold) {
      items.push({
        key: `strengths.${cat}.high`,
        params: { score: detail.score },
      })
    }
  }

  if (option.stops === 0 && option.type === 'flight') {
    items.push({ key: 'strengths.flight.direct', params: {} })
  }

  if (option.refundable === true) {
    items.push({ key: 'strengths.cancellation.free', params: {} })
  }

  if (option.rating !== null && option.rating >= 4.5) {
    items.push({ key: 'strengths.rating.high', params: { rating: option.rating } })
  }

  return { key: 'strengths', titleKey: 'section.strengths', items }
}

// ── Weaknesses ─────────────────────────────────────────────────────────────

export function generateWeaknesses(
  option: NormalizedTravelOption,
): ReasoningSection {
  const items: ReasoningItem[] = []
  const score = option.decisionScore
  if (!score) return emptySection('weaknesses', 'section.weaknesses')

  const threshold = 50
  const cats: ScoreCategory[] = [
    'price', 'comfort', 'travelTime', 'familySuitability',
    'luxury', 'destinationMatch', 'purposeMatch', 'preferenceMatch',
  ]

  for (const cat of cats) {
    const detail = getCategory(score, cat)
    if (detail && detail.score < threshold) {
      items.push({
        key: `weaknesses.${cat}.low`,
        params: { score: detail.score },
      })
    }
  }

  if (option.stops !== null && option.stops >= 2) {
    items.push({ key: 'weaknesses.flight.multipleStops', params: { stops: option.stops } })
  }

  if (option.refundable === false) {
    items.push({ key: 'weaknesses.cancellation.none', params: {} })
  }

  if (option.familyFriendly === false) {
    items.push({ key: 'weaknesses.family.notFriendly', params: {} })
  }

  return { key: 'weaknesses', titleKey: 'section.weaknesses', items }
}

// ── Budget analysis ────────────────────────────────────────────────────────

export function generateBudgetReason(
  option: NormalizedTravelOption,
  req: TravelSearchRequest,
): ReasoningSection {
  const items: ReasoningItem[] = []
  const priceScore = option.decisionScore ? scoreOf(option.decisionScore, 'price') : 0

  if (req.budgetAmount > 0) {
    const ratio = option.price / req.budgetAmount
    const percentage = Math.round((1 - ratio) * 100)

    if (ratio <= 0.5) {
      items.push({
        key: 'budget.significantlyUnder',
        params: { percentage, budget: req.budgetAmount, currency: req.budgetCurrency },
      })
    } else if (ratio <= 0.75) {
      items.push({
        key: 'budget.under',
        params: { percentage, budget: req.budgetAmount, currency: req.budgetCurrency },
      })
    } else if (ratio <= 0.9) {
      items.push({
        key: 'budget.closeToLimit',
        params: { budget: req.budgetAmount, currency: req.budgetCurrency },
      })
    } else if (ratio <= 1.0) {
      items.push({
        key: 'budget.atLimit',
        params: { budget: req.budgetAmount, currency: req.budgetCurrency },
      })
    } else {
      const overPercentage = Math.round((ratio - 1) * 100)
      items.push({
        key: 'budget.overBudget',
        params: { overPercentage, budget: req.budgetAmount, currency: req.budgetCurrency },
      })
    }

    if (req.budgetPriority === 'lowest-price' && priceScore >= 80) {
      items.push({ key: 'budget.bestValue', params: { score: priceScore } })
    }
  } else {
    items.push({ key: 'budget.noBudgetSet', params: {} })
  }

  return { key: 'budgetAnalysis', titleKey: 'section.budgetAnalysis', items }
}

// ── Family suitability ─────────────────────────────────────────────────────

export function generateFamilyReason(
  option: NormalizedTravelOption,
  req: TravelSearchRequest,
): ReasoningSection {
  const items: ReasoningItem[] = []
  const familyScore = option.decisionScore ? scoreOf(option.decisionScore, 'familySuitability') : 0

  if (!hasChildren(req)) {
    items.push({ key: 'family.notApplicable', params: {} })
    return { key: 'familySuitability', titleKey: 'section.familySuitability', items }
  }

  if (option.familyFriendly === true) {
    items.push({ key: 'family.friendly', params: { score: familyScore } })
  } else if (option.familyFriendly === false) {
    items.push({ key: 'family.notFriendly', params: { score: familyScore } })
  } else {
    items.push({ key: 'family.unknown', params: {} })
  }

  if (option.attributes.breakfastIncluded === true) {
    items.push({ key: 'family.breakfastIncluded', params: {} })
  }

  const amenities = option.attributes.amenities
  if (typeof amenities === 'string') {
    if (amenities.includes('family-rooms')) {
      items.push({ key: 'family.familyRooms', params: {} })
    }
    if (amenities.includes('crib')) {
      items.push({ key: 'family.cribAvailable', params: {} })
    }
    if (amenities.includes('kids-club')) {
      items.push({ key: 'family.kidsClub', params: {} })
    }
  }

  if (option.type === 'flight' && option.stops !== null && option.stops > 1) {
    items.push({ key: 'family.multipleStops', params: { stops: option.stops } })
  }

  return { key: 'familySuitability', titleKey: 'section.familySuitability', items }
}

// ── Comfort analysis ───────────────────────────────────────────────────────

export function generateComfortReason(
  option: NormalizedTravelOption,
  _req: TravelSearchRequest,
): ReasoningSection {
  const items: ReasoningItem[] = []
  const comfortScore = option.decisionScore ? scoreOf(option.decisionScore, 'comfort') : 0

  const cabin = option.attributes.cabin
  if (typeof cabin === 'string' && cabin) {
    if (cabin === 'business' || cabin === 'first') {
      items.push({ key: 'comfort.premiumCabin', params: { cabin, score: comfortScore } })
    } else if (cabin === 'premium-economy') {
      items.push({ key: 'comfort.upgradedEconomy', params: { score: comfortScore } })
    } else {
      items.push({ key: 'comfort.standardCabin', params: { score: comfortScore } })
    }
  }

  if (option.rating !== null && option.rating >= 4.5) {
    items.push({ key: 'comfort.highRating', params: { rating: option.rating } })
  }

  const hotelStars = option.attributes.hotelStars
  if (typeof hotelStars === 'number' && hotelStars >= 4) {
    items.push({ key: 'comfort.highHotelStars', params: { stars: hotelStars } })
  }

  if (option.type === 'flight' && option.stops === 0) {
    items.push({ key: 'comfort.directFlight', params: {} })
  }

  if (comfortScore >= 75) {
    items.push({ key: 'comfort.overallHigh', params: { score: comfortScore } })
  } else if (comfortScore < 50) {
    items.push({ key: 'comfort.overallLow', params: { score: comfortScore } })
  }

  return { key: 'comfortAnalysis', titleKey: 'section.comfortAnalysis', items }
}

// ── Purpose match ──────────────────────────────────────────────────────────

export function generatePurposeReason(
  option: NormalizedTravelOption,
  req: TravelSearchRequest,
): ReasoningSection {
  const items: ReasoningItem[] = []
  const purposeScore = option.decisionScore ? scoreOf(option.decisionScore, 'purposeMatch') : 0

  const purpose = req.travelPurpose
  if (!purpose) {
    items.push({ key: 'purpose.notSpecified', params: {} })
    return { key: 'purposeMatch', titleKey: 'section.purposeMatch', items }
  }

  if (purposeScore >= 75) {
    items.push({ key: `purpose.${purpose}.strongMatch`, params: { score: purposeScore } })
  } else if (purposeScore >= 50) {
    items.push({ key: `purpose.${purpose}.partialMatch`, params: { score: purposeScore } })
  } else {
    items.push({ key: `purpose.${purpose}.weakMatch`, params: { score: purposeScore } })
  }

  if (purpose === 'family' && option.familyFriendly === true) {
    items.push({ key: 'purpose.family.friendlyConfirmed', params: {} })
  }
  if (purpose === 'business' && typeof option.attributes.cabin === 'string' &&
    (option.attributes.cabin === 'business' || option.attributes.cabin === 'first')) {
    items.push({ key: 'purpose.business.premiumCabin', params: {} })
  }
  if (purpose === 'adventure' && typeof option.attributes.activityType === 'string' &&
    option.attributes.activityType === 'adventure') {
    items.push({ key: 'purpose.adventure.activityTypeMatch', params: {} })
  }

  return { key: 'purposeMatch', titleKey: 'section.purposeMatch', items }
}

// ── Travel time analysis ───────────────────────────────────────────────────

function generateTravelTimeAnalysis(
  option: NormalizedTravelOption,
  req: TravelSearchRequest,
): ReasoningSection {
  const items: ReasoningItem[] = []
  const timeScore = option.decisionScore ? scoreOf(option.decisionScore, 'travelTime') : 0

  if (option.type === 'flight') {
    if (option.stops === 0) {
      items.push({ key: 'travelTime.flight.direct', params: { score: timeScore } })
    } else if (option.stops === 1) {
      items.push({ key: 'travelTime.flight.oneStop', params: { score: timeScore } })
    } else {
      items.push({ key: 'travelTime.flight.multipleStops', params: { stops: option.stops!, score: timeScore } })
    }

    if (option.durationMinutes !== null) {
      const hours = Math.round(option.durationMinutes / 60)
      if (hours <= 6) {
        items.push({ key: 'travelTime.flight.shortDuration', params: { hours } })
      } else if (hours <= 12) {
        items.push({ key: 'travelTime.flight.mediumDuration', params: { hours } })
      } else {
        items.push({ key: 'travelTime.flight.longDuration', params: { hours } })
      }
    }
  } else if (option.durationMinutes !== null) {
    const hours = Math.round(option.durationMinutes / 60)
    items.push({ key: 'travelTime.general.duration', params: { hours, score: timeScore } })
  } else {
    items.push({ key: 'travelTime.unknown', params: {} })
  }

  if (req.directFlightPreferred === 'direct-only' && option.stops !== 0 && option.type === 'flight') {
    items.push({ key: 'travelTime.flight.notDirectPreferred', params: {} })
  }

  return { key: 'travelTimeAnalysis', titleKey: 'section.travelTimeAnalysis', items }
}

// ── Destination match ──────────────────────────────────────────────────────

function generateDestinationMatch(
  option: NormalizedTravelOption,
  req: TravelSearchRequest,
): ReasoningSection {
  const items: ReasoningItem[] = []
  const destScore = option.decisionScore ? scoreOf(option.decisionScore, 'destinationMatch') : 0

  const dest = option.attributes.destination
  if (typeof dest === 'string' && dest) {
    if (dest.toLowerCase() === req.destination.toLowerCase()) {
      items.push({ key: 'destination.exactMatch', params: { destination: dest, score: destScore } })
    } else if (req.destination && dest.toLowerCase().includes(req.destination.toLowerCase())) {
      items.push({ key: 'destination.partialMatch', params: { destination: dest, score: destScore } })
    } else {
      items.push({ key: 'destination.mismatch', params: { destination: dest, score: destScore } })
    }
  } else {
    items.push({ key: 'destination.noDestinationData', params: { score: destScore } })
  }

  return { key: 'destinationMatch', titleKey: 'section.destinationMatch', items }
}

// ── Risk warnings ──────────────────────────────────────────────────────────

export function generateWarnings(
  option: NormalizedTravelOption,
  req: TravelSearchRequest,
): ReasoningSection {
  const items: ReasoningItem[] = []

  if (option.price > req.budgetAmount && req.budgetAmount > 0) {
    const overAmount = option.price - req.budgetAmount
    items.push({
      key: 'warning.overBudget',
      params: { amount: overAmount, currency: req.budgetCurrency },
    })
  }

  if (option.refundable === false) {
    items.push({ key: 'warning.nonRefundable', params: {} })
  }

  if (option.familyFriendly === false && hasChildren(req)) {
    items.push({ key: 'warning.notFamilyFriendly', params: {} })
  }

  if (option.stops !== null && option.stops >= 2 && hasChildren(req)) {
    items.push({ key: 'warning.manyStopsWithKids', params: { stops: option.stops } })
  }

  if (option.rating !== null && option.rating < 3.5) {
    items.push({ key: 'warning.lowRating', params: { rating: option.rating } })
  }

  if (option.baggageIncluded === false) {
    items.push({ key: 'warning.noBaggage', params: {} })
  }

  if (option.decisionScore && option.decisionScore.confidence < 40) {
    items.push({ key: 'warning.lowConfidence', params: { confidence: option.decisionScore.confidence } })
  }

  const comfortScore = option.decisionScore ? scoreOf(option.decisionScore, 'comfort') : 0
  if (comfortScore < 40) {
    items.push({ key: 'warning.lowComfort', params: { score: comfortScore } })
  }

  return { key: 'riskWarnings', titleKey: 'section.riskWarnings', items }
}

// ── Confidence explanation ─────────────────────────────────────────────────

export function generateConfidenceExplanation(
  option: NormalizedTravelOption,
  req: TravelSearchRequest,
): ReasoningSection {
  const items: ReasoningItem[] = []
  const confidence = option.decisionScore?.confidence ?? 0

  if (confidence >= 80) {
    items.push({ key: 'confidence.high', params: { confidence } })
  } else if (confidence >= 60) {
    items.push({ key: 'confidence.medium', params: { confidence } })
  } else if (confidence >= 40) {
    items.push({ key: 'confidence.low', params: { confidence } })
  } else {
    items.push({ key: 'confidence.veryLow', params: { confidence } })
  }

  const highCount = req.highConfidence.length
  const mediumCount = req.mediumConfidence.length
  const lowCount = req.lowConfidence.length

  items.push({
    key: 'confidence.inferenceBreakdown',
    params: { high: highCount, medium: mediumCount, low: lowCount },
  })

  if (lowCount > highCount) {
    items.push({ key: 'confidence.moreLowThanHigh', params: {} })
  }

  const scoreVariance = computeScoreVariance(option)
  if (scoreVariance > 30) {
    items.push({ key: 'confidence.highVariance', params: { variance: scoreVariance } })
  }

  return { key: 'confidenceExplanation', titleKey: 'section.confidenceExplanation', items }
}

function computeScoreVariance(option: NormalizedTravelOption): number {
  if (!option.decisionScore) return 0
  const scores = option.decisionScore.categories.map(c => c.score)
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((acc, s) => acc + Math.abs(s - mean), 0) / scores.length
  return Math.round(variance)
}

// ── Recommendation summary ─────────────────────────────────────────────────

export function generateRecommendation(
  option: NormalizedTravelOption,
  req: TravelSearchRequest,
): ReasoningItem[] {
  const items: ReasoningItem[] = []
  const score = option.decisionScore
  if (!score) return items

  const label = optionLabel(option)
  items.push({
    key: `recommendation.${score.recommendation}`,
    params: { type: label, score: score.weightedAverage },
  })

  const priceScore = scoreOf(score, 'price')
  if (priceScore >= 75 && req.budgetAmount > 0) {
    const ratio = option.price / req.budgetAmount
    if (ratio < 1) {
      const savings = Math.round((1 - ratio) * 100)
      items.push({ key: 'recommendation.withinBudget', params: { percentage: savings } })
    }
  }

  const timeScore = scoreOf(score, 'travelTime')
  if (timeScore >= 75 && option.type === 'flight') {
    if (option.stops === 0) {
      items.push({ key: 'recommendation.directFlight', params: {} })
    } else if (option.stops === 1) {
      items.push({ key: 'recommendation.oneStop', params: {} })
    }
  }

  if (option.durationMinutes !== null) {
    const hours = Math.round(option.durationMinutes / 60)
    if (hours <= 7 && option.type === 'flight') {
      items.push({ key: 'recommendation.shorterThanAverage', params: { hours } })
    }
  }

  const familyScore = scoreOf(score, 'familySuitability')
  if (familyScore >= 75 && hasChildren(req)) {
    items.push({ key: 'recommendation.excellentForFamilies', params: {} })
  }

  const purposeScore = scoreOf(score, 'purposeMatch')
  if (purposeScore >= 75) {
    items.push({ key: 'recommendation.matchesPurpose', params: { purpose: req.travelPurpose } })
  }

  if (req.budgetAmount > 0 && option.price < req.budgetAmount) {
    const savings = Math.round((1 - option.price / req.budgetAmount) * 100)
    if (savings > 0) {
      items.push({
        key: 'recommendation.savesPercentage',
        params: { percentage: savings },
      })
    }
  }

  return items
}

// ── Summary ────────────────────────────────────────────────────────────────

export function generateSummary(
  option: NormalizedTravelOption,
  _req: TravelSearchRequest,
): ReasoningItem[] {
  const items: ReasoningItem[] = []
  const score = option.decisionScore
  if (!score) return items

  const label = optionLabel(option)
  items.push({
    key: `summary.${score.recommendation}`,
    params: { type: label, score: score.weightedAverage },
  })

  const topCategory = [...score.categories].sort((a, b) => b.score - a.score)[0]
  if (topCategory && topCategory.score >= 75) {
    items.push({
      key: `summary.topCategory.${topCategory.category}`,
      params: { score: topCategory.score },
    })
  }

  const bottomCategory = [...score.categories].sort((a, b) => a.score - b.score)[0]
  if (bottomCategory && bottomCategory.score < 50) {
    items.push({
      key: `summary.bottomCategory.${bottomCategory.category}`,
      params: { score: bottomCategory.score },
    })
  }

  return items
}

// ── Decision explanation ───────────────────────────────────────────────────

function generateDecisionExplanation(
  option: NormalizedTravelOption,
  _req: TravelSearchRequest,
): ReasoningItem[] {
  const items: ReasoningItem[] = []
  const score = option.decisionScore
  if (!score) return items

  const label = optionLabel(option)
  items.push({
    key: 'decision.opening',
    params: { type: label, title: option.title, score: score.weightedAverage },
  })

  for (const cat of score.categories) {
    if (cat.score >= 80) {
      items.push({
        key: `decision.strongCategory.${cat.category}`,
        params: { score: cat.score, weight: Math.round(cat.weight) },
      })
    } else if (cat.score < 45) {
      items.push({
        key: `decision.weakCategory.${cat.category}`,
        params: { score: cat.score },
      })
    }
  }

  const confidence = score.confidence
  items.push({
    key: 'decision.confidence',
    params: { confidence },
  })

  items.push({
    key: `decision.recommendationLevel.${score.recommendation}`,
    params: {},
  })

  return items
}

// ── Utility ────────────────────────────────────────────────────────────────

function emptySection(key: string, titleKey: string): ReasoningSection {
  return { key, titleKey, items: [] }
}

// ── Main generator ─────────────────────────────────────────────────────────

export const generateReasoning: ReasoningGenerator = (
  option: NormalizedTravelOption,
  req: TravelSearchRequest,
): ReasoningResult => {
  const score = option.decisionScore

  return {
    optionId: option.id,
    optionTitle: option.title,
    optionType: option.type,
    recommendation: score?.recommendation ?? 'not-recommended',
    weightedAverage: score?.weightedAverage ?? 0,
    confidence: score?.confidence ?? 0,
    recommendationSummary: generateRecommendation(option, req),
    strengths: generateStrengths(option),
    weaknesses: generateWeaknesses(option),
    budgetAnalysis: generateBudgetReason(option, req),
    familySuitability: generateFamilyReason(option, req),
    travelTimeAnalysis: generateTravelTimeAnalysis(option, req),
    comfortAnalysis: generateComfortReason(option, req),
    destinationMatch: generateDestinationMatch(option, req),
    purposeMatch: generatePurposeReason(option, req),
    confidenceExplanation: generateConfidenceExplanation(option, req),
    riskWarnings: generateWarnings(option, req),
    decisionExplanation: generateDecisionExplanation(option, req),
  }
}

// ── Formatter ──────────────────────────────────────────────────────────────

const SECTION_TITLES: Record<string, string> = {
  'section.strengths': 'نقاط القوة',
  'section.weaknesses': 'نقاط الضعف',
  'section.budgetAnalysis': 'تحليل الميزانية',
  'section.familySuitability': 'ملاءمة العائلة',
  'section.travelTimeAnalysis': 'تحليل وقت السفر',
  'section.comfortAnalysis': 'تحليل الراحة',
  'section.destinationMatch': 'مطابقة الوجهة',
  'section.purposeMatch': 'مطابقة الغرض',
  'section.confidenceExplanation': 'تفسير مستوى الثقة',
  'section.riskWarnings': 'تحذيرات',
}

const TEXT_MAP: Record<string, (p: Record<string, string | number>) => string> = {
  // Recommendation
  'recommendation.excellent': p => `هذا ${p.type} خيار ممتاز (النتيجة: ${p.score}/100)`,
  'recommendation.recommended': p => `نوصي بهذا ${p.type} (النتيجة: ${p.score}/100)`,
  'recommendation.acceptable': p => `هذا ${p.type} خيار مقبول (النتيجة: ${p.score}/100)`,
  'recommendation.not-recommended': p => `لا نوصي بهذا ${p.type} (النتيجة: ${p.score}/100)`,
  'recommendation.withinBudget': p => `ضمن ميزانيتك (يوفّر ≈${p.percentage}%)`,
  'recommendation.directFlight': () => 'رحلة مباشرة',
  'recommendation.oneStop': () => 'توقف واحد فقط',
  'recommendation.shorterThanAverage': p => `مدة السفر أقصر من المتوسط (${p.hours} ساعات)`,
  'recommendation.excellentForFamilies': () => 'ممتاز للعائلات',
  'recommendation.matchesPurpose': p => `يطابق غرض السفر: ${p.purpose}`,
  'recommendation.savesPercentage': p => `يوفّر حوالي ${p.percentage}% مقارنة بخيارات مشابهة`,

  // Summary
  'summary.excellent': p => `خيار ممتاز لل${p.type} بنتيجة ${p.score}/100`,
  'summary.recommended': p => `خيار موصى به لل${p.type} بنتيجة ${p.score}/100`,
  'summary.acceptable': p => `خيار مقبول لل${p.type} بنتيجة ${p.score}/100`,
  'summary.not-recommended': p => `خيار غير موصى به لل${p.type} بنتيجة ${p.score}/100`,
  'summary.topCategory.price': p => `أعلى تصنيف: السعر (${p.score}/100)`,
  'summary.topCategory.comfort': p => `أعلى تصنيف: الراحة (${p.score}/100)`,
  'summary.topCategory.travelTime': p => `أعلى تصنيف: وقت السفر (${p.score}/100)`,
  'summary.topCategory.familySuitability': p => `أعلى تصنيف: ملاءمة العائلة (${p.score}/100)`,
  'summary.topCategory.luxury': p => `أعلى تصنيف: الفخامة (${p.score}/100)`,
  'summary.topCategory.destinationMatch': p => `أعلى تصنيف: مطابقة الوجهة (${p.score}/100)`,
  'summary.topCategory.purposeMatch': p => `أعلى تصنيف: مطابقة الغرض (${p.score}/100)`,
  'summary.topCategory.preferenceMatch': p => `أعلى تصنيف: مطابقة التفضيلات (${p.score}/100)`,
  'summary.bottomCategory.price': p => `أدنى تصنيف: السعر (${p.score}/100)`,
  'summary.bottomCategory.comfort': p => `أدنى تصنيف: الراحة (${p.score}/100)`,
  'summary.bottomCategory.travelTime': p => `أدنى تصنيف: وقت السفر (${p.score}/100)`,
  'summary.bottomCategory.familySuitability': p => `أدنى تصنيف: ملاءمة العائلة (${p.score}/100)`,
  'summary.bottomCategory.luxury': p => `أدنى تصنيف: الفخامة (${p.score}/100)`,
  'summary.bottomCategory.destinationMatch': p => `أدنى تصنيف: مطابقة الوجهة (${p.score}/100)`,
  'summary.bottomCategory.purposeMatch': p => `أدنى تصنيف: مطابقة الغرض (${p.score}/100)`,
  'summary.bottomCategory.preferenceMatch': p => `أدنى تصنيف: مطابقة التفضيلات (${p.score}/100)`,

  // Strengths
  'strengths.price.high': p => `السعر ممتاز (${p.score}/100)`,
  'strengths.comfort.high': p => `مستوى الراحة عالي (${p.score}/100)`,
  'strengths.travelTime.high': p => `وقت السفر ممتاز (${p.score}/100)`,
  'strengths.familySuitability.high': p => `ملاءمة العائلة عالية (${p.score}/100)`,
  'strengths.luxury.high': p => `مستوى الفخامة عالي (${p.score}/100)`,
  'strengths.destinationMatch.high': p => `مطابقة الوجهة ممتازة (${p.score}/100)`,
  'strengths.purposeMatch.high': p => `مطابقة الغرض عالية (${p.score}/100)`,
  'strengths.preferenceMatch.high': p => `مطابقة التفضيلات عالية (${p.score}/100)`,
  'strengths.flight.direct': () => 'رحلة مباشرة بدون توقفات',
  'strengths.cancellation.free': () => 'إلغاء مجاني متاح',
  'strengths.rating.high': p => `تقييم عالي (${p.rating}/5)`,

  // Weaknesses
  'weaknesses.price.low': p => `السعر ضعيف (${p.score}/100)`,
  'weaknesses.comfort.low': p => `مستوى الراحة منخفض (${p.score}/100)`,
  'weaknesses.travelTime.low': p => `وقت السفر طويل (${p.score}/100)`,
  'weaknesses.familySuitability.low': p => `ملاءمة العائلة منخفضة (${p.score}/100)`,
  'weaknesses.luxury.low': p => `مستوى الفخامة منخفض (${p.score}/100)`,
  'weaknesses.destinationMatch.low': p => `مطابقة الوجهة ضعيفة (${p.score}/100)`,
  'weaknesses.purposeMatch.low': p => `مطابقة الغرض ضعيفة (${p.score}/100)`,
  'weaknesses.preferenceMatch.low': p => `مطابقة التفضيلات ضعيفة (${p.score}/100)`,
  'weaknesses.flight.multipleStops': p => `${p.stops} توقفات`,
  'weaknesses.cancellation.none': () => 'لا يوجد إلغاء مجاني',
  'weaknesses.family.notFriendly': () => 'غير مناسب للعائلات',

  // Budget
  'budget.significantlyUnder': p => `أقل من الميزانية بـ ${p.percentage}% (الميزانية: ${p.budget} ${p.currency})`,
  'budget.under': p => `ضمن الميزانية (يوفّر ${p.percentage}%)`,
  'budget.closeToLimit': p => `قريب من حد الميزانية (${p.budget} ${p.currency})`,
  'budget.atLimit': p => `عند حد الميزانية (${p.budget} ${p.currency})`,
  'budget.overBudget': p => `يتجاوز الميزانية بـ ${p.overPercentage}%`,
  'budget.bestValue': p => `أفضل قيمة للسعر (${p.score}/100)`,
  'budget.noBudgetSet': () => 'لم يتم تحديد ميزانية',

  // Family
  'family.friendly': p => `مناسب للعائلات (${p.score}/100)`,
  'family.notFriendly': p => `غير مناسب للعائلات (${p.score}/100)`,
  'family.unknown': () => 'لم يتم التحقق من ملاءمة العائلة',
  'family.breakfastIncluded': () => 'يشمل الإفطار',
  'family.familyRooms': () => 'غرف عائلية متاحة',
  'family.cribAvailable': () => 'سرير أطفال متاح',
  'family.kidsClub': () => 'نادي أطفال متاح',
  'family.multipleStops': p => `${p.stops} توقفات قد تكون مرهقة للأطفال`,
  'family.notApplicable': () => 'لا يوجد أطفال في هذه الرحلة',

  // Comfort
  'comfort.premiumCabin': p => `درجة ${p.cabin} (${p.score}/100)`,
  'comfort.upgradedEconomy': p => `درجة اقتصادية محسّنة (${p.score}/100)`,
  'comfort.standardCabin': p => `درجة اقتصادية قياسية (${p.score}/100)`,
  'comfort.highRating': p => `تقييم عالي (${p.rating}/5)`,
  'comfort.highHotelStars': p => `${p.stars} نجوم`,
  'comfort.directFlight': () => 'رحلة مباشرة تزيد الراحة',
  'comfort.overallHigh': p => `مستوى الراحة العام عالي (${p.score}/100)`,
  'comfort.overallLow': p => `مستوى الراحة العام منخفض (${p.score}/100)`,

  // Purpose
  'purpose.family.strongMatch': p => `مطابقة ممتازة لسفر العائلة (${p.score}/100)`,
  'purpose.family.partialMatch': p => `مطابقة جزئية لسفر العائلة (${p.score}/100)`,
  'purpose.family.weakMatch': p => `مطابقة ضعيفة لسفر العائلة (${p.score}/100)`,
  'purpose.family.friendlyConfirmed': () => 'مؤكد كخيار مناسب للعائلة',
  'purpose.business.strongMatch': p => `مطابقة ممتازة لسفر العمل (${p.score}/100)`,
  'purpose.business.partialMatch': p => `مطابقة جزئية لسفر العمل (${p.score}/100)`,
  'purpose.business.weakMatch': p => `مطابقة ضعيفة لسفر العمل (${p.score}/100)`,
  'purpose.business.premiumCabin': () => 'درجة رجال أعمال متاحة',
  'purpose.honeymoon.strongMatch': p => `مطابقة ممتازة لشهر العسل (${p.score}/100)`,
  'purpose.honeymoon.partialMatch': p => `مطابقة جزئية لشهر العسل (${p.score}/100)`,
  'purpose.honeymoon.weakMatch': p => `مطابقة ضعيفة لشهر العسل (${p.score}/100)`,
  'purpose.vacation.strongMatch': p => `مطابقة ممتازة لرحلة سياحية (${p.score}/100)`,
  'purpose.vacation.partialMatch': p => `مطابقة جزئية لرحلة سياحية (${p.score}/100)`,
  'purpose.vacation.weakMatch': p => `مطابقة ضعيفة لرحلة سياحية (${p.score}/100)`,
  'purpose.adventure.strongMatch': p => `مطابقة ممتازة لرحلة مغامرة (${p.score}/100)`,
  'purpose.adventure.partialMatch': p => `مطابقة جزئية لرحلة مغامرة (${p.score}/100)`,
  'purpose.adventure.weakMatch': p => `مطابقة ضعيفة لرحلة مغامرة (${p.score}/100)`,
  'purpose.adventure.activityTypeMatch': () => 'نوع النشاط مطابق للمغامرة',
  'purpose.notSpecified': () => 'لم يتم تحديد غرض السفر',

  // Travel time
  'travelTime.flight.direct': p => `رحلة مباشرة (${p.score}/100)`,
  'travelTime.flight.oneStop': p => `توقف واحد (${p.score}/100)`,
  'travelTime.flight.multipleStops': p => `${p.stops} توقفات (${p.score}/100)`,
  'travelTime.flight.shortDuration': p => `مدة قصيرة (${p.hours} ساعات)`,
  'travelTime.flight.mediumDuration': p => `مدة متوسطة (${p.hours} ساعات)`,
  'travelTime.flight.longDuration': p => `مدة طويلة (${p.hours} ساعات)`,
  'travelTime.flight.notDirectPreferred': () => 'تم تفضيل رحلة مباشرة لكن هذا الخيار يتوقف',
  'travelTime.general.duration': p => `المدة: ${p.hours} ساعات (${p.score}/100)`,
  'travelTime.unknown': () => 'لم يتم تحديد مدة السفر',

  // Destination
  'destination.exactMatch': p => `مطابقة تامة للوجهة: ${p.destination} (${p.score}/100)`,
  'destination.partialMatch': p => `مطابقة جزئية للوجهة: ${p.destination} (${p.score}/100)`,
  'destination.mismatch': p => `الوجهة لا تطابق: ${p.destination} (${p.score}/100)`,
  'destination.noDestinationData': p => `لا توجد بيانات وجهة (${p.score}/100)`,

  // Confidence
  'confidence.high': p => `مستوى ثقة عالي (${p.confidence}/100)`,
  'confidence.medium': p => `مستوى ثقة متوسط (${p.confidence}/100)`,
  'confidence.low': p => `مستوى ثقة منخفض (${p.confidence}/100)`,
  'confidence.veryLow': p => `مستوى ثقة منخفض جداً (${p.confidence}/100)`,
  'confidence.inferenceBreakdown': p => `استنتاجات: عالية=${p.high}, متوسطة=${p.medium}, منخفضة=${p.low}`,
  'confidence.moreLowThanHigh': () => 'عدد الاستنتاجات منخفضة الثقة أكبر من العالية',
  'confidence.highVariance': p => `تباين عالي في النتائج (${p.variance})`,

  // Warnings
  'warning.overBudget': p => `يتجاوز الميزانية بـ ${p.amount} ${p.currency}`,
  'warning.nonRefundable': () => 'غير قابل للاسترداد',
  'warning.notFamilyFriendly': () => 'غير مناسب للأطفال',
  'warning.manyStopsWithKids': p => `${p.stops} توقفات مع أطفال قد تكون مرهقة`,
  'warning.lowRating': p => `تقييم منخفض (${p.rating}/5)`,
  'warning.noBaggage': () => 'لا يشمل الأمتعة',
  'warning.lowConfidence': p => `مستوى ثقة منخفض (${p.confidence}/100)`,
  'warning.lowComfort': p => `مستوى راحة منخفض (${p.score}/100)`,

  // Decision
  'decision.opening': p => `نوصي بهذا ${p.type} (${p.title}) بنتيجة ${p.score}/100 لأن:`,
  'decision.strongCategory.price': p => `السعر قوي (${p.score}/100, وزن ${p.weight})`,
  'decision.strongCategory.comfort': p => `الراحة قوية (${p.score}/100, وزن ${p.weight})`,
  'decision.strongCategory.travelTime': p => `وقت السفر ممتاز (${p.score}/100, وزن ${p.weight})`,
  'decision.strongCategory.familySuitability': p => `ملاءمة العائلة قوية (${p.score}/100, وزن ${p.weight})`,
  'decision.strongCategory.luxury': p => `الفخامة عالية (${p.score}/100, وزن ${p.weight})`,
  'decision.strongCategory.destinationMatch': p => `مطابقة الوجهة ممتازة (${p.score}/100, وزن ${p.weight})`,
  'decision.strongCategory.purposeMatch': p => `مطابقة الغرض قوية (${p.score}/100, وزن ${p.weight})`,
  'decision.strongCategory.preferenceMatch': p => `مطابقة التفضيلات قوية (${p.score}/100, وزن ${p.weight})`,
  'decision.weakCategory.price': p => `السعر ضعيف (${p.score}/100)`,
  'decision.weakCategory.comfort': p => `الراحة ضعيفة (${p.score}/100)`,
  'decision.weakCategory.travelTime': p => `وقت السفر طويل (${p.score}/100)`,
  'decision.weakCategory.familySuitability': p => `ملاءمة العائلة ضعيفة (${p.score}/100)`,
  'decision.weakCategory.luxury': p => `الفخامة منخفضة (${p.score}/100)`,
  'decision.weakCategory.destinationMatch': p => `مطابقة الوجهة ضعيفة (${p.score}/100)`,
  'decision.weakCategory.purposeMatch': p => `مطابقة الغرض ضعيفة (${p.score}/100)`,
  'decision.weakCategory.preferenceMatch': p => `مطابقة التفضيلات ضعيفة (${p.score}/100)`,
  'decision.confidence': p => `مستوى الثقة: ${p.confidence}/100`,
  'decision.recommendationLevel.excellent': () => 'التقييم النهائي: ممتاز',
  'decision.recommendationLevel.recommended': () => 'التقييم النهائي: موصى به',
  'decision.recommendationLevel.acceptable': () => 'التقييم النهائي: مقبول',
  'decision.recommendationLevel.not-recommended': () => 'التقييم النهائي: غير موصى به',
}

function formatItem(item: ReasoningItem): string {
  const formatter = TEXT_MAP[item.key]
  if (formatter) return formatter(item.params)
  return item.key
}

export const formatReasoning: ReasoningFormatter = (result: ReasoningResult): string => {
  void SECTION_TITLES
  const lines: string[] = []

  lines.push(`"${formatItem({
    key: `recommendation.${result.recommendation}`,
    params: { type: result.optionType, score: result.weightedAverage },
  })}"`)
  lines.push('')

  for (const item of result.recommendationSummary) {
    lines.push(`• ${formatItem(item)}`)
  }
  lines.push('')

  const sections: { section: ReasoningSection; title: string }[] = [
    { section: result.strengths, title: 'نقاط القوة' },
    { section: result.weaknesses, title: 'نقاط الضعف' },
    { section: result.budgetAnalysis, title: 'تحليل الميزانية' },
    { section: result.familySuitability, title: 'ملاءمة العائلة' },
    { section: result.travelTimeAnalysis, title: 'تحليل وقت السفر' },
    { section: result.comfortAnalysis, title: 'تحليل الراحة' },
    { section: result.destinationMatch, title: 'مطابقة الوجهة' },
    { section: result.purposeMatch, title: 'مطابقة الغرض' },
    { section: result.confidenceExplanation, title: 'تفسير الثقة' },
    { section: result.riskWarnings, title: 'تحذيرات' },
  ]

  for (const { section, title } of sections) {
    if (section.items.length === 0) continue
    lines.push(`[${title}]`)
    for (const item of section.items) {
      lines.push(`• ${formatItem(item)}`)
    }
    lines.push('')
  }

  if (result.decisionExplanation.length > 0) {
    lines.push('[تفسير القرار]')
    for (const item of result.decisionExplanation) {
      lines.push(`• ${formatItem(item)}`)
    }
  }

  return lines.join('\n')
}
