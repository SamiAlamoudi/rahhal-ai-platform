/**
 * Sprint 87 — Destination Knowledge layer (data-driven reasoning).
 */

import { describe, expect, it } from 'vitest'
import {
  clearDestinationKnowledgeRegistryForTests,
  ensureDestinationKnowledgeLoaded,
  getDestinationKnowledgeByKey,
  listDestinationKnowledge,
  reasonFromDestinationKnowledge,
  registerDestinationKnowledge,
  resetDestinationKnowledgeBootstrapForTests,
  resolveDestinationKnowledgeKey,
  type DestinationKnowledge,
} from '../brain/v1/destinationKnowledge'
import { runConversationManagerTurn } from '../brain/v1'

function reloadCatalog() {
  clearDestinationKnowledgeRegistryForTests()
  resetDestinationKnowledgeBootstrapForTests()
  ensureDestinationKnowledgeLoaded()
}

describe('Sprint 87 — Destination Knowledge layer', () => {
  it('loads structured fields required by the knowledge contract', () => {
    reloadCatalog()
    const morocco = getDestinationKnowledgeByKey('morocco')
    expect(morocco).toBeTruthy()
    expect(morocco!.country).toBe('Morocco')
    expect(morocco!.cities.length).toBeGreaterThan(1)
    expect(morocco!.bestSeason.en).toBeTruthy()
    expect(morocco!.climate.en).toBeTruthy()
    expect(morocco!.averageBudgetSar.mid).toBeGreaterThan(0)
    expect(morocco!.tripDuration.recommended).toBeGreaterThan(0)
    expect(morocco!.familyScore).toBeGreaterThanOrEqual(0)
    expect(morocco!.honeymoonScore).toBeGreaterThanOrEqual(0)
    expect(morocco!.businessScore).toBeGreaterThanOrEqual(0)
    expect(morocco!.beaches).toBeGreaterThanOrEqual(0)
    expect(morocco!.mountains).toBeGreaterThanOrEqual(0)
    expect(morocco!.nightlife).toBeGreaterThanOrEqual(0)
    expect(morocco!.shopping).toBeGreaterThanOrEqual(0)
    expect(morocco!.culture).toBeGreaterThanOrEqual(0)
    expect(morocco!.transportation.en).toBeTruthy()
    expect(morocco!.visaNotes.en).toBeTruthy()
    expect(morocco!.airports.some((a) => a.code === 'CMN')).toBe(true)
  })

  it('ranks cities from scores — business prefers Casablanca, family prefers Agadir', () => {
    reloadCatalog()
    const business = reasonFromDestinationKnowledge({
      destination: 'Morocco',
      specialRequests: 'tripStyle=business',
    })
    const family = reasonFromDestinationKnowledge({
      destination: 'Morocco',
      specialRequests: 'tripStyle=family',
    })
    expect(business?.rankedCities[0]?.city.nameEn).toBe('Casablanca')
    expect(family?.rankedCities[0]?.city.nameEn).toBe('Agadir')
    expect(business?.cityContrastEn).toMatch(/Based on destination scores/)
    expect(family?.cityContrastEn).not.toEqual(business?.cityContrastEn)
  })

  it('allows adding a future country by registering data only', () => {
    reloadCatalog()
    const before = listDestinationKnowledge().length
    const portugal: DestinationKnowledge = {
      key: 'portugal',
      kind: 'country',
      country: 'Portugal',
      countryAr: 'البرتغال',
      displayNameEn: 'Portugal',
      displayNameAr: 'البرتغال',
      aliases: ['portugal', 'البرتغال', 'lisbon', 'لشبونة'],
      cities: [
        {
          key: 'lisbon',
          nameEn: 'Lisbon',
          nameAr: 'لشبونة',
          traitsEn: ['coastal', 'walkable'],
          traitsAr: ['ساحلية', 'مشي'],
          familyScore: 8,
          honeymoonScore: 8,
          businessScore: 6,
          beaches: 7,
          mountains: 2,
          nightlife: 7,
          shopping: 6,
          culture: 8,
          suggestedDays: 3,
          highlightsEn: ['old town walks'],
          highlightsAr: ['مشي في البلدة القديمة'],
        },
      ],
      bestSeason: { en: 'Spring and early autumn.', ar: 'الربيع وأوائل الخريف.' },
      climate: { en: 'Mild Atlantic climate.', ar: 'مناخ أطلسي معتدل.' },
      averageBudgetSar: { low: 5000, mid: 8000, high: 12000 },
      tripDuration: { min: 4, max: 8, recommended: 5 },
      familyScore: 8,
      honeymoonScore: 8,
      businessScore: 6,
      beaches: 7,
      mountains: 3,
      nightlife: 7,
      shopping: 6,
      culture: 8,
      transportation: { en: 'Trains and metro in Lisbon.', ar: 'قطارات ومترو في لشبونة.' },
      visaNotes: { en: 'Schengen rules apply by nationality.', ar: 'قواعد شنغن حسب الجنسية.' },
      airports: [{ code: 'LIS', nameEn: 'Lisbon', nameAr: 'لشبونة', primary: true }],
      flightFromKsa: { en: 'Usually one-stop from Saudi.', ar: 'عادة بتوقف من السعودية.' },
      timezone: { en: 'Western Europe time.', ar: 'توقيت غرب أوروبا.' },
      attractionsEn: ['Belém', 'Alfama'],
      attractionsAr: ['بيليم', 'ألفاما'],
    }
    registerDestinationKnowledge(portugal)
    expect(listDestinationKnowledge().length).toBe(before + 1)
    expect(resolveDestinationKnowledgeKey('Lisbon')).toBe('portugal')
    const reasoned = reasonFromDestinationKnowledge({ destination: 'Portugal' })
    expect(reasoned?.knowledge.key).toBe('portugal')
    expect(reasoned?.recommendedCityNamesEn).toContain('Lisbon')
    expect(reasoned?.itinerarySketchEn[0]).toMatch(/Lisbon/)
  })

  it('conversation value for Morocco is composed from knowledge reasoning, not a fixed essay', () => {
    reloadCatalog()
    const result = runConversationManagerTurn(
      { text: 'I want to travel to Morocco.', locale: 'en' },
      { enabled: true },
    )
    expect(result.response?.providedValue).toBe(true)
    expect(result.response?.en.toLowerCase()).toMatch(/marrakech|agadir|fes|casablanca/)
    expect(result.response?.en).toMatch(/Based on destination scores|First cut/)
    expect(result.response?.en.toLowerCase()).toMatch(/indicative|preliminary/)
    // Must still ask at most one question.
    expect(result.response?.questionCount).toBeLessThanOrEqual(1)
  })
})
