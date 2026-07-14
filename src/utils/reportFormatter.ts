import type { NormalizedTravelOption } from './searchOrchestrator'
import type { ReasoningResult, ReasoningItem, ReasoningSection } from './reasoningEngine'
import type { FinalDecisionScore, ScoreCategory } from './decisionScoreEngine'

export interface RecommendationReportData {
  option: NormalizedTravelOption
  reasoning: ReasoningResult
}

export interface StarRating {
  stars: number
  label: string
}

const TYPE_LABELS: Record<string, string> = {
  flight: 'رحلة طيران',
  hotel: 'فندق',
  activity: 'نشاط',
  transportation: 'مواصلات',
}

const REC_LABELS: Record<string, string> = {
  excellent: 'ممتاز',
  recommended: 'موصى به',
  acceptable: 'مقبول',
  'not-recommended': 'غير موصى به',
}

const REC_STAR_COLORS: Record<string, string> = {
  excellent: 'text-amber-400',
  recommended: 'text-emerald-400',
  acceptable: 'text-sky-400',
  'not-recommended': 'text-rose-400',
}

export function scoreToStars(score: number): StarRating {
  if (score >= 90) return { stars: 5, label: 'ممتاز' }
  if (score >= 75) return { stars: 4, label: 'جيد جداً' }
  if (score >= 60) return { stars: 3, label: 'جيد' }
  if (score >= 45) return { stars: 2, label: 'مقبول' }
  return { stars: 1, label: 'ضعيف' }
}

function starsString(stars: number): string {
  return '★'.repeat(stars) + '☆'.repeat(5 - stars)
}

export function formatStars(rating: StarRating): { visual: string; label: string } {
  return { visual: starsString(rating.stars), label: rating.label }
}

function getCategoryScore(score: FinalDecisionScore | null, cat: ScoreCategory): number {
  if (!score) return 0
  return score.categories.find(c => c.category === cat)?.score ?? 0
}

function formatItemArabic(item: ReasoningItem): string {
  const p = item.params
  switch (item.key) {
    case 'recommendation.excellent':
      return `خيار ممتاز بنتيجة ${p.score}/100`
    case 'recommendation.recommended':
      return `خيار موصى به بنتيجة ${p.score}/100`
    case 'recommendation.acceptable':
      return `خيار مقبول بنتيجة ${p.score}/100`
    case 'recommendation.not-recommended':
      return `خيار غير موصى به بنتيجة ${p.score}/100`
    case 'recommendation.withinBudget':
      return `ضمن ميزانيتك (يوفّر ≈${p.percentage}%)`
    case 'recommendation.directFlight':
      return 'رحلة مباشرة بدون توقفات'
    case 'recommendation.oneStop':
      return 'توقف واحد فقط'
    case 'recommendation.shorterThanAverage':
      return `مدة السفر أقصر من المتوسط (${p.hours} ساعات)`
    case 'recommendation.excellentForFamilies':
      return 'ممتاز للعائلات'
    case 'recommendation.matchesPurpose':
      return `يطابق غرض السفر: ${p.purpose}`
    case 'recommendation.savesPercentage':
      return `يوفّر حوالي ${p.percentage}% مقارنة بالميزانية`
    case 'strengths.price.high':
      return `السعر ممتاز (${p.score}/100)`
    case 'strengths.comfort.high':
      return `مستوى الراحة عالي (${p.score}/100)`
    case 'strengths.travelTime.high':
      return `وقت السفر ممتاز (${p.score}/100)`
    case 'strengths.familySuitability.high':
      return `ملاءمة العائلة عالية (${p.score}/100)`
    case 'strengths.luxury.high':
      return `مستوى الفخامة عالي (${p.score}/100)`
    case 'strengths.destinationMatch.high':
      return `مطابقة الوجهة ممتازة (${p.score}/100)`
    case 'strengths.purposeMatch.high':
      return `مطابقة الغرض عالية (${p.score}/100)`
    case 'strengths.preferenceMatch.high':
      return `مطابقة التفضيلات عالية (${p.score}/100)`
    case 'strengths.flight.direct':
      return 'رحلة مباشرة بدون توقفات'
    case 'strengths.cancellation.free':
      return 'إلغاء مجاني متاح'
    case 'strengths.rating.high':
      return `تقييم عالي (${p.rating}/5)`
    case 'weaknesses.price.low':
      return `السعر ضعيف (${p.score}/100)`
    case 'weaknesses.comfort.low':
      return `مستوى الراحة منخفض (${p.score}/100)`
    case 'weaknesses.travelTime.low':
      return `وقت السفر طويل (${p.score}/100)`
    case 'weaknesses.familySuitability.low':
      return `ملاءمة العائلة منخفضة (${p.score}/100)`
    case 'weaknesses.luxury.low':
      return `مستوى الفخامة منخفض (${p.score}/100)`
    case 'weaknesses.destinationMatch.low':
      return `مطابقة الوجهة ضعيفة (${p.score}/100)`
    case 'weaknesses.purposeMatch.low':
      return `مطابقة الغرض ضعيفة (${p.score}/100)`
    case 'weaknesses.preferenceMatch.low':
      return `مطابقة التفضيلات ضعيفة (${p.score}/100)`
    case 'weaknesses.flight.multipleStops':
      return `${p.stops} توقفات`
    case 'weaknesses.cancellation.none':
      return 'لا يوجد إلغاء مجاني'
    case 'weaknesses.family.notFriendly':
      return 'غير مناسب للعائلات'
    case 'warning.overBudget':
      return `يتجاوز الميزانية بـ ${p.amount} ${p.currency}`
    case 'warning.nonRefundable':
      return 'غير قابل للاسترداد'
    case 'warning.notFamilyFriendly':
      return 'غير مناسب للأطفال'
    case 'warning.manyStopsWithKids':
      return `${p.stops} توقفات مع أطفال قد تكون مرهقة`
    case 'warning.lowRating':
      return `تقييم منخفض (${p.rating}/5)`
    case 'warning.noBaggage':
      return 'لا يشمل الأمتعة'
    case 'warning.lowConfidence':
      return `مستوى ثقة منخفض (${p.confidence}/100)`
    case 'warning.lowComfort':
      return `مستوى راحة منخفض (${p.score}/100)`
    default:
      return ''
  }
}

