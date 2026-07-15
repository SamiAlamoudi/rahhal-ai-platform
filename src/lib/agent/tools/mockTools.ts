import type { AgentTool, AgentToolContext, AgentToolResult, ToolJsonSchema } from './types'
import { moneyFromSeed, pick, stableHash } from './mockData'

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

export function createMockFlightSearchTool(): AgentTool {
  const tool: AgentTool = {
    name: 'flights',
    providerId: 'mock-flights',
    defaultTimeoutMs: 1500,
    inputSchema: schema('FlightSearchInput', {
      ...destinationSchemaProps,
      origin: { type: 'string' },
      startDate: { type: 'string' },
      endDate: { type: 'string' },
      travelers: { type: 'number' },
    }, ['origin', 'destination', 'travelers']),
    outputSchema: schema('FlightSearchOutput', {
      offers: { type: 'array', description: 'Mock flight offers' },
      currency: { type: 'string' },
    }, ['offers']),
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      const origin = String(ctx.input?.origin ?? 'RUH')
      const destination = String(ctx.input?.destination ?? ctx.requirements.destination ?? 'TYO')
      const travelers = Number(ctx.input?.travelers ?? 2)
      const currency = ctx.requirements.budgetCurrency || 'USD'
      const price = moneyFromSeed(`${origin}-${destination}-${travelers}`, currency === 'SAR' ? 2200 : 650, 200)
      const airline = pick(['Rahhal Air', 'Gulf Mock', 'Pacific Mock'], destination)
      const data = {
        offers: [
          {
            id: `flt_${stableHash(`${origin}${destination}`)}`,
            airline,
            from: origin,
            to: airportCode(destination),
            cabin: 'economy',
            stops: stableHash(destination) % 2,
            durationHours: 6 + (stableHash(destination) % 8),
            price,
            currency,
            travelers,
          },
        ],
        currency,
      }
      return {
        tool: 'flights',
        status: 'ok',
        summary: ctx.locale === 'ar'
          ? `عرض طيران تجريبي ${airline}: ${price} ${currency}`
          : `Mock flight ${airline}: ${price} ${currency}`,
        data,
        error: null,
        meta: baseMeta(tool, started),
      }
    },
  }
  return tool
}

export function createMockHotelSearchTool(): AgentTool {
  const tool: AgentTool = {
    name: 'hotels',
    providerId: 'mock-hotels',
    defaultTimeoutMs: 1500,
    inputSchema: schema('HotelSearchInput', {
      ...destinationSchemaProps,
      nights: { type: 'number' },
      travelers: { type: 'number' },
      currency: { type: 'string' },
    }, ['destination', 'nights']),
    outputSchema: schema('HotelSearchOutput', {
      stays: { type: 'array' },
    }, ['stays']),
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      const destination = String(ctx.input?.destination ?? ctx.requirements.destination ?? 'City')
      const nights = Number(ctx.input?.nights ?? 3)
      const currency = String(ctx.input?.currency ?? ctx.requirements.budgetCurrency ?? 'USD')
      const nightly = moneyFromSeed(`${destination}-hotel`, currency === 'JPY' ? 18000 : 140, 40)
      const data = {
        stays: [
          {
            name: `${destination} Central Stay`,
            area: destination,
            category: 'hotel',
            nightly,
            nights,
            total: nightly * nights,
            currency,
            score: 8.4,
          },
          {
            name: `${destination} Boutique Inn`,
            area: destination,
            category: 'boutique',
            nightly: Math.round(nightly * 1.25),
            nights,
            total: Math.round(nightly * 1.25) * nights,
            currency,
            score: 8.9,
          },
        ],
      }
      return {
        tool: 'hotels',
        status: 'ok',
        summary: ctx.locale === 'ar'
          ? `${data.stays.length} خيارات إقامة تجريبية في ${destination}`
          : `${data.stays.length} mock stays in ${destination}`,
        data,
        error: null,
        meta: baseMeta(tool, started),
      }
    },
  }
  return tool
}

