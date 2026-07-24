/**
 * Evolution Sprint 6 — Impact assessments from known fields only.
 */

import type { ImpactAssessment, RecommendationCandidate } from './recommendationTypes'

export function assessImpacts(c: RecommendationCandidate): ImpactAssessment {
  const budgetImpact: string[] = []
  const comfortImpact: string[] = []
  const timeImpact: string[] = []
  const travelQualityImpact: string[] = []

  if (typeof c.budget?.amount === 'number') {
    budgetImpact.push(
      `Budget signal ${c.budget.amount}${c.budget.currency ? ` ${c.budget.currency}` : ''} frames spend expectations.`,
    )
    if (c.budget.stance === 'strict') {
      budgetImpact.push('Strict stance — treat amount as a ceiling until relaxed.')
    } else if (c.budget.stance === 'flexible' || c.budget.stance === 'value_seeking') {
      budgetImpact.push('Flexible/value stance — may stretch for clear quality gains.')
    }
  } else {
    budgetImpact.push('Budget amount unknown — budget impact cannot be quantified yet.')
  }

  const riskTol = c.travelerProfile?.riskTolerance
  const pace = c.travelerProfile?.pace
  if (pace === 'relaxed') {
    comfortImpact.push('Relaxed pace supports comfort-first days.')
  } else if (pace === 'packed') {
    comfortImpact.push('Packed pace may reduce recovery comfort.')
  }
  if (riskTol === 'low') {
    comfortImpact.push('Low risk tolerance favors lower-friction logistics.')
  }
  if (!comfortImpact.length) {
    comfortImpact.push('Comfort preferences not fully stated — impact provisional.')
  }

  if (typeof c.dates?.durationDays === 'number') {
    timeImpact.push(`Trip length ${c.dates.durationDays} days shapes daily density.`)
  } else {
    timeImpact.push('Duration unknown — time impact remains open.')
  }
  if (c.dates?.flexible) {
    timeImpact.push('Flexible dates can reduce schedule pressure.')
  }

  if (c.destinations?.length) {
    travelQualityImpact.push(`Destination focus on ${c.destinations.join(', ')} anchors experience quality.`)
  } else {
    travelQualityImpact.push('No destination locked — quality assessment waits on direction.')
  }
  if (c.travelerProfile?.purpose) {
    travelQualityImpact.push(`Purpose "${c.travelerProfile.purpose}" defines quality criteria.`)
  }

  return { budgetImpact, comfortImpact, timeImpact, travelQualityImpact }
}

export const ImpactAnalyzer = { assess: assessImpacts }
