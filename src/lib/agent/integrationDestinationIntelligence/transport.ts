/**
 * Integration Sprint 5 — Local transport layer (prepared; mock estimates).
 */

import type { DestinationKnowledge, LocalTransportOption } from './types'

export interface LocalTransportProvider {
  readonly providerId: string
  getOptions(destination: DestinationKnowledge): Promise<LocalTransportOption[]>
}

export class MockLocalTransportProvider implements LocalTransportProvider {
  readonly providerId = 'mock_local_transport'

  async getOptions(destination: DestinationKnowledge): Promise<LocalTransportOption[]> {
    const currency = destination.culture.currency || 'SAR'
    const mid = destination.dailyBudgetSar.mid
    return [
      {
        mode: 'airport_transfer',
        labelEn: 'Airport transfer',
        labelAr: 'توصيل من المطار',
        typicalCost: Math.round(mid * 0.15),
        currency,
        notesEn: 'Pre-booked transfer is usually simplest after a long flight.',
        notesAr: 'الحجز المسبق للتوصيل أسهل بعد رحلة طويلة.',
      },
      {
        mode: 'metro',
        labelEn: 'Metro / local rail',
        labelAr: 'مترو / قطار محلي',
        typicalCost: Math.round(mid * 0.04),
        currency,
        notesEn: destination.themes.includes('city')
          ? 'Metro covers most central neighborhoods efficiently.'
          : 'Rail coverage varies — confirm lines near your hotel.',
        notesAr: destination.themes.includes('city')
          ? 'المترو يغطي أغلب الأحياء المركزية بكفاءة.'
          : 'تغطية القط المختلف — تأكد من القرب من فندقك.',
      },
      {
        mode: 'taxi',
        labelEn: 'Taxi',
        labelAr: 'تاكسي',
        typicalCost: Math.round(mid * 0.08),
        currency,
        notesEn: 'Use official taxis or metered apps when possible.',
        notesAr: 'استخدم التاكسي الرسمي أو التطبيقات الموثوقة.',
      },
      {
        mode: 'rideshare',
        labelEn: 'Ride sharing',
        labelAr: 'تطبيقات توصيل',
        typicalCost: Math.round(mid * 0.07),
        currency,
        notesEn: 'Convenient for evenings and luggage-heavy days.',
        notesAr: 'مريحة مساءً ومع الأمتعة.',
      },
      {
        mode: 'walking',
        labelEn: 'Walking',
        labelAr: 'مشي',
        typicalCost: 0,
        currency,
        notesEn: destination.neighborhoods[0]
          ? `Best around ${destination.neighborhoods[0]} for short hops.`
          : 'Great for compact historic cores.',
        notesAr: destination.neighborhoods[0]
          ? `ممتاز حول ${destination.neighborhoods[0]} للمسافات القصيرة.`
          : 'ممتاز في الأحياء التاريخية المدمجة.',
      },
    ]
  }
}

export function createMockLocalTransportProvider(): LocalTransportProvider {
  return new MockLocalTransportProvider()
}
