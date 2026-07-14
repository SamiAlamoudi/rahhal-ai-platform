import type { TravelSearchRequest } from './travelSearchRequest'

// ── Category scores (0–100) ────────────────────────────────────────────────

export interface CategoryScores {
  price: number
  comfort: number
  travelTime: number
  familySuitability: number
  luxury: number
  destinationMatch: number
  purposeMatch: number
  preferenceMatch: number
}

export type ScoreCategory = keyof CategoryScores

export interface CategoryScoreDetail {
  category: ScoreCategory
  score: number
  weight: number
  weightedScore: number
  reason: string
}

export type RecommendationLevel = 'excellent' | 'recommended' | 'acceptable' | 'not-recommended'

export interface FinalDecisionScore {
  categories: CategoryScoreDetail[]
  weightedAverage: number
  confidence: number
  reasons: string[]
  recommendation: RecommendationLevel
}

// ── Option shapes (future flight / hotel / activity inputs) ────────────────

export interface ScoreableOption {
  price: number
  currency: string
  cabin?: string
  directFlight?: boolean
  stops?: number
  durationMinutes?: number
  departureTime?: string
  arrivalTime?: string
  airline?: string
  hotelStars?: number
  hotelRating?: number
  familyFriendly?: boolean
  breakfastIncluded?: boolean
  freeCancellation?: boolean
  amenities?: string[]
  area?: string
  destination?: string
  activityType?: string
}

// ── Weight config derived from TravelSearchRequest ─────────────────────────

export interface ScoreWeights {
  price: number
  comfort: number
  travelTime: number
  familySuitability: number
  luxury: number
  destinationMatch: number
  purposeMatch: number
  preferenceMatch: number
}

const TOTAL_WEIGHT_FIELDS: (keyof ScoreWeights)[] = [
  'price', 'comfort', 'travelTime', 'familySuitability',
  'luxury', 'destinationMatch', 'purposeMatch', 'preferenceMatch',
]

function deriveWeights(req: TravelSearchRequest): ScoreWeights {
  const w: ScoreWeights = {
    price: req.lowestPriceWeight * 1.5 + 1,
    comfort: req.comfortWeight * 1.5 + 1,
    travelTime: req.timeWeight * 1.5 + 1,
    familySuitability: req.familyWeight * 2 + (req.travelers.children > 0 ? 2 : 0),
    luxury: req.luxuryWeight * 1.5 + 1,
    destinationMatch: 3,
    purposeMatch: 3,
    preferenceMatch: 2,
  }
  // Normalize so weights sum to a known total (40 = 8 categories × 5 max)
  const sum = TOTAL_WEIGHT_FIELDS.reduce((acc, k) => acc + w[k], 0)
  if (sum === 0) {
    return { price: 5, comfort: 5, travelTime: 5, familySuitability: 5, luxury: 5, destinationMatch: 5, purposeMatch: 5, preferenceMatch: 5 }
  }
  const normalized = { ...w }
  for (const k of TOTAL_WEIGHT_FIELDS) {
    normalized[k] = (w[k] / sum) * 40
  }
  return normalized
}

// ── Pure scoring functions ─────────────────────────────────────────────────

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)))
}

function scorePrice(option: ScoreableOption, req: TravelSearchRequest): number {
  if (req.budgetAmount <= 0 || option.price <= 0) return 50
  const ratio = option.price / req.budgetAmount
  if (ratio <= 0.5) return 100
  if (ratio <= 0.75) return 90
  if (ratio <= 0.9) return 78
  if (ratio <= 1.0) return 65
  if (ratio <= 1.25) return 40
  return 20
}

function scoreComfort(option: ScoreableOption, _req: TravelSearchRequest): number {
  let score = 50
  if (option.cabin) {
    if (option.cabin === 'first') score += 35
    else if (option.cabin === 'business') score += 30
    else if (option.cabin === 'premium-economy') score += 18
    else if (option.cabin === 'economy') score += 5
  }
  if (option.hotelRating && option.hotelRating > 0) {
    score += (option.hotelRating / 5) * 25
  }
  if (option.stops !== undefined) {
    score -= option.stops * 10
  }
  if (option.amenities && option.amenities.length > 0) {
    score += Math.min(option.amenities.length * 3, 15)
  }
  return clampScore(score)
}

function scoreTravelTime(option: ScoreableOption, req: TravelSearchRequest): number {
  let score = 50
  if (option.directFlight === true) {
    score += 35
  } else if (option.stops !== undefined) {
    score -= option.stops * 15
  }
  if (option.durationMinutes && option.durationMinutes > 0) {
    if (option.durationMinutes <= 360) score += 20
    else if (option.durationMinutes <= 720) score += 10
    else if (option.durationMinutes <= 1200) score -= 5
    else score -= 15
  }
  if (req.directFlightPreferred === 'direct-only' && option.directFlight !== true) {
    score -= 20
  }
  return clampScore(score)
}