function sectionToTexts(section: ReasoningSection): string[] {
  return section.items.map(formatItemArabic).filter(s => s.length > 0)
}

function summaryToTexts(items: ReasoningItem[]): string[] {
  return items.map(formatItemArabic).filter(s => s.length > 0)
}

export interface OptionReportSection {
  title: string
  lines: string[]
}

export interface OptionReport {
  optionId: string
  optionTitle: string
  optionType: string
  typeLabel: string
  price: number
  currency: string
  rating: number | null
  overallScore: number
  overallStars: StarRating
  recommendationLabel: string
  recommendationColor: string
  whyRahhalRecommends: string[]
  advantages: string[]
  disadvantages: string[]
  bestSuitedFor: string[]
  budgetSuitability: StarRating
  budgetSuitabilityText: string[]
  comfortLevel: StarRating
  comfortText: string[]
  timeEfficiency: StarRating
  timeText: string[]
  overallValue: StarRating
  overallValueText: string[]
  whyNotOthers: string
}

function buildBestSuitedFor(option: NormalizedTravelOption, reasoning: ReasoningResult): string[] {
  const out: string[] = []
  const score = option.decisionScore
  if (!score) return out

  if (getCategoryScore(score, 'familySuitability') >= 75) {
    out.push('العائلات مع أطفال')
  }
  if (getCategoryScore(score, 'luxury') >= 75) {
    out.push('الباحثين عن الفخامة والرقي')
  }
  if (getCategoryScore(score, 'price') >= 80) {
    out.push('من يبحث عن أفضل قيمة مقابل السعر')
  }
  if (getCategoryScore(score, 'purposeMatch') >= 75) {
    const purpose = reasoning.purposeMatch.items[0]?.key
    if (purpose?.includes('family')) out.push('رحلات العائلة')
    else if (purpose?.includes('business')) out.push('رحلات العمل')
    else if (purpose?.includes('honeymoon')) out.push('شهر العسل')
    else if (purpose?.includes('adventure')) out.push('المغامرين')
    else if (purpose?.includes('vacation')) out.push('الرحلات السياحية')
  }
  if (getCategoryScore(score, 'comfort') >= 75) {
    out.push('من يفضّل الراحة والاسترخاء')
  }
  if (out.length === 0) {
    out.push('المسافرين الذين يوازنون بين السعر والجودة')
  }
  return Array.from(new Set(out))
}

