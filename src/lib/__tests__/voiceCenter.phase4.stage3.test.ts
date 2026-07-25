/**
 * Phase 4 Stage 3 — Premium Voice Conversation Center tests.
 * New tests only. Voice Center is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  VOICE_CENTER_ARCHITECTURE,
  VOICE_CENTER_FEATURE_ID,
  VOICE_CONTROLS,
  VOICE_SESSION_STATES,
  VOICE_SHORTCUTS,
  VoiceCenter,
  applyVoiceControl,
  assertVoiceCenterIsolation,
  createDemoTranscriptEntry,
  createInitialVoiceCenterState,
  filterSessionsByBucket,
  isVoiceCenterEnabled,
  searchSessions,
  tryRenderVoiceCenter,
} from '../../ui/voiceCenter'

describe('Phase 4 Stage 3 — Premium Voice Conversation Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.voice_center default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(VOICE_CENTER_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(VOICE_CENTER_FEATURE_ID)).toBe(false)
      expect(isVoiceCenterEnabled()).toBe(false)
      expect(VOICE_CENTER_ARCHITECTURE.wiredIntoProductionRoutes).toBe(false)
      expect(VOICE_CENTER_ARCHITECTURE.wiredIntoRuntimeCoordinator).toBe(false)
      expect(VOICE_CENTER_ARCHITECTURE.wiredIntoConversationOrchestrator).toBe(
        false,
      )
      expect(VOICE_CENTER_ARCHITECTURE.wiredIntoTts).toBe(false)
      expect(VOICE_CENTER_ARCHITECTURE.wiredIntoStt).toBe(false)
      expect(VOICE_CENTER_ARCHITECTURE.embeddedInChat).toBe(false)
      expect(VOICE_CENTER_ARCHITECTURE.ownDestination).toBe(true)
      expect(tryRenderVoiceCenter({})).toBeNull()
      expect(renderToStaticMarkup(createElement(VoiceCenter))).toBe('')
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-vc',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-vc',
            role: 'user',
            modality: 'text',
            content: 'Hello',
            audioUrl: null,
            imageUrl: null,
            attachments: [],
            status: 'complete',
            error: null,
            providerMeta: {},
            createdAt: '2026-07-24T00:00:00.000Z',
            updatedAt: '2026-07-24T00:00:00.000Z',
          },
        ],
      })
      expect(turn.reply.length).toBeGreaterThan(0)
      expect(turn.meta.experience).toBeUndefined()
    })
  })

  describe('isolation rules', () => {
    it('keeps Voice as own destination with no speech engines', () => {
      const isolation = assertVoiceCenterIsolation()
      expect(isolation.ownDestination).toBe(true)
      expect(isolation.notInsideChat).toBe(true)
      expect(isolation.embeddedInChat).toBe(false)
      expect(isolation.speechRecognition).toBe(false)
      expect(isolation.speechSynthesis).toBe(false)
      expect(isolation.whisper).toBe(false)
      expect(isolation.elevenLabs).toBe(false)
      expect(isolation.openaiVoice).toBe(false)
      expect(isolation.azureSpeech).toBe(false)
      expect(isolation.googleSpeech).toBe(false)
      expect(isolation.realtimeApi).toBe(false)
      expect(isolation.ttsConnected).toBe(false)
      expect(isolation.sttConnected).toBe(false)
      expect(isolation.aiCalls).toBe(false)
    })
  })

  describe('states, controls, history helpers', () => {
    it('exposes required session states, controls, and shortcuts', () => {
      expect(VOICE_SESSION_STATES).toEqual(
        expect.arrayContaining([
          'idle',
          'listening',
          'processing',
          'speaking',
          'paused',
          'disconnected',
          'offline',
          'permission_required',
          'noise_detected',
          'muted',
        ]),
      )
      expect(VOICE_CONTROLS).toEqual(
        expect.arrayContaining([
          'start',
          'pause',
          'resume',
          'stop',
          'mute',
          'speaker',
          'headphones',
          'voice_settings',
          'replay',
          'clear_session',
        ]),
      )
      expect(VOICE_SHORTCUTS).toEqual(
        expect.arrayContaining([
          'plan_trip',
          'ask_visa',
          'recommend_destination',
          'executive_travel',
          'budget_planning',
          'nearby_attractions',
        ]),
      )
    })

    it('applies UI-only control transitions and filters sessions', () => {
      let state = createInitialVoiceCenterState({ enabled: true })
      state = applyVoiceControl(state, 'start')
      expect(state.sessionState).toBe('listening')
      state = applyVoiceControl(state, 'pause')
      expect(state.sessionState).toBe('paused')
      state = applyVoiceControl(state, 'resume')
      expect(state.sessionState).toBe('listening')
      state = applyVoiceControl(state, 'mute')
      expect(state.sessionState).toBe('muted')
      state = applyVoiceControl(state, 'clear_session')
      expect(state.sessionState).toBe('idle')
      expect(state.transcript).toEqual([])

      const sessions = [
        {
          id: 's1',
          title: 'رحلة صوتية',
          bucket: 'recent' as const,
          favorite: true,
          archived: false,
          updatedAt: '2026-07-24T00:00:00.000Z',
          preview: 'تأشيرة',
        },
        {
          id: 's2',
          title: 'Archived',
          bucket: 'archived' as const,
          favorite: false,
          archived: true,
          updatedAt: '2026-07-24T00:00:00.000Z',
          preview: 'old',
        },
      ]
      expect(filterSessionsByBucket(sessions, 'favorites').map((s) => s.id)).toEqual([
        's1',
      ])
      expect(searchSessions(sessions, 'تأشيرة').map((s) => s.id)).toEqual(['s1'])
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders immersive voice chrome without embedding chat/speech engines', () => {
      const html = renderToStaticMarkup(
        createElement(VoiceCenter, {
          enabled: true,
          locale: 'ar',
          initialState: {
            sessionState: 'listening',
            sessions: [
              {
                id: 'vs1',
                title: 'جلسة تجريبية',
                bucket: 'recent',
                favorite: false,
                archived: false,
                updatedAt: '2026-07-24T00:00:00.000Z',
                preview: 'مرحبا',
              },
            ],
            activeSessionId: 'vs1',
            currentTravelerText: 'أريد باريس',
            currentAssistantText: 'حسناً',
            transcript: [
              createDemoTranscriptEntry({
                id: 't1',
                role: 'traveler',
                text: 'أريد باريس',
                confidence: 0.91,
              }),
              createDemoTranscriptEntry({
                id: 't2',
                role: 'assistant',
                text: 'إليك اقتراحاً',
              }),
            ],
          },
        }),
      )

      expect(html).toContain('data-testid="voice-center"')
      expect(html).toContain('data-testid="vc-microphone-stage"')
      expect(html).toContain('data-session-state="listening"')
      expect(html).toContain('data-testid="vc-wave"')
      expect(html).toContain('data-testid="vc-status"')
      expect(html).toContain('data-testid="vc-controls"')
      expect(html).toContain('data-control="start"')
      expect(html).toContain('data-control="mute"')
      expect(html).toContain('data-testid="vc-transcript"')
      expect(html).toContain('data-testid="vc-current-traveler"')
      expect(html).toContain('data-testid="vc-current-assistant"')
      expect(html).toContain('data-testid="vc-confidence"')
      expect(html).toContain('data-testid="vc-personality"')
      expect(html).toContain('data-testid="vc-voice-selector"')
      expect(html).toContain('data-testid="vc-session-history"')
      expect(html).toContain('data-shortcut="plan_trip"')
      expect(html).toContain('data-testid="vc-brand"')
      expect(html).toContain('رحّال')
      // Must not look like Chat / speech vendor wiring
      expect(html).not.toContain('data-testid="conversation-center"')
      expect(html).not.toContain('whisper')
      expect(html).not.toContain('elevenlabs')
      expect(html).not.toContain('openai-voice')
    })
  })
})
