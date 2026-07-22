/**
 * Sprint 99 — Alpha Experience Assembly tests (presentation / orchestration only).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  AlphaExperienceComposer,
  composeAlphaTravelerExperience,
  buildAlphaExperienceDTO,
  buildExperienceSections,
  compareSectionIds,
  priorityForSection,
  EXPERIENCE_SECTION_PRIORITY,
  SPRINT99_ALPHA_ASSEMBLY_VERSION,
  type AlphaExperienceComposeInput,
} from '../../core'
import {
  assembleAlphaTravelerExperience,
  toAlphaExperienceComposeInput,
  isAlphaExperienceEnabled,
  ALPHA_EXPERIENCE_FEATURE_ID,
} from '../agent/alphaExperience'
import { integrateConciergeIntoTurn } from '../agent/conciergeIntegration'
import { emptyMemory } from '../agent/types'

function baseInput(overrides?: Partial<AlphaExperienceComposeInput>): AlphaExperienceComposeInput {
  return {
    conversationId: 'conv_alpha_99',
    destination: 'Dubai',
    origin: 'Riyadh',
    currency: 'SAR',
    concierge: {
      enabled: true,
      explanation: 'Balanced Dubai escape that fits your budget.',
      summaryText: 'Recommended Dubai trip for a couple from Riyadh.',
      recommendedOption: 'Dubai balanced escape',
      nextStep: 'Review the package and confirm booking.',
      confidence: {
        score: 0.86,
        level: 'high',
        label: 'High confidence',
        uncertaintyExplanation: null,
      },
      timeline: {
        stages: [
          { id: 'thinking', label: 'Thinking', status: 'completed', message: 'Analyzed request', progressPercent: 20 },
          { id: 'searching', label: 'Searching', status: 'completed', message: 'Searched offers', progressPercent: 40 },
          { id: 'comparing', label: 'Comparing', status: 'completed', message: 'Compared options', progressPercent: 60 },
          { id: 'optimizing', label: 'Optimizing', status: 'completed', message: 'Optimized package', progressPercent: 80 },
          { id: 'final_recommendation', label: 'Final recommendation', status: 'completed', message: 'Ready', progressPercent: 100 },
        ],
        currentStageId: 'final_recommendation',
        progressPercent: 100,
      },
      alternatives: [
        {
          kind: 'best_price',
          label: 'Best price',
          estimatedCost: 2800,
          currency: 'SAR',
          explanation: 'Cheaper hotel with one stop.',
        },
      ],
      suggestions: [{ title: 'Travel insurance', message: 'Add trip insurance.' }],
      whyDestination: 'Dubai matches your interests.',
      whyFlights: 'Direct morning flight.',
      whyHotel: 'Marina location near dining.',
      whyPackage: 'Best overall value.',
      whyTiming: 'Prices look favorable this week.',
    },
    packageSelected: {
      id: 'pkg_1',
      title: 'Dubai balanced escape',
      totalPrice: 3600,
      currency: 'SAR',
      confidence: 0.86,
      explanation: 'Balanced flight and hotel pairing.',
    },
    flight: {
      id: 'flt_1',
      airline: 'Saudia',
      origin: 'RUH',
      destination: 'DXB',
      price: 1200,
      currency: 'SAR',
      durationMinutes: 190,
      stops: 0,
    },
    hotel: {
      id: 'htl_1',
      name: 'Marina Hotel',
      price: 2200,
      currency: 'SAR',
      stars: 4,
      rating: 4.4,
    },
    priceOpportunity: {
      note: 'Book within 48 hours for better fares.',
      confidence: 0.72,
      currency: 'SAR',
    },
    decisionExplanation: 'Selected best overall package for couple travelers.',
    engineConfidence: 0.86,
    ...overrides,
  }
}

describe('Sprint 99 — Alpha Experience Assembly', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('registers ai.alpha_experience enabled by default', () => {
    expect(getFeatureRegistry().isEnabled('ai.alpha_experience')).toBe(true)
    expect(isAlphaExperienceEnabled()).toBe(true)
    expect(ALPHA_EXPERIENCE_FEATURE_ID).toBe('ai.alpha_experience')
    expect(SPRINT99_ALPHA_ASSEMBLY_VERSION).toMatch(/alpha-assembly/)
  })

  describe('priority', () => {
    it('ranks critical sections ahead of high / medium / low', () => {
      expect(priorityForSection('confidence')).toBe('critical')
      expect(priorityForSection('price')).toBe('critical')
      expect(priorityForSection('flight')).toBe('high')
      expect(priorityForSection('timeline')).toBe('medium')
      expect(priorityForSection('next_action')).toBe('low')
      expect(compareSectionIds('confidence', 'next_action')).toBeLessThan(0)
      expect(compareSectionIds('flight', 'timeline')).toBeLessThan(0)
      expect(EXPERIENCE_SECTION_PRIORITY.package).toBe('high')
    })
  })

  describe('section omission', () => {
    it('hides missing sections without placeholders', () => {
      const sections = buildExperienceSections({
        conversationId: 'empty',
        destination: 'Dubai',
      })
      expect(sections).toEqual([])
    })

    it('includes only available sections', () => {
      const sections = buildExperienceSections({
        priceOpportunity: { note: 'Good timing', confidence: 0.7 },
        engineConfidence: 0.8,
      })
      const ids = sections.map((s) => s.id)
      expect(ids).toContain('price')
      expect(ids).toContain('confidence')
      expect(ids).toContain('timeline')
      expect(ids).not.toContain('flight')
      expect(ids).not.toContain('hotel')
      expect(ids).not.toContain('package')
      expect(ids).not.toContain('next_action')
    })
  })

  describe('composer', () => {
    it('assembles a full traveler experience DTO', () => {
      const dto = composeAlphaTravelerExperience(baseInput())
      expect(dto.enabled).toBe(true)
      expect(dto.version).toBe(SPRINT99_ALPHA_ASSEMBLY_VERSION)
      expect(dto.finalRecommendation).toBeTruthy()
      expect(dto.confidenceLevel).toBe('high')
      expect(dto.confidenceScore).toBe(0.86)
      expect(dto.nextAction).toMatch(/confirm booking/i)
      expect(dto.sectionIds).toContain('timeline')
      expect(dto.sectionIds).toContain('concierge')
      expect(dto.sectionIds).toContain('package')
      expect(dto.sectionIds).toContain('flight')
      expect(dto.sectionIds).toContain('hotel')
      expect(dto.sectionIds).toContain('price')
      expect(dto.sectionIds).toContain('confidence')
      expect(dto.sectionIds).toContain('alternatives')
      expect(dto.sectionIds).toContain('explanation')
      expect(dto.sectionIds).toContain('summary')
      expect(dto.sectionIds).toContain('next_action')
      // Critical sections appear before low-priority next_action.
      expect(dto.sectionIds.indexOf('confidence')).toBeLessThan(dto.sectionIds.indexOf('next_action'))
      expect(dto.sectionIds.indexOf('price')).toBeLessThan(dto.sectionIds.indexOf('timeline'))
    })

    it('returns empty sections when disabled', () => {
      const composer = new AlphaExperienceComposer()
      const dto = composer.compose(baseInput(), { enabled: false })
      expect(dto.enabled).toBe(false)
      expect(dto.sections).toEqual([])
      expect(dto.finalRecommendation).toBeNull()
      expect(dto.nextAction).toBeNull()
    })

    it('deduplicates identical explanation / summary text', () => {
      const same = 'Same traveler-facing copy.'
      const dto = buildAlphaExperienceDTO({
        conversationId: 'dedupe',
        concierge: {
          enabled: true,
          explanation: same,
          summaryText: same,
          recommendedOption: 'Option A',
          nextStep: 'Continue',
        },
      })
      const explanation = dto.sections.find((s) => s.id === 'explanation')
      const summary = dto.sections.find((s) => s.id === 'summary')
      const concierge = dto.sections.find((s) => s.id === 'concierge')
      // Identical fingerprints: keep higher priority (explanation medium vs summary medium;
      // concierge high beats both when explanation fingerprint matches).
      const textSections = [explanation, summary, concierge].filter(Boolean)
      expect(textSections.length).toBeLessThan(3)
    })
  })

  describe('agent assembly bridge', () => {
    it('returns null when flag is off (legacy preserved)', () => {
      getFeatureRegistry().setEnabled('ai.alpha_experience', false)
      expect(isAlphaExperienceEnabled()).toBe(false)
      const memory = emptyMemory()
      memory.requirements.destination = 'Dubai'
      const attachment = assembleAlphaTravelerExperience({
        memory,
        enabled: false,
        packageSelected: {
          id: 'pkg_1',
          title: 'Package',
          totalPrice: 1000,
          currency: 'SAR',
        },
      })
      expect(attachment).toBeNull()
    })

    it('assembles from concierge integration + engine snapshots', () => {
      const memory = emptyMemory()
      memory.requirements.destination = 'Dubai'
      memory.requirements.origin = 'Riyadh'
      memory.requirements.startDate = '2026-08-15'
      memory.requirements.endDate = '2026-08-20'
      memory.requirements.budgetAmount = 8000
      memory.requirements.budgetCurrency = 'SAR'
      memory.requirements.travelers = 2
      memory.requirements.travelerType = 'couple'

      const concierge = integrateConciergeIntoTurn({
        conversationId: 'conv_99',
        memory,
        packageSelected: {
          id: 'pkg_1',
          title: 'Dubai balanced escape',
          totalPrice: 3600,
          currency: 'SAR',
          confidence: 0.86,
          labels: ['best overall'],
          explanation: 'Balanced pairing.',
        },
        flightOffers: [{
          id: 'flt_1',
          airline: 'Saudia',
          origin: 'RUH',
          destination: 'DXB',
          price: 1200,
          currency: 'SAR',
          durationMinutes: 190,
          stops: 0,
        }],
        hotelOffers: [{
          id: 'htl_1',
          name: 'Marina Hotel',
          price: 2200,
          currency: 'SAR',
          stars: 4,
          rating: 4.4,
        }],
        decision: {
          explanation: 'Best overall for couple',
          confidence: 0.86,
        },
        priceTimingNote: 'Book soon for better fares.',
        priceConfidence: 0.7,
        engineConfidence: 0.86,
      })

      const attachment = assembleAlphaTravelerExperience({
        conversationId: 'conv_99',
        memory,
        conciergeIntegration: concierge,
        packageSelected: {
          id: 'pkg_1',
          title: 'Dubai balanced escape',
          totalPrice: 3600,
          currency: 'SAR',
          confidence: 0.86,
          explanation: 'Balanced pairing.',
        },
        flightOffers: [{
          id: 'flt_1',
          airline: 'Saudia',
          origin: 'RUH',
          destination: 'DXB',
          price: 1200,
          currency: 'SAR',
          durationMinutes: 190,
          stops: 0,
        }],
        hotelOffers: [{
          id: 'htl_1',
          name: 'Marina Hotel',
          price: 2200,
          currency: 'SAR',
          stars: 4,
          rating: 4.4,
        }],
        decisionExplanation: 'Best overall for couple',
        priceTimingNote: 'Book soon for better fares.',
        priceConfidence: 0.7,
        engineConfidence: 0.86,
      })

      expect(attachment).not.toBeNull()
      expect(attachment?.meta.enabled).toBe(true)
      expect(attachment?.meta.sectionCount).toBeGreaterThan(0)
      expect(attachment?.experience.sectionIds).toContain('flight')
      expect(attachment?.experience.sectionIds).toContain('hotel')
      expect(attachment?.experience.sectionIds).toContain('package')
      expect(attachment?.experience.sectionIds).toContain('price')
      expect(attachment?.experience.finalRecommendation).toBeTruthy()

      const composeInput = toAlphaExperienceComposeInput({
        memory,
        conciergeIntegration: concierge,
        packageSelected: { id: 'pkg_1', title: 'Dubai balanced escape' },
      })
      expect(composeInput.concierge?.enabled).toBe(true)
    })
  })
})
