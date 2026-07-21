import {
  aggregationResultToToolData,
  createDefaultAggregationEngine,
  type AggregatableDomain,
  type AggregationEngine,
} from '../aggregation'
import {
  getDefaultFlightSearchEngine,
  type FlightSearchEngine,
} from '../flightSearchEngine'
import {
  getDefaultHotelSearchEngine,
  type HotelSearchEngine,
} from '../hotelSearchEngine'
import type { AgentTool, AgentToolContext, AgentToolResult, ToolJsonSchema } from './types'
import { runFlightSearchTool, runHotelSearchTool } from './searchEngineBridge'

const destinationSchemaProps = {
  destination: { type: 'string', description: 'Primary destination city or country' },
  locale: { type: 'string', enum: ['ar', 'en'] },
}

function schema(title: string, properties: ToolJsonSchema['properties'], required: string[] = []): ToolJsonSchema {
  return { type: 'object', title, properties, required }
}

function baseMeta(tool: AgentTool, started: number): NonNullable<AgentToolResult['meta']> {
  const finishedAt = new Date().toISOString()
  return {
    startedAt: new Date(started).toISOString(),
    finishedAt,
    durationMs: Date.now() - started,
    timeoutMs: tool.defaultTimeoutMs,
    providerId: tool.providerId,
    attempt: 1,
  }
}

function createAggregatedTool(input: {
  name: AgentTool['name']
  domain: AggregatableDomain
  providerId: string
  timeoutMs: number
  inputSchema: ToolJsonSchema
  outputSchema: ToolJsonSchema
  engine: AggregationEngine
  selectionStrategy?: 'parallel' | 'priority_fallback'
  enrichInput?: (ctx: AgentToolContext) => Record<string, unknown>
  summarize: (ctx: AgentToolContext, data: Record<string, unknown>, conf: number) => string
}): AgentTool {
  const tool: AgentTool = {
    name: input.name,
    providerId: input.providerId,
    defaultTimeoutMs: input.timeoutMs,
    inputSchema: input.inputSchema,
    outputSchema: input.outputSchema,
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      const queryInput = {
        ...ctx.input,
        ...input.enrichInput?.(ctx),
        currency: ctx.requirements.budgetCurrency || ctx.input?.currency || 'USD',
      }
      const aggregated = await input.engine.aggregate({
        domain: input.domain,
        input: queryInput,
        locale: ctx.locale,
        signal: ctx.signal,
        selectionStrategy: input.selectionStrategy,
      })

      if (aggregated.meta.providersSucceeded === 0) {
        return {
          tool: input.name,
          status: 'error',
          summary: `All ${input.domain} providers failed`,
          data: { aggregation: aggregated.meta, providerResults: aggregated.providerResults },
          error: 'all_providers_failed',
          meta: baseMeta(tool, started),
        }
      }

      const data = aggregationResultToToolData(input.domain, aggregated)
      return {
        tool: input.name,
        status: 'ok',
        summary: input.summarize(ctx, data, aggregated.averageConfidence),
        data,
        error: null,
        meta: baseMeta(tool, started),
      }
    },
  }
  return tool
}

/**
 * Sprint 74 — flights tool uses Flight Search Engine (Sprint 72) via Provider Runtime.
 * AggregationEngine arg kept for call-site compatibility; unused for flights.
 */
export function createMockFlightSearchTool(
  _aggregationEngine?: AggregationEngine,
  flightEngine: FlightSearchEngine = getDefaultFlightSearchEngine(),
): AgentTool {
  const tool: AgentTool = {
    name: 'flights',
    providerId: 'flight-search-engine',
    defaultTimeoutMs: 8000,
    inputSchema: schema('FlightSearchInput', {
      ...destinationSchemaProps,
      origin: { type: 'string' },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      travelers: { type: 'number' },
    }, ['origin', 'destination', 'travelers']),
    outputSchema: schema('FlightSearchOutput', {
      offers: { type: 'array', description: 'Flight Search Engine offers' },
      currency: { type: 'string' },
      highlights: { type: 'object' },
    }, ['offers']),
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      try {
        const { data, empty, gracefulMessage } = await runFlightSearchTool(flightEngine, ctx)
        const offers = Array.isArray(data.offers) ? data.offers : []
        const top = offers[0] as { airline?: string; price?: number; currency?: string } | undefined
        const highlights = data.highlights as {
          best?: string | null
          cheapest?: string | null
          fastest?: string | null
        } | undefined

        if (empty) {
          return {
            tool: 'flights',
            status: 'error',
            summary: gracefulMessage
              ?? (ctx.locale === 'ar' ? 'لا عروض طيران متاحة حالياً' : 'No flight offers available right now'),
            data: { ...data, searchEngine: 'flightSearchEngine' },
            error: gracefulMessage ? 'provider_unavailable' : 'no_results',
            meta: baseMeta(tool, started),
          }
        }

        const highlightLine = [
          highlights?.best ? `Best: ${highlights.best}` : null,
          highlights?.cheapest ? `Cheapest: ${highlights.cheapest}` : null,
          highlights?.fastest ? `Fastest: ${highlights.fastest}` : null,
        ].filter(Boolean).join(' · ')

        const summary = ctx.locale === 'ar'
          ? `محرك الطيران: ${top?.airline ?? ''} ${top?.price ?? ''} ${top?.currency ?? ''} (${offers.length})`
          : `Flight engine: ${top?.airline ?? ''} ${top?.price ?? ''} ${top?.currency ?? ''} (${offers.length} offers)${highlightLine ? ` · ${highlightLine}` : ''}`

        return {
          tool: 'flights',
          status: 'ok',
          summary,
          data,
          error: null,
          meta: baseMeta(tool, started),
        }
      } catch (err) {
        return {
          tool: 'flights',
          status: 'error',
          summary: ctx.locale === 'ar'
            ? 'تعذّر البحث عن الطيران — سنحاول لاحقاً'
            : 'Flight search failed — please try again shortly',
          data: { searchEngine: 'flightSearchEngine' },
          error: err instanceof Error ? err.message : 'flight_search_failed',
          meta: baseMeta(tool, started),
        }
      }
    },
  }
  return tool
}

