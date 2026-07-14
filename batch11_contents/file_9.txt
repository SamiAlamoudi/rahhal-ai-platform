export type ActivityType =
  | 'entertainment'
  | 'nature'
  | 'culture'
  | 'adventure'
  | 'beach'
  | 'shopping'
  | 'dining'

export interface ActivityOffer {
  id: string
  providerId: string
  title: string
  currency: string
  price: number
  originalPrice: number | null
  rating: number | null
  location: string
  durationMinutes: number | null
  activityType: ActivityType
  familyFriendly: boolean
  cancellationPolicy: string | null
  destination: string
}
