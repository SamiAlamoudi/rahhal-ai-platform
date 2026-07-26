/**
 * Product Sprint A — New UX/UI Foundation (presentation helpers).
 * Does not own routing, AI turns, or providers.
 */

export {
  PRODUCT_UX_SPRINT,
  PRODUCT_UX_VERSION,
  UI_NEW_EXPERIENCE_FEATURE_ID,
  productAtmosphere,
  productBorders,
  productBrand,
  productBreakpoints,
  productColors,
  productElevation,
  productMotion,
  productRadius,
  productSpacing,
  productStatus,
  productTypography,
} from './tokens'

export {
  productBrandName,
  productCopy,
  type ProductCopyKey,
  type ProductLocale,
} from './copy'

export { isUiNewExperienceEnabled } from './feature'

export {
  PRODUCT_HOME_SUGGESTIONS,
  suggestionText,
  type ProductSuggestion,
} from './suggestions'

export {
  budgetFromBreakdown,
  demoActionConfirmation,
  demoItinerary,
  flightResultFromModel,
  hotelResultFromModel,
  type ActionConfirmationView,
  type BudgetPresentationView,
  type DestinationResultView,
  type FlightCompareTag,
  type FlightResultView,
  type HotelResultView,
  type ItineraryDayView,
  type ItineraryItemView,
} from './models'

export {
  buildActiveTripContext,
  isStaleTripRoute,
  tripClarificationText,
  type ActiveTripContext,
} from './tripContext'
