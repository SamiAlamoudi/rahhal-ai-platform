/**
 * Sprint 86 — Brain v1 Preview Integration tests.
 * Flag OFF by default; production hard-blocked; exception → current planner.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import { RECOVERY_TURN_OWNER, RECOVERY_FROZEN_OFF_FLAGS } from '../recovery/freeze'
import {
  BRAIN_V1_FEATURE_ID,
  BRAIN_V1_PREVIEW_FEATURE_ID,
  BRAIN_V1_PREVIEW_VERSION,
  isBrainV1Enabled,
  isBrainV1PreviewEnabled,
  isBrainPreviewDeployTargetAllowed,
  routeBrainPreviewTurn,
  runBrainV1Turn,
  runConversationManagerTurn,
} from '../brain/v1'
import type { ChatMessage } from '../chat/chatTypes'
import { emptyMemory } from '../agent/types'

function msg(
  role: 'user' | 'assistant',
  content: string,
  conversationId = 's86',
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

describe('Sprint 86 — Brain v1 Preview Integration', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })
  afterEach(() => {
    resetFeatureRegistry()
  })

  describe('flags / freeze / production isolation', () => {
    it('keeps ai.brain.v1.preview OFF by default', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_PREVIEW_FEATURE_ID)).toBe(false)
      expect(isBrainV1PreviewEnabled()).toBe(false)
      expect(BRAIN_V1_PREVIEW_VERSION).toMatch(/brain-preview/)
    })

    it('keeps foundation ai.brain.v1 frozen OFF and unwired as a registry default', () => {
      expect(getFeatureRegistry().isEnabled(BRAIN_V1_FEATURE_ID)).toBe(false)
      expect(isBrainV1Enabled()).toBe(false)
      expect(RECOVERY_FROZEN_OFF_FLAGS).toContain('ai.brain.v1')
      expect(RECOVERY_FROZEN_OFF_FLAGS).not.toContain('ai.brain.v1.preview')
      expect(RECOVERY_TURN_OWNER).toBe('travelAgentService.planTurn')
      expect(runBrainV1Turn({ text: 'hi' }).enabled).toBe(false)
      expect(runConversationManagerTurn({ text: 'hi' }).enabled).toBe(false)
    })

    it('hard-blocks production deploy targets even if registry flag is ON', () => {
      getFeatureRegistry().setEnabled(BRAIN_V1_PREVIEW_FEATURE_ID, true)
      expect(
        isBrainV1PreviewEnabled({
          env: { VITE_DEPLOY_TARGET: 'production', DEPLOY_TARGET: 'production' },
        }),
      ).toBe(false)
      expect(
        isBrainPreviewDeployTargetAllowed({
          env: { VITE_DEPLOY_TARGET: 'production' },
        }),
      ).toBe(false)
    })

    it('allows development / staging(preview) / beta deploy targets when flag ON', () => {
      getFeatureRegistry().setEnabled(BRAIN_V1_PREVIEW_FEATURE_ID, true)
      expect(
        isBrainV1PreviewEnabled({ env: { VITE_DEPLOY_TARGET: 'development' } }),
      ).toBe(true)
      expect(
        isBrainV1PreviewEnabled({ env: { VITE_DEPLOY_TARGET: 'preview' } }),
      ).toBe(true)
      expect(
        isBrainV1PreviewEnabled({ env: { VITE_DEPLOY_TARGET: 'beta', VITE_LAUNCH_PHASE: 'beta' } }),
      ).toBe(true)
    })
  })

  describe('BrainRouter', () => {
    it('flag OFF → current planner path', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'I want to travel to Morocco.',
        locale: 'en',
        conversationId: 's86',
        messages: [msg('user', 'I want to travel to Morocco.')],
        memory: emptyMemory('en'),
      })
      expect(decision.path).toBe('current')
    })

    it('flag ON → Brain path with Value Before Questions for Morocco', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'I want to travel to Morocco.',
        locale: 'en',
        conversationId: 's86',
        messages: [msg('user', 'I want to travel to Morocco.')],
        memory: emptyMemory('en'),
        enabled: true,
        bypassDeployGateForTests: true,
      })
      expect(decision.path).toBe('brain')
      if (decision.path !== 'brain') return
      expect(decision.result.meta.brainV1Preview?.active).toBe(true)
      expect(decision.result.meta.brainV1Preview?.providedValue).toBe(true)
      expect(decision.result.meta.brainV1Preview?.questionCount).toBeLessThanOrEqual(1)
      expect(decision.result.reply.toLowerCase()).toMatch(/marrakech|agadir|casablanca|morocco/)
      const onlyQuestion = /^when would you like to travel\??$/i.test(decision.result.reply.trim())
      expect(onlyQuestion).toBe(false)
      expect(decision.result.reply.trim().endsWith('?')).toBe(true)
    })

    it('Brain exception → fallback path (no throw)', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'I want to travel to Morocco.',
        locale: 'en',
        conversationId: 's86',
        messages: [msg('user', 'I want to travel to Morocco.')],
        memory: emptyMemory('en'),
        enabled: true,
        bypassDeployGateForTests: true,
        runBrain: () => {
          throw new Error('simulated brain failure')
        },
      })
      expect(decision.path).toBe('fallback')
      if (decision.path !== 'fallback') return
      expect(decision.reason).toMatch(/simulated brain failure/)
    })

    it('enforces one-question budget on explore turns', () => {
      const decision = routeBrainPreviewTurn({
        userText: 'أريد السفر إلى المغرب',
        locale: 'ar',
        conversationId: 's86',
        messages: [msg('user', 'أريد السفر إلى المغرب')],
        memory: emptyMemory('ar'),
        enabled: true,
        bypassDeployGateForTests: true,
      })
      expect(decision.path).toBe('brain')
      if (decision.path !== 'brain') return
      expect(decision.result.meta.brainV1Preview?.questionCount).toBeLessThanOrEqual(1)
      expect((decision.result.reply.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1)
      expect(decision.result.reply).not.toMatch(/يرجى إدخال|البيانات المطلوبة/)
    })
  })

  describe('planTurn integration', () => {
    it('flag OFF: planTurn behaves as current planner (no brain meta)', async () => {
      const service = createTravelAgentService({ brainV1PreviewEnabled: false })
      const result = await service.planTurn({
        conversationId: 's86-off',
        messages: [msg('user', 'I want to travel to Morocco.', 's86-off')],
      })
      expect(result.reply.length).toBeGreaterThan(0)
      expect(result.meta.brainV1Preview).toBeUndefined()
      expect(result.meta.kind).toBe('travel_agent')
    })

    it('flag ON: Morocco request uses Brain Value Before Questions', async () => {
      const service = createTravelAgentService({ brainV1PreviewEnabled: true })
      const result = await service.planTurn({
        conversationId: 's86-on',
        messages: [msg('user', 'I want to travel to Morocco.', 's86-on')],
      })
      expect(result.meta.brainV1Preview?.active).toBe(true)
      expect(result.meta.brainV1Preview?.providedValue).toBe(true)
      expect(result.meta.brainV1Preview?.questionCount).toBeLessThanOrEqual(1)
      expect(result.reply.toLowerCase()).toMatch(/marrakech|agadir|morocco/)
      expect(/^when would you like to travel\??$/i.test(result.reply.trim())).toBe(false)
    })

    it('flag ON: Brain exception falls back to current planner without user-facing errors', async () => {
      const decision = routeBrainPreviewTurn({
        userText: 'flights to Paris',
        locale: 'en',
        conversationId: 's86-fb',
        messages: [msg('user', 'flights to Paris')],
        memory: emptyMemory('en'),
        enabled: true,
        bypassDeployGateForTests: true,
        runBrain: () => {
          throw new Error('boom')
        },
      })
      expect(decision.path).toBe('fallback')

      // planTurn with normal Brain ON still returns a safe reply (never throws).
      const service = createTravelAgentService({ brainV1PreviewEnabled: true })
      const result = await service.planTurn({
        conversationId: 's86-fb2',
        messages: [msg('user', 'Hello', 's86-fb2')],
      })
      expect(result.reply.length).toBeGreaterThan(0)
      expect(result.reply).not.toMatch(/boom|stack|TypeError/i)
    })

    it('flag ON: flight request is handled safely', async () => {
      const service = createTravelAgentService({ brainV1PreviewEnabled: true })
      const result = await service.planTurn({
        conversationId: 's86-flight',
        messages: [
          msg(
            'user',
            'Find me flights to Morocco from Riyadh 2026-10-01 adults 2',
            's86-flight',
          ),
        ],
      })
      expect(result.reply.length).toBeGreaterThan(0)
      expect(result.meta.brainV1Preview?.active).toBe(true)
      expect(result.meta.brainV1Preview?.questionCount).toBeLessThanOrEqual(1)
      expect(result.reply.toLowerCase()).toMatch(/morocco|marrakech|flight|riyadh|preliminary/)
    })

    it('flag ON: hotel request is handled safely', async () => {
      const service = createTravelAgentService({ brainV1PreviewEnabled: true })
      const result = await service.planTurn({
        conversationId: 's86-hotel',
        messages: [msg('user', 'I need hotels in Marrakech for a Morocco trip', 's86-hotel')],
      })
      expect(result.reply.length).toBeGreaterThan(0)
      expect(result.meta.brainV1Preview?.active).toBe(true)
      expect(result.meta.brainV1Preview?.questionCount).toBeLessThanOrEqual(1)
    })

    it('flag ON: multi-turn conversation memory does not re-ask answered origin', async () => {
      const service = createTravelAgentService({ brainV1PreviewEnabled: true })
      const first = await service.planTurn({
        conversationId: 's86-multi',
        messages: [msg('user', 'I want to travel to Morocco from Riyadh', 's86-multi')],
      })
      expect(first.meta.brainV1Preview?.active).toBe(true)
      expect(first.meta.brainV1Preview?.session).toBeTruthy()

      const second = await service.planTurn({
        conversationId: 's86-multi',
        messages: [
          msg('user', 'I want to travel to Morocco from Riyadh', 's86-multi'),
          msg('assistant', first.reply, 's86-multi', first.meta as unknown as Record<string, unknown>),
          msg('user', 'continue', 's86-multi'),
        ],
      })
      expect(second.meta.brainV1Preview?.active).toBe(true)
      // Must not re-ask for Riyadh / origin after it was already provided.
      expect(second.reply.toLowerCase()).not.toMatch(/which city will you depart from/)
      expect(second.reply).not.toMatch(/من أي مدينة ستسافر/)
    })
  })
})
