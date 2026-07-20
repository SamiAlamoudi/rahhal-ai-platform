/**
 * Sprint 52 — Executive OS shared types.
 */

export type TravelGoal =
  | 'relaxation'
  | 'honeymoon'
  | 'adventure'
  | 'family'
  | 'business'
  | 'conference'
  | 'medical'
  | 'shopping'
  | 'pilgrimage'
  | 'photography'
  | 'food'
  | 'general'

export type ExecutiveStrategy =
  | 'fast'
  | 'deep'
  | 'budget'
  | 'risk'
  | 'luxury'
  | 'family'
  | 'business'
  | 'emergency'

export type ObjectiveAxis =
  | 'price'
  | 'comfort'
  | 'luxury'
  | 'time'
  | 'weather'
  | 'activities'
  | 'visa'
  | 'family'
  | 'business'
  | 'safety'

export interface DestinationIntelligence {
  id: string
  nameEn: string
  nameAr: string
  region: string
  weather: string
  visa: string
  safety: number
  crowdedness: number
  seasonality: string
  food: number
  transportation: number
  internet: number
  familyFriendliness: number
  luxuryScore: number
  businessScore: number
  nightlife: number
  nature: number
  shopping: number
  adventure: number
  medicalAccess: number
  religionFriendliness: number
  languageDifficulty: number
  averageDailyCostSar: number
  politicalStability: number
  tourismPopularity: number
  airportQuality: number
  flightAccessibility: number
  environmental: number
  riskScore: number
}

export interface ScoredOption {
  id: string
  name: string
  score: number
  objectives: Partial<Record<ObjectiveAxis, number>>
  rejected: boolean
  rejectReason: string | null
  confidence: number
}

export interface PredictionResult {
  preferredDestination: string | null
  likelyBudget: number | null
  likelyTravelMonth: number | null
  likelyAirline: string | null
  likelyHotelStyle: string | null
  acceptProbability: number
  cancelProbability: number
  changeDestinationProbability: number
  confidence: number
}

export interface NegotiationSuggestion {
  kind: 'timing' | 'destination' | 'airport' | 'hotel' | 'routing' | 'budget'
  message: string
  betterThan: string
}

export interface SelfReviewFinding {
  kind: 'accuracy' | 'consistency' | 'hallucination' | 'missing' | 'conflict' | 'weak' | 'duplicate'
  message: string
  severity: 'low' | 'medium' | 'high'
}
