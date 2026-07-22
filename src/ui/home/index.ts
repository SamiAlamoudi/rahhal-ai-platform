/**
 * Sprint 121 — Premium Home Experience (presentation sections).
 */

export {
  UI_PREMIUM_HOME_FEATURE_ID,
  isUiPremiumHomeEnabled,
} from './feature'

export {
  SPRINT121_PREMIUM_HOME_VERSION,
  PREMIUM_HOME_SECTIONS,
  homeColors,
  homeMotion,
  homePageStyle,
  homeShellStyle,
  homeCardStyle,
  homeChipStyle,
  type PremiumHomeSectionId,
} from './homeTheme'

export { HomeSection, type PremiumHomeSectionProps } from './HomeSection'
export { HomeSkeleton, type HomeSkeletonProps } from './HomeSkeleton'
export { HeroSection, type HeroSectionProps } from './HeroSection'
export { ConversationEntry, type ConversationEntryProps } from './ConversationEntry'
export {
  ContinueConversation,
  type ContinueConversationProps,
} from './ContinueConversation'
export {
  RecentTripsCard,
  type RecentTripsCardProps,
  type HomeTripItem,
} from './RecentTripsCard'
export { UpcomingTrips, type UpcomingTripsProps } from './UpcomingTrips'
export {
  SuggestedDestinations,
  type SuggestedDestinationsProps,
} from './SuggestedDestinations'
export {
  TravelInspiration,
  type TravelInspirationProps,
} from './TravelInspiration'
export {
  RecommendedActions,
  type RecommendedActionsProps,
} from './RecommendedActions'
export {
  QuickActions,
  type QuickActionsProps,
  type QuickActionItem,
} from './QuickActions'
export {
  SmartSearchEntry,
  type SmartSearchEntryProps,
} from './SmartSearchEntry'
export {
  FeaturedExperiences,
  featuredItemsFromHistory,
  type FeaturedExperiencesProps,
  type FeaturedExperienceItem,
} from './FeaturedExperiences'
