/**
 * Evolution Sprint 8 — Travel Strategy Intelligence Layer (additive).
 * Default OFF via `ai.travel_strategy`. Not wired into planTurn.
 * Does NOT choose destinations — optimizes HOW to travel.
 */

export type {
  StrategyLocale,
  StrategyKind,
  StrategyScores,
  StrategyEvidenceItem,
  TravelStrategyContext,
  TravelStrategyOption,
  TravelStrategyResult,
} from './strategyTypes'

export {
  clamp01,
  clampScore,
  isoNow,
  newId,
  uniqueStrings,
  emptyScores,
} from './strategyTypes'

export {
  TRAVEL_STRATEGY_FEATURE_ID,
  isTravelStrategyEnabled,
} from './strategyRegistry'

export { StrategyScoring, withOverall, contextConfidence, scoreOverallValue } from './strategyScoring'
export { StrategyFormatter, formatStrategyBrief, formatStrategyResult } from './strategyFormatter'

export { SeasonStrategy, evaluateSeasonStrategy } from './seasonStrategy'
export { WeatherImpact, evaluateWeatherImpact } from './weatherImpact'
export { CrowdImpact, evaluateCrowdImpact } from './crowdImpact'
export { VisaTiming, evaluateVisaTiming } from './visaTiming'
export { HolidayImpact, evaluateHolidayImpact } from './holidayImpact'

export { BudgetStrategy, evaluateBudgetStrategy, ComfortCostStrategy } from './budgetStrategy'
export { OpportunityCost, evaluateOpportunityCost } from './opportunityCost'

export { TravelTiming, evaluateTravelTiming } from './travelTiming'
export { StayDurationOptimizer, optimizeStayDuration } from './stayDurationOptimizer'
export { FlightTimingStrategy, evaluateFlightTiming } from './flightTimingStrategy'
export { HotelTimingStrategy, evaluateHotelTiming } from './hotelTimingStrategy'
export { CitySplitStrategy, evaluateCitySplit } from './citySplitStrategy'
export { RouteOptimizer, evaluateRouteOptimizer } from './routeOptimizer'
export { TravelRiskStrategy, evaluateTravelRisk } from './travelRiskStrategy'

export {
  TravelStrategyEngine,
  runTravelStrategyEngine,
  tryRunTravelStrategyEngine,
} from './travelStrategyEngine'
