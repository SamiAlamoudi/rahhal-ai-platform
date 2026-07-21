export { isDynamicPackagesEnabled, DYNAMIC_PACKAGES_FEATURE_ID } from './feature'
export {
  enrichWithDynamicPackages,
  normalizeFlightOffers,
  normalizeHotelOffers,
  normalizeTransfers,
  normalizeActivities,
  normalizeAddons,
  prioritizeOffersForDecisionEngine,
  type PackageBuilderResult,
} from './bridge'
export {
  runPackageBuilder,
  createPackageBuilder,
  SPRINT83_DYNAMIC_PACKAGES_VERSION,
  evaluateCompatibility,
  rankPackages,
  dedupePackages,
} from '../../../core'
