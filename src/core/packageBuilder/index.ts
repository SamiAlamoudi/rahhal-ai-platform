/**
 * Sprint 83 — AI Dynamic Travel Packages (core barrel).
 */

export {
  SPRINT83_DYNAMIC_PACKAGES_VERSION,
  DEFAULT_PACKAGE_WEIGHTS,
  type PackageComponentKind,
  type PackageRankLabel,
  type PackageComponent,
  type PackageScoreDimensions,
  type PackageScoreWeights,
  type PackageCandidate,
  type NormalizedFlightOffer,
  type NormalizedHotelOffer,
  type NormalizedTransferOffer,
  type NormalizedActivityOffer,
  type NormalizedAddonOffer,
  type PackageBuilderInput,
} from './PackageCandidate'

export {
  checkFlightHotelCompatibility,
  checkTransferCompatibility,
  checkActivityCompatibility,
  checkFlightMismatch,
  evaluateCompatibility,
  isCompatiblePackage,
} from './CompatibilityEngine'

export {
  scorePackageDimensions,
  applyWeights,
  scorePackage,
  scorePackagesParallel,
} from './PackageScorer'

export { calculatePackageConfidence, attachConfidence } from './PackageConfidence'
export { explainPackage, explainSelectedPackages } from './PackageExplainer'
export { rankPackages, pickLabeledPackages } from './PackageRanking'
export {
  packageNormalizedKey,
  dedupePackages,
  pruneWeakPackages,
  optimizePackagesParallel,
} from './PackageOptimizer'

export {
  PackageBuilder,
  createPackageBuilder,
  runPackageBuilder,
  generatePackageCandidates,
  generatePackageCandidatesParallel,
  rerankPackagesWithPreferences,
  type PackageBuilderResult,
} from './PackageBuilder'

export {
  emitPackageEvent,
  onPackageEvent,
  resetPackageEventListeners,
  type PackageEvent,
  type PackageEventName,
} from './events'
