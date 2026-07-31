/**
 * Sprint 119 — Rahhal Experience Phase 1 (UI Foundation) tests.
 * Presentation architecture only — no engines, APIs, or mock trip data.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { resetFeatureRegistry, getFeatureRegistry } from '../ai'
import {
  SPRINT119_UI_EXPERIENCE_VERSION,
  UI_EXPERIENCE_V1_FEATURE_ID,
  UI_EXPERIENCE_V1_ARCHITECTURE,
  isUiExperienceV1Enabled,
  designTokens,
  tokenCssVariables,
  spacing,
  HOME_EXPERIENCE_SECTIONS,
  CONVERSATION_UI_PARTS,
  CARD_UI_MODELS,
  TIMELINE_UI_PARTS,
  LOADING_UI_PARTS,
  HomeExperience,
  ConversationScreen,
  FlightCard,
  HotelCard,
  Timeline,
  TimelineDay,
  TimelineItem,
  TimelineEvent,
  TimelineStatus,
  Skeleton,
  ProgressIndicator,
  EmptyState,
  ErrorState,
  RetryState,
  StreamingPlaceholder,
  MessageBubble,
  AssistantBubble,
  UserBubble,
  ThinkingBubble,
  StreamingBubble,
  SuggestionBubble,
  TypingIndicator,
  ConversationInput,
  VoiceButton,
  AttachmentButton,
} from '../../ui'

describe('Sprint 119 — UI Experience Phase 1', () => {
  beforeEach(() => {
    resetFeatureRegistry()
  })

  afterEach(() => {
    resetFeatureRegistry()
  })

  it('exposes version and feature flag default OFF', () => {
    expect(SPRINT119_UI_EXPERIENCE_VERSION).toMatch(/experience-v1/)
    expect(UI_EXPERIENCE_V1_FEATURE_ID).toBe('ui.experience_v1')
    expect(getFeatureRegistry().isEnabled('ui.experience_v1')).toBe(false)
    expect(isUiExperienceV1Enabled()).toBe(false)
  })

  it('enables via options override and registry', () => {
    expect(isUiExperienceV1Enabled({ enabled: true })).toBe(true)
    getFeatureRegistry().setEnabled('ui.experience_v1', true)
    expect(isUiExperienceV1Enabled()).toBe(true)
  })

  it('centralizes design tokens without requiring hardcoded call-site values', () => {
    expect(designTokens.spacing.md).toBe(spacing.md)
    expect(designTokens.radius.lg).toBeGreaterThan(0)
    expect(designTokens.typography.size.md).toBeGreaterThan(0)
    expect(designTokens.elevation.md.length).toBeGreaterThan(0)
    expect(designTokens.animation.duration.normal).toBeGreaterThan(0)
    expect(designTokens.iconSize.md).toBeGreaterThan(0)
    expect(designTokens.componentSize.controlHeight.md).toBeGreaterThan(0)
    const css = tokenCssVariables()
    expect(css['--ui-space-md']).toBe(`${spacing.md}px`)
    expect(css['--ui-duration-normal']).toMatch(/ms$/)
  })

  it('declares home experience section architecture', () => {
    expect(HOME_EXPERIENCE_SECTIONS).toEqual([
      'greeting',
      'recent_trips',
      'suggested_destinations',
      'continue_conversation',
      'upcoming_trips',
      'quick_actions',
    ])
    expect(UI_EXPERIENCE_V1_ARCHITECTURE.homeSections).toEqual(
      HOME_EXPERIENCE_SECTIONS,
    )
    const tree = createElement(HomeExperience, {
      greeting: createElement('div', null, 'hi'),
    })
    expect(tree.type).toBe(HomeExperience)
  })

  it('declares conversation UI architecture parts', () => {
    expect(CONVERSATION_UI_PARTS).toContain('ConversationScreen')
    expect(CONVERSATION_UI_PARTS).toContain('ThinkingBubble')
    expect(CONVERSATION_UI_PARTS).toContain('StreamingBubble')
    expect(CONVERSATION_UI_PARTS).toContain('VoiceButton')
    expect(CONVERSATION_UI_PARTS).toContain('AttachmentButton')
    const parts = [
      ConversationScreen,
      MessageBubble,
      AssistantBubble,
      UserBubble,
      ThinkingBubble,
      StreamingBubble,
      SuggestionBubble,
      TypingIndicator,
      ConversationInput,
      VoiceButton,
      AttachmentButton,
    ]
    for (const part of parts) {
      expect(typeof part).toBe('function')
    }
    // Recovery Phase 2.2 — attachment chrome hidden unless explicitly requested.
    expect(AttachmentButton({})).toBeNull()
    expect(AttachmentButton({ visible: true, label: 'إرفاق جواز السفر' })).not.toBeNull()
  })

  it('declares reusable card models', () => {
    expect(CARD_UI_MODELS).toHaveLength(10)
    expect(CARD_UI_MODELS).toContain('FlightCard')
    expect(CARD_UI_MODELS).toContain('ComparisonCard')
    const flight = createElement(FlightCard, { title: 'SV101', airline: 'Saudia' })
    const hotel = createElement(HotelCard, { title: 'Marina', city: 'Dubai' })
    expect(flight.type).toBe(FlightCard)
    expect(hotel.type).toBe(HotelCard)
  })

  it('declares timeline architecture', () => {
    expect(TIMELINE_UI_PARTS).toEqual([
      'Timeline',
      'TimelineItem',
      'TimelineDay',
      'TimelineEvent',
      'TimelineStatus',
    ])
    const tree = createElement(
      Timeline,
      null,
      createElement(
        TimelineDay,
        { dayLabel: 'Day 1' },
        createElement(
          TimelineItem,
          { title: 'Arrival' },
          createElement(TimelineEvent, {
            timeLabel: '10:00',
            status: 'completed',
          }),
        ),
      ),
    )
    expect(tree.type).toBe(Timeline)
    expect(typeof TimelineStatus).toBe('function')
  })

  it('declares loading system parts', () => {
    expect(LOADING_UI_PARTS).toEqual([
      'Skeleton',
      'ProgressIndicator',
      'StreamingPlaceholder',
      'EmptyState',
      'ErrorState',
      'RetryState',
    ])
    for (const part of [
      Skeleton,
      ProgressIndicator,
      StreamingPlaceholder,
      EmptyState,
      ErrorState,
      RetryState,
    ]) {
      expect(typeof part).toBe('function')
    }
  })

  it('exposes architecture inventory for docs/verify', () => {
    expect(UI_EXPERIENCE_V1_ARCHITECTURE.version).toMatch(/experience-v1/)
    expect(UI_EXPERIENCE_V1_ARCHITECTURE.cardModels.length).toBe(10)
    expect(UI_EXPERIENCE_V1_ARCHITECTURE.conversationParts.length).toBeGreaterThan(8)
  })
})
