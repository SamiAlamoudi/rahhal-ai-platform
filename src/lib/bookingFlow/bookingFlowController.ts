/**
 * Sprint 25 — BookingFlowController
 *
 * Orchestrates existing engines/APIs only:
 * BookingOrchestrator, persistence, search→booking adapter, payment bridge, brain sync.
 * No duplicated booking/search/planning business rules.
 */

import {
  getBookingOrchestrator,
  persistBookingSession,
  syncBookingSession,
  loadBookingSession,
  type BookingSelectedItem,
  type BookingSession,
  type BookingItemType,
  type AddBookingItemInput,
} from '../booking'
import { prepareBookingPayment } from '../payment'
import type { ConversationMemory } from '../brain/types'
import { searchOptionsToBookingSelectedItems, bookingKindOfItem } from './searchOptionAdapter'
import {
  saveBookingFlowState,
  loadBookingFlowState,
  loadLatestBookingFlowState,
  loadBookingFlowBySessionId,
  BOOKING_FLOW_STORAGE_PREFIX,
} from './bookingFlowPersistence'
import { buildBookingFlowReviewModel } from './reviewModel'
import {
  detectBookingFlowConversationEdit,
  bookingEditTouchesSection,
} from './conversationEdits'
import {
  syncBrainMemoryFromBookingFlow,
  bookingFlowBrainContextSummary,
} from './brainBookingSync'
import type {
  ApplySearchOptionSelectionInput,
  ApplySelectionInput,
  BookingFlowControllerOptions,
  BookingFlowPaymentNav,
  BookingFlowReviewModel,
  BookingFlowStage,
  BookingFlowState,
  CreateBookingFlowInput,
} from './types'
import type { SearchOption } from '../brain/search/types'

function nowIso(): string {
  return new Date().toISOString()
}

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function selectedToAddInput(item: BookingSelectedItem): AddBookingItemInput {
  return {
    type: item.bookingType,
    providerId: item.option.providerIds[0] || 'unknown',
    providerName: item.providerName,
    providerOfferId: item.option.id,
    title: item.option.title,
    price: item.option.price,
    currency: item.option.currency,
    bookingUrl: item.bookingUrl,
    expiresAt: item.expiresAt,
    travelerSummary: '',
    metadata: {
      cancellationInfo: item.cancellationInfo,
      rating: item.option.rating,
      refundable: item.option.refundable,
      bookingKind: item.option.attributes.bookingKind ?? item.bookingType,
      attributes: item.option.attributes,
    },
  }
}

function advanceStage(
  current: BookingFlowStage,
  next: BookingFlowStage,
): BookingFlowStage {
  const order: BookingFlowStage[] = [
    'conversation',
    'requirements',
    'planning',
    'execution',
    'search_results',
    'user_selection',
    'booking_session',
    'booking_review',
    'ready_for_payment',
  ]
  const ci = order.indexOf(current)
  const ni = order.indexOf(next)
  return ni >= ci ? next : current
}

/**
 * BookingFlowController factory — session-scoped orchestration handle.
 */