export function buildOptionReport(data: RecommendationReportData): OptionReport {
  const { option, reasoning } = data
  const score = option.decisionScore
  const overallScore = score?.weightedAverage ?? 0
  const overallStars = scoreToStars(overallScore)

  const recKey = score?.recommendation ?? 'acceptable'
  const recLabel = REC_LABELS[recKey] ?? 'مقبول'
  const recColor = REC_STAR_COLORS[recKey] ?? REC_STAR_COLORS.acceptable

  const whyRecommends = summaryToTexts(reasoning.recommendationSummary)
  if (whyRecommends.length === 0) {
    whyRecommends.push(`${recLabel} بنتيجة ${overallScore}/100`)
  }

  const advantages = sectionToTexts(reasoning.strengths)
  const disadvantages = [
    ...sectionToTexts(reasoning.weaknesses),
    ...sectionToTexts(reasoning.riskWarnings),
  ]

  const bestSuitedFor = buildBestSuitedFor(option, reasoning)

  const priceScore = getCategoryScore(score, 'price')
  const comfortScore = getCategoryScore(score, 'comfort')
  const timeScore = getCategoryScore(score, 'travelTime')

  const budgetSuitability = scoreToStars(priceScore)
  const comfortLevel = scoreToStars(comfortScore)
  const timeEfficiency = scoreToStars(timeScore)
  const overallValue = overallStars

  return {
    optionId: option.id,
    optionTitle: option.title,
    optionType: option.type,
    typeLabel: TYPE_LABELS[option.type] ?? option.type,
    price: option.price,
    currency: option.currency,
    rating: option.rating,
    overallScore,
    overallStars,
    recommendationLabel: recLabel,
    recommendationColor: recColor,
    whyRahhalRecommends: whyRecommends,
    advantages: advantages.slice(0, 5),
    disadvantages: disadvantages.slice(0, 3),
    bestSuitedFor,
    budgetSuitability,
    budgetSuitabilityText: sectionToTexts(reasoning.budgetAnalysis).slice(0, 2),
    comfortLevel,
    comfortText: sectionToTexts(reasoning.comfortAnalysis).slice(0, 2),
    timeEfficiency,
    timeText: sectionToTexts(reasoning.travelTimeAnalysis).slice(0, 2),
    overallValue,
    overallValueText: whyRecommends.slice(0, 2),
    whyNotOthers: '',
  }
}

export function buildWhyNotOthers(
  ranked: OptionReport[],
  currentIndex: number,
): string {
  if (ranked.length <= 1) return ''
  const current = ranked[currentIndex]
  const others = ranked.filter((_, i) => i !== currentIndex)
  if (others.length === 0) return ''

  const scoreDiff = (other: OptionReport) => current.overallScore - other.overallScore

  const better = others.filter(o => scoreDiff(o) > 0)
  const worse = others.filter(o => scoreDiff(o) < 0)

  const lines: string[] = []

  if (better.length > 0) {
    const closest = better.reduce((best, o) =>
      scoreDiff(o) < scoreDiff(best) ? o : best
    )
    const diff = scoreDiff(closest)
    lines.push(
      `تفوّق هذا الخيار على "${closest.optionTitle}" بفارق ${diff} نقطة في التقييم الإجمالي.`
    )
  }

  if (worse.length > 0) {
    const next = worse.reduce((top, o) =>
      scoreDiff(o) > scoreDiff(top) ? o : top
    )
    const diff = Math.abs(scoreDiff(next))
    lines.push(
      `الخيار الأقرب من حيث الجودة هو "${next.optionTitle}" (${next.overallScore}/100)، لكنه يتفوّق بـ ${diff} نقطة.`
    )

    const lower = worse.filter(o => Math.abs(scoreDiff(o)) >= 15)
    if (lower.length > 0) {
      const names = lower.map(o => `"${o.optionTitle}"`).join('، ')
      lines.push(
        `الخيارات الأخرى (${names}) أقل ملاءمة بفارق كبير في النقاط.`
      )
    }
  }

  if (lines.length === 0) return ''
  return lines.join(' ')
}

export function buildFullReport(
  rankedOptions: NormalizedTravelOption[],
  reasoningMap: Map<string, ReasoningResult>,
): OptionReport[] {
  const reports: OptionReport[] = rankedOptions.map(option => {
    const reasoning = reasoningMap.get(option.id)
    if (!reasoning) return null
    return buildOptionReport({ option, reasoning })
  }).filter((r): r is OptionReport => r !== null)

  for (let i = 0; i < reports.length; i++) {
    reports[i] = { ...reports[i], whyNotOthers: buildWhyNotOthers(reports, i) }
  }

  return reports
}
