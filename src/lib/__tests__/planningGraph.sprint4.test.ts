/**
 * Evolution Sprint 4 — Planning Graph Layer tests
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  PLANNING_GRAPH_FEATURE_ID,
  isPlanningGraphEnabled,
  createPlanningGraph,
  tryCreatePlanningGraph,
  PlanningGraph,
  comparePlans,
  findMergeCandidates,
  selectBestPlan,
  propagateConstraints,
  propagateConfidence,
} from '../agent/planningGraph'
import { createReflectionSession, reflectTurn } from '../agent/reflection'
import { runConsultantReasoningPipeline } from '../agent/reasoning'

describe('Evolution Sprint 4 — Planning Graph Layer', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate', () => {
    it('registers ai.planning_graph default OFF', () => {
      expect(getFeatureRegistry().isEnabled(PLANNING_GRAPH_FEATURE_ID)).toBe(false)
      expect(isPlanningGraphEnabled()).toBe(false)
      expect(tryCreatePlanningGraph('en')).toBeNull()
      expect(tryCreatePlanningGraph('en', { enabled: true })).not.toBeNull()
    })
  })

  describe('graph creation', () => {
    it('creates root plan with required node fields', () => {
      const graph = createPlanningGraph('en', new Date('2026-07-24T16:00:00.000Z'))
      const root = PlanningGraph.addRoot(graph, {
        locale: 'en',
        label: 'Family Dubai week',
        intent: 'plan',
        destinations: ['Dubai'],
        budget: { amount: 12000, currency: 'SAR', stance: 'value_seeking' },
        dates: { durationDays: 7, flexible: false },
        travelerProfile: { purpose: 'family', riskTolerance: 'low', interests: ['beach'] },
        constraints: { hard: ['destination:Dubai'], soft: ['prefer_relaxed_pace'] },
        confidence: 0.72,
        score: 68,
        evidence: ['user:named_dubai'],
        assumptions: ['Party of 4 assumed later'],
        risks: ['Summer heat'],
        tradeoffs: ['City convenience vs beach quiet'],
        missingData: ['exact_party_size'],
        reasoningRef: 'reasoning_demo',
        reflectionRef: 'reflection_demo',
        whyExists: 'Traveler named Dubai for a family week.',
        now: new Date('2026-07-24T16:00:00.000Z'),
      })

      expect(root.intent).toBe('plan')
      expect(root.travelerProfile.purpose).toBe('family')
      expect(root.constraints.hard).toContain('destination:Dubai')
      expect(root.budget.amount).toBe(12000)
      expect(root.dates.durationDays).toBe(7)
      expect(root.destinations).toEqual(['Dubai'])
      expect(root.confidence).toBeGreaterThan(0)
      expect(root.reasoningRef).toBe('reasoning_demo')
      expect(root.reflectionRef).toBe('reflection_demo')
      expect(root.evidence.length).toBeGreaterThan(0)
      expect(root.createdAt).toBeTruthy()
      expect(Object.keys(graph.nodes)).toHaveLength(1)
      expect(graph.activeBranchId).toBeTruthy()
      expect(graph.decisionLog[0]?.action).toBe('create')
    })
  })

  describe('branch merge restore', () => {
    it('branches, compares, merges, rejects, restores without losing rejected history', () => {
      const graph = createPlanningGraph('en')
      const root = PlanningGraph.addRoot(graph, {
        locale: 'en',
        label: 'Open cultural trip',
        intent: 'discover',
        destinations: [],
        confidence: 0.55,
        score: 55,
        whyExists: 'Discovery root',
        travelerProfile: { purpose: 'cultural' },
      })

      const istanbul = PlanningGraph.branch(graph, root.id, {
        locale: 'en',
        label: 'Istanbul cultural',
        destinations: ['Istanbul'],
        reason: 'Traveler leaned Istanbul',
        whyExists: 'Branch toward Istanbul',
        confidence: 0.7,
        score: 70,
        evidence: ['user:istanbul'],
        constraints: { hard: ['destination:Istanbul'] },
      })

      const baku = PlanningGraph.branch(graph, root.id, {
        locale: 'en',
        label: 'Baku cultural',
        destinations: ['Baku'],
        reason: 'Alternative hub Baku',
        whyExists: 'Branch toward Baku',
        confidence: 0.62,
        score: 62,
        evidence: ['user:baku_option'],
        constraints: { hard: ['destination:Baku'] },
      })

      expect(PlanningGraph.nodes(graph).length).toBeGreaterThanOrEqual(3)
      expect(graph.forks.length).toBe(2)
      expect(istanbul.parentIds).toContain(root.id)

      const comparison = PlanningGraph.compare(graph, istanbul.id, baku.id)
      expect(comparison.leftId).toBe(istanbul.id)
      expect(comparison.reasons.length).toBeGreaterThan(0)

      const merged = PlanningGraph.merge(graph, istanbul.id, baku.id, {
        reason: 'Traveler wants dual-city option',
        label: 'Istanbul ⊕ Baku',
      })
      expect(merged.parentIds).toEqual(expect.arrayContaining([istanbul.id, baku.id]))
      expect(merged.destinations).toEqual(expect.arrayContaining(['Istanbul', 'Baku']))
      expect(graph.nodes[istanbul.id]!.status).toBe('merged')
      expect(graph.nodes[baku.id]!.status).toBe('merged')

      const weak = PlanningGraph.clone(graph, merged.id, {
        label: 'Weak clone',
        whyExists: 'Low-fit experiment',
      })
      weak.score = 20
      weak.confidence = 0.2
      weak.missingData = ['a', 'b', 'c', 'd', 'e']
      graph.nodes[weak.id] = weak

      const discarded = PlanningGraph.reject(graph, weak.id, { reason: 'Too incomplete' })
      expect(discarded.status).toBe('rejected')
      expect(PlanningGraph.rejected(graph).some((n) => n.id === weak.id)).toBe(true)

      const restored = PlanningGraph.restore(graph, weak.id, {
        reason: 'Traveler revisited the idea',
      })
      expect(restored.status).toBe('active')
      expect(restored.parentIds).toContain(weak.id)
      expect(graph.edges.some((e) => e.kind === 'restore')).toBe(true)
      // Original rejected node remains addressable
      expect(graph.nodes[weak.id]!.status).toBe('rejected')
    })
  })

  describe('plan comparison + selection', () => {
    it('scores and selects best plan', () => {
      const graph = createPlanningGraph('en')
      const a = PlanningGraph.addRoot(graph, {
        locale: 'en',
        label: 'A',
        destinations: ['Dubai'],
        confidence: 0.85,
        score: 60,
        budget: { amount: 10000, currency: 'SAR' },
        dates: { durationDays: 5 },
        missingData: [],
      })
      const b = PlanningGraph.branch(graph, a.id, {
        locale: 'en',
        label: 'B',
        destinations: [],
        reason: 'Budget Cairo alternative',
        confidence: 0.3,
        score: 25,
        missingData: ['destination', 'budget_amount', 'duration', 'party_size', 'trip_purpose'],
        risks: ['r1', 'r2', 'r3', 'r4'],
      })
      const scoreA = PlanningGraph.score(graph, a.id)
      const scoreB = PlanningGraph.score(graph, b.id)
      expect(scoreA).toBeGreaterThan(scoreB)
      const best = PlanningGraph.selectBest(graph)
      expect(best.nodeId).toBe(a.id)
      expect(selectBestPlan(PlanningGraph.nodes(graph)).nodeId).toBe(best.nodeId)
      expect(findMergeCandidates(PlanningGraph.nodes(graph)).length).toBeGreaterThanOrEqual(0)
      expect(comparePlans(graph.nodes[a.id]!, graph.nodes[b.id]!).winnerId).toBe(a.id)
    })
  })

  describe('propagation', () => {
    it('propagates constraints and confidence on branch', () => {
      const graph = createPlanningGraph('en')
      const root = PlanningGraph.addRoot(graph, {
        locale: 'en',
        constraints: { hard: ['low_risk_preference'], soft: ['prefer_relaxed_pace'] },
        confidence: 0.8,
        travelerProfile: { purpose: 'family', interests: ['culture'] },
      })
      const child = PlanningGraph.branch(graph, root.id, {
        reason: 'Add destination',
        destinations: ['Istanbul'],
        confidence: 0.4,
        travelerProfile: { interests: ['food'] },
        constraints: { soft: ['hotel_central'] },
      })
      expect(child.constraints.hard).toContain('low_risk_preference')
      expect(child.constraints.soft).toEqual(
        expect.arrayContaining(['prefer_relaxed_pace', 'hotel_central']),
      )
      expect(child.travelerProfile.interests).toEqual(expect.arrayContaining(['culture', 'food']))
      expect(child.confidence).toBe(propagateConfidence(root, { ...child, confidence: 0.4 }))
      const propagated = propagateConstraints(root, child)
      expect(propagated.constraints.hard.length).toBeGreaterThan(0)
    })
  })

  describe('Arabic', () => {
    it('maintains Arabic locale plans and branch rationale', () => {
      const graph = createPlanningGraph('ar')
      const root = PlanningGraph.addRoot(graph, {
        locale: 'ar',
        label: 'رحلة عائلية',
        intent: 'discover',
        travelerProfile: { purpose: 'family' },
        whyExists: 'اقتراح أولي لرحلة عائلية',
        evidence: ['user:عائلة'],
      })
      const branch = PlanningGraph.branch(graph, root.id, {
        locale: 'ar',
        label: 'خطة دبي',
        destinations: ['Dubai'],
        reason: 'المسافر فضّل دبي',
        whyExists: 'فرع دبي بعد تفضيل المسافر',
        budget: { amount: 15000, currency: 'SAR' },
      })
      expect(branch.locale).toBe('ar')
      expect(branch.whyExists).toMatch(/دبي/)
      expect(graph.branches[branch.branchId]?.whyExists).toMatch(/دبي|فضّل/)
    })
  })

  describe('English', () => {
    it('clones and keeps decision history', () => {
      const graph = createPlanningGraph('en')
      const root = PlanningGraph.addRoot(graph, {
        locale: 'en',
        label: 'Honeymoon open',
        intent: 'discover',
        travelerProfile: { purpose: 'honeymoon', budgetStance: 'comfort_first' },
        whyExists: 'Romantic discovery',
      })
      const cloned = PlanningGraph.clone(graph, root.id, {
        label: 'Honeymoon Maldives draft',
        whyExists: 'Explore Maldives without losing open root',
      })
      expect(cloned.id).not.toBe(root.id)
      expect(graph.nodes[root.id]).toBeTruthy()
      expect(graph.decisionLog.some((d) => d.action === 'clone')).toBe(true)
      expect(PlanningGraph.alternatives(graph, root.id).some((a) => a.nodeId === cloned.id)).toBe(
        true,
      )
    })
  })

  describe('regression — freeze boundaries', () => {
    it('does not export planTurn from planningGraph', async () => {
      const mod = await import('../agent/planningGraph')
      expect('planTurn' in mod).toBe(false)
      expect(typeof mod.createPlanningGraph).toBe('function')
      expect(typeof mod.PlanningGraph.branch).toBe('function')
    })

    it('Reasoning and Reflection remain independently callable', () => {
      const reasoning = runConsultantReasoningPipeline({
        locale: 'en',
        userText: 'Family trip ideas',
      })
      expect(reasoning.recommendation).toBeTruthy()

      const session = createReflectionSession('en')
      const reflected = reflectTurn(session, {
        userText: 'Family trip ideas',
        locale: 'en',
        enabled: true,
      })
      expect(reflected.latestRecommendation).toBeTruthy()

      // Planning graph can store opaque refs without mutating those layers
      const graph = createPlanningGraph('en')
      const node = PlanningGraph.addRoot(graph, {
        locale: 'en',
        reasoningRef: 'bundle',
        reflectionRef: session.id,
        destinations: [],
      })
      expect(node.reasoningRef).toBe('bundle')
      expect(node.reflectionRef).toBe(session.id)
    })
  })
})
