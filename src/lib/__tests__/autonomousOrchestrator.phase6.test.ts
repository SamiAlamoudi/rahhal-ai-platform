/**
 * Recovery Phase 6 — Autonomous Agent Orchestrator tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import {
  applyWorkflowCommand,
  detectConflicts,
  isAutonomousAgentOrchestratorEnabled,
  PHASE6_AUTONOMOUS_ORCHESTRATOR_VERSION,
  planRecovery,
  runAutonomousAgentOrchestrator,
  enrichWithAutonomousAgentOrchestrator,
  updateTravelGoal,
  emptyTravelGoal,
} from '../agent/orchestrator/autonomous'
import { createTravelAgentService } from '../agent/travelAgentService'
import { emptyMemory } from '../agent/types'
import type { ChatMessage } from '../chat/chatTypes'
import { PIPELINE_ORCHESTRATOR_FEATURE_ID } from '../agent/orchestrator'

function msg(content: string, conversationId = 'ao-p6'): ChatMessage {
  return {
    id: `u-${Math.random().toString(36).slice(2, 7)}`,
    conversationId,
    role: 'user',
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta: {},
    createdAt: '2026-07-23T00:00:00.000Z',
    updatedAt: '2026-07-23T00:00:00.000Z',
  }
}

describe('Phase 6 — Autonomous Agent Orchestrator', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('keeps ai.autonomous_agent_orchestrator OFF and distinct from Sprint 113 flag', () => {
    expect(getFeatureRegistry().isEnabled('ai.autonomous_agent_orchestrator')).toBe(false)
    expect(isAutonomousAgentOrchestratorEnabled()).toBe(false)
    expect(PIPELINE_ORCHESTRATOR_FEATURE_ID).toBe('ai.orchestrator')
    expect(getFeatureRegistry().isEnabled('ai.orchestrator')).toBe(false)
    expect(PHASE6_AUTONOMOUS_ORCHESTRATOR_VERSION).toMatch(/phase6/)
  })

  it('builds a honeymoon Japan mission with multi-step tasks', () => {
    const result = runAutonomousAgentOrchestrator({
      userText: 'I want a honeymoon in Japan.',
      locale: 'en',
    })
    expect(result.mission.goal.destination).toBe('Japan')
    expect(result.mission.goal.purpose).toBe('honeymoon')
    expect(result.mission.goal.travelers).toBe(2)
    const kinds = result.mission.tasks.map((t) => t.kind)
    expect(kinds).toContain('understand_request')
    expect(kinds).toContain('flight_strategy')
    expect(kinds).toContain('hotel_strategy')
    expect(kinds).toContain('visa_check')
    expect(kinds).toContain('recommend')
    expect(kinds).toContain('wait_approval')
    expect(result.execution.completedTaskIds.length).toBeGreaterThan(0)
    expect(result.decisions.every((d) => d.debugOnly)).toBe(true)
  })

  it('replans when destination changes to Korea', () => {
    const first = runAutonomousAgentOrchestrator({
      userText: 'I want a honeymoon in Japan.',
      locale: 'en',
    })
    const second = runAutonomousAgentOrchestrator({
      userText: 'Actually make it Korea.',
      locale: 'en',
      priorMission: first.mission,
      priorExecution: first.execution,
      priorMemory: first.memory,
    })
    expect(second.replanned).toBe(true)
    expect(second.mission.goal.destination).toBe('Korea')
    expect(second.timeline.some((e) => e.kind === 'replan')).toBe(true)
  })

  it('handles budget change and short duration rebuild cues', () => {
    const base = runAutonomousAgentOrchestrator({
      userText: 'Honeymoon in Japan around ten thousand',
      locale: 'en',
    })
    const budgeted = runAutonomousAgentOrchestrator({
      userText: 'Budget changed to SAR 8000',
      locale: 'en',
      priorMission: base.mission,
    })
    expect(budgeted.mission.goal.budgetAmount).toBe(8000)
    expect(budgeted.replanned).toBe(true)

    const short = runAutonomousAgentOrchestrator({
      userText: 'I only have 5 days.',
      locale: 'en',
      priorMission: budgeted.mission,
    })
    expect(short.mission.goal.durationDays).toBe(5)
    const activities = short.mission.tasks.find((t) => t.kind === 'activities')
    expect(activities?.priority).toBe('high')
  })

  it('self-corrects when companion cannot travel', () => {
    const first = runAutonomousAgentOrchestrator({
      userText: 'I want a honeymoon in Japan.',
      locale: 'en',
    })
    const solo = runAutonomousAgentOrchestrator({
      userText: "My wife can't travel.",
      locale: 'en',
      priorMission: first.mission,
    })
    expect(solo.mission.goal.travelers).toBe(1)
    expect(solo.mission.goal.notes).toContain('companion_unavailable')
    expect(detectConflicts(solo.mission.goal).join(' ')).toMatch(/Honeymoon|solo/i)
  })

  it('asks only unblocking clarifications (no interview chain)', () => {
    const result = runAutonomousAgentOrchestrator({
      userText: 'I want a honeymoon in Japan.',
      locale: 'en',
    })
    expect(result.clarifications.length).toBeLessThanOrEqual(1)
    if (result.clarifications[0]) {
      expect(result.clarifications[0].toLowerCase()).not.toMatch(/what is your name/)
    }
  })

  it('supports Arabic and Saudi dialect goal capture', () => {
    const ar = runAutonomousAgentOrchestrator({
      userText: 'أبي شهر عسل في اليابان',
      locale: 'ar',
    })
    expect(ar.mission.goal.destination).toBe('Japan')
    expect(ar.mission.goal.purpose).toBe('honeymoon')
    expect(ar.replyPreview).toMatch(/مهمة|اليابان|اختراع/)
  })

  it('supports mixed Arabic-English corrections', () => {
    const first = runAutonomousAgentOrchestrator({
      userText: 'أبي اليابان honeymoon',
      locale: 'ar',
    })
    const second = runAutonomousAgentOrchestrator({
      userText: 'Actually make it Korea. Budget 12000 SAR',
      locale: 'ar',
      priorMission: first.mission,
    })
    expect(second.mission.goal.destination).toBe('Korea')
    expect(second.mission.goal.budgetAmount).toBe(12000)
  })

  it('routes tools dynamically and plans recovery without APIs', () => {
    const result = runAutonomousAgentOrchestrator({
      userText: 'Honeymoon in Tokyo — do I need a visa?',
      locale: 'en',
    })
    expect(['visa', 'flights', 'weather', 'none', 'hotels']).toContain(result.toolDecision.tool)
    const recovery = planRecovery({
      toolDecision: result.toolDecision,
      goal: result.mission.goal,
      failedTool: 'flights',
      missingCritical: false,
    })
    expect(recovery.some((r) => r.kind === 'use_fallback_tool' || r.kind === 'retry_tool')).toBe(
      true,
    )
    expect(recovery.some((r) => r.kind === 'continue_with_estimate')).toBe(true)
  })

  it('supports long-running workflow cancel / resume', () => {
    const result = runAutonomousAgentOrchestrator({
      userText: 'I want a honeymoon in Japan.',
      locale: 'en',
    })
    const cancelled = applyWorkflowCommand(result.mission, result.execution, 'cancel')
    expect(cancelled.mission.status).toBe('cancelled')
    expect(cancelled.execution.phase).toBe('cancel')
    const resumed = applyWorkflowCommand(result.mission, result.execution, 'resume')
    expect(resumed.mission.status).toBe('executing')
  })

  it('keeps decision explanations debug-only', () => {
    const result = runAutonomousAgentOrchestrator({
      userText: 'Honeymoon in Japan in October',
      locale: 'en',
    })
    expect(result.decisions.length).toBeGreaterThan(0)
    expect(result.decisions.every((d) => d.debugOnly === true)).toBe(true)
    expect(result.timeline.some((e) => e.kind === 'reasoning')).toBe(true)
  })

  it('enrich is a no-op when flag OFF', () => {
    const { autonomousOrchestrator, memory } = enrichWithAutonomousAgentOrchestrator({
      userText: 'I want a honeymoon in Japan.',
      memory: emptyMemory(),
    })
    expect(autonomousOrchestrator).toBeNull()
    expect(memory.requirements.destination).toBeNull()
  })

  it('planTurn attaches autonomousOrchestrator meta only when enabled', async () => {
    const off = createTravelAgentService({ autonomousAgentOrchestratorEnabled: false })
    const offTurn = await off.planTurn({
      conversationId: 'ao-off',
      messages: [msg('I want a honeymoon in Japan.', 'ao-off')],
    })
    expect(offTurn.meta.autonomousOrchestrator).toBeUndefined()

    const on = createTravelAgentService({ autonomousAgentOrchestratorEnabled: true })
    const onTurn = await on.planTurn({
      conversationId: 'ao-on',
      messages: [msg('I want a honeymoon in Japan.', 'ao-on')],
    })
    expect(onTurn.meta.autonomousOrchestrator?.destination).toBe('Japan')
    expect(onTurn.meta.autonomousOrchestrator?.purpose).toBe('honeymoon')
    expect(onTurn.meta.autonomousOrchestrator?.taskCount).toBeGreaterThan(5)
    expect(onTurn.meta.autonomousOrchestrator?.timeline?.length).toBeGreaterThan(0)
  })

  it('goal manager version bumps on material change', () => {
    const g1 = updateTravelGoal(null, 'Honeymoon in Japan')
    expect(g1.goal.version).toBe(1)
    const g2 = updateTravelGoal(g1.goal, 'Actually make it Korea.')
    expect(g2.changed).toBe(true)
    expect(g2.goal.destination).toBe('Korea')
    expect(g2.goal.version).toBeGreaterThan(g1.goal.version)
    expect(emptyTravelGoal().destination).toBeNull()
  })
})
