/**
 * Integration Sprint 5 — destination matching / scoring / recommendations.
 */

import type { TripRequirements } from '../types'
import { DESTINATION_KNOWLEDGE, themesFromRequirements } from './knowledge'
import type {
  DestinationKnowledge,
  DestinationMatchReason,
  DestinationRecommendation,
  DestinationTheme,
} from './types'
import { createMockWeatherProvider } from './weather'
import { estimateDestinationCost } from './cost'
import { createMockLocalTransportProvider } from './transport'

const weatherProvider = createMockWeatherProvider()
const transportProvider = createMockLocalTransportProvider()

function monthFromRequirements(requirements: TripRequirements): number {
  const raw = requirements.startDate ?? ''
  const month = Number(raw.slice(5, 7))
  if (Number.isFinite(month) && month >= 1 && month <= 12) return month
  return new Date().getUTCMonth() + 1
}

function purposeBoost(themes: DestinationTheme[], knowledge: DestinationKnowledge): number {
  let boost = 0
  for (const theme of themes) {
    if (knowledge.themes.includes(theme)) boost += 12
  }
  return Math.min(40, boost)
}

function budgetFit(requirements: TripRequirements, knowledge: DestinationKnowledge): number {
  const amount = requirements.budgetAmount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    if (requirements.budgetStyle === 'luxury' && knowledge.themes.includes('luxury')) return 90
    if (requirements.budgetStyle === 'budget' && knowledge.dailyBudgetSar.low <= 500) return 88
    return 70
  }
  const estimate = estimateDestinationCost(knowledge, requirements)
  const tripTotal = estimate.tripTotal ?? estimate.dailyTotal * Math.max(1, estimate.nights)
  // Local spend is only part of trip; leave headroom for flights/hotels (~55%).
  const localCeiling = amount * 0.45
  const ratio = tripTotal / Math.max(1, localCeiling)
  if (ratio <= 0.75) return 95
  if (ratio <= 1.0) return 85
  if (ratio <= 1.25) return 65
  if (ratio <= 1.6) return 40
  return 20
}

function weatherFit(requirements: TripRequirements, knowledge: DestinationKnowledge): number {
  const month = monthFromRequirements(requirements)
  if (knowledge.seasonality.bestMonths.includes(month)) return 95
  if (knowledge.seasonality.avoidMonths.includes(month)) return 35
  return 65
}

function familyFit(requirements: TripRequirements, knowledge: DestinationKnowledge): number {
  const kids = requirements.children ?? 0
  const familySignal =
    kids > 0
    || requirements.tripPurpose === 'family'
    || requirements.travelerType === 'family'
  if (!familySignal) return 70
  if (knowledge.themes.includes('family')) return 95
  if (knowledge.themes.includes('beach') || knowledge.themes.includes('culture')) return 72
  return 42
}

function businessFit(requirements: TripRequirements, knowledge: DestinationKnowledge): number {
  if (requirements.tripPurpose !== 'business' && requirements.travelerType !== 'business') return 70
  if (knowledge.themes.includes('business')) return 95
  return 38
}

function luxuryFit(requirements: TripRequirements, knowledge: DestinationKnowledge): number {
  const luxurySignal =
    requirements.budgetStyle === 'luxury'
    || (typeof requirements.budgetAmount === 'number' && requirements.budgetAmount >= 20000)
    || requirements.interests.some((i) => /luxury|رفاه/i.test(i))
  if (!luxurySignal) return 70
  if (knowledge.themes.includes('luxury')) return 95
  if (knowledge.dailyBudgetSar.high >= 1200) return 75
  return 40
}

function themeFit(themes: DestinationTheme[], knowledge: DestinationKnowledge): number {
  if (themes.length === 0) return 60
  const hits = themes.filter((t) => knowledge.themes.includes(t)).length
  return Math.min(100, 45 + hits * 18 + purposeBoost(themes, knowledge) * 0.5)
}

