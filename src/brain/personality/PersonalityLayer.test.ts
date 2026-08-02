import { describe, expect, it } from 'vitest'
import { PersonalityLayer } from './PersonalityLayer'

describe('PersonalityLayer', () => {
  const p = new PersonalityLayer()

  it('shapes calm consultant replies in EN/AR', () => {
    const en = p.shape({
      locale: 'en',
      intentLabel: p.intentLabel('book_flight', 'en'),
      body: 'Here are calm options.',
    })
    expect(en.tone.robotic).toBe(false)
    expect(en.text.toLowerCase()).toContain('gladly')

    const ar = p.shape({
      locale: 'ar',
      intentLabel: p.intentLabel('recommendations', 'ar'),
      body: 'خيارات هادئة.',
      safetyMessage: 'نحتاج المدينة.',
    })
    expect(ar.text).toContain('نحتاج المدينة')
  })

  it('labels known and unknown intents', () => {
    expect(p.intentLabel('emergency', 'en')).toMatch(/calmly/i)
    expect(p.intentLabel('unknown', 'ar')).toBeTruthy()
    expect(p.intentLabel('custom_x', 'en')).toMatch(/help/i)
  })
})
