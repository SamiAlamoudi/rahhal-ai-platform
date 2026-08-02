import { describe, expect, it } from 'vitest'
import { TRAVEL_INTENT_IDS } from './intents'
import { IntentEngine, detectIntent } from './IntentEngine'

describe('IntentEngine', () => {
  const engine = new IntentEngine()

  it('exposes full intent catalog', () => {
    expect(TRAVEL_INTENT_IDS).toContain('book_flight')
    expect(TRAVEL_INTENT_IDS).toContain('emergency')
    expect(TRAVEL_INTENT_IDS).toHaveLength(17)
  })

  it.each([
    ['book a flight to Dubai', 'book_flight'],
    ['أريد حجز طيران إلى دبي', 'book_flight'],
    ['book a hotel in Istanbul', 'book_hotel'],
    ['حجز فندق في إسطنبول', 'book_hotel'],
    ['show me a package deal', 'book_package'],
    ['باقة شاملة', 'book_package'],
    ['suggest a destination', 'search_destination'],
    ['وين أروح؟', 'search_destination'],
    ['do I need a visa', 'visa'],
    ['تأشيرة لندن', 'visa'],
    ['what is the weather', 'weather'],
    ['كيف الطقس', 'weather'],
    ['plan my budget', 'budget_planning'],
    ['ميزانية الرحلة', 'budget_planning'],
    ['when is the cheapest price', 'price_prediction'],
    ['متى أرخص سعر', 'price_prediction'],
    ['modify my trip', 'modify_trip'],
    ['عدل رحلتي', 'modify_trip'],
    ['cancel booking please', 'cancel_booking'],
    ['إلغاء حجز', 'cancel_booking'],
    ['recommend the best hotel', 'recommendations'],
    ['اقترح أفضل فندق', 'recommendations'],
    ['airport transfer taxi', 'transportation'],
    ['مواصلات تاكسي', 'transportation'],
    ['best restaurants nearby', 'restaurants'],
    ['مطاعم قريبة', 'restaurants'],
    ['things to do and activities', 'activities'],
    ['أنشطة وجولة', 'activities'],
    ['emergency lost passport', 'emergency'],
    ['طوارئ جواز ضاع', 'emergency'],
    ['travel advice is it safe', 'travel_advice'],
    ['نصيحة هل آمن', 'travel_advice'],
  ])('detects %s → %s', (text, id) => {
    expect(detectIntent(text).id).toBe(id)
    expect(engine.recognize(text).id).toBe(id)
    expect(engine.recognize(text).confidence).toBeGreaterThan(0.5)
  })

  it('returns unknown for unrelated text', () => {
    const r = detectIntent('hello world xyz')
    expect(r.id).toBe('unknown')
    expect(r.confidence).toBe(0)
  })
})
