import type { PreferenceSignal, UserPreferenceProfile } from './types'
import { emptyPreferenceProfile } from './types'
import { clamp01 } from '../types'

function uniquePush(list: string[], value: string, max = 8): string[] {
  const next = [value, ...list.filter((x) => x.toLowerCase() !== value.toLowerCase())]
  return next.slice(0, max)
}

/**
 * Learns preferences from signals — no hardcoded airline/hotel favorites.
 */
export class PreferenceEngine {
  private profile: UserPreferenceProfile

  constructor(profile: UserPreferenceProfile = emptyPreferenceProfile()) {
    this.profile = profile
  }

  getProfile(): UserPreferenceProfile {
    return structuredClone(this.profile)
  }

  learn(signal: PreferenceSignal): UserPreferenceProfile {
    const strength = clamp01(signal.strength ?? 0.6)
    const key = signal.key.trim().toLowerCase()
    const value = signal.value.trim()
    if (!key || !value) return this.getProfile()

    this.profile.signalWeights[key] = clamp01((this.profile.signalWeights[key] ?? 0) + strength * 0.25)

    switch (key) {
      case 'airline':
      case 'favorite_airline':
        this.profile.favoriteAirlines = uniquePush(this.profile.favoriteAirlines, value)
        break
      case 'hotel':
      case 'favorite_hotel':
        this.profile.favoriteHotels = uniquePush(this.profile.favoriteHotels, value)
        break
      case 'seat':
        if (value === 'window' || value === 'aisle' || value === 'extra_legroom' || value === 'any') {
          this.profile.preferredSeat = value
        }
        break
      case 'budget_level':
        if (value === 'low' || value === 'mid' || value === 'high' || value === 'luxury') {
          this.profile.budgetLevel = value
        }
        break
      case 'luxury_level':
        if (
          value === 'essential' ||
          value === 'comfort' ||
          value === 'premium' ||
          value === 'ultra'
        ) {
          this.profile.luxuryLevel = value
        }
        break
      case 'travel_style':
        if (
          value === 'leisure' ||
          value === 'business' ||
          value === 'family' ||
          value === 'luxury' ||
          value === 'budget' ||
          value === 'adventure'
        ) {
          this.profile.travelStyle = value
        }
        break
      case 'currency':
        if (value === 'SAR' || value === 'USD' || value === 'EUR' || value === 'AED' || value === 'GBP') {
          this.profile.preferredCurrency = value
        }
        break
      default:
        break
    }

    return this.getProfile()
  }

  /** Infer soft signals from free text (AR/EN) without fixed favorites. */
  observeText(text: string): PreferenceSignal[] {
    const signals: PreferenceSignal[] = []
    const airline = text.match(/\b(saudia|emirates|qatar airways|flynas|etihad)\b/i)
    if (airline?.[1]) signals.push({ key: 'airline', value: airline[1], strength: 0.5 })

    if (/\bwindow\b|نافذة|شباك/.test(text)) signals.push({ key: 'seat', value: 'window', strength: 0.7 })
    if (/\baisle\b|ممر/.test(text)) signals.push({ key: 'seat', value: 'aisle', strength: 0.7 })

    if (/\bluxury\b|فاخر|فخم/.test(text)) {
      signals.push({ key: 'luxury_level', value: 'premium', strength: 0.65 })
      signals.push({ key: 'budget_level', value: 'luxury', strength: 0.55 })
      signals.push({ key: 'travel_style', value: 'luxury', strength: 0.55 })
    }
    if (/\bbudget\b|رخيص|اقتصادي/.test(text)) {
      signals.push({ key: 'budget_level', value: 'low', strength: 0.65 })
      signals.push({ key: 'travel_style', value: 'budget', strength: 0.55 })
    }
    if (/\bfamily\b|عائلي| foresطفال/.test(text)) {
      signals.push({ key: 'travel_style', value: 'family', strength: 0.7 })
    }
    if (/\bbusiness\b|عمل|رجال أعمال/.test(text)) {
      signals.push({ key: 'travel_style', value: 'business', strength: 0.7 })
    }

    for (const s of signals) this.learn(s)
    return signals
  }
}