export function createMockWeatherTool(): AgentTool {
  const tool: AgentTool = {
    name: 'weather',
    providerId: 'mock-weather',
    defaultTimeoutMs: 1000,
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
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      const destination = String(ctx.input?.destination ?? '')
      const monthHint = monthFromRequirements(ctx)
      const season = seasonFor(destination, monthHint)
      const averageHighC = 12 + (stableHash(`${destination}-${season}`) % 18)
      const summary = `${season} conditions in ${destination}: daytime ~${averageHighC}°C`
      return {
        tool: 'weather',
        status: 'ok',
        summary: ctx.locale === 'ar'
          ? `طقس تجريبي: ${season} حوالي ${averageHighC}°م في ${destination}`
          : summary,
        data: { summary, averageHighC, season, destination, monthHint },
        error: null,
        meta: baseMeta(tool, started),
      }
    },
  }
  return tool
}

export function createMockMapsTool(): AgentTool {
  const tool: AgentTool = {
    name: 'maps',
    providerId: 'mock-maps',
    defaultTimeoutMs: 1000,
    inputSchema: schema('MapsInput', {
      ...destinationSchemaProps,
      hubs: { type: 'array', description: 'Cities/hubs to connect' },
    }, ['destination']),
    outputSchema: schema('MapsOutput', {
      legs: { type: 'array' },
    }, ['legs']),
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      const hubs = Array.isArray(ctx.input?.hubs) && ctx.input.hubs.length > 0
        ? ctx.input.hubs.map(String)
        : [String(ctx.input?.destination ?? 'City')]
      const legs = []
      for (let i = 0; i < Math.max(1, hubs.length - 1); i += 1) {
        const from = hubs[i] ?? hubs[0]
        const to = hubs[i + 1] ?? hubs[0]
        legs.push({
          from,
          to,
          mode: 'transit',
          distanceKm: 40 + (stableHash(`${from}-${to}`) % 420),
          durationMinutes: 45 + (stableHash(`${to}`) % 180),
        })
      }
      if (legs.length === 0) {
        legs.push({
          from: hubs[0],
          to: hubs[0],
          mode: 'walk_and_metro',
          distanceKm: 8 + (stableHash(hubs[0]) % 20),
          durationMinutes: 35,
        })
      }
      return {
        tool: 'maps',
        status: 'ok',
        summary: ctx.locale === 'ar'
          ? `مسارات تجريبية: ${legs.length} مقطع`
          : `Mock map legs: ${legs.length}`,
        data: { legs },
        error: null,
        meta: baseMeta(tool, started),
      }
    },
  }
  return tool
}

export function createMockCurrencyTool(): AgentTool {
  const tool: AgentTool = {
    name: 'currency',
    providerId: 'mock-currency',
    defaultTimeoutMs: 800,
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
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      const amount = Number(ctx.input?.amount ?? 1000)
      const from = String(ctx.input?.fromCurrency ?? 'USD')
      const to = String(ctx.input?.toCurrency ?? 'USD')
      const rate = mockRate(from, to)
      const convertedAmount = Math.round(amount * rate * 100) / 100
      return {
        tool: 'currency',
        status: 'ok',
        summary: `${amount} ${from} ≈ ${convertedAmount} ${to}`,
        data: { amount, fromCurrency: from, toCurrency: to, rate, convertedAmount },
        error: null,
        meta: baseMeta(tool, started),
      }
    },
  }
  return tool
}

export function createMockVisaTool(): AgentTool {
  const tool: AgentTool = {
    name: 'visa',
    providerId: 'mock-visa',
    defaultTimeoutMs: 1000,
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
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      const destination = String(ctx.input?.destination ?? '')
      const nationality = String(ctx.input?.nationality ?? 'SA')
      const guidance = destination.toLowerCase().includes('japan')
        ? 'Mock: many Saudi travelers use visa waiver / eVisa paths for short Japan trips — confirm before booking.'
        : `Mock visa guidance for ${nationality} travelers to ${destination}. Confirm official rules before travel.`
      return {
        tool: 'visa',
        status: 'ok',
        summary: ctx.locale === 'ar' ? `إرشاد تأشيرة تجريبي لـ ${destination}` : `Mock visa guidance for ${destination}`,
        data: {
          status: 'check_required',
          guidance,
          destination,
          nationality,
        },
        error: null,
        meta: baseMeta(tool, started),
      }
    },
  }
  return tool
}