export function BookingFlowController(options: BookingFlowControllerOptions = {}) {
  const storagePrefix = options.storagePrefix ?? BOOKING_FLOW_STORAGE_PREFIX
  const orchestrator = getBookingOrchestrator()
  const flows = new Map<string, BookingFlowState>()

  function persist(state: BookingFlowState): BookingFlowState {
    const next = { ...state, updatedAt: nowIso() }
    flows.set(next.id, next)
    saveBookingFlowState(next, storagePrefix)
    return next
  }

  function getFlow(flowId: string): BookingFlowState | null {
    return flows.get(flowId) ?? null
  }

  function requireFlow(flowId: string): BookingFlowState {
    const flow = getFlow(flowId)
    if (!flow) throw new Error(`Booking flow not found: ${flowId}`)
    return flow
  }

  function getSession(flow: BookingFlowState): BookingSession | null {
    if (!flow.bookingSessionId) return null
    return (
      orchestrator.getBookingSession(flow.bookingSessionId) ??
      null
    )
  }

  async function ensureSessionLoaded(flow: BookingFlowState): Promise<BookingSession | null> {
    if (!flow.bookingSessionId) return null
    const hot = orchestrator.getBookingSession(flow.bookingSessionId)
    if (hot) return hot
    const loaded = await loadBookingSession(flow.bookingSessionId, flow.userId)
    if (loaded) {
      orchestrator.importSession(loaded)
      return loaded
    }
    return null
  }

  function createFlow(input: CreateBookingFlowInput): BookingFlowState {
    const now = nowIso()
    const state: BookingFlowState = {
      id: newId('bflow'),
      conversationId: input.conversationId ?? null,
      userId: input.userId,
      stage: 'conversation',
      bookingSessionId: null,
      travelSessionId: input.travelSessionId ?? null,
      currency: input.currency ?? 'SAR',
      selectedItems: [],
      searchRecommendation: null,
      budget: input.budget ?? { amount: null, currency: input.currency ?? 'SAR' },
      dates: input.dates ?? {
        startDate: null,
        endDate: null,
        durationDays: null,
      },
      travelers: input.travelers ?? {
        adults: null,
        children: null,
        infants: null,
        summary: null,
      },
      lastEditedSection: null,
      createdAt: now,
      updatedAt: now,
    }
    return persist(state)
  }

  function setStage(flowId: string, stage: BookingFlowStage): BookingFlowState {
    const flow = requireFlow(flowId)
    return persist({ ...flow, stage: advanceStage(flow.stage, stage) })
  }

  function attachSearchRecommendation(
    flowId: string,
    recommendation: BookingFlowState['searchRecommendation'],
  ): BookingFlowState {
    const flow = requireFlow(flowId)
    return persist({
      ...flow,
      searchRecommendation: recommendation,
      stage: advanceStage(flow.stage, 'search_results'),
    })
  }

  async function applySelection(input: ApplySelectionInput): Promise<{
    flow: BookingFlowState
    session: BookingSession
  }> {
    const flow = requireFlow(input.flowId)
    let session = await ensureSessionLoaded(flow)

    if (!session) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      session = orchestrator.createBookingSession({
        userId: flow.userId,
        travelSessionId: flow.travelSessionId,
        currency: flow.currency,
        expiresAt,
      })
    }

    const replaceTypes = input.replaceTypes
    const replaceKinds = input.replaceKinds

    if (replaceTypes?.length || replaceKinds?.length) {
      const fromStatus = session.status
      for (const item of session.items) {
        const kind = bookingKindOfItem(item)
        const byKind = replaceKinds?.includes(kind) === true
        const byType =
          !replaceKinds?.length && replaceTypes?.includes(item.type) === true
        if (byKind || byType) {
          session = orchestrator.removeBookingItem(session.id, item.id) ?? session
        }
      }
      session = orchestrator.getBookingSession(session.id) ?? session
      await syncBookingSession(session, fromStatus)
    }

    const fromStatus = session.status
    for (const item of input.items) {
      if (replaceKinds?.length) {
        const kind = String(item.option.attributes.bookingKind ?? item.bookingType)
        if (!replaceKinds.includes(kind as (typeof replaceKinds)[number])) continue
      } else if (replaceTypes && !replaceTypes.includes(item.bookingType)) {
        continue
      }
      const result = orchestrator.addBookingItem(session.id, selectedToAddInput(item))
      if (result.session) session = result.session
    }

    await persistBookingSession(session)

    const mergedSelected = mergeSelectedItems(
      flow.selectedItems,
      input.items,
      replaceTypes,
      replaceKinds,
    )

    const nextFlow = persist({
      ...flow,
      bookingSessionId: session.id,
      selectedItems: mergedSelected,
      stage: advanceStage(flow.stage, 'booking_session'),
      lastEditedSection: sectionFromReplace(replaceKinds, replaceTypes),
    })

    void fromStatus
    return { flow: nextFlow, session }
  }

  async function applySearchOptionSelection(
    input: ApplySearchOptionSelectionInput,
  ): Promise<{ flow: BookingFlowState; session: BookingSession }> {
    const selected = searchOptionsToBookingSelectedItems(input.options)
    return applySelection({
      flowId: input.flowId,
      items: selected,
      replaceKinds: input.replaceKinds,
      replaceTypes: input.replaceKinds
        ? kindsToBookingTypes(input.replaceKinds)
        : undefined,
    })
  }

  async function enterReview(flowId: string): Promise<{
    flow: BookingFlowState
    model: BookingFlowReviewModel
  }> {
    const flow = requireFlow(flowId)
    const session = await ensureSessionLoaded(flow)
    if (!session) throw new Error('No booking session for review')

    const summary = orchestrator.calculateBookingSummary(session.id)
    const readiness = orchestrator.validateBookingReadiness(session.id)
    if (!summary) throw new Error('Unable to calculate booking summary')

    const nextFlow = persist({
      ...flow,
      stage: advanceStage(flow.stage, 'booking_review'),
    })

    const model = buildBookingFlowReviewModel({
      session,
      stage: nextFlow.stage,
      summary,
      readiness,
      budget: nextFlow.budget,
      dates: nextFlow.dates,
      travelers: nextFlow.travelers,
    })

    return { flow: nextFlow, model }
  }

  async function markReadyForPayment(flowId: string): Promise<{
    flow: BookingFlowState
    nav: BookingFlowPaymentNav
  }> {
    const flow = requireFlow(flowId)
    const session = await ensureSessionLoaded(flow)
    if (!session || session.items.length === 0) {
      throw new Error('Booking session not ready for payment')
    }

    const prepared = prepareBookingPayment({
      bookingSession: session,
      returnUrl: '/checkout/return',
      customerEmail: null,
      customerName: null,
    })

    const nextFlow = persist({
      ...flow,
      stage: 'ready_for_payment',
    })

    return {
      flow: nextFlow,
      nav: {
        path: '/checkout',
        state: {
          items: prepared.checkoutInit.items,
          travelSessionId: prepared.checkoutInit.travelSessionId,
          currency: prepared.currency,
          bookingSessionId: prepared.bookingSessionId,
        },
      },
    }
  }

  /**
   * Partial section replace — changing hotel does not recreate flights.
   */
  async function replaceSection(
    flowId: string,
    section: 'flights' | 'hotels' | 'transport' | 'activities' | 'packages',
    items: BookingSelectedItem[],
  ): Promise<{ flow: BookingFlowState; session: BookingSession }> {
    const kindMap = {
      flights: 'flight' as const,
      hotels: 'hotel' as const,
      transport: 'transport' as const,
      activities: 'activity' as const,
      packages: 'package' as const,
    }
    const result = await applySelection({
      flowId,
      items,
      replaceKinds: [kindMap[section]],
    })
    const next = persist({
      ...result.flow,
      lastEditedSection: section,
    })
    return { flow: next, session: result.session }
  }

  function applyConversationEdit(
    flowId: string,
    userText: string,
  ): {
    flow: BookingFlowState
    edit: ReturnType<typeof detectBookingFlowConversationEdit>
    section: ReturnType<typeof bookingEditTouchesSection>
  } {
    const flow = requireFlow(flowId)
    const edit = detectBookingFlowConversationEdit(userText)
    const section = bookingEditTouchesSection(edit)

    let next = flow
    if (edit.kind === 'extend_nights') {
      const extra = 2
      const duration = (flow.dates.durationDays ?? 0) + extra
      next = persist({
        ...flow,
        dates: { ...flow.dates, durationDays: duration },
        lastEditedSection: 'dates',
        stage: advanceStage(flow.stage, 'booking_review'),
      })
    } else if (edit.kind === 'business_class') {
      next = persist({
        ...flow,
        lastEditedSection: 'flights',
        stage: advanceStage(flow.stage, 'user_selection'),
      })
    } else if (edit.kind === 'cheaper_hotel' || edit.kind === 'cheaper_flight') {
      next = persist({
        ...flow,
        lastEditedSection: section,
        stage: advanceStage(flow.stage, 'user_selection'),
      })
    }

    return { flow: next, edit, section }
  }

  function syncBrain(
    flowId: string,
    memory: ConversationMemory,
  ): { memory: ConversationMemory; summary: string } {
    const flow = requireFlow(flowId)
    const session = getSession(flow)
    const nextMemory = syncBrainMemoryFromBookingFlow(memory, flow, session)
    return {
      memory: nextMemory,
      summary: bookingFlowBrainContextSummary(flow, session),
    }
  }

  function restoreFlow(userId: string, flowId: string): BookingFlowState | null {
    const loaded = loadBookingFlowState(userId, flowId, storagePrefix)
    if (!loaded) return null
    flows.set(loaded.id, loaded)
    return loaded
  }

  function restoreLatest(userId: string): BookingFlowState | null {
    const loaded = loadLatestBookingFlowState(userId, storagePrefix)
    if (!loaded) return null
    flows.set(loaded.id, loaded)
    return loaded
  }

  function restoreByBookingSession(
    userId: string,
    bookingSessionId: string,
  ): BookingFlowState | null {
    const loaded = loadBookingFlowBySessionId(
      userId,
      bookingSessionId,
      storagePrefix,
    )
    if (!loaded) return null
    flows.set(loaded.id, loaded)
    return loaded
  }

  function updateContext(
    flowId: string,
    patch: Partial<
      Pick<BookingFlowState, 'budget' | 'dates' | 'travelers' | 'conversationId' | 'currency'>
    >,
  ): BookingFlowState {
    const flow = requireFlow(flowId)
    return persist({
      ...flow,
      ...patch,
      budget: patch.budget ? { ...flow.budget, ...patch.budget } : flow.budget,
      dates: patch.dates ? { ...flow.dates, ...patch.dates } : flow.dates,
      travelers: patch.travelers
        ? { ...flow.travelers, ...patch.travelers }
        : flow.travelers,
    })
  }

  /** Bind an existing BookingSession into the flow without recreating items. */
  function bindSession(flowId: string, sessionId: string): BookingFlowState {
    const flow = requireFlow(flowId)
    return persist({
      ...flow,
      bookingSessionId: sessionId,
      stage: advanceStage(flow.stage, 'booking_session'),
    })
  }

  return {
    createFlow,
    getFlow,
    setStage,
    attachSearchRecommendation,
    applySelection,
    applySearchOptionSelection,
    enterReview,
    markReadyForPayment,
    replaceSection,
    applyConversationEdit,
    syncBrain,
    restoreFlow,
    restoreLatest,
    restoreByBookingSession,
    updateContext,
    bindSession,
    ensureSessionLoaded,
  }
}

