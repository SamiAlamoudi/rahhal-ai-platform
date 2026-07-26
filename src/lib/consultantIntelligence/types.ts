/**
 * Sprint 55 — Travel Consultant Intelligence (conversation quality only).
 * Pure helpers — no providers, no architecture change.
 */

export type ConsultantLocale = 'ar' | 'en'

export type DiscoveryInference = {
  mustHaves: string[]
  dealBreakers: string[]
  notes: string[]
  travelStyle: string | null
  tripPurpose: string | null
  activities: string[]
  foodPreferences: string[]
}

export type EmpathyCue =
  | 'honeymoon'
  | 'family'
  | 'budget_tight'
  | 'beach'
  | 'avoid_crowds'
  | 'culture'
  | null