/**
 * Sprint 74 — hotels tool uses Hotel Search Engine (Sprint 73) via Provider Runtime.
 * AggregationEngine arg kept for call-site compatibility; unused for hotels.
 */
export function createMockHotelSearchTool(
  _aggregationEngine?: AggregationEngine,
  hotelEngine: HotelSearchEngine = getDefaultHotelSearchEngine(),
): AgentTool {
  const tool: AgentTool = {
    name: 'hotels',
    providerId: 'hotel-search-engine',
    defaultTimeoutMs: 8000,
    inputSchema: schema('HotelSearchInput', {
      ...destinationSchemaProps,
      nights: { type: 'number' },
      travelers: { type: 'number' },
      currency: { type: 'string' },
      checkIn: { type: 'string' },
    }, ['destination', 'nights']),
    outputSchema: schema('HotelSearchOutput', {
      stays: { type: 'array' },
      highlights: { type: 'object' },
    }, ['stays']),
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      try {
        const { data, empty, gracefulMessage } = await runHotelSearchTool(hotelEngine, ctx)
        const stays = Array.isArray(data.stays) ? data.stays : []
        const destination = String(ctx.input?.destination ?? ctx.requirements.destination ?? '')
        const highlights = data.highlights as {
          best?: string | null
          cheapest?: string | null
        } | undefined

        if (empty) {
          return {
            tool: 'hotels',
            status: 'error',
            summary: gracefulMessage
              ?? (ctx.locale === 'ar'
                ? `لا إقامات متاحة في ${destination}`
                : `No hotel stays available in ${destination}`),
            data: { ...data, searchEngine: 'hotelSearchEngine' },
            error: gracefulMessage ? 'provider_unavailable' : 'no_results',
            meta: baseMeta(tool, started),
          }
        }

        const summary = ctx.locale === 'ar'
          ? `${stays.length} إقامات عبر محرك الفنادق في ${destination}`
          : `${stays.length} stays via hotel engine in ${destination}${highlights?.best ? ` · Best: ${highlights.best}` : ''}${highlights?.cheapest ? ` · Cheapest: ${highlights.cheapest}` : ''}`

        return {
          tool: 'hotels',
          status: 'ok',
          summary,
          data,
          error: null,
          meta: baseMeta(tool, started),
        }
      } catch (err) {
        return {
          tool: 'hotels',
          status: 'error',
          summary: ctx.locale === 'ar'
            ? 'تعذّر البحث عن الفنادق — سنحاول لاحقاً'
            : 'Hotel search failed — please try again shortly',
          data: { searchEngine: 'hotelSearchEngine' },
          error: err instanceof Error ? err.message : 'hotel_search_failed',
          meta: baseMeta(tool, started),
        }
      }
    },
  }
  return tool
}

