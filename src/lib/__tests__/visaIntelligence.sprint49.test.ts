/**
 * Sprint 49 — Visa & travel advisory intelligence tests.
 */
import { describe, expect, it } from 'vitest'
import { findDestinationProfile, runTravelReasoning, formatReasoningReply, buildVisaGuidance, buildTravelAdvisory } from '../agent/reasoning'
import { mergeRequirements } from '../agent/memory'
import { emptyRequirements } from '../agent/types'

describe('Sprint 49 visa intelligence', () => {
  it('builds consultant visa guidance for Switzerland (Schengen)', () => {
    const profile = findDestinationProfile('Switzerland')
    expect(profile).toBeTruthy()
    const guidance = buildVisaGuidance(profile!, 'en')
    expect(guidance.ease).toBe('embassy')
    expect(guidance.summary).toMatch(/Switzerland/i)
    expect(guidance.summary).toMatch(/Schengen|embassy/i)
    expect(guidance.processingDays).toMatch(/week/i)
    expect(guidance.documents.length).toBeGreaterThan(0)
  })

  it('builds Arabic visa guidance for Georgia/Tbilisi visa-free path', () => {
    const profile = findDestinationProfile('Tbilisi')
    expect(profile?.visaFromSaudi).toBe('visa_free')
    const guidance = buildVisaGuidance(profile!, 'ar')
    expect(guidance.summary).toMatch(/بدون تأشيرة|تبليسي/)
    expect(guidance.feeNote).toMatch(/بدون/)
  })

  it('attaches visa guidance and advisories to ranked candidates', () => {
    const requirements = mergeRequirements(emptyRequirements(), {
      destinationFlexible: true,
      weatherPreference: 'cold',
      budgetAmount: 20000,
      budgetCurrency: 'SAR',
      startDate: '2027-01-15',
      durationDays: 7,
      travelers: 2,
    })
    const result = runTravelReasoning({
      locale: 'en',
      requirements,
      userText: 'somewhere cold in January',
      now: new Date('2026-12-01T00:00:00Z'),
    })
    expect(result.primary?.visaGuidance).toBeTruthy()
    expect(result.primary?.visaGuidance?.summary.length).toBeGreaterThan(10)
    expect(result.primary?.advisoryNotes.length).toBeGreaterThan(0)
  })

  it('formats warm consultant reply with visa and advisory lines', () => {
    const requirements = mergeRequirements(emptyRequirements(), {
      destinationFlexible: true,
      weatherPreference: 'cold',
      budgetAmount: 12000,
      budgetCurrency: 'SAR',
      startDate: '2027-01-10',
    })
    const result = runTravelReasoning({
      locale: 'en',
      requirements,
      userText: 'I want somewhere cold',
      now: new Date('2026-12-01T00:00:00Z'),
    })
    const reply = formatReasoningReply({ result, requirements })
    expect(reply).toMatch(/travel consultant|ranked destinations/i)
    expect(reply).toMatch(/Visa:/)
    expect(reply).toMatch(/Advisory:|Plus:|Why:/)
    expect(reply).not.toMatch(/visa: embassy/)
  })

  it('builds travel advisory for long-haul Japan', () => {
    const profile = findDestinationProfile('Japan')
    expect(profile).toBeTruthy()
    const notes = buildTravelAdvisory(profile!, 'en')
    expect(notes.some((n) => /flight|haul|visa/i.test(n))).toBe(true)
  })
})