export type BookingFlowControllerHandle = ReturnType<typeof BookingFlowController>

/** Singleton for app UI (tests may reset). */
let singleton: BookingFlowControllerHandle | null = null

export function getBookingFlowController(
  options?: BookingFlowControllerOptions,
): BookingFlowControllerHandle {
  if (!singleton) singleton = BookingFlowController(options)
  return singleton
}

export function resetBookingFlowController(): void {
  singleton = null
}

function kindsToBookingTypes(
  kinds: SearchOption['kind'][],
): BookingItemType[] {
  const out = new Set<BookingItemType>()
  for (const kind of kinds) {
    if (kind === 'flight') out.add('flight')
    if (kind === 'hotel') out.add('hotel')
    if (kind === 'transport') {
      out.add('transfer')
      out.add('rental_car')
    }
    if (kind === 'activity' || kind === 'package') out.add('activity')
  }
  return [...out]
}

function mergeSelectedItems(
  existing: BookingSelectedItem[],
  incoming: BookingSelectedItem[],
  replaceTypes?: BookingItemType[],
  replaceKinds?: Array<'flight' | 'hotel' | 'transport' | 'activity' | 'package'>,
): BookingSelectedItem[] {
  if (!replaceTypes?.length && !replaceKinds?.length) {
    return incoming.length ? incoming : existing
  }
  const kept = existing.filter((item) => {
    const kind = String(item.option.attributes.bookingKind ?? item.bookingType)
    if (replaceKinds?.length) return !replaceKinds.includes(kind as (typeof replaceKinds)[number])
    return !replaceTypes?.includes(item.bookingType)
  })
  return [...kept, ...incoming]
}

function sectionFromReplace(
  replaceKinds?: Array<'flight' | 'hotel' | 'transport' | 'activity' | 'package'>,
  replaceTypes?: BookingItemType[],
): BookingFlowState['lastEditedSection'] {
  if (replaceKinds?.includes('hotel') || replaceTypes?.includes('hotel')) return 'hotels'
  if (replaceKinds?.includes('flight') || replaceTypes?.includes('flight')) return 'flights'
  if (
    replaceKinds?.includes('transport') ||
    replaceTypes?.includes('transfer') ||
    replaceTypes?.includes('rental_car')
  ) {
    return 'transport'
  }
  if (replaceKinds?.includes('package')) return 'packages'
  if (replaceKinds?.includes('activity') || replaceTypes?.includes('activity')) {
    return 'activities'
  }
  return null
}
