/**
 * Phase 5 Stage 4 — Traveler Profile Center tests.
 * New tests only. Package is not wired into production routes.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it } from 'vitest'
import { getFeatureRegistry, resetFeatureRegistry } from '../ai'
import { createTravelAgentService } from '../agent/travelAgentService'
import {
  TRAVELER_PROFILE_ARCHITECTURE,
  TRAVELER_PROFILE_FEATURE_ID,
  TravelerProfileCenter,
  assertTravelerProfileIsolation,
  createDemoTravelerProfileState,
  isTravelerProfileEnabled,
  tryRenderTravelerProfileCenter,
} from '../../ui/travelerProfile'

describe('Phase 5 Stage 4 — Traveler Profile Center', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  describe('feature gate + production isolation', () => {
    it('registers ui.traveler_profile default OFF with shell dependency', () => {
      const def = getFeatureRegistry().get(TRAVELER_PROFILE_FEATURE_ID)
      expect(def?.enabled).toBe(false)
      expect(def?.dependsOn).toEqual(['ui.application_shell'])
      expect(getFeatureRegistry().isEnabled(TRAVELER_PROFILE_FEATURE_ID)).toBe(
        false,
      )
      expect(isTravelerProfileEnabled()).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoProductionRoutes).toBe(
        false,
      )
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoAi).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoRuntime).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoBooking).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoMaps).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoWeather).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoFirebase).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.wiredIntoNotifications).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.authentication).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.payments).toBe(false)
      expect(TRAVELER_PROFILE_ARCHITECTURE.storage).toBe(false)
      expect(tryRenderTravelerProfileCenter({})).toBeNull()
      expect(renderToStaticMarkup(createElement(TravelerProfileCenter))).toBe(
        '',
      )
    })

    it('does not change planTurn production path', async () => {
      const service = createTravelAgentService()
      const turn = await service.planTurn({
        conversationId: 'c-tp',
        messages: [
          {
            id: 'u1',
            conversationId: 'c-tp',
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

  describe('inventory', () => {
    it('exposes isolation and demo presentation data', () => {
      expect(assertTravelerProfileIsolation().presentationOnly).toBe(true)
      const demo = createDemoTravelerProfileState({ enabled: true })
      expect(demo.personalInfo.length).toBeGreaterThan(0)
      expect(demo.passports.length).toBeGreaterThan(0)
      expect(demo.profileCompletionPercent).toBeGreaterThan(0)
      expect(demo.completionTimeline.length).toBeGreaterThan(0)
    })
  })

  describe('UI smoke (forced ON)', () => {
    it('renders profile sections, documents, loyalty, and settings placeholders', () => {
      const html = renderToStaticMarkup(
        createElement(TravelerProfileCenter, {
          enabled: true,
          locale: 'ar',
          theme: 'light',
        }),
      )

      expect(html).toContain('data-testid="traveler-profile-center"')
      expect(html).toContain('data-testid="tp-overview"')
      expect(html).toContain('data-testid="tp-personal-info"')
      expect(html).toContain('data-testid="tp-travel-preferences"')
      expect(html).toContain('data-testid="tp-languages"')
      expect(html).toContain('data-testid="tp-currencies"')
      expect(html).toContain('data-testid="tp-timezone"')
      expect(html).toContain('data-testid="tp-travel-documents"')
      expect(html).toContain('data-testid="tp-multiple-passports"')
      expect(html).toContain('data-testid="tp-passport-card"')
      expect(html).toContain('data-testid="tp-visa"')
      expect(html).toContain('data-testid="tp-boarding-pass"')
      expect(html).toContain('data-testid="tp-emergency-contacts"')
      expect(html).toContain('data-testid="tp-family-members"')
      expect(html).toContain('data-testid="tp-frequent-flyer"')
      expect(html).toContain('data-testid="tp-hotel-loyalty"')
      expect(html).toContain('data-testid="tp-loyalty-card"')
      expect(html).toContain('data-testid="tp-preferred-airlines"')
      expect(html).toContain('data-testid="tp-preferred-hotels"')
      expect(html).toContain('data-testid="tp-preferred-seat"')
      expect(html).toContain('data-testid="tp-meal-preferences"')
      expect(html).toContain('data-testid="tp-payment-methods"')
      expect(html).toContain('data-testid="tp-saved-travelers"')
      expect(html).toContain('data-testid="tp-privacy-settings"')
      expect(html).toContain('data-testid="tp-notification-settings"')
      expect(html).toContain('data-testid="tp-security-center"')
      expect(html).toContain('data-testid="tp-security-status"')
      expect(html).toContain('data-testid="tp-profile-completion"')
      expect(html).toContain('data-testid="tp-progress-ring"')
      expect(html).toContain('data-testid="tp-completion-timeline"')
      expect(html).toContain('رحّال')
      expect(html).not.toContain('firebase')
      expect(html).not.toContain('amadeus')
      expect(html).not.toContain('supabase.auth')
    })
  })
})