function scoreFamilySuitability(option: ScoreableOption, req: TravelSearchRequest): number {
  if (req.travelers.children === 0 && req.travelers.infants === 0) return 75
  let score = 50
  if (option.familyFriendly === true) score += 30
  if (option.breakfastIncluded === true) score += 12
  if (option.amenities) {
    if (option.amenities.includes('family-rooms')) score += 10
    if (option.amenities.includes('crib')) score += 8
    if (option.amenities.includes('kids-club')) score += 10
  }
  if (option.hotelStars && option.hotelStars >= 3) score += 5
  if (option.stops !== undefined && option.stops > 1) score -= 15
  return clampScore(score)
}

function scoreLuxury(option: ScoreableOption, req: TravelSearchRequest): number {
  let score = 40
  if (option.cabin) {
    if (option.cabin === 'first') score += 45
    else if (option.cabin === 'business') score += 35
    else if (option.cabin === 'premium-economy') score += 20
  }
  if (option.hotelStars) {
    score += option.hotelStars * 8
  }
  if (option.amenities) {
    if (option.amenities.includes('spa')) score += 8
    if (option.amenities.includes('pool')) score += 6
    if (option.amenities.includes('gym')) score += 5
  }
  if (req.luxuryWeight === 0) {
    score = Math.min(score, 55)
  }
  return clampScore(score)
}

function scoreDestinationMatch(option: ScoreableOption, req: TravelSearchRequest): number {
  if (!option.destination) return 50
  if (option.destination.toLowerCase() === req.destination.toLowerCase()) return 100
  if (req.destination && option.destination.toLowerCase().includes(req.destination.toLowerCase())) return 80
  return 30
}

function scorePurposeMatch(option: ScoreableOption, req: TravelSearchRequest): number {
  let score = 55
  if (req.travelPurpose === 'family') {
    if (option.familyFriendly === true) score += 30
    if (option.amenities && option.amenities.includes('kids-club')) score += 15
  } else if (req.travelPurpose === 'honeymoon') {
    if (option.hotelStars && option.hotelStars >= 4) score += 25
    if (option.amenities && (option.amenities.includes('spa') || option.amenities.includes('pool'))) score += 15
  } else if (req.travelPurpose === 'business') {
    if (option.cabin === 'business' || option.cabin === 'first') score += 25
    if (option.amenities && option.amenities.includes('wifi')) score += 10
    if (option.directFlight === true) score += 10
  } else if (req.travelPurpose === 'adventure') {
    if (option.activityType === 'adventure' || option.activityType === 'outdoor') score += 30
    if (option.amenities && option.amenities.includes('parking')) score += 8
  } else if (req.travelPurpose === 'vacation') {
    if (option.hotelStars && option.hotelStars >= 3) score += 15
    if (option.amenities && option.amenities.includes('pool')) score += 10
  }
  return clampScore(score)
}

function scorePreferenceMatch(option: ScoreableOption, req: TravelSearchRequest): number {
  let score = 50
  let checks = 0
  let matched = 0

  if (req.preferredCabin) {
    checks++
    if (option.cabin === req.preferredCabin) matched++
  }
  if (req.directFlightPreferred && req.directFlightPreferred !== 'any') {
    checks++
    if (req.directFlightPreferred === 'direct-only' && option.directFlight === true) matched++
    else if (req.directFlightPreferred === 'direct-preferred' && option.directFlight === true) matched++
  }
  if (req.hotelStars > 0 && option.hotelStars !== undefined) {
    checks++
    if (option.hotelStars >= req.hotelStars) matched++
  }
  if (req.preferredAirlines.length > 0 && option.airline) {
    checks++
    if (req.preferredAirlines.some(a => a.toLowerCase() === option.airline!.toLowerCase())) matched++
  }
  if (req.avoidAirlines.length > 0 && option.airline) {
    checks++
    if (!req.avoidAirlines.some(a => a.toLowerCase() === option.airline!.toLowerCase())) matched++
  }
  if (req.familyFriendly && option.familyFriendly !== undefined) {
    checks++
    if (option.familyFriendly === true) matched++
  }
  if (req.breakfastRequired && option.breakfastIncluded !== undefined) {
    checks++
    if (option.breakfastIncluded === true) matched++
  }
  if (req.freeCancellation && option.freeCancellation !== undefined) {
    checks++
    if (option.freeCancellation === true) matched++
  }
  if (req.preferredArea && option.area) {
    checks++
    if (option.area.toLowerCase().includes(req.preferredArea.toLowerCase())) matched++
  }
  if (req.hotelAmenities.length > 0 && option.amenities) {
    const reqSet = new Set(req.hotelAmenities)
    const optSet = new Set(option.amenities)
    const overlap = [...reqSet].filter(a => optSet.has(a)).length
    if (reqSet.size > 0) {
      checks++
      matched += overlap / reqSet.size
    }
  }

  if (checks === 0) return 55
  score = (matched / checks) * 100
  return clampScore(score)
}

