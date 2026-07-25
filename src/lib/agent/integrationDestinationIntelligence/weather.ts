/**
 * Integration Sprint 5 — Weather provider interface (no live provider yet).
 * Produces a normalized weather model from seasonality priors.
 */

import type { DestinationKnowledge, NormalizedWeather } from './types'

export interface WeatherProvider {
  readonly providerId: string
  getWeather(input: {
    destination: DestinationKnowledge
    month?: number | null
    signal?: AbortSignal
  }): Promise<NormalizedWeather>
}

function monthName(month: number): string {
  return [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][Math.max(0, Math.min(11, month - 1))] ?? 'this month'
}

/** Mock weather readiness from seasonality — ready for a live adapter later. */
export class MockWeatherProvider implements WeatherProvider {
  readonly providerId = 'mock_weather'

  async getWeather(input: {
    destination: DestinationKnowledge
    month?: number | null
  }): Promise<NormalizedWeather> {
    const month = input.month && input.month >= 1 && input.month <= 12
      ? input.month
      : new Date().getUTCMonth() + 1
    const best = input.destination.seasonality.bestMonths.includes(month)
    const avoid = input.destination.seasonality.avoidMonths.includes(month)
    const high = best ? 26 : avoid ? 38 : 22
    const low = best ? 16 : avoid ? 28 : 12
    const rain = avoid ? 55 : best ? 15 : 30

    return {
      destinationId: input.destination.id,
      asOf: new Date().toISOString(),
      source: 'mock',
      summaryEn: best
        ? `${monthName(month)} is typically pleasant in ${input.destination.nameEn}.`
        : avoid
          ? `${monthName(month)} can be uncomfortable in ${input.destination.nameEn}.`
          : `${monthName(month)} is workable in ${input.destination.nameEn} with light planning.`,
      summaryAr: best
        ? `${monthName(month)} عادة ممتع في ${input.destination.nameAr}.`
        : avoid
          ? `${monthName(month)} قد يكون مرهقاً في ${input.destination.nameAr}.`
          : `${monthName(month)} مناسب نسبياً في ${input.destination.nameAr} مع تخطيط بسيط.`,
      tempHighC: high,
      tempLowC: low,
      condition: avoid ? 'hot_or_wet' : best ? 'mild' : 'mixed',
      rainProbability: rain,
      readinessEn: best
        ? 'Good weather window for outdoor plans.'
        : avoid
          ? 'Pack for heat/rain; prioritize indoor highlights midday.'
          : 'Flexible layers recommended.',
      readinessAr: best
        ? 'فترة جيدة للجولات الخارجية.'
        : avoid
          ? 'استعد للحر/المطر؛ ركّز على أماكن داخلية ظهراً.'
          : 'طبقات ملابس مرنة مفيدة.',
    }
  }
}

export function createMockWeatherProvider(): WeatherProvider {
  return new MockWeatherProvider()
}
