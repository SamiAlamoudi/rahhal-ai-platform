/**
 * Sprint 89 Phase 1 hardening — correction / abort / stale-reference regressions.
 * Understanding quality only. No search, planning, reasoning, booking.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resetFeatureRegistry } from '../ai'
import { emptyMemory } from '../agent/types'
import {
  createConversationStateSnapshot,
  createIntentExtractor,
  createProvenancedEntityExtractor,
  createReferenceResolver,
  createUnderstandingMemoryManager,
  understandTurn,
} from '../brain/v1'

describe('Sprint 89 Phase 1 — correction hardening', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('destination corrections override previous destination', () => {
    it('I wanted Dubai → Actually make it Morocco → Morocco wins', () => {
      const turn1 = understandTurn({
        text: 'I wanted Dubai.',
        locale: 'en',
        conversationId: 'corr-dest-1',
      })
      expect(turn1.entities.entities.destination).toBe('Dubai')

      const turn2 = understandTurn({
        text: 'Actually make it Morocco.',
        locale: 'en',
        conversationId: 'corr-dest-1',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
        memoryHints: {
          destination: turn1.entities.entities.destination,
          recentTexts: ['I wanted Dubai.'],
        },
      })

      expect(turn2.intent.isCorrection).toBe(true)
      expect(turn2.entities.entities.destination).toBe('Morocco')
      expect(turn2.state.knownSlots.destination).toBe('Morocco')
      expect(turn2.state.supersededFields).toContain('destination')
      expect(turn2.provenance.destination?.value).toBe('Morocco')
      expect(turn2.provenance.destination?.previousValue).toBe('Dubai')
      expect(turn2.provenance.destination?.corrected).toBe(true)
    })

    it('Arabic destination correction Turkey overrides Morocco', () => {
      const turn1 = understandTurn({
        text: 'أريد رحلة إلى المغرب',
        locale: 'ar',
        conversationId: 'corr-dest-ar',
      })
      const turn2 = understandTurn({
        text: 'صرت أبغى تركيا بدل المغرب',
        locale: 'ar',
        conversationId: 'corr-dest-ar',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
        memoryHints: { destination: 'Morocco', recentTexts: ['أريد رحلة إلى المغرب'] },
      })
      expect(turn2.entities.entities.destination).toBe('Turkey')
      expect(turn2.state.knownSlots.destination).toBe('Turkey')
      expect(turn2.state.supersededFields).toContain('destination')
    })
  })

  describe('date corrections override previous dates', () => {
    it('replaces start date and clears superseded end on single-date correction', () => {
      const turn1 = understandTurn({
        text: 'Trip to Dubai 2026-10-01 to 2026-10-08',
        locale: 'en',
        conversationId: 'corr-dates',
      })
      expect(turn1.entities.entities.travelDates.start).toBe('2026-10-01')
      expect(turn1.entities.entities.travelDates.end).toBe('2026-10-08')

      const turn2 = understandTurn({
        text: 'Actually make it 2026-11-15',
        locale: 'en',
        conversationId: 'corr-dates',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
      })

      expect(turn2.intent.isCorrection).toBe(true)
      expect(turn2.entities.entities.travelDates.start).toBe('2026-11-15')
      expect(turn2.entities.entities.travelDates.end).toBeNull()
      expect(turn2.state.knownSlots.startDate).toBe('2026-11-15')
      expect(turn2.state.knownSlots.endDate).toBeNull()
      expect(turn2.state.supersededFields).toEqual(
        expect.arrayContaining(['startDate', 'endDate']),
      )
      expect(turn2.provenance['travelDates.start']?.previousValue).toBe('2026-10-01')
      expect(turn2.provenance['travelDates.start']?.corrected).toBe(true)
    })
  })

  describe('traveler corrections override previous counts', () => {
    it('overrides adults / traveler count', () => {
      const turn1 = understandTurn({
        text: 'Flight to Paris adults 2',
        locale: 'en',
        conversationId: 'corr-pax',
      })
      expect(turn1.entities.entities.adults).toBe(2)

      const turn2 = understandTurn({
        text: 'Actually make it 3 adults',
        locale: 'en',
        conversationId: 'corr-pax',
        priorEntities: turn1.entities.entities,
        priorState: turn1.state,
      })

      expect(turn2.intent.isCorrection).toBe(true)
      expect(turn2.entities.entities.adults).toBe(3)
      expect(turn2.state.knownSlots.adults).toBe(3)
      expect(turn2.state.supersededFields).toContain('adults')
      expect(turn2.entities.facts.some((f) => f.field === 'adults' && f.kind === 'corrected')).toBe(
        true,
      )
    })
  })

  describe('ReferenceResolver never keeps stale entities', () => {
    it('ignores stale recentTexts after destination correction', () => {
      const turn = understandTurn({
        text: 'Actually make it Morocco.',
        locale: 'en',
        conversationId: 'corr-ref',
        priorEntities: { destination: 'Dubai' },
        memoryHints: {
          destination: 'Dubai',
          recentTexts: ['I wanted Dubai.', 'same place'],
        },
      })
      expect(turn.entities.entities.destination).toBe('Morocco')
      // No resolved ref may point back to Dubai.
      expect(turn.references.resolved.every((r) => r.resolvesTo !== 'Dubai')).toBe(true)
    })

    it('resolves "there" to the corrected destination, not the old one', () => {
      const refs = createReferenceResolver()
      const r = refs.resolve({
        text: 'lets go there',
        destination: 'Morocco',
        recentTexts: ['I wanted Dubai.'],
      })
      expect(r.resolved.some((x) => x.resolvesTo === 'Morocco')).toBe(true)
      expect(r.resolved.every((x) => x.resolvesTo !== 'Dubai')).toBe(true)
    })

    it('does not apply conflicting stale reference over explicit entity', () => {
      const turn = understandTurn({
        text: 'Actually Morocco — same place',
        locale: 'en',
        conversationId: 'corr-ref-2',
        priorEntities: { destination: 'Dubai' },
        memoryHints: {
          destination: 'Dubai',
          recentTexts: ['Dubai trip'],
        },
      })
      expect(turn.entities.entities.destination).toBe('Morocco')
    })
  })

  describe('ConversationState removes superseded values', () => {
    it('drops prior destination from knownSlots on correction', () => {
      const s1 = createConversationStateSnapshot({
        conversationId: 'st',
        locale: 'en',
        knownSlots: {
          destination: 'Dubai',
          origin: 'Riyadh',
          startDate: '2026-10-01',
          endDate: '2026-10-08',
          adults: 2,
          children: null,
          travelerCount: 2,
          budget: null,
        },
      })
      const turn = understandTurn({
        text: 'Actually make it Morocco.',
        locale: 'en',
        conversationId: 'st',
        priorState: s1,
        priorEntities: {
          destination: 'Dubai',
          origin: 'Riyadh',
          travelDates: { start: '2026-10-01', end: '2026-10-08' },
          adults: 2,
          travelerCount: 2,
        },
      })
      expect(turn.state.knownSlots.destination).toBe('Morocco')
      expect(turn.state.knownSlots.destination).not.toBe('Dubai')
      expect(turn.state.knownSlots.origin).toBe('Riyadh')
      expect(turn.state.supersededFields).toContain('destination')
    })
  })

  describe('abort never deletes confirmed memories', () => {
    it('understandTurn abort preserves entities and proposes no memory writes', () => {
      const planned = understandTurn({
        text: 'I want a trip to Morocco',
        locale: 'en',
        conversationId: 'abort-1',
      })
      expect(planned.entities.entities.destination).toBe('Morocco')

      const aborted = understandTurn({
        text: 'cancel planning',
        locale: 'en',
        conversationId: 'abort-1',
        priorEntities: planned.entities.entities,
        priorState: planned.state,
        memoryHints: { destination: 'Morocco' },
      })

      expect(aborted.intent.primaryIntent).toBe('abort')
      expect(aborted.entities.entities.destination).toBe('Morocco')
      expect(aborted.memoryProposals).toHaveLength(0)
      expect(aborted.entities.facts).toHaveLength(0)
      expect(aborted.state.knownSlots.destination).toBe('Morocco')
      expect(aborted.state.supersededFields).toHaveLength(0)
    })

    it('MemoryManager preserveOnAbort is a no-op', () => {
      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('en')
      memory = mm.applyEntityFacts(memory, [
        {
          field: 'destination',
          value: 'Morocco',
          kind: 'user_provided',
          confidence: { level: 'confirmed', score: 1 },
          evidence: 'Morocco',
        },
      ]).memory
      expect(memory.requirements.destination).toBe('Morocco')

      const aborted = mm.applyEntityFacts(
        memory,
        [
          {
            field: 'destination',
            value: 'Nowhere',
            kind: 'user_provided',
            confidence: { level: 'confirmed', score: 1 },
            evidence: 'cancel',
          },
        ],
        { preserveOnAbort: true },
      )
      expect(aborted.memory.requirements.destination).toBe('Morocco')
      expect(aborted.applied).toHaveLength(0)
      expect(mm.getProvenance().destination?.value).toBe('Morocco')
    })
  })

  describe('memory provenance after corrections', () => {
    it('records previousValue and corrected on MemoryManager apply', () => {
      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('en')
      memory = mm.applyEntityFacts(memory, [
        {
          field: 'destination',
          value: 'Dubai',
          kind: 'user_provided',
          confidence: { level: 'confirmed', score: 1 },
          evidence: 'Dubai',
        },
      ]).memory

      const corrected = mm.applyEntityFacts(memory, [
        {
          field: 'destination',
          value: 'Morocco',
          kind: 'corrected',
          confidence: { level: 'confirmed', score: 1 },
          evidence: 'Actually Morocco',
        },
      ])

      expect(corrected.memory.requirements.destination).toBe('Morocco')
      expect(corrected.provenance.destination?.value).toBe('Morocco')
      expect(corrected.provenance.destination?.previousValue).toBe('Dubai')
      expect(corrected.provenance.destination?.corrected).toBe(true)
      expect(corrected.provenance.destination?.source).toBe('user_stated')
    })

    it('records traveler count correction provenance', () => {
      const mm = createUnderstandingMemoryManager()
      let memory = emptyMemory('en')
      memory = mm.applyEntityFacts(memory, [
        {
          field: 'adults',
          value: 2,
          kind: 'user_provided',
          confidence: { level: 'confirmed', score: 1 },
          evidence: '2 adults',
        },
      ]).memory
      const corrected = mm.applyEntityFacts(memory, [
        {
          field: 'adults',
          value: 4,
          kind: 'corrected',
          confidence: { level: 'confirmed', score: 1 },
          evidence: '4 adults',
        },
      ])
      expect(corrected.memory.requirements.travelers).toBe(4)
      expect(corrected.provenance.travelers?.previousValue).toBe(2)
      expect(corrected.provenance.travelers?.corrected).toBe(true)
    })
  })

  describe('intent / extractor spot checks', () => {
    it('detects make-it corrections', () => {
      const intent = createIntentExtractor().extract('Actually make it Morocco.')
      expect(intent.primaryIntent).toBe('correct')
      expect(intent.isCorrection).toBe(true)
    })

    it('extractor marks corrected kind when overriding prior destination', () => {
      const ex = createProvenancedEntityExtractor()
      const prior = ex.extract('I wanted Dubai.')
      const next = ex.extractWithProvenance('Actually make it Morocco.', prior)
      expect(next.entities.destination).toBe('Morocco')
      expect(next.facts.find((f) => f.field === 'destination')?.kind).toBe('corrected')
    })
  })
})
