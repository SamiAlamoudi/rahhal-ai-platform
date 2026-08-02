import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrainSessionController } from './BrainSessionController'
import { mapTraceToError } from './mapError'
import { mockTranscribe, isDeveloperMode } from './mockVoice'
import { phaseLabel, BRAIN_LOADING_SEQUENCE } from './loadingPhases'
import { createTravelBrain, processBrainTurn } from '../brain'

describe('Brain ⇄ UI controller', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('exposes loading phase labels', () => {
    expect(BRAIN_LOADING_SEQUENCE).toContain('preparing')
    expect(phaseLabel('thinking', 'en')).toMatch(/Thinking/)
    expect(phaseLabel('reasoning', 'ar')).toBeTruthy()
  })

  it('mock voice has no network', () => {
    expect(mockTranscribe(0).length).toBeGreaterThan(5)
    expect(mockTranscribe(1)).not.toBe(mockTranscribe(0))
  })

  it('maps safety to UI errors', async () => {
    const brain = createTravelBrain()
    await brain.begin('t1', 'en')
    const missing = processBrainTurn(brain, 'book a flight')
    const err = mapTraceToError(missing)
    expect(err?.code).toBe('missing_information')

    const conflict = processBrainTurn(
      brain,
      'Book a hotel in Istanbul 5 star budget 300 SAR for 4 nights',
    )
    const conflictErr = mapTraceToError(conflict)
    expect(conflictErr?.code === 'budget_conflict' || conflictErr?.code === 'contradictory_request' || conflictErr != null).toBe(
      true,
    )
  })

  it('sendMessage streams reply and fills recommendations', async () => {
    const c = new BrainSessionController()
    await c.start('u1', 'en')
    const done = c.sendMessage('Book a flight from Riyadh to Istanbul budget 5000 SAR')
    await done
    const state = c.getState()
    expect(state.messages.some((m) => m.role === 'user')).toBe(true)
    expect(state.messages.some((m) => m.role === 'assistant' && m.text.length > 0)).toBe(true)
    expect(c.getRecommendations().flights.length).toBeGreaterThan(0)
    expect(c.getConversation().length).toBeGreaterThan(1)
    expect(c.getTimeline().length).toBeGreaterThan(0)
    expect(state.conversationTimeline.some((s) => s.kind === 'decision')).toBe(true)
    expect(state.loading).toBe(false)
    c.dispose()
  })

  it('startVoice uses mock transcription', async () => {
    const c = new BrainSessionController()
    await c.start('u2', 'en')
    await c.startVoice()
    expect(c.getConversation().some((m) => m.role === 'user')).toBe(true)
    c.stopVoice()
    await c.resetConversation()
    expect(c.getState().ready).toBe(true)
    c.dispose()
  })

  it('isDeveloperMode reads query and localStorage', () => {
    expect(typeof isDeveloperMode()).toBe('boolean')
    const prev = globalThis.window
    globalThis.window = {
      location: { search: '?debug=1' },
      localStorage: { getItem: () => null },
    } as unknown as Window & typeof globalThis
    expect(isDeveloperMode()).toBe(true)
    globalThis.window = {
      location: { search: '' },
      localStorage: { getItem: (k: string) => (k === 'rahhal_brain_debug' ? '1' : null) },
    } as unknown as Window & typeof globalThis
    expect(isDeveloperMode()).toBe(true)
    globalThis.window = {
      location: { search: '' },
      localStorage: {
        getItem: () => {
          throw new Error('blocked')
        },
      },
    } as unknown as Window & typeof globalThis
    expect(isDeveloperMode()).toBe(false)
    globalThis.window = prev
  })

  it('ignores empty send while loading guard works', async () => {
    const c = new BrainSessionController()
    await c.start('u3', 'en')
    await c.sendMessage('   ')
    expect(c.getConversation()).toHaveLength(0)
    c.setLocale('ar')
    expect(c.getState().locale).toBe('ar')
    const unsub = c.subscribe(() => undefined)
    unsub()
    c.dispose()
  })
})
