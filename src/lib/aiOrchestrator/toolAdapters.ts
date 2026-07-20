/**
 * Sprint 43 — thin adapters into existing engines.
 * Orchestrator must never reimplement booking / refund / disruption / etc. logic.
 */

import {
  UnifiedTravelPlanner,
  emptyUnifiedContext,
  extractContextFromUserText,
  mergeUnifiedContext,
  searchUnifiedFlights,
  searchUnifiedHotels,
  type UnifiedTravelPlannerHandle,
  type UnifiedTravelPlanResult,
} from '../brain/unifiedTravel'
import {
  answerRefundQuery,
  createPolicyEngine,
  linesFromPlan,
  type PolicyEngine,
} from '../refunds'
import {
  answerDisruptionQuery,
  createTravelDisruptionEngine,
  type TravelDisruptionEngine,
} from '../disruption'
import {
  answerLoyaltyQuery,
  createLoyaltyPlatform,
  type LoyaltyPlatform,
} from '../loyalty'
import {
  answerDocumentQuery,
  createTravelDocumentsPlatform,
  extractDestinationFromText,
  type TravelDocumentsPlatform,
} from '../travelDocuments'
import {
  answerSupplierQuery,
  createSupplierMarketplace,
  type SupplierMarketplace,
} from '../suppliers'
import {
  answerFinanceQuery,
  createFinancePlatform,
  type FinancePlatform,
} from '../finance'
import {
  answerTripQuery,
  getPostBookingService,
  type PostBookingService,
} from '../trips'
import type {
  OrchestratorMemorySnapshot,
  OrchestratorToolId,
  RankedRecommendation,
  ToolExecutionResult,
} from './types'

export type ToolAdapterDeps = {
  planner?: UnifiedTravelPlannerHandle
  policyEngine?: PolicyEngine
  disruptionEngine?: TravelDisruptionEngine
  loyaltyPlatform?: LoyaltyPlatform
  travelDocumentsPlatform?: TravelDocumentsPlatform
  supplierMarketplace?: SupplierMarketplace
  financePlatform?: FinancePlatform
  postBookingService?: PostBookingService
}

export type ToolAdapterContext = {
  conversationId: string
  userText: string
  locale: 'ar' | 'en'
  userId: string
  memory: OrchestratorMemorySnapshot
  intent: string
  signal?: AbortSignal
}

export type ToolAdaptersHandle = {
  run: (tool: OrchestratorToolId, ctx: ToolAdapterContext) => Promise<ToolExecutionResult>
  getLastPlanResult: () => UnifiedTravelPlanResult | null
}

