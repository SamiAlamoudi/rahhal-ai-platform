export type POICategory =
  | 'landmark'
  | 'museum'
  | 'restaurant'
  | 'shopping'
  | 'park'
  | 'temple'
  | 'beach'
  | 'transit'

export interface PointOfInterest {
  name: string
  category: POICategory
  lat: number
  lng: number
  rating: number | null
}

export type SafetyLevel = 'low' | 'moderate' | 'elevated' | 'high'

export interface DestinationInsight {
  id: string
  providerId: string
  destination: string
  country: string
  timezone: string
  language: string
  currency: string
  safetyLevel: SafetyLevel
  pointsOfInterest: PointOfInterest[]
  travelTips: string[]
}
