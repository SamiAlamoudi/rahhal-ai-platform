import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  __getThinkingStuckMsForTests,
  __resetThinkingEvidenceForTests,
  armThinkingEvidence,
  buildThinkingEvidenceExport,
  clearThinkingEvidence,
  formatThinkingEvidenceJson,
  getThinkingEvidence,
  getThinkingStuckSnapshot,
  noteThinkingUiEntered,
  thinkingEvidence,
} from '../chat/voice/thinkingStuckEvidence'

describe('Thinking stuck evidence panel (instrumentation)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubEnv('VITE_VOICE_TRACE', 'true')
    __resetThinkingEvidenceForTests()
  })

  afterEach(() => {
    __resetThinkingEvidenceForTests()
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it('records only executed events with required fields', () => {
    armThinkingEvidence({ turnId: 't1', conversationId: 'c1' })
    thinkingEvidence('CHAT_REQUEST', {
      turnId: 't1',
      conversationId: 'c1',
      previousState: 'SUBMITTING',
      nextState: 'THINKING',
      waitingComponent: 'ChatPage.seed',
      messageCount: 0,
    })
    thinkingEvidence('REQUEST_START', {
      conversationId: 'c1',
      waitingComponent: 'chatEngine.sendMessage',
    })

    const events = getThinkingEvidence()
    expect(events.map((e) => e.event)).toEqual(['CHAT_REQUEST', 'REQUEST_START'])
    expect(events[0]?.timestamp).toMatch(/T/)
    expect(events[0]?.turnId).toBe('t1')
    expect(events[0]?.conversationId).toBe('c1')
    expect(events[0]?.waitingComponent).toBe('ChatPage.seed')
    expect(events[0]?.success).toBe(true)
  })

  it('freezes stuck snapshot after 15s of Thinking UI', () => {
    noteThinkingUiEntered('VoiceStateBadge')
    thinkingEvidence('CHAT_REQUEST', {
      conversationId: 'c1',
      nextState: 'thinking',
      reactState: { voiceStatus: 'thinking', voiceUiState: 'thinking' },
    })

    vi.advanceTimersByTime(__getThinkingStuckMsForTests())

    const snap = getThinkingStuckSnapshot()
    expect(snap).toBeTruthy()
    expect(snap?.lastSuccessfulEvent).toBe('CHAT_REQUEST')
    expect(snap?.firstMissingOrFailingEvent).toBeTruthy()
    expect(snap?.assistantMessagePresent).toBe(false)
    expect(snap?.assistantBubbleRendered).toBe(false)

    const events = getThinkingEvidence()
    expect(events.some((e) => e.event === 'THINKING_TIMEOUT')).toBe(true)
    // Evidence must remain after freeze.
    expect(events.some((e) => e.event === 'CHAT_REQUEST')).toBe(true)
  })

  it('export JSON includes events + stuckSnapshot for clipboard', () => {
    thinkingEvidence('VOICE_SUBMIT', { turnId: 't2', conversationId: 'c2' })
    const json = formatThinkingEvidenceJson()
    const parsed = JSON.parse(json) as ReturnType<typeof buildThinkingEvidenceExport>
    expect(parsed.events.length).toBeGreaterThan(0)
    expect(parsed.capturedAt).toBeTruthy()
    expect(Array.isArray(parsed.events)).toBe(true)
  })

  it('clear removes evidence', () => {
    thinkingEvidence('STT_START', {})
    clearThinkingEvidence()
    expect(getThinkingEvidence()).toHaveLength(0)
    expect(getThinkingStuckSnapshot()).toBeNull()
  })
})
