/**
 * Sprint 45 — Autonomous Travel Reasoning Engine tests.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  getFeatureRegistry,
  resetFeatureRegistry,
  resetPreferenceEngine,
  getPreferenceEngine,
  emptyPersonalizationProfile,
} from '../ai'
import { extractFromUserText } from '../agent/extractRequirements'
import { mergeRequirements, missingRequirementFields } from '../agent/memory'
import { emptyRequirements } from '../agent/types'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  detectOpenEndedDestination,
  runTravelReasoning,
  applyReasoningToRequirements,
  seedRequirementsFromPreferences,
  learnPreferencesFromRequirements,
  matchDestinationSelection,
  formatReasoningReply,
} from '../agent/reasoning'
import type { ChatMessage } from '../chat/chatTypes'

function userMessage(content: string): ChatMessage {
  const now = new Date().toISOString()
  return {
    id: `u-${Math.random().toString(36).slice(2, 8)}`,
    conversationId: 'conv-45',
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: now,
    updatedAt: now,
  }
}

describe('Sprint 45 feature flag', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  it('enables ai.travel_reasoning by default with dependencies', () => {
    const registry = getFeatureRegistry()
    expect(registry.isEnabled('ai.travel_reasoning')).toBe(true)
    registry.setEnabled('ai.concierge', false)
    expect(registry.isEnabled('ai.travel_reasoning')).toBe(false)
  })
})

describe('open-ended detection + extraction', () => {
  it('detects English somewhere-cold discovery', () => {
    const open = detectOpenEndedDestination(
      'I want somewhere cold next month with a budget of 12000 SAR.',
      false,
    )
    expect(open.isOpenEnded).toBe(true)
    expect(open.climateHint).toBe('cold')
  })

  it('extracts discover intent with flexible destination and budget', () => {
    const result = extractFromUserText(
      'I want somewhere cold next month with a budget of 12000 SAR.',
    )
    expect(result.intent).toBe('discover')
    expect(result.patch.destinationFlexible).toBe(true)
    expect(result.patch.weatherPreference).toBe('cool')
    expect(result.patch.budgetAmount).toBe(12000)
    expect(result.patch.budgetCurrency).toBe('SAR')
    expect(result.patch.startDate).toBeTruthy()
    expect(result.patch.destination).toBeUndefined()
  })

  it('extracts Arabic open-ended cold destination ask', () => {
    const result = extractFromUserText(
      'أبي مكان بارد الشهر القادم بميزانية 12000 ريال',
    )
    expect(result.locale).toBe('ar')
    expect(result.intent).toBe('discover')
    expect(result.patch.destinationFlexible).toBe(true)
    expect(result.patch.weatherPreference).toBe('cool')
    expect(result.patch.budgetAmount).toBe(12000)
  })

  it('keeps named Japan trips as plan (not discover)', () => {
    const result = extractFromUserText('Plan a 7-day trip to Japan.')
    expect(result.intent).toBe('plan')
    expect(result.patch.destination).toBe('Japan')
    expect(result.patch.destinationFlexible).toBeUndefined()
  })
})

describe('travel reasoning engine', () => {
  it('ranks cool destinations for next-month cold budget trip', () => {
    const requirements = mergeRequirements(emptyRequirements(), {
      destinationFlexible: true,
      weatherPreference: 'cool',
      budgetAmount: 12000,
      budgetCurrency: 'SAR',
      startDate: '2026-08-01',
      durationDays: 5,
      travelers: 2,
    })
    const result = runTravelReasoning({
      locale: 'en',
      requirements,
      userText: 'somewhere cold next month budget 12000 SAR',
      now: new Date('2026-07-20T00:00:00Z'),
    })
    expect(result.mode).toBe('open_ended')
    expect(result.primary).toBeTruthy()
    expect(result.alternatives.length).toBeGreaterThan(0)
    expect(result.overallConfidence).toBeGreaterThan(0.4)
    expect(result.primary?.whySelected.length).toBeGreaterThan(0)
    // Cool/cold August destinations should outrank hot Gulf summer spots.
    const topIds = [result.primary!, ...result.alternatives].map((row) => row.id)
    expect(topIds).not.toContain('dubai')
  })

  it('does not treat destination as missing when flexible', () => {
    const requirements = mergeRequirements(emptyRequirements(), {
      destinationFlexible: true,
      weatherPreference: 'cool',
      budgetAmount: 12000,
      budgetCurrency: 'SAR',
      destinations: ['Istanbul', 'Tbilisi'],
    })
    const missing = missingRequirementFields(requirements)
    expect(missing).not.toContain('destination')
  })

  it('applies reasoning suggestions into destinations without locking', () => {
    const base = mergeRequirements(emptyRequirements(), {
      destinationFlexible: true,
      weatherPreference: 'cool',
      budgetAmount: 12000,
      budgetCurrency: 'SAR',
      startDate: '2026-08-01',
    })
    const reasoned = runTravelReasoning({ locale: 'en', requirements: base, userText: 'somewhere cold' })
    const next = applyReasoningToRequirements(base, reasoned)
    expect(next.destination).toBeNull()
    expect(next.destinationFlexible).toBe(true)
    expect(next.destinations.length).toBeGreaterThan(0)
  })

  it('matches ordinal destination selection', () => {
    const picked = matchDestinationSelection('the first one', [
      { id: 'istanbul', name: 'Istanbul', nameAr: 'إسطنبول' },
      { id: 'tbilisi', name: 'Tbilisi', nameAr: 'تبليسي' },
    ])
    expect(picked).toBe('Istanbul')
  })
})

describe('preference memory bridge', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
  })

  it('seeds empty slots from long-term preferences and never overwrites', () => {
    const engine = getPreferenceEngine()
    const profile = emptyPersonalizationProfile('user-45')
    profile.budget.typicalTripBudget = 15000
    profile.budget.currency = 'SAR'
    profile.travelStyle.weatherPreference = 'cool'
    profile.traveler.preferredGroupSize = 2
    profile.traveler.travelerTypes = ['couple']
    engine.upsertProfile(profile)

    const seeded = seedRequirementsFromPreferences(emptyRequirements(), {
      userId: 'user-45',
      engine,
    })
    expect(seeded.budgetAmount).toBe(15000)
    expect(seeded.weatherPreference).toBe('cool')
    expect(seeded.travelers).toBe(2)
    expect(seeded.travelerType).toBe('couple')

    const preserved = seedRequirementsFromPreferences(
      mergeRequirements(emptyRequirements(), { budgetAmount: 9000, weatherPreference: 'warm' }),
      { userId: 'user-45', engine },
    )
    expect(preserved.budgetAmount).toBe(9000)
    expect(preserved.weatherPreference).toBe('warm')
  })

  it('learns preferences from stated requirements', () => {
    const engine = getPreferenceEngine()
    const learned = learnPreferencesFromRequirements(
      mergeRequirements(emptyRequirements(), {
        budgetAmount: 12000,
        budgetCurrency: 'SAR',
        weatherPreference: 'cool',
        travelerType: 'couple',
        travelers: 2,
        interests: ['culture'],
      }),
      { userId: 'user-45-learn', engine },
    )
    expect(learned?.budget.typicalTripBudget).toBe(12000)
    expect(learned?.travelStyle.weatherPreference).toBe('cool')
    expect(learned?.traveler.travelerTypes).toContain('couple')
    expect(learned?.travelStyle.interests).toContain('culture')
  })
})

describe('travelAgentService open-ended reasoning turn', () => {
  beforeEach(() => {
    resetFeatureRegistry()
    resetPreferenceEngine()
  })

  it('proposes destinations instead of asking where to go', async () => {
    const service = createTravelAgentService({
      conciergeEnabled: true,
      travelReasoningEnabled: true,
      brainEnabled: false,
    })
    const turn = await service.planTurn({
      conversationId: 'conv-45',
      messages: [
        userMessage('I want somewhere cold next month with a budget of 12000 SAR.'),
      ],
    })

    expect(turn.memory.requirements.destinationFlexible).toBe(true)
    expect(turn.memory.requirements.weatherPreference).toBe('cool')
    expect(turn.memory.requirements.budgetAmount).toBe(12000)
    expect(turn.meta.reasoning).toBeTruthy()
    expect(turn.meta.reasoning?.candidateIds.length).toBeGreaterThan(0)
    expect(turn.reply.toLowerCase()).toMatch(/recommend|ترشيح|اقترح|destination|وجهة|istanbul|tbilisi|geneva|baku|cappadocia|london|paris/)
    expect(turn.reply.toLowerCase()).not.toMatch(/where do you want to (?:travel|go)\?/)
    expect(turn.reply).not.toMatch(/وين تبي تسافر/)
  })

  it('formats bilingual reasoning replies with follow-ups', () => {
    const requirements = mergeRequirements(emptyRequirements(), {
      destinationFlexible: true,
      weatherPreference: 'cool',
      budgetAmount: 12000,
      budgetCurrency: 'SAR',
      startDate: '2026-08-01',
    })
    const result = runTravelReasoning({
      locale: 'ar',
      requirements,
      userText: 'مكان بارد',
      now: new Date('2026-07-20T00:00:00Z'),
    })
    const reply = formatReasoningReply({ result, requirements })
    expect(reply).toContain('ترشيحاتي')
    expect(reply.length).toBeGreaterThan(40)
  })
})