export function createMockWeatherTool(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool {
  return createAggregatedTool({
    name: 'weather',
    domain: 'weather',
    providerId: 'aggregate-weather',
    timeoutMs: 10_000,
    selectionStrategy: 'priority_fallback',
    engine,
    inputSchema: schema('WeatherInput', {
      ...destinationSchemaProps,
      startDate: { type: 'string' },
      durationDays: { type: 'number' },
    }, ['destination']),
    outputSchema: schema('WeatherOutput', {
      summary: { type: 'string' },
      averageHighC: { type: 'number' },
      season: { type: 'string' },
    }, ['summary', 'averageHighC']),
    summarize: (ctx, data) => {
      const summary = String(data.summary ?? '')
      return ctx.locale === 'ar' ? `طقس مجمّع: ${summary}` : `Aggregated weather: ${summary}`
    },
  })
}

export function createMockMapsTool(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool {
  return createAggregatedTool({
    name: 'maps',
    domain: 'maps',
    providerId: 'aggregate-maps',
    timeoutMs: 12_000,
    selectionStrategy: 'priority_fallback',
    engine,
    inputSchema: schema('MapsInput', {
      ...destinationSchemaProps,
      hubs: { type: 'array', description: 'Cities/hubs to connect' },
    }, ['destination']),
    outputSchema: schema('MapsOutput', {
      legs: { type: 'array' },
    }, ['legs']),
    summarize: (ctx, data) => {
      const legs = Array.isArray(data.legs) ? data.legs : []
      return ctx.locale === 'ar'
        ? `خرائط مجمّعة: ${legs.length} مقطع`
        : `Aggregated maps: ${legs.length} legs`
    },
  })
}

export function createMockCurrencyTool(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool {
  return createAggregatedTool({
    name: 'currency',
    domain: 'currency',
    providerId: 'aggregate-currency',
    timeoutMs: 1200,
    engine,
    inputSchema: schema('CurrencyInput', {
      amount: { type: 'number' },
      fromCurrency: { type: 'string' },
      toCurrency: { type: 'string' },
      locale: { type: 'string' },
    }, ['amount', 'fromCurrency', 'toCurrency']),
    outputSchema: schema('CurrencyOutput', {
      convertedAmount: { type: 'number' },
      rate: { type: 'number' },
    }, ['convertedAmount', 'rate']),
    summarize: (_ctx, data) => `${data.amount} ${data.fromCurrency} ≈ ${data.convertedAmount} ${data.toCurrency}`,
  })
}

export function createMockVisaTool(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool {
  return createAggregatedTool({
    name: 'visa',
    domain: 'visa',
    providerId: 'aggregate-visa',
    timeoutMs: 1500,
    engine,
    inputSchema: schema('VisaInput', {
      destination: { type: 'string' },
      nationality: { type: 'string' },
      purpose: { type: 'string' },
      locale: { type: 'string' },
    }, ['destination', 'nationality']),
    outputSchema: schema('VisaOutput', {
      status: { type: 'string' },
      guidance: { type: 'string' },
    }, ['status', 'guidance']),
    summarize: (ctx, data) => (ctx.locale === 'ar'
      ? `تأشيرة مجمّعة: ${data.destination}`
      : `Aggregated visa: ${data.destination}`),
  })
}

export function createMockAttractionsTool(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool {
  return createAggregatedTool({
    name: 'attractions',
    domain: 'attractions',
    providerId: 'aggregate-attractions',
    timeoutMs: 1500,
    engine,
    inputSchema: schema('AttractionsInput', {
      ...destinationSchemaProps,
      durationDays: { type: 'number' },
      interests: { type: 'array' },
    }, ['destination']),
    outputSchema: schema('AttractionsOutput', {
      attractions: { type: 'array' },
    }, ['attractions']),
    summarize: (ctx, data) => {
      const attractions = Array.isArray(data.attractions) ? data.attractions : []
      const destination = String(ctx.input?.destination ?? '')
      return ctx.locale === 'ar'
        ? `${attractions.length} معالم مجمّعة في ${destination}`
        : `${attractions.length} aggregated attractions in ${destination}`
    },
  })
}

export function createMockTransportationTool(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool {
  return createAggregatedTool({
    name: 'transportation',
    domain: 'transportation',
    providerId: 'aggregate-transportation',
    timeoutMs: 1800,
    engine,
    inputSchema: schema('TransportationInput', {
      ...destinationSchemaProps,
      origin: { type: 'string' },
      hubs: { type: 'array' },
      currency: { type: 'string' },
    }, ['destination']),
    outputSchema: schema('TransportationOutput', {
      options: { type: 'array' },
    }, ['options']),
    summarize: (ctx, data) => {
      const options = Array.isArray(data.options) ? data.options : []
      return ctx.locale === 'ar'
        ? `تنقل مجمّع: ${options.length} خيار`
        : `Aggregated transportation: ${options.length} options`
    },
  })
}

export function createAllMockTools(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool[] {
  return [
    createMockFlightSearchTool(engine),
    createMockHotelSearchTool(engine),
    createMockWeatherTool(engine),
    createMockMapsTool(engine),
    createMockCurrencyTool(engine),
    createMockVisaTool(engine),
    createMockAttractionsTool(engine),
    createMockTransportationTool(engine),
  ]
}
