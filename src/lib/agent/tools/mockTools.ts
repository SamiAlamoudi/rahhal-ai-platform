import {
  aggregationResultToToolData,
  createDefaultAggregationEngine,
  type AggregatableDomain,
  type AggregationEngine,
} from '../aggregation'
import type { AgentTool, AgentToolContext, AgentToolResult, ToolJsonSchema } from './types'

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
        ...(ctx.input ?? {}),
        ...(input.enrichInput?.(ctx) ?? {}),
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

export function createMockFlightSearchTool(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool {
  return createAggregatedTool({
    name: 'flights',
    domain: 'flights',
    providerId: 'aggregate-flights',
    timeoutMs: 5000,
    // Real Amadeus (when available) then mock flights automatically.
    selectionStrategy: 'priority_fallback',
    engine,
    inputSchema: schema('FlightSearchInput', {
      ...destinationSchemaProps,
      origin: { type: 'string' },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      travelers: { type: 'number' },
    }, ['origin', 'destination', 'travelers']),
    outputSchema: schema('FlightSearchOutput', {
      offers: { type: 'array', description: 'Aggregated flight offers' },
      currency: { type: 'string' },
    }, ['offers']),
    summarize: (ctx, data, conf) => {
      const offers = Array.isArray(data.offers) ? data.offers : []
      const top = offers[0] as { airline?: string; price?: number; currency?: string } | undefined
      if (!top) return ctx.locale === 'ar' ? 'لا عروض طيران' : 'No flight offers'
      return ctx.locale === 'ar'
        ? `طيران مجمّع (${Math.round(conf * 100)}%): ${top.airline} ${top.price} ${top.currency}`
        : `Aggregated flights (${Math.round(conf * 100)}%): ${top.airline} ${top.price} ${top.currency}`
    },
  })
}

export function createMockHotelSearchTool(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool {
  return createAggregatedTool({
    name: 'hotels',
    domain: 'hotels',
    providerId: 'aggregate-hotels',
    timeoutMs: 5000,
    // Real Booking.com (when available) then mock hotels automatically.
    selectionStrategy: 'priority_fallback',
    engine,
    inputSchema: schema('HotelSearchInput', {
      ...destinationSchemaProps,
      nights: { type: 'number' },
      travelers: { type: 'number' },
      currency: { type: 'string' },
    }, ['destination', 'nights']),
    outputSchema: schema('HotelSearchOutput', {
      stays: { type: 'array' },
    }, ['stays']),
    summarize: (ctx, data, conf) => {
      const stays = Array.isArray(data.stays) ? data.stays : []
      const destination = String(ctx.input?.destination ?? ctx.requirements.destination ?? '')
      return ctx.locale === 'ar'
        ? `${stays.length} إقامات مجمّعة في ${destination} (${Math.round(conf * 100)}%)`
        : `${stays.length} aggregated stays in ${destination} (${Math.round(conf * 100)}%)`
    },
  })
}

export function createMockWeatherTool(
  engine: AggregationEngine = createDefaultAggregationEngine(),
): AgentTool {
  return createAggregatedTool({
    name: 'weather',
    domain: 'weather',
    providerId: 'aggregate-weather',
    timeoutMs: 1500,
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
