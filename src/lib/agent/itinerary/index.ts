/**
 * Sprint 114 — Intelligent Itinerary Engine barrel.
 */

export {
  SPRINT114_ITINERARY_ENGINE_VERSION,
  type TripStyleKind,
  type DayPart,
  type ItineraryBlockKind,
  type ItineraryConflictKind,
  type ItineraryCityStay,
  type ItineraryEngineInput,
  type ItineraryTimeBlock,
  type ItineraryDayPlan,
  type ItineraryConflict,
  type ItineraryScores,
  type ItineraryExplanation,
  type ItineraryMetadata,
  type ItineraryEngineResult,
  type ItineraryLogEntry,
  type ItineraryStructuredLogger,
  createSilentItineraryLogger,
  minutesToLabel,
  dayPartForMinutes,
  parseTimeToMinutes,
  addDays,
  daysBetween,
  eachDateInclusive,
} from './types'

export {
  ITINERARY_ENGINE_FEATURE_ID,
  isItineraryEngineEnabled,
} from './feature'

export {
  normalizeItineraryContext,
  planDays,
  hotelNights,
  DayPlanner,
  createDayPlanner,
  type NormalizedItineraryContext,
} from './DayPlanner'

export {
  planTransfers,
  planCheckInOut,
  planMeals,
  allocateActivities,
  planInterCityTransfer,
  TransferPlanner,
  CheckInPlanner,
  MealPlanner,
  ActivityAllocator,
  createTransferPlanner,
  createCheckInPlanner,
  createMealPlanner,
  createActivityAllocator,
} from './TransferPlanner'

export {
  planCheckInOut as planHotelCheckInOut,
  CheckInPlanner as HotelCheckInPlanner,
  createCheckInPlanner as createHotelCheckInPlanner,
} from './CheckInPlanner'

export {
  planMeals as planItineraryMeals,
  MealPlanner as ItineraryMealPlanner,
  createMealPlanner as createItineraryMealPlanner,
} from './MealPlanner'

export {
  allocateActivities as allocateItineraryActivities,
  planInterCityTransfer as planItineraryInterCityTransfer,
  ActivityAllocator as ItineraryActivityAllocator,
  createActivityAllocator as createItineraryActivityAllocator,
} from './ActivityAllocator'

export {
  partitionDayParts,
  summarizeDayMinutes,
  buildDayTimeline,
  flattenTimeline,
  TimelineBuilder,
  createTimelineBuilder,
} from './TimelineBuilder'

export {
  detectConflicts,
  resolveConflicts,
  ConflictResolver,
  createConflictResolver,
} from './ConflictResolver'

export {
  scoreItinerary,
  ItineraryScorer,
  createItineraryScorer,
} from './ItineraryScorer'

export {
  explainItinerary,
  explainBlock,
  ItineraryExplainer,
  createItineraryExplainer,
} from './ItineraryExplainer'

export {
  buildItineraryMetadata,
  ItineraryMetadataBuilder,
  createItineraryMetadataBuilder,
} from './ItineraryMetadata'

export {
  runItineraryEngine,
  buildItineraryFromContext,
  ItineraryEngine,
  createItineraryEngine,
  createItineraryRunner,
  type ItineraryEngineOptions,
} from './ItineraryEngine'
