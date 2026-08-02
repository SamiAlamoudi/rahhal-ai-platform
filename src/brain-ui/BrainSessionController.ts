import {
  createTravelBrain,
  type BrainRecommendationsBundle,
  type BrainTurnTrace,
  type TravelBrain,
} from '../brain'
import type { LocaleCode } from '../brain/types'
import { BRAIN_LOADING_SEQUENCE } from './loadingPhases'
import { mapTraceToError } from './mapError'
import { isDeveloperMode, mockTranscribe } from './mockVoice'
import type {
  BrainLoadingPhase,
  BrainUiError,
  BrainUiState,
  ConversationMessage,
  ConversationTimelineStep,
  RecentConversationSummary,
  SuggestedJourney,
} from './types'

const SUGGESTED: SuggestedJourney[] = [
  {
    id: 'sj-ist',
    title: 'Istanbul calm week',
    subtitle: '4 nights · soft evenings',
    prompt: 'Book a flight from Riyadh to Istanbul for 4 nights budget 5500 SAR',
  },
  {
    id: 'sj-dxb',
    title: 'Dubai weekend',
    subtitle: 'Business-friendly · short hop',
    prompt: 'Book a flight from Riyadh to Dubai budget 2500 SAR 2 adults',
  },
  {
    id: 'sj-pkg',
    title: 'Quiet package',
    subtitle: 'Flights + stay composed',
    prompt: 'Recommend a package to Istanbul',
  },
]

function emptyRecs(): BrainRecommendationsBundle {
  return { flights: [], hotels: [], packages: [], activities: [], restaurants: [] }
}

export type ControllerListener = (state: BrainUiState) => void

/**
 * Framework-agnostic session controller — TravelBrain only, mock delays.
 */
export class BrainSessionController {
  private brain: TravelBrain = createTravelBrain()
  private listeners = new Set<ControllerListener>()
  private voiceSample = 0
  private phaseTimer: ReturnType<typeof setTimeout> | null = null
  private streamTimer: ReturnType<typeof setTimeout> | null = null
  private state: BrainUiState = this.initialState()

  private initialState(): BrainUiState {
    return {
      ready: false,
      locale: 'ar',
      loading: false,
      thinking: false,
      loadingPhase: 'idle',
      voiceListening: false,
      messages: [],
      travelSession: null,
      memory: null,
      reasoning: null,
      decision: null,
      recommendations: null,
      timeline: [],
      conversationTimeline: [],
      preferences: null,
      lastTrace: null,
      error: null,
      recentConversations: [],
      suggestedJourneys: SUGGESTED,
      developerMode: isDeveloperMode(),
    }
  }

  subscribe(listener: ControllerListener): () => void {
    this.listeners.add(listener)
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState(): BrainUiState {
    return this.state
  }

  async start(userId = 'brain-ui-user', locale: LocaleCode = 'ar'): Promise<void> {
    const snap = await this.brain.begin(userId, locale)
    this.patch({
      ready: true,
      locale,
      travelSession: snap.travelSession,
      memory: snap.shortTerm,
      preferences: this.brain.conversation.preferences.getProfile(),
      developerMode: isDeveloperMode(),
    })
  }

  async sendMessage(text: string): Promise<void> {
    const trimmed = text.trim()
    if (!trimmed || this.state.loading) return
    if (!this.state.ready) await this.start(undefined, this.state.locale)

    const userMsg: ConversationMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      at: new Date().toISOString(),
    }
    this.patch({
      messages: [...this.state.messages, userMsg],
      loading: true,
      thinking: true,
      loadingPhase: 'thinking',
      error: null,
    })

    await this.runLoadingSequence()

    const trace = this.brain.processTurn(trimmed, this.state.locale)
    const error = mapTraceToError(trace)
    const steps = buildConversationTimeline(trace)
    const assistantId = `a-${Date.now()}`

    this.patch({
      thinking: false,
      loadingPhase: 'preparing',
      lastTrace: trace,
      travelSession: trace.travelSession,
      memory: trace.shortTerm,
      reasoning: trace.reasoner,
      decision: trace.decision,
      recommendations: trace.recommendations,
      timeline: trace.timeline,
      conversationTimeline: steps,
      preferences: trace.preferences,
      error,
      recentConversations: pushRecent(this.state.recentConversations, trimmed, trace.reply),
      messages: [
        ...this.state.messages,
        { id: assistantId, role: 'assistant', text: '', at: new Date().toISOString(), streaming: true },
      ],
    })

    await this.streamReply(assistantId, trace.reply)
    this.patch({ loading: false, loadingPhase: 'idle', thinking: false })
  }

