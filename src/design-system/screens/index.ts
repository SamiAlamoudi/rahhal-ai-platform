export { ScreenFrame } from './ScreenFrame'
export * from './coreScreens'
export * from './journeyScreens'

export type DesignScreenId =
  | 'splash'
  | 'onboarding'
  | 'authentication'
  | 'home'
  | 'aiConversation'
  | 'voiceConversation'
  | 'searchResults'
  | 'flightDetails'
  | 'hotelDetails'
  | 'packageDetails'
  | 'bookingReview'
  | 'payment'
  | 'tripTimeline'
  | 'myTrips'
  | 'saved'
  | 'notifications'
  | 'profile'
  | 'settings'
  | 'aiRecommendations'
  | 'error'
  | 'offline'
  | 'empty'
  | 'loading'
  | 'success'

export const DESIGN_SCREEN_CATALOG: Array<{ id: DesignScreenId; label: string; group: string }> = [
  { id: 'splash', label: 'Splash', group: 'Entry' },
  { id: 'onboarding', label: 'Onboarding', group: 'Entry' },
  { id: 'authentication', label: 'Authentication', group: 'Entry' },
  { id: 'home', label: 'Home', group: 'Core' },
  { id: 'aiConversation', label: 'AI Conversation', group: 'Core' },
  { id: 'voiceConversation', label: 'Voice Conversation', group: 'Core' },
  { id: 'aiRecommendations', label: 'AI Recommendations', group: 'Core' },
  { id: 'searchResults', label: 'Search Results', group: 'Discover' },
  { id: 'flightDetails', label: 'Flight Details', group: 'Discover' },
  { id: 'hotelDetails', label: 'Hotel Details', group: 'Discover' },
  { id: 'packageDetails', label: 'Package Details', group: 'Discover' },
  { id: 'bookingReview', label: 'Booking Review', group: 'Booking' },
  { id: 'payment', label: 'Payment', group: 'Booking' },
  { id: 'tripTimeline', label: 'Trip Timeline', group: 'Trips' },
  { id: 'myTrips', label: 'My Trips', group: 'Trips' },
  { id: 'saved', label: 'Saved', group: 'Trips' },
  { id: 'notifications', label: 'Notifications', group: 'Account' },
  { id: 'profile', label: 'Profile', group: 'Account' },
  { id: 'settings', label: 'Settings', group: 'Account' },
  { id: 'error', label: 'Error States', group: 'System' },
  { id: 'offline', label: 'Offline State', group: 'System' },
  { id: 'empty', label: 'Empty States', group: 'System' },
  { id: 'loading', label: 'Loading States', group: 'System' },
  { id: 'success', label: 'Success States', group: 'System' },
]