export function scoreDestination(
  knowledge: DestinationKnowledge,
  requirements: TripRequirements,
  themes: DestinationTheme[],
): { score: number; reasons: DestinationMatchReason[] } {
  const parts = {
    budget: budgetFit(requirements, knowledge),
    weather: weatherFit(requirements, knowledge),
    purpose: themeFit(themes, knowledge),
    family: familyFit(requirements, knowledge),
    business: businessFit(requirements, knowledge),
    luxury: luxuryFit(requirements, knowledge),
  }
  const score = Math.round(
    parts.budget * 0.22
      + parts.weather * 0.18
      + parts.purpose * 0.22
      + parts.family * 0.14
      + parts.business * 0.12
      + parts.luxury * 0.12,
  )
  const reasons: DestinationMatchReason[] = [
    { code: 'budget', labelEn: 'Budget fit', labelAr: 'ملاءمة الميزانية', weight: parts.budget },
    { code: 'weather', labelEn: 'Weather window', labelAr: 'نافذة الطقس', weight: parts.weather },
    { code: 'purpose', labelEn: 'Purpose / themes', labelAr: 'الغرض والاهتمامات', weight: parts.purpose },
    { code: 'family', labelEn: 'Family fit', labelAr: 'ملاءمة عائلية', weight: parts.family },
    { code: 'business', labelEn: 'Business fit', labelAr: 'ملاءمة أعمال', weight: parts.business },
    { code: 'luxury', labelEn: 'Luxury fit', labelAr: 'ملاءمة رفاهية', weight: parts.luxury },
  ].sort((a, b) => b.weight - a.weight)
  return { score: Math.min(100, score), reasons }
}

function buildWhy(
  knowledge: DestinationKnowledge,
  score: number,
  themes: DestinationTheme[],
): { whyEn: string; whyAr: string } {
  const matched = themes.filter((t) => knowledge.themes.includes(t))
  const themeEn = matched.length > 0
    ? `matches your interest in ${matched.slice(0, 2).join(' & ')}`
    : knowledge.seasonality.noteEn
  const themeAr = matched.length > 0
    ? `يتماشى مع اهتمامك بـ ${matched.slice(0, 2).join(' و')}`
    : knowledge.seasonality.noteAr
  return {
    whyEn: `${knowledge.nameEn} (${score}/100): ${themeEn}. Best months: ${knowledge.seasonality.bestMonths.join(', ')}.`,
    whyAr: `${knowledge.nameAr} (${score}/100): ${themeAr}. أفضل الأشهر: ${knowledge.seasonality.bestMonths.join('، ')}.`,
  }
}

export async function buildRecommendation(
  knowledge: DestinationKnowledge,
  requirements: TripRequirements,
  themes?: DestinationTheme[],
): Promise<DestinationRecommendation> {
  const queryThemes = themes ?? themesFromRequirements({
    interests: requirements.interests,
    tripPurpose: requirements.tripPurpose,
    travelerType: requirements.travelerType,
    budgetStyle: requirements.budgetStyle,
    weatherPreference: requirements.weatherPreference,
  })
  const { score, reasons } = scoreDestination(knowledge, requirements, queryThemes)
  const month = monthFromRequirements(requirements)
  const [weather, transport] = await Promise.all([
    weatherProvider.getWeather({ destination: knowledge, month }),
    transportProvider.getOptions(knowledge),
  ])
  const cost = estimateDestinationCost(knowledge, requirements)
  const why = buildWhy(knowledge, score, queryThemes)
  return {
    knowledge,
    score,
    reasons,
    whyEn: why.whyEn,
    whyAr: why.whyAr,
    bestMonthsNoteEn: knowledge.seasonality.noteEn,
    bestMonthsNoteAr: knowledge.seasonality.noteAr,
    weather,
    transport,
    cost,
  }
}

export async function recommendDestinations(
  requirements: TripRequirements,
  limit = 3,
): Promise<DestinationRecommendation[]> {
  const themes = themesFromRequirements({
    interests: requirements.interests,
    tripPurpose: requirements.tripPurpose,
    travelerType: requirements.travelerType,
    budgetStyle: requirements.budgetStyle,
    weatherPreference: requirements.weatherPreference,
  })
  const ranked = await Promise.all(
    DESTINATION_KNOWLEDGE.map((k) => buildRecommendation(k, requirements, themes)),
  )
  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, limit))
}

export { monthFromRequirements }