  async startVoice(): Promise<void> {
    this.patch({ voiceListening: true, error: null })
    await delay(280)
    const transcript = mockTranscribe(this.voiceSample++)
    this.patch({ voiceListening: false })
    await this.sendMessage(transcript)
  }

  stopVoice(): void {
    this.patch({ voiceListening: false })
  }

  async resetConversation(): Promise<void> {
    this.clearTimers()
    this.brain = createTravelBrain()
    const locale = this.state.locale
    this.state = this.initialState()
    this.emit()
    await this.start('brain-ui-user', locale)
  }

  getRecommendations(): BrainRecommendationsBundle {
    return this.state.recommendations ?? emptyRecs()
  }

  getConversation(): ConversationMessage[] {
    return this.state.messages
  }

  getTimeline() {
    return this.state.timeline
  }

  setLocale(locale: LocaleCode): void {
    this.patch({ locale })
  }

  dispose(): void {
    this.clearTimers()
    this.listeners.clear()
  }

  private async runLoadingSequence(): Promise<void> {
    for (const phase of BRAIN_LOADING_SEQUENCE) {
      this.patch({ loadingPhase: phase, thinking: phase === 'thinking' || phase === 'reasoning' })
      await delay(70)
    }
  }

  private streamReply(messageId: string, full: string): Promise<void> {
    return new Promise((resolve) => {
      let i = 0
      const step = () => {
        i = Math.min(full.length, i + Math.max(2, Math.floor(full.length / 18)))
        const slice = full.slice(0, i)
        this.patch({
          messages: this.state.messages.map((m) =>
            m.id === messageId
              ? { ...m, text: slice, streaming: i < full.length }
              : m,
          ),
        })
        if (i >= full.length) {
          resolve()
          return
        }
        this.streamTimer = setTimeout(step, 28)
      }
      step()
    })
  }

  private patch(partial: Partial<BrainUiState>): void {
    this.state = { ...this.state, ...partial }
    this.emit()
  }

  private emit(): void {
    for (const l of this.listeners) l(this.state)
  }

  private clearTimers(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer)
    if (this.streamTimer) clearTimeout(this.streamTimer)
    this.phaseTimer = null
    this.streamTimer = null
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function buildConversationTimeline(trace: BrainTurnTrace): ConversationTimelineStep[] {
  const reasonNote =
    trace.reasoner.findings[0]?.note ??
    (trace.reasoner.overallFeasible ? 'Feasible on mock knowledge.' : 'Needs adjustment.')
  const decisionText = `${trace.decision.action}${
    trace.decision.toolRoute ? ` → ${trace.decision.toolRoute.toolId}` : ''
  }`
  const recText = `Flights ${trace.recommendations.flights.length} · Hotels ${trace.recommendations.hotels.length} · Packages ${trace.recommendations.packages.length}`
  return [
    { id: 'ct-user', kind: 'user_ask', text: trace.userText },
    { id: 'ct-reason', kind: 'brain_reasoning', text: reasonNote },
    { id: 'ct-decision', kind: 'decision', text: decisionText },
    { id: 'ct-rec', kind: 'recommendation', text: recText },
    { id: 'ct-sum', kind: 'summary', text: trace.reply },
  ]
}

function pushRecent(
  list: RecentConversationSummary[],
  userText: string,
  reply: string,
): RecentConversationSummary[] {
  const item: RecentConversationSummary = {
    id: `rc-${Date.now()}`,
    title: userText.slice(0, 42) || 'Conversation',
    preview: reply.slice(0, 80),
    updatedAt: new Date().toISOString(),
  }
  return [item, ...list].slice(0, 6)
}

export type { BrainLoadingPhase, BrainUiError }
