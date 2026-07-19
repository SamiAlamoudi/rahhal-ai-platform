import { assertTransition, canTransition, nextVoiceState } from './stateMachine'
import { createVoiceTimeline } from './timeline'
import type {
  VoiceEvent,
  VoiceEventType,
  VoiceMessage,
  VoiceSessionSnapshot,
  VoiceSessionTransitionReason,
  VoiceState,
  VoiceStateTransition,
} from './types'
import { createVoiceQueue } from './voiceQueue'
import { createVoiceProvider } from './providers'
import type { VoiceProvider, VoiceProviderId } from './providers'
import {
  isBrainVoiceIntegrationEnabled,
  runIntegratedBrainTurn,
} from '../brain/integration'

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

export type VoiceSessionOptions = {
  conversationId?: string
  provider?: VoiceProvider
  providerId?: VoiceProviderId
}

/**
 * Production VoiceSession controller — single state owner.
 * Coordinates provider, queue, timeline, and interruption without racey duplicate state.
 */
export function createVoiceSession(options: VoiceSessionOptions = {}) {
  const conversationId = options.conversationId ?? newId('vc')
  const provider = options.provider ?? createVoiceProvider(options.providerId)
  const queue = createVoiceQueue()
  const timeline = createVoiceTimeline(conversationId)

  let state: VoiceState = 'idle'
  let previousState: VoiceState | null = null
  let connected = false
  let lastError: string | null = null
  let startedAt: string | null = null
  let listeningSince: string | null = null
  let speakingSince: string | null = null
  let interruptedCount = 0
  let reconnectCount = 0
  let disposed = false
  let transitionLock = false
  let lastBrainPlan: VoiceSessionSnapshot['lastBrainPlan'] = null

  const messages: VoiceMessage[] = []
  const transitions: VoiceStateTransition[] = []
  const eventLog: VoiceEvent[] = []
  const listeners = new Set<() => void>()

  // Cached snapshot for useSyncExternalStore stability (React #185).
  let cachedSnapshot: VoiceSessionSnapshot = buildSnapshot()

  function buildSnapshot(): VoiceSessionSnapshot {
    return {
      conversationId,
      state,
      previousState,
      connected,
      providerId: provider.providerId,
      messages: messages.map((m) => ({ ...m })),
      timeline: timeline.list(),
      lastError,
      startedAt,
      listeningSince,
      speakingSince,
      interruptedCount,
      reconnectCount,
      lastBrainPlan,
    }
  }

  const emit = () => {
    cachedSnapshot = buildSnapshot()
    for (const listener of listeners) listener()
  }

  const pushEvent = (
    type: VoiceEventType,
    priority: VoiceEvent['priority'] = 'normal',
    payload?: Record<string, unknown>,
  ): VoiceEvent => {
    const event: VoiceEvent = {
      id: newId('ve'),
      type,
      conversationId,
      createdAt: new Date().toISOString(),
      priority,
      payload,
    }
    eventLog.push(event)
    queue.enqueue({
      kind: type.startsWith('assistant_') ? 'outgoing' : 'incoming',
      event,
      priority,
    })
    return event
  }

  const applyTransition = (reason: VoiceSessionTransitionReason): VoiceState => {
    if (disposed) throw new Error('voice_session_disposed')
    if (transitionLock) throw new Error('voice_session_transition_in_progress')
    if (!canTransition(state, reason)) {
      throw new Error(`Invalid voice transition: ${state} --(${reason})--> ?`)
    }

    transitionLock = true
    try {
      const from = state
      const to = assertTransition(from, reason)
      previousState = from
      state = to
      const at = new Date().toISOString()
      transitions.push({ from, to, reason, at })
      pushEvent('state_changed', 'normal', { from, to, reason })
      timeline.mark('state', `${from}→${to}`, { reason })

      if (to === 'listening') listeningSince = at
      if (to !== 'listening') listeningSince = null
      if (to === 'speaking') speakingSince = at
      if (to !== 'speaking') speakingSince = null
      if (to === 'idle' || to === 'disconnected') {
        listeningSince = null
        speakingSince = null
      }

      emit()
      return to
    } finally {
      transitionLock = false
    }
  }

  const offsetMs = () =>
    startedAt ? Math.max(0, Date.now() - Date.parse(startedAt)) : 0

  const appendMessage = (
    role: VoiceMessage['role'],
    content: string,
    modality: VoiceMessage['modality'] = 'speech',
  ): VoiceMessage => {
    const message: VoiceMessage = {
      id: newId('vm'),
      conversationId,
      role,
      modality,
      content,
      offsetMs: offsetMs(),
      createdAt: new Date().toISOString(),
    }
    messages.push(message)
    emit()
    return message
  }

  return {
    getSnapshot: () => cachedSnapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    getConversationId: () => conversationId,
    getState: () => state,
    getProvider: () => provider,
    getQueue: () => queue,
    getTimeline: () => timeline,
    listEvents: () => eventLog.map((e) => ({ ...e })),
    listTransitions: () => transitions.map((t) => ({ ...t })),

    async start() {
      if (disposed) return
      if (state === 'listening') return
      startedAt = startedAt ?? new Date().toISOString()
      timeline.mark('conversation', 'session_started', { conversationId })
      pushEvent('session_started', 'high')
      await provider.startSession({
        conversationId,
        handlers: {
          onError: (message) => {
            lastError = message
            pushEvent('error', 'critical', { message })
            if (canTransition(state, 'error')) applyTransition('error')
            emit()
          },
        },
      })
      connected = provider.getTransport().isConnected()
      if (state === 'interrupted') applyTransition('start')
      else if (state === 'idle' || state === 'error' || state === 'disconnected') {
        if (state === 'disconnected') applyTransition('reconnect')
        if (state === 'error') applyTransition('reset')
        applyTransition('start')
      }
      timeline.begin('listening', 'user_speech', 'listening')
      pushEvent('user_speech_started', 'normal')
      emit()
    },

    async stop() {
      if (disposed) return
      timeline.end('listening')
      timeline.end('speaking')
      timeline.end('thinking')
      await provider.stopSession()
      connected = provider.getTransport().isConnected()
      queue.clear()
      if (state !== 'idle' && canTransition(state, 'stop')) {
        applyTransition('stop')
      } else {
        previousState = state
        state = 'idle'
        emit()
      }
      pushEvent('session_ended', 'normal')
      timeline.mark('conversation', 'session_ended')
    },

    /** User finished an utterance → thinking. */
    commitUserUtterance(transcript: string) {
      const text = transcript.trim()
      if (!text) return null
      if (state !== 'listening') {
        // Ignore stray commits outside listening to avoid races.
        return null
      }
      timeline.end('listening', { transcript: text })
      appendMessage('user', text, 'speech')
      pushEvent('user_transcript', 'normal', { transcript: text })
      pushEvent('user_speech_ended', 'normal')

      // Sprint 20 — speech uses the same Brain pipeline as text (when brain.voice is on).
      if (isBrainVoiceIntegrationEnabled()) {
        const brainResult = runIntegratedBrainTurn({
          conversationId,
          userText: text,
          locale: 'ar',
        })
        lastBrainPlan = {
          intent: brainResult.plan.intent,
          action: brainResult.plan.action,
          summary: brainResult.plan.summary,
          assistantGoal: brainResult.plan.assistantGoal,
          missingFields: [...brainResult.plan.missingFields],
        }
        pushEvent('timeline_marker', 'normal', {
          kind: 'brain_plan',
          summary: brainResult.plan.summary,
          action: brainResult.plan.action,
        })
      }

      timeline.begin('thinking', 'thinking', 'thinking')
      pushEvent('thinking_started', 'normal')
      applyTransition('user_speech_end')
      return text
    },

    /**
     * Queue an assistant response (architecture only — does not synthesize speech).
     * Does not invent content; caller must supply text from a real upstream later.
     */
    queueAssistantResponse(content: string) {
      const text = content.trim()
      if (!text) return null
      if (state !== 'thinking' && state !== 'speaking') {
        return null
      }
      return pushEvent('assistant_response_queued', 'normal', { content: text })
    },

    /** Move thinking → speaking and record assistant message (no audio). */
    beginAssistantSpeech(content: string) {
      const text = content.trim()
      if (!text) return null
      if (state === 'thinking') {
        timeline.end('thinking')
        pushEvent('thinking_ended', 'normal')
        applyTransition('assistant_ready')
      }
      if (state !== 'speaking') return null
      appendMessage('assistant', text, 'speech')
      timeline.begin('speaking', 'assistant_speech', 'speaking', { preview: text.slice(0, 80) })
      pushEvent('assistant_speech_started', 'normal', { content: text })
      return text
    },

    endAssistantSpeech() {
      if (state !== 'speaking') return
      timeline.end('speaking')
      pushEvent('assistant_speech_ended', 'normal')
      applyTransition('assistant_done')
      timeline.begin('listening', 'user_speech', 'listening')
      pushEvent('user_speech_started', 'normal')
    },

    /**
     * Barge-in: cancel outgoing queue, interrupt provider, resume listening.
     * Serialized via transitionLock — no duplicated state / races.
     */
    async interrupt() {
      if (disposed) return
      if (state !== 'speaking' && state !== 'thinking' && state !== 'listening') {
        return
      }
      const cancelled = queue.cancelOutgoingBelow(100)
      pushEvent('interrupted', 'critical', { cancelledOutgoing: cancelled })
      pushEvent('queue_cancelled', 'critical', { count: cancelled })
      timeline.end('speaking')
      timeline.end('thinking')
      interruptedCount += 1
      await provider.interrupt()
      applyTransition('interrupt')
      // Immediately resume listening (requirement: assistant stops → listening resumes).
      applyTransition('start')
      timeline.begin('listening', 'user_speech', 'listening', { afterInterrupt: true })
      pushEvent('user_speech_started', 'high')
    },

    pause() {
      if (!canTransition(state, 'pause')) return
      timeline.end('listening')
      timeline.end('speaking')
      pushEvent('paused', 'high')
      applyTransition('pause')
    },

    resume() {
      if (!canTransition(state, 'resume')) return
      pushEvent('resumed', 'high')
      applyTransition('resume')
      timeline.begin('listening', 'user_speech', 'listening')
    },

    async disconnect() {
      await provider.getTransport().disconnect()
      connected = false
      pushEvent('disconnected', 'high')
      timeline.mark('reconnect', 'disconnected')
      if (canTransition(state, 'disconnect')) applyTransition('disconnect')
      else {
        previousState = state
        state = 'disconnected'
        emit()
      }
    },

    async reconnect() {
      reconnectCount += 1
      pushEvent('reconnect_attempt', 'high', { attempt: reconnectCount })
      timeline.mark('reconnect', 'reconnect_attempt', { attempt: reconnectCount })
      await provider.getTransport().connect({ conversationId })
      connected = provider.getTransport().isConnected()
      if (canTransition(state, 'reconnect')) applyTransition('reconnect')
      pushEvent('reconnected', 'high')
      timeline.mark('reconnect', 'reconnected', { attempt: reconnectCount })
      emit()
    },

    recordLatency(label: string, durationMs: number) {
      timeline.sampleLatency(label, durationMs)
      pushEvent('latency_sample', 'normal', { label, durationMs })
      emit()
    },

    fail(message: string) {
      lastError = message
      pushEvent('error', 'critical', { message })
      timeline.mark('error', message)
      if (canTransition(state, 'error')) applyTransition('error')
      else emit()
    },

    resetFromError() {
      if (state !== 'error') return
      lastError = null
      applyTransition('reset')
    },

    /** Test/helper: inspect whether a transition would be legal. */
    can(reason: VoiceSessionTransitionReason) {
      return canTransition(state, reason)
    },

    peekNextState(reason: VoiceSessionTransitionReason) {
      return nextVoiceState(state, reason)
    },

    dispose() {
      if (disposed) return
      disposed = true
      listeningSince = null
      speakingSince = null
      queue.clear()
      listeners.clear()
      void provider.stopSession()
    },
  }
}

export type VoiceSession = ReturnType<typeof createVoiceSession>