export function createToolAdapters(deps: ToolAdapterDeps = {}): ToolAdaptersHandle {
  const planner =
    deps.planner
    ?? UnifiedTravelPlanner({ enabled: true, skipOrchestrator: true })
  const policyEngine = deps.policyEngine ?? createPolicyEngine({ enabled: true })
  const postBookingService = deps.postBookingService ?? getPostBookingService()
  const disruptionEngine =
    deps.disruptionEngine
    ?? createTravelDisruptionEngine({
      enabled: true,
      postBooking: postBookingService,
      notifications: postBookingService.getNotificationScheduler(),
    })
  const loyaltyPlatform = deps.loyaltyPlatform ?? createLoyaltyPlatform({ enabled: true })
  const travelDocumentsPlatform =
    deps.travelDocumentsPlatform
    ?? createTravelDocumentsPlatform({ enabled: true })
  const supplierMarketplace =
    deps.supplierMarketplace ?? createSupplierMarketplace({ enabled: true })
  const financePlatform = deps.financePlatform ?? createFinancePlatform({ enabled: true })

  let lastPlan: UnifiedTravelPlanResult | null = null

  async function run(tool: OrchestratorToolId, ctx: ToolAdapterContext): Promise<ToolExecutionResult> {
    const started = Date.now()
    try {
      const result = await dispatch(tool, ctx)
      return { ...result, durationMs: Date.now() - started }
    } catch (error) {
      return {
        tool,
        ok: false,
        durationMs: Date.now() - started,
        summary: 'Tool failed',
        recommendations: [],
        error: error instanceof Error ? error.message : 'tool_error',
      }
    }
  }

  async function dispatch(
    tool: OrchestratorToolId,
    ctx: ToolAdapterContext,
  ): Promise<Omit<ToolExecutionResult, 'durationMs'>> {
    switch (tool) {
      case 'destination':
        return runDestination(ctx)
      case 'flights':
        return runFlights(ctx)
      case 'hotels':
        return runHotels(ctx)
      case 'visa':
        return runVisa(ctx)
      case 'insurance':
        return runInsurance(ctx)
      case 'activities':
        return runActivities(ctx)
      case 'supplier_marketplace':
        return runSuppliers(ctx)
      case 'loyalty':
        return runLoyalty(ctx)
      case 'finance':
        return runFinance(ctx)
      case 'refund_policy':
        return runRefund(ctx)
      case 'disruption':
        return runDisruption(ctx)
      case 'travel_documents':
        return runDocuments(ctx)
      case 'timeline':
        return runTimeline(ctx)
      case 'notifications':
        return runNotifications(ctx)
      case 'booking':
      case 'travel_execution':
      case 'payments':
        return runBookingHandoff(tool, ctx)
      case 'ai_conversation':
        return runConversationPlanner(ctx)
      default:
        return {
          tool,
          ok: false,
          summary: 'Unknown tool',
          recommendations: [],
          error: 'unknown_tool',
        }
    }
  }

  function resolveDestination(ctx: ToolAdapterContext): string | null {
    const fromText = extractContextFromUserText(ctx.userText, ctx.locale)
    return (
      fromText.destination
      ?? extractDestinationFromText(ctx.userText)
      ?? extractKnownDestination(ctx.userText)
      ?? ctx.memory.destination
      ?? null
    )
  }

  function buildCtx(ctx: ToolAdapterContext) {
    const fromText = extractContextFromUserText(ctx.userText, ctx.locale)
    const destination = resolveDestination(ctx)
    const base = emptyUnifiedContext(ctx.locale)
    return mergeUnifiedContext(base, {
      ...fromText,
      destination,
      origin: fromText.origin ?? ctx.memory.origin ?? 'RUH',
      adults: fromText.adults ?? ctx.memory.travellers.adults ?? 1,
      children: fromText.children ?? ctx.memory.travellers.children ?? 0,
      budgetAmount: fromText.budgetAmount ?? ctx.memory.budget.amount,
      currency: fromText.currency ?? ctx.memory.budget.currency ?? 'SAR',
      preferredAirlines: unique([
        ...(fromText.preferredAirlines ?? []),
        ...ctx.memory.preferredAirlines,
      ]),
      preferredHotels: unique([
        ...(fromText.preferredHotels ?? []),
        ...ctx.memory.hotelPreferences,
      ]),
    })
  }

  function runDestination(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const unified = buildCtx(ctx)
    const destination = unified.destination ?? 'your destination'
    return {
      tool: 'destination',
      ok: true,
      summary:
        ctx.locale === 'ar'
          ? `وجهة الرحلة: ${destination}`
          : `Trip destination: ${destination}`,
      recommendations: [
        {
          id: `dest_${slug(destination)}`,
          kind: 'other',
          title: destination,
          score: 0.8,
          price: null,
          currency: unified.currency,
          quality: 0.8,
          refundFlexibility: 0.5,
          supplierScore: 0.5,
          travelTimeHours: null,
          loyaltyValue: 0.4,
          preferenceMatch: 0.7,
          reasons: ['Primary destination from your request'],
          payload: { destination },
        },
      ],
      data: { destination },
    }
  }

  async function runFlights(ctx: ToolAdapterContext): Promise<Omit<ToolExecutionResult, 'durationMs'>> {
    const unified = buildCtx(ctx)
    const flights = await searchUnifiedFlights(unified)
    const recommendations: RankedRecommendation[] = flights.map((f, i) => ({
      id: f.id || `flight_${i}`,
      kind: 'flight' as const,
      title: `${f.airline} ${f.from}→${f.to}`,
      score: 0,
      price: f.price,
      currency: f.currency,
      quality: f.stops === 0 ? 0.9 : 0.65,
      refundFlexibility: 0.55,
      supplierScore: 0.7,
      travelTimeHours: f.durationHours,
      loyaltyValue: ctx.memory.preferredAirlines.some((a) =>
        f.airline.toLowerCase().includes(a.toLowerCase()),
      )
        ? 0.85
        : 0.4,
      preferenceMatch: ctx.memory.preferredAirlines.some((a) =>
        f.airline.toLowerCase().includes(a.toLowerCase()),
      )
        ? 0.9
        : 0.4,
      reasons: [`${f.stops} stop(s)`, f.cabin],
      payload: { ...f },
    }))
    return {
      tool: 'flights',
      ok: true,
      summary:
        ctx.locale === 'ar'
          ? `وجدت ${flights.length} خيارات طيران.`
          : `Found ${flights.length} flight options.`,
      recommendations,
      data: { flights },
    }
  }

  async function runHotels(ctx: ToolAdapterContext): Promise<Omit<ToolExecutionResult, 'durationMs'>> {
    const unified = buildCtx(ctx)
    const hotelResult = await searchUnifiedHotels(unified)
    const recommendations: RankedRecommendation[] = hotelResult.stays.map((h, i) => ({
      id: h.id || `hotel_${i}`,
      kind: 'hotel' as const,
      title: h.name,
      score: 0,
      price: h.nightly * (unified.nights || 1),
      currency: h.currency,
      quality: Math.min(1, (h.stars ?? 3) / 5),
      refundFlexibility: 0.6,
      supplierScore: 0.7,
      travelTimeHours: null,
      loyaltyValue: ctx.memory.hotelPreferences.some((p) =>
        h.name.toLowerCase().includes(p.toLowerCase()),
      )
        ? 0.8
        : 0.35,
      preferenceMatch: ctx.memory.hotelPreferences.some((p) =>
        h.name.toLowerCase().includes(p.toLowerCase()),
      )
        ? 0.9
        : 0.4,
      reasons: [`${h.stars}★`, h.area || 'City stay'],
      payload: { ...h },
    }))
    return {
      tool: 'hotels',
      ok: true,
      summary:
        ctx.locale === 'ar'
          ? `وجدت ${hotelResult.stays.length} خيارات فنادق.`
          : `Found ${hotelResult.stays.length} hotel options.`,
      recommendations,
      data: { hotels: hotelResult.stays },
    }
  }

  function runVisa(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const destination = resolveDestination(ctx) ?? 'Morocco'
    const nationality = ctx.memory.nationality ?? ctx.memory.passport.nationality ?? 'SA'
    const summary = answerDocumentQuery({
      kind: 'need_visa',
      platform: travelDocumentsPlatform,
      userId: ctx.userId,
      userText: ctx.userText.includes('visa') || ctx.userText.includes('تأشيرة')
        ? ctx.userText
        : `Do I need a visa for ${destination}?`,
      locale: ctx.locale,
      nationality,
      defaults: { destination, nationality },
    })
    return {
      tool: 'visa',
      ok: true,
      summary,
      recommendations: [
        {
          id: `visa_${slug(destination)}`,
          kind: 'visa',
          title: `Visa guidance for ${destination}`,
          score: 0,
          price: null,
          currency: null,
          quality: 0.75,
          refundFlexibility: 0.3,
          supplierScore: 0.5,
          travelTimeHours: null,
          loyaltyValue: 0.2,
          preferenceMatch: 0.5,
          reasons: ['Document intelligence'],
          payload: { destination, nationality },
        },
      ],
    }
  }

  function runInsurance(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const destination = resolveDestination(ctx) ?? 'your trip'
    const price = 89
    return {
      tool: 'insurance',
      ok: true,
      summary:
        ctx.locale === 'ar'
          ? `يمكن إضافة تأمين سفر شامل لرحلة ${destination}.`
          : `Travel insurance is available for ${destination}, including medical and trip interruption cover.`,
      recommendations: [
        {
          id: `ins_${slug(String(destination))}`,
          kind: 'insurance',
          title: 'Comprehensive travel insurance',
          score: 0,
          price,
          currency: ctx.memory.budget.currency ?? 'SAR',
          quality: 0.8,
          refundFlexibility: 0.7,
          supplierScore: 0.75,
          travelTimeHours: null,
          loyaltyValue: 0.3,
          preferenceMatch: 0.5,
          reasons: ['Medical cover', 'Trip interruption'],
        },
      ],
    }
  }

  function runActivities(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const destination = resolveDestination(ctx) ?? 'the city'
    const activities = [
      { id: 'act_food', title: `${destination} food walk`, price: 120 },
      { id: 'act_culture', title: `${destination} cultural highlights`, price: 180 },
      { id: 'act_day', title: `${destination} day trip`, price: 260 },
    ]
    return {
      tool: 'activities',
      ok: true,
      summary:
        ctx.locale === 'ar'
          ? `إليك أنشطة مقترحة في ${destination}.`
          : `Here are suggested activities in ${destination}.`,
      recommendations: activities.map((a) => ({
        id: a.id,
        kind: 'activity' as const,
        title: a.title,
        score: 0,
        price: a.price,
        currency: ctx.memory.budget.currency ?? 'SAR',
        quality: 0.75,
        refundFlexibility: 0.65,
        supplierScore: 0.7,
        travelTimeHours: 3,
        loyaltyValue: 0.25,
        preferenceMatch: 0.55,
        reasons: ['Local experience'],
      })),
    }
  }

  function runSuppliers(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const kind =
      ctx.intent === 'cheapest_option' ? 'avoid_poor_refunds' : 'rank_suppliers'
    const summary = answerSupplierQuery({
      kind,
      marketplace: supplierMarketplace,
      locale: ctx.locale,
    })
    return {
      tool: 'supplier_marketplace',
      ok: true,
      summary,
      recommendations: [
        {
          id: 'supplier_top',
          kind: 'supplier',
          title: 'Top matched suppliers',
          score: 0,
          price: null,
          currency: null,
          quality: 0.8,
          refundFlexibility: ctx.intent === 'cheapest_option' ? 0.85 : 0.6,
          supplierScore: 0.9,
          travelTimeHours: null,
          loyaltyValue: 0.4,
          preferenceMatch: 0.5,
          reasons: ['Marketplace ranking'],
        },
      ],
    }
  }

  function runLoyalty(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const summary = answerLoyaltyQuery({
      kind: ctx.intent === 'cheapest_option' ? 'use_rahhal_points' : 'points_earn_estimate',
      platform: loyaltyPlatform,
      userId: ctx.userId,
      locale: ctx.locale,
      context: {
        preferredAirlines: ctx.memory.preferredAirlines,
        preferredHotels: ctx.memory.hotelPreferences,
      },
      estimateAmount: ctx.memory.budget.amount ?? 2000,
    })
    return {
      tool: 'loyalty',
      ok: true,
      summary,
      recommendations: [
        {
          id: 'loyalty_value',
          kind: 'other',
          title: 'Loyalty value',
          score: 0,
          price: null,
          currency: null,
          quality: 0.7,
          refundFlexibility: 0.5,
          supplierScore: 0.5,
          travelTimeHours: null,
          loyaltyValue: 0.9,
          preferenceMatch: ctx.memory.loyaltyMemberships.length ? 0.85 : 0.4,
          reasons: ctx.memory.loyaltyMemberships.length
            ? [`Memberships: ${ctx.memory.loyaltyMemberships.join(', ')}`]
            : ['Rahhal points estimate'],
        },
      ],
    }
  }

  function runFinance(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const summary = answerFinanceQuery({
      kind: 'finance_profit_destination',
      platform: financePlatform,
      userText: ctx.userText,
    })
    return {
      tool: 'finance',
      ok: true,
      summary,
      recommendations: [
        {
          id: 'finance_value',
          kind: 'other',
          title: 'Value & margin view',
          score: 0,
          price: ctx.memory.budget.amount,
          currency: ctx.memory.budget.currency ?? 'SAR',
          quality: 0.65,
          refundFlexibility: 0.5,
          supplierScore: 0.55,
          travelTimeHours: null,
          loyaltyValue: 0.35,
          preferenceMatch: 0.4,
          reasons: ['Finance platform insight'],
        },
      ],
    }
  }

  function runRefund(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const trip = postBookingService.listUserTrips(ctx.userId)[0]
    const currency = trip?.currency ?? ctx.memory.budget.currency ?? 'SAR'
    const kind =
      ctx.intent === 'flight_cancelled' ? 'airline_cancels' : 'cancel_refund_quote'
    const summary = answerRefundQuery({
      kind,
      engine: policyEngine,
      tripId: trip?.tripId ?? 'trip_conversation',
      userId: ctx.userId,
      lines: linesFromPlan(null, currency),
      currency,
      platformFee: 40,
      locale: ctx.locale,
    })
    return {
      tool: 'refund_policy',
      ok: true,
      summary,
      recommendations: [
        {
          id: 'refund_flex',
          kind: 'other',
          title: 'Refund flexibility',
          score: 0,
          price: null,
          currency,
          quality: 0.6,
          refundFlexibility: 0.85,
          supplierScore: 0.5,
          travelTimeHours: null,
          loyaltyValue: 0.3,
          preferenceMatch: 0.4,
          reasons: ['Policy engine quote'],
        },
      ],
    }
  }

  function runDisruption(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const trip = postBookingService.listUserTrips(ctx.userId)[0]
    const summary = answerDisruptionQuery({
      kind: 'flight_cancelled',
      engine: disruptionEngine,
      context: {
        tripId: trip?.tripId ?? 'trip_conversation',
        userId: ctx.userId,
        conversationId: ctx.conversationId,
        destination: trip?.destination ?? ctx.memory.destination ?? 'Unknown',
        origin: trip?.origin ?? ctx.memory.origin ?? 'RUH',
        currency: trip?.currency ?? ctx.memory.budget.currency ?? 'SAR',
        flightConfirmation: trip?.references.flightConfirmation ?? null,
      },
      locale: ctx.locale,
    })
    return {
      tool: 'disruption',
      ok: true,
      summary,
      recommendations: [
        {
          id: 'recovery_plan',
          kind: 'recovery',
          title: 'Recovery options',
          score: 0,
          price: null,
          currency: trip?.currency ?? 'SAR',
          quality: 0.8,
          refundFlexibility: 0.7,
          supplierScore: 0.75,
          travelTimeHours: null,
          loyaltyValue: 0.5,
          preferenceMatch: 0.5,
          reasons: ['Disruption recovery'],
        },
      ],
    }
  }

  function runDocuments(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const nationality = ctx.memory.nationality ?? ctx.memory.passport.nationality ?? 'SA'
    const destination = resolveDestination(ctx) ?? 'nearest consulate support'
    const summary = answerDocumentQuery({
      kind: ctx.intent === 'lost_passport' ? 'what_documents' : 'can_travel_to',
      platform: travelDocumentsPlatform,
      userId: ctx.userId,
      userText:
        ctx.intent === 'lost_passport'
          ? 'What documents do I need after losing my passport?'
          : ctx.userText,
      locale: ctx.locale,
      nationality,
      defaults: { destination, nationality },
    })
    return {
      tool: 'travel_documents',
      ok: true,
      summary,
      recommendations: [
        {
          id: 'docs_checklist',
          kind: 'other',
          title: 'Document checklist',
          score: 0,
          price: null,
          currency: null,
          quality: 0.85,
          refundFlexibility: 0.2,
          supplierScore: 0.4,
          travelTimeHours: null,
          loyaltyValue: 0.2,
          preferenceMatch: 0.5,
          reasons: ['Travel documents guidance'],
        },
      ],
    }
  }

  function runTimeline(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const buckets = postBookingService.getTimelineBuckets(ctx.userId)
    const active = [...buckets.Active, ...buckets.Upcoming]
    const summary =
      active.length === 0
        ? ctx.locale === 'ar'
          ? 'لا توجد أحداث في الجدول الزمني بعد.'
          : 'No timeline events yet. I will keep your trip timeline updated.'
        : answerTripQuery({
            kind: 'my_trip',
            service: postBookingService,
            userId: ctx.userId,
            locale: ctx.locale,
          })
    return {
      tool: 'timeline',
      ok: true,
      summary,
      recommendations: [],
      data: {
        upcoming: buckets.Upcoming.length,
        active: buckets.Active.length,
        completed: buckets.Completed.length,
        cancelled: buckets.Cancelled.length,
      },
    }
  }

  function runNotifications(ctx: ToolAdapterContext): Omit<ToolExecutionResult, 'durationMs'> {
    const scheduler = postBookingService.getNotificationScheduler()
    const trip = postBookingService.listUserTrips(ctx.userId)[0]
    if (trip) {
      scheduler.schedule({
        tripId: trip.tripId,
        userId: ctx.userId,
        trigger: 'gate_change',
        channels: ['push', 'email'],
        destination: trip.destination,
        bookingReference: trip.references.bookingReference,
      })
    }
    return {
      tool: 'notifications',
      ok: true,
      summary:
        ctx.locale === 'ar'
          ? 'سأرسل تنبيهات عاجلة حول المستندات وحالة الرحلة.'
          : 'I will send urgent alerts about your documents and trip status.',
      recommendations: [],
      data: { queued: Boolean(trip) },
    }
  }

  function runBookingHandoff(
    tool: OrchestratorToolId,
    ctx: ToolAdapterContext,
  ): Omit<ToolExecutionResult, 'durationMs'> {
    return {
      tool,
      ok: true,
      summary:
        ctx.locale === 'ar'
          ? 'جاهز لمتابعة الحجز والدفع عبر المنصة الحالية.'
          : 'Ready to continue with booking and checkout on the existing platform.',
      recommendations: [],
      data: { handoff: tool },
    }
  }

  async function runConversationPlanner(
    ctx: ToolAdapterContext,
  ): Promise<Omit<ToolExecutionResult, 'durationMs'>> {
    const plan = await planner.planTrip({
      conversationId: ctx.conversationId,
      userText: ctx.userText,
      locale: ctx.locale,
      userId: ctx.userId,
      signal: ctx.signal,
      contextOverrides: {
        destination: ctx.memory.destination,
        origin: ctx.memory.origin,
        adults: ctx.memory.travellers.adults ?? undefined,
        children: ctx.memory.travellers.children ?? undefined,
        budgetAmount: ctx.memory.budget.amount,
        currency: ctx.memory.budget.currency ?? undefined,
        preferredAirlines: ctx.memory.preferredAirlines,
        preferredHotels: ctx.memory.hotelPreferences,
      },
    })
    lastPlan = plan
    return {
      tool: 'ai_conversation',
      ok: true,
      summary: plan.headline || 'Trip plan ready',
      recommendations: (plan.plans ?? []).slice(0, 3).map((p, i) => ({
        id: p.id || `plan_${i}`,
        kind: 'other' as const,
        title: p.title || `Option ${i + 1}`,
        score: 0,
        price: p.cost?.total ?? null,
        currency: p.cost?.currency ?? null,
        quality: 0.75,
        refundFlexibility: 0.55,
        supplierScore: 0.65,
        travelTimeHours: p.flight?.durationHours ?? null,
        loyaltyValue: 0.4,
        preferenceMatch: 0.55,
        reasons: p.reasons ?? [],
        payload: { planId: p.id },
      })),
      data: { plan },
    }
  }

  return {
    run,
    getLastPlanResult: () => lastPlan,
  }
}

function extractKnownDestination(userText: string): string | null {
  const known: Array<{ match: RegExp; label: string }> = [
    { match: /\bmorocco\b|marrakech|casablanca|مراكش|المغرب/i, label: 'Morocco' },
    { match: /\bjapan\b|tokyo|اليابان|طوكيو/i, label: 'Japan' },
    { match: /\bdubai\b|uae|دبي/i, label: 'Dubai' },
    { match: /\bparis\b|france|باريس/i, label: 'Paris' },
    { match: /\blondon\b|لندن/i, label: 'London' },
    { match: /\bistanbul\b|turkey|إسطنبول/i, label: 'Istanbul' },
  ]
  for (const row of known) {
    if (row.match.test(userText)) return row.label
  }
  return null
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'item'
}

function unique(values: string[]): string[] {
  const out: string[] = []
  for (const v of values) {
    const t = String(v ?? '').trim()
    if (!t) continue
    if (!out.some((x) => x.toLowerCase() === t.toLowerCase())) out.push(t)
  }
  return out
}