export function createMockAttractionsTool(): AgentTool {
  const tool: AgentTool = {
    name: 'attractions',
    providerId: 'mock-attractions',
    defaultTimeoutMs: 1200,
    inputSchema: schema('AttractionsInput', {
      ...destinationSchemaProps,
      durationDays: { type: 'number' },
      interests: { type: 'array' },
    }, ['destination']),
    outputSchema: schema('AttractionsOutput', {
      attractions: { type: 'array' },
    }, ['attractions']),
    isAvailable: () => true,
    async execute(ctx) {
      const started = Date.now()
      const destination = String(ctx.input?.destination ?? 'City')
      const interests = Array.isArray(ctx.input?.interests) ? ctx.input.interests.map(String) : []
      const catalog = attractionCatalog(destination)
      const attractions = catalog.slice(0, 4).map((title, index) => ({
        id: `att_${index}_${stableHash(title)}`,
        title,
        destination,
        tag: interests[index % Math.max(1, interests.length)] || 'highlight',
      }))
      return {
        tool: 'attractions',
        status: 'ok',
        summary: ctx.locale === 'ar'
          ? `${attractions.length} معالم تجريبية في ${destination}`
          : `${attractions.length} mock attractions in ${destination}`,
        data: { attractions },
        error: null,
        meta: baseMeta(tool, started),
      }
    },
  }
  return tool
}

export function createAllMockTools(): AgentTool[] {
  return [
    createMockFlightSearchTool(),
    createMockHotelSearchTool(),
    createMockWeatherTool(),
    createMockMapsTool(),
    createMockCurrencyTool(),
    createMockVisaTool(),
    createMockAttractionsTool(),
  ]
}

function airportCode(destination: string): string {
  const key = destination.toLowerCase()
  if (key.includes('japan') || key.includes('tokyo')) return 'HND'
  if (key.includes('osaka')) return 'KIX'
  if (key.includes('london')) return 'LHR'
  if (key.includes('bali')) return 'DPS'
  if (key.includes('paris')) return 'CDG'
  if (key.includes('dubai')) return 'DXB'
  if (key.includes('riyadh')) return 'RUH'
  return destination.slice(0, 3).toUpperCase() || 'XXX'
}

function monthFromRequirements(ctx: AgentToolContext): number | null {
  const start = ctx.requirements.startDate || String(ctx.input?.startDate ?? '')
  if (/^\d{4}-\d{2}/.test(start)) return Number(start.slice(5, 7))
  return null
}

function seasonFor(destination: string, month: number | null): string {
  if (destination.toLowerCase().includes('japan') && (month === 4 || month == null)) return 'spring'
  if (month == null) return 'mild'
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function mockRate(from: string, to: string): number {
  if (from === to) return 1
  const table: Record<string, number> = {
    'USD:JPY': 150,
    'USD:EUR': 0.92,
    'USD:GBP': 0.79,
    'USD:SAR': 3.75,
    'USD:AED': 3.67,
    'USD:IDR': 15500,
    'SAR:USD': 1 / 3.75,
    'SAR:JPY': 40,
  }
  return table[`${from}:${to}`] ?? (stableHash(`${from}${to}`) % 50 + 1) / 10
}

function attractionCatalog(destination: string): string[] {
  const key = destination.toLowerCase()
  if (key.includes('japan') || key.includes('tokyo')) {
    return ['Senso-ji', 'Shibuya Crossing', 'Meiji Shrine', 'day trip to Nikko', 'teamLab Planets']
  }
  if (key.includes('london')) {
    return ['British Museum', 'South Bank walk', 'Tower Bridge', 'Hyde Park']
  }
  if (key.includes('bali')) {
    return ['Ubud Rice Terraces', 'Uluwatu Temple', 'Seminyak sunset', 'Tirta Empul']
  }
  if (key.includes('riyadh')) {
    return ['Diriyah', 'Boulevard World', 'National Museum', 'Edge of the World viewpoint']
  }
  return [`${destination} Old Town`, `${destination} Central Market`, `${destination} Viewpoint`, `${destination} Museum`]
}
