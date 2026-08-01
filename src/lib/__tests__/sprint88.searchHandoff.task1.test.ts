/**
 * Sprint 88 Task 1 — Search Handoff ADR lock tests.
 *
 * Locks current preview early-return (toolBatch: null, no search/gateway)
 * and documents the clarification-before-search gate for Sprint 90.
 *
 * Does NOT implement Search Handoff (Option A deferred to Sprint 90).
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { emptyMemory } from '../agent/types'
import {
  BRAIN_V1_FEATURE_ID,
  BRAIN_V1_PREVIEW_FEATURE_ID,
  routeBrainPreviewTurn,
  tryBrainV1PreviewTurn,
} from '../brain/v1'
import type { ChatMessage } from '../chat/chatTypes'
import { RECOVERY_FROZEN_OFF_FLAGS, RECOVERY_TURN_OWNER } from '../recovery/freeze'
import * as providerGateway from '../../core/providerGateway'

function msg(
  role: 'user' | 'assistant',
  content: string,
  conversationId = 's88-t1',
  providerMeta: Record<string, unknown> = {},
): ChatMessage {
  return {
    id: `${role}-${Math.random().toString(36).slice(2, 8)}`,
    conversationId,
    role,
    modality: 'text',
    content,
    audioUrl: null,
    imageUrl: null,
    attachments: [],
    status: 'complete',
    error: null,
    providerMeta,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }
}

const ADR_PATH = resolve(
  process.cwd(),
  'docs/adr/ADR-SPRINT88-SEARCH-HANDOFF.md',
)

describe('Sprint 88 Task 1 — Search Handoff ADR + early-return lock', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
    vi.restoreAllMocks()
  })

  describe('ADR documentation', () => {
    it('documents clarification-before-search/gateway as mandatory', () => {
      const adr = readFileSync(ADR_PATH, 'utf8')
      expect(adr).toMatch(/Option A/i)
      expect(adr).toMatch(/Soft-enrich then continue/i)
      expect(adr).toMatch(
        /MUST NOT invoke Search or any Provider Gateway/i,
      )
      expect(adr).toMatch(
        /does not yet contain sufficient information/i,
      )
      expect(adr).toMatch(/ask a clarification question first/i)
      expect(adr).toMatch(/src\/core\/providerGateway/)
      // Dual flag forbidden (mentioned only as a prohibition).
      expect(adr).toMatch(/No `ai\.tie\.v1`/)
      expect(adr).toMatch(/sole soft pilot remains `ai\.brain\.v1\.preview`/)
    })
  })

  describe('flags / freeze (unchanged)', () => {
    it('keeps both Brain flags OFF by default and recovery owner intact', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_PREVIEW_FEATURE_ID)).toBe(false)
      expect(RECOVERY_FROZEN_OFF_FLAGS).toContain('ai.brain.v1')
      expect(RECOVERY_TURN_OWNER).toBe('travelAgentService.planTurn')
      const registryIds = getFeatureRegistry()
        .list()
        .map((f) => f.id)
      expect(registryIds).not.toContain('ai.tie.v1')
    })
  })

  describe('BrainRouter early-return lock', () => {
    it('successful Brain path always returns toolBatch: null', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'I want to travel to Morocco.',
        locale: 'en',
        conversationId: 's88-t1',
        messages: [msg('user', 'I want to travel to Morocco.')],
        memory: emptyMemory('en'),
        enabled: true,
        bypassDeployGateForTests: true,
      })
      expect(decision.path).toBe('brain')
      if (decision.path !== 'brain') return
      expect(decision.result.toolBatch).toBeNull()
      expect(decision.result.meta.brainV1Preview?.active).toBe(true)
    })

    it('tryBrainV1PreviewTurn returns toolBatch null on success', () => {
      const result = tryBrainV1PreviewTurn({
        userText: 'I want to travel to Morocco from Riyadh',
        locale: 'en',
        conversationId: 's88-t1',
        messages: [msg('user', 'I want to travel to Morocco from Riyadh')],
        memory: emptyMemory('en'),
        enabled: true,
        bypassDeployGateForTests: true,
      })
      expect(result).not.toBeNull()
      expect(result!.toolBatch).toBeNull()
    })
  })

  describe('planTurn integration — no search / no gateway on preview success', () => {
    it('insufficient information: clarifies and does not search or create Provider Gateway', async () => {
      const createGatewaySpy = vi.spyOn(providerGateway, 'createProviderGateway')

      const service = createTravelAgentService({ brainV1PreviewEnabled: true })
      const result = await service.planTurn({
        conversationId: 's88-t1-clarify',
        messages: [
          msg('user', 'I want to travel to Morocco.', 's88-t1-clarify'),
        ],
      })

      // Preview handled the turn (consultant path).
      expect(result.meta.brainV1Preview?.active).toBe(true)
      // Early-return lock: no tool/search batch.
      expect(result.toolBatch).toBeNull()
      // Clarification-before-search: at least one question when info insufficient.
      expect(result.meta.brainV1Preview?.questionCount).toBeGreaterThanOrEqual(1)
      expect(result.meta.brainV1Preview?.questionCount).toBeLessThanOrEqual(1)
      expect(result.reply.trim().endsWith('?')).toBe(true)
      // Value-first still allowed without search.
      expect(result.meta.brainV1Preview?.providedValue).toBe(true)
      // MUST NOT invoke Provider Gateway.
      expect(createGatewaySpy).not.toHaveBeenCalled()
    })

    it('even richer flight-like prompts early-return with toolBatch null and no gateway (pre-Sprint 90)', async () => {
      const createGatewaySpy = vi.spyOn(providerGateway, 'createProviderGateway')

      const service = createTravelAgentService({ brainV1PreviewEnabled: true })
      const result = await service.planTurn({
        conversationId: 's88-t1-flight',
        messages: [
          msg(
            'user',
            'Find me flights to Morocco from Riyadh 2026-10-01 adults 2',
            's88-t1-flight',
          ),
        ],
      })

      expect(result.meta.brainV1Preview?.active).toBe(true)
      expect(result.toolBatch).toBeNull()
      expect(createGatewaySpy).not.toHaveBeenCalled()
    })

    it('hotel-like prompts early-return with toolBatch null and no gateway', async () => {
      const createGatewaySpy = vi.spyOn(providerGateway, 'createProviderGateway')

      const service = createTravelAgentService({ brainV1PreviewEnabled: true })
      const result = await service.planTurn({
        conversationId: 's88-t1-hotel',
        messages: [
          msg(
            'user',
            'I need hotels in Marrakech for a Morocco trip',
            's88-t1-hotel',
          ),
        ],
      })

      expect(result.meta.brainV1Preview?.active).toBe(true)
      expect(result.toolBatch).toBeNull()
      expect(createGatewaySpy).not.toHaveBeenCalled()
    })

    it('preview OFF still does not require gateway for a simple explore turn', async () => {
      const createGatewaySpy = vi.spyOn(providerGateway, 'createProviderGateway')
      const service = createTravelAgentService({ brainV1PreviewEnabled: false })
      const result = await service.planTurn({
        conversationId: 's88-t1-off',
        messages: [msg('user', 'I want to travel to Morocco.', 's88-t1-off')],
      })
      expect(result.meta.brainV1Preview).toBeUndefined()
      expect(result.reply.length).toBeGreaterThan(0)
      // Explore clarification under current planner also should not spin up gateway.
      expect(createGatewaySpy).not.toHaveBeenCalled()
    })
  })
})
