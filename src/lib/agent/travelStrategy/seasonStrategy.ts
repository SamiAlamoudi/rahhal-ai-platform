/**
 * Evolution Sprint 8 — season / weather / crowd / holiday / visa timing signals.
 */

import { clampScore, type TravelStrategyContext } from './strategyTypes'

export function evaluateSeasonStrategy(ctx: TravelStrategyContext): {
  goNowOrLater: 'now' | 'later' | 'either' | 'unknown'
  weatherScore: number
  crowdScore: number
  notes: string[]
  missing: string[]
} {
  const notes: string[] = []
  const missing: string[] = []
  const month = ctx.monthHint
  const priors = ctx.destinationPriors

  if (typeof month !== 'number') {
    missing.push('month_hint')
    return {
      goNowOrLater: 'unknown',
      weatherScore: 50,
      crowdScore: 50,
      notes: ['Travel month unknown — season strategy provisional.'],
      missing,
    }
  }

  let weatherScore = 55
  let crowdScore = 55
  let goNowOrLater: 'now' | 'later' | 'either' | 'unknown' = 'either'

  if (priors?.bestSeasons?.includes(month)) {
    weatherScore = 88
    goNowOrLater = 'now'
    notes.push(`Month ${month} is among destination best-season priors.`)
  } else if (priors?.worstSeasons?.includes(month)) {
    weatherScore = 28
    goNowOrLater = 'later'
    notes.push(`Month ${month} is among destination worst-season priors — consider later.`)
  } else if (priors) {
    weatherScore = 60
    notes.push(`Month ${month} is neither peak-best nor worst in known priors.`)
  } else {
    missing.push('destination_season_priors')
    notes.push('No destination season priors supplied — cannot firmly time the trip.')
  }

  if (priors?.crowdByMonth && priors.crowdByMonth[month - 1]) {
    const crowd = priors.crowdByMonth[month - 1]!
    if (crowd === 'peak' || crowd === 'high') {
      crowdScore = 35
      notes.push(`Crowd prior for month ${month}: ${crowd}.`)
      if (goNowOrLater === 'now') goNowOrLater = 'either'
    } else if (crowd === 'low') {
      crowdScore = 85
      notes.push(`Lower crowd prior for month ${month}.`)
    } else {
      crowdScore = 60
    }
  } else if (!missing.includes('destination_season_priors')) {
    missing.push('crowd_by_month')
  }

  if (priors?.climateByMonth?.[month - 1]) {
    const climate = priors.climateByMonth[month - 1]!
    notes.push(`Climate prior for month ${month}: ${climate}.`)
    if (climate === 'hot' || climate === 'rainy') weatherScore = Math.min(weatherScore, 40)
    if (climate === 'mild') weatherScore = Math.max(weatherScore, 75)
  }

  return {
    goNowOrLater,
    weatherScore: clampScore(weatherScore),
    crowdScore: clampScore(crowdScore),
    notes,
    missing,
  }
}

export function evaluateHolidayImpact(ctx: TravelStrategyContext): {
  score: number
  notes: string[]
  missing: string[]
} {
  const missing: string[] = ['public_holiday_calendar']
  return {
    score: 50,
    notes: [
      'Public holiday calendar not supplied — holiday impact unknown (not invented).',
      ...(typeof ctx.monthHint === 'number'
        ? [`Month ${ctx.monthHint} may overlap regional holidays — confirm before locking.`]
        : []),
    ],
    missing,
  }
}

export function evaluateVisaTiming(ctx: TravelStrategyContext): {
  score: number
  notes: string[]
  missing: string[]
  preferLater: boolean
} {
  const visa = ctx.destinationPriors?.visaComplexity
  if (!visa) {
    return {
      score: 50,
      notes: ['Visa complexity unknown — timing advice provisional.'],
      missing: ['visa_complexity'],
      preferLater: false,
    }
  }
  if (visa === 'complex') {
    return {
      score: 40,
      notes: [
        'Complex visa prior — allow processing buffer; rushing "go now" may raise risk.',
      ],
      missing: [],
      preferLater: true,
    }
  }
  if (visa === 'easy') {
    return {
      score: 80,
      notes: ['Easy visa prior — timing less constrained by paperwork.'],
      missing: [],
      preferLater: false,
    }
  }
  return {
    score: 60,
    notes: [`Visa complexity prior: ${visa}.`],
    missing: [],
    preferLater: false,
  }
}

export function evaluateWeatherImpact(ctx: TravelStrategyContext) {
  return evaluateSeasonStrategy(ctx)
}

export function evaluateCrowdImpact(ctx: TravelStrategyContext) {
  return evaluateSeasonStrategy(ctx)
}

export const SeasonStrategy = { evaluate: evaluateSeasonStrategy }
export const WeatherImpact = { evaluate: evaluateWeatherImpact }
export const CrowdImpact = { evaluate: evaluateCrowdImpact }
export const HolidayImpact = { evaluate: evaluateHolidayImpact }
export const VisaTiming = { evaluate: evaluateVisaTiming }