// ── Category metadata ──────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<ScoreCategory, string> = {
  price: 'السعر',
  comfort: 'الراحة',
  travelTime: 'وقت السفر',
  familySuitability: 'ملاءمة العائلة',
  luxury: 'الفخامة',
  destinationMatch: 'مطابقة الوجهة',
  purposeMatch: 'مطابقة الغرض',
  preferenceMatch: 'مطابقة التفضيلات',
}

// ── Confidence calculation ─────────────────────────────────────────────────

function calculateConfidence(req: TravelSearchRequest, scores: CategoryScores): number {
  const totalKnown = req.highConfidence.length + req.mediumConfidence.length + req.lowConfidence.length
  if (totalKnown === 0) return 30
  const weighted =
    req.highConfidence.length * 1.0 +
    req.mediumConfidence.length * 0.6 +
    req.lowConfidence.length * 0.3
  const base = (weighted / totalKnown) * 70

  const scoreVariance = Object.values(scores).reduce((acc, s) => acc + Math.abs(s - 50), 0) / 8
  const stabilityBonus = Math.max(0, 20 - scoreVariance / 5)

  return clampScore(base + stabilityBonus + 10)
}

// ── Recommendation level ───────────────────────────────────────────────────

function recommendationFromScore(score: number): RecommendationLevel {
  if (score >= 85) return 'excellent'
  if (score >= 70) return 'recommended'
  if (score >= 50) return 'acceptable'
  return 'not-recommended'
}

// ── Reason generation ──────────────────────────────────────────────────────

function buildReasons(details: CategoryScoreDetail[], req: TravelSearchRequest): string[] {
  const reasons: string[] = []
  const sorted = [...details].sort((a, b) => b.weightedScore - a.weightedScore)

  const top = sorted[0]
  if (top && top.score >= 75) {
    reasons.push(`نقطة قوة: ${CATEGORY_LABELS[top.category]} (${top.score}/100)`)
  }
  const bottom = sorted[sorted.length - 1]
  if (bottom && bottom.score < 50) {
    reasons.push(`نقطة ضعف: ${CATEGORY_LABELS[bottom.category]} (${bottom.score}/100)`)
  }
  if (req.travelers.children > 0) {
    const fam = details.find(d => d.category === 'familySuitability')
    if (fam && fam.score >= 70) {
      reasons.push('خيار مناسب للسفر مع الأطفال')
    } else if (fam && fam.score < 50) {
      reasons.push('قد لا يكون مناسباً للأطفال')
    }
  }
  if (req.budgetPriority === 'lowest-price') {
    const price = details.find(d => d.category === 'price')
    if (price && price.score >= 75) {
      reasons.push('سعر ضمن الميزانية')
    }
  }
  return Array.from(new Set(reasons))
}

// ── Main scoring function ──────────────────────────────────────────────────

export function scoreOption(
  option: ScoreableOption,
  req: TravelSearchRequest,
): FinalDecisionScore {
  const weights = deriveWeights(req)

  const rawScores: CategoryScores = {
    price: scorePrice(option, req),
    comfort: scoreComfort(option, req),
    travelTime: scoreTravelTime(option, req),
    familySuitability: scoreFamilySuitability(option, req),
    luxury: scoreLuxury(option, req),
    destinationMatch: scoreDestinationMatch(option, req),
    purposeMatch: scorePurposeMatch(option, req),
    preferenceMatch: scorePreferenceMatch(option, req),
  }

  const categories: CategoryScoreDetail[] = (Object.keys(rawScores) as ScoreCategory[]).map(cat => {
    const score = rawScores[cat]
    const weight = weights[cat]
    return {
      category: cat,
      score,
      weight,
      weightedScore: score * weight,
      reason: '',
    }
  })

  const totalWeight = categories.reduce((acc, c) => acc + c.weight, 0)
  const weightedSum = categories.reduce((acc, c) => acc + c.weightedScore, 0)
  const weightedAverage = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0

  const confidence = calculateConfidence(req, rawScores)
  const reasons = buildReasons(categories, req)
  const recommendation = recommendationFromScore(weightedAverage)

  return {
    categories,
    weightedAverage,
    confidence,
    reasons,
    recommendation,
  }
}

// ── Batch scoring helper ───────────────────────────────────────────────────

export interface ScoredOption {
  option: ScoreableOption
  score: FinalDecisionScore
}

export function scoreOptions(
  options: ScoreableOption[],
  req: TravelSearchRequest,
): ScoredOption[] {
  return options
    .map(option => ({ option, score: scoreOption(option, req) }))
    .sort((a, b) => b.score.weightedAverage - a.score.weightedAverage)
}
