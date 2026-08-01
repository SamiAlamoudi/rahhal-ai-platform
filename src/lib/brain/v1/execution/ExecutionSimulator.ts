/**
 * Sprint 85 — Execution Simulator.
 * Deterministic fake data only — NO real provider calls.
 */

import type { TravelPlanSlots } from '../planning/types'
import type {
  ExecutableToolType,
  ToolDecision,
  UnifiedResultItem,
  UnifiedToolResult,
} from './types'

function slot(slots: TravelPlanSlots | null | undefined) {
  return {
    origin: slots?.origin ?? 'Riyadh',
    destination: slots?.destination ?? 'Morocco',
    start: slots?.dates.start ?? '2026-10-01',
    end: slots?.dates.end ?? '2026-10-07',
    adults: slots?.adults ?? 2,
    currency: slots?.currency ?? 'SAR',
    budget: slots?.budget ?? 5000,
  }
}

function item(
  tool: ExecutableToolType,
  id: string,
  title: string,
  extra?: Partial<UnifiedResultItem>,
): UnifiedResultItem {
  return {
    id: `${tool}_${id}`,
    kind: tool,
    title,
    ...extra,
  }
}

export class ExecutionSimulator {
  /**
   * Deterministic mock execution for a single tool decision.
   * Never calls live providers or booking systems.
   */
  execute(
    decision: ToolDecision,
    slots: TravelPlanSlots | null | undefined,
  ): UnifiedToolResult {
    const s = slot(slots)
    const items = this.itemsFor(decision.tool, s, decision.params)

    return {
      tool: decision.tool,
      ok: true,
      status: 'succeeded',
      items,
      summary: `${decision.tool}: ${items.length} simulated item(s)`,
      meta: {
        simulated: true,
        source: 'execution_simulator',
        attempts: 1,
        fallbackFrom: null,
      },
    }
  }

  private itemsFor(
    tool: ExecutableToolType,
    s: ReturnType<typeof slot>,
    params: Record<string, unknown>,
  ): UnifiedResultItem[] {
    switch (tool) {
      case 'flights':
        return [
          item('flights', 'direct', `${s.origin} → ${s.destination} direct`, {
            subtitle: s.start,
            amount: 2200,
            currency: s.currency,
            score: 92,
            tags: ['nonstop', 'simulated'],
            attributes: { stops: 0, durationMinutes: 360, adults: s.adults },
          }),
          item('flights', 'connect', `${s.origin} → ${s.destination} 1-stop`, {
            subtitle: s.start,
            amount: 1800,
            currency: s.currency,
            score: 78,
            tags: ['connection', 'simulated'],
            attributes: { stops: 1, durationMinutes: 540, adults: s.adults },
          }),
        ]
      case 'hotels':
        return [
          item('hotels', 'riad', `Riad in ${s.destination}`, {
            amount: 900,
            currency: s.currency,
            score: 88,
            tags: ['hotel', 'simulated'],
            attributes: { stars: 4, freeCancellation: true },
          }),
        ]
      case 'packages':
        return [
          item('packages', 'bundle', `${s.destination} flight+hotel package`, {
            amount: 2900,
            currency: s.currency,
            score: 85,
            tags: ['package', 'simulated'],
          }),
        ]
      case 'weather':
        return [
          item('weather', 'outlook', `Weather outlook for ${s.destination}`, {
            subtitle: 'mild / clear (simulated)',
            attributes: { highC: 28, lowC: 18 },
          }),
        ]
      case 'maps':
        return [
          item('maps', 'area', `Map context for ${s.destination}`, {
            subtitle: 'city center focus (simulated)',
            attributes: { lat: 31.63, lng: -7.99 },
          }),
        ]
      case 'visa':
        return [
          item('visa', 'info', `Visa guidance for ${s.destination}`, {
            subtitle: 'check nationality requirements (simulated)',
            tags: ['visa', 'simulated'],
          }),
        ]
      case 'knowledge':
        return [
          item('knowledge', 'tip', `Travel tip for ${s.destination}`, {
            subtitle: String(params.topic ?? 'general'),
            tags: ['knowledge', 'simulated'],
          }),
        ]
      case 'currency':
        return [
          item('currency', 'fx', `FX ${s.currency} baseline`, {
            amount: 1,
            currency: s.currency,
            attributes: { usdRate: s.currency === 'SAR' ? 0.27 : 1 },
          }),
        ]
      case 'pricing':
        return [
          item('pricing', 'rank', 'Pricing summary (simulated)', {
            amount: Math.min(s.budget, 2200),
            currency: s.currency,
            score: 90,
            tags: ['pricing', 'simulated'],
          }),
        ]
      case 'calendar':
        return [
          item('calendar', 'window', 'Travel window', {
            subtitle: `${s.start} → ${s.end}`,
            tags: ['calendar', 'simulated'],
          }),
        ]
      case 'booking':
        // Stub only — does NOT execute real booking.
        return [
          item('booking', 'prep', 'Booking preparation stub', {
            subtitle: 'prepare_booking only — no capture',
            tags: ['booking_stub', 'simulated'],
            attributes: { executable: false },
          }),
        ]
      case 'external_api':
        return [
          item('external_api', 'stub', 'External API placeholder', {
            tags: ['external', 'simulated'],
            attributes: { connected: false },
          }),
        ]
      default:
        return []
    }
  }
}

export function createExecutionSimulator(): ExecutionSimulator {
  return new ExecutionSimulator()
}
