import {
  getDisplayValue,
  SESSION_FIELD_LABELS,
  type TravelSession,
} from './travelSession'
import type { NextQuestion } from './travelSession'

const ACKNOWLEDGMENTS: Record<string, string[]> = {
  destination: [
    'وجهة رائعة!',
    'اختيار ممتاز!',
    'مكان جميل للسفر.',
  ],
  departureCity: [
    'تمام، فهمت.',
    'ممتاز.',
    'واضح.',
  ],
  departureDate: [
    'تاريخ مناسب.',
    'تمام.',
    'جيد، سأبني عليه.',
  ],
  durationDays: [
    'مدة مثالية.',
    'تمام، سأوزّع الأيام بناءً عليها.',
    'جيد.',
  ],
  adults: [
    'تمام.',
    'فهمت.',
    'ممتاز.',
  ],
  children: [
    'رائع، سأراعي ذلك في اختياتي.',
    'تمام، الأطفال يغيّر معادلة الخيارات.',
    'فهمت.',
  ],
  budgetAmount: [
    'ميزانية جيدة.',
    'تمام، سأوجّه الخيارات إليك.',
    'واضح.',
  ],
  tripPurpose: [
    'ممتاز، غرض الرحلة يوجّه كل توصياتي.',
    'فهمت تماماً.',
    'جيد.',
  ],
  visaStatus: [
    'تمام، سأراعي التأشيرة في الخيارات.',
    'فهمت.',
    'واضح.',
  ],
  cabinClass: [
    'تمام.',
    'ممتاز.',
    'فهمت.',
  ],
  preferredHotelCategory: [
    'تمام.',
    'اختيار جيد.',
    'فهمت.',
  ],
}

const GENERIC_ACKS = [
  'ممتاز.',
  'تمام.',
  'فهمت.',
  'جيد.',
]

const WHY_PREFIX = 'لأن'
const WHY_CONNECTOR = '\n'

function pickAck(field: string | undefined): string {
  if (!field) return GENERIC_ACKS[0]
  const list = ACKNOWLEDGMENTS[field]
  if (!list) return GENERIC_ACKS[Math.floor(Math.random() * GENERIC_ACKS.length)]
  return list[Math.floor(Math.random() * list.length)]
}

function formatWhy(reason: string): string {
  if (!reason) return ''
  return `${WHY_PREFIX} ${reason}`
}

function recentlyLearnedFields(
  prevSession: TravelSession | null,
  currentSession: TravelSession,
): string[] {
  if (!prevSession) return []
  const learned: string[] = []
  const fields: (keyof TravelSession)[] = [
    'destination', 'departureCity', 'departureDate', 'durationDays',
    'adults', 'children', 'infants', 'budgetAmount', 'tripPurpose',
    'visaStatus', 'cabinClass', 'preferredHotelCategory',
  ]
  for (const f of fields) {
    const prev = prevSession[f]
    const curr = currentSession[f]
    const wasEmpty = prev === null || prev === undefined || prev === ''
    const isFilled = curr !== null && curr !== undefined && curr !== ''
    if (wasEmpty && isFilled) {
      learned.push(f)
    }
  }
  return learned
}

function learnedSummary(learned: string[], session: TravelSession): string {
  if (learned.length === 0) return ''
  const parts = learned.map(f => {
    const label = SESSION_FIELD_LABELS[f] ?? f
    const value = getDisplayValue(f as keyof TravelSession, session)
    return value ? `${label}: ${value}` : label
  })
  if (parts.length === 1) return `دوّنت ${parts[0]}.`
  if (parts.length === 2) return `دوّنت ${parts[0]} و${parts[1]}.`
  return `دوّنت ${parts.slice(0, -1).join('، ')} و${parts[parts.length - 1]}.`
}

export function buildRahhalReply(
  prevSession: TravelSession | null,
  currentSession: TravelSession,
  nextQuestion: NextQuestion | null,
): string {
  const learned = recentlyLearnedFields(prevSession, currentSession)
  const learnedText = learnedSummary(learned, currentSession)

  if (!nextQuestion) {
    if (learnedText) {
      return `${learnedText}\nلقد فهمت رحلتك بالكامل الآن — رحّال جاهز للتفكير في أفضل خياراتك.`
    }
    return 'لقد فهمت رحلتك بالكامل الآن — رحّال جاهز للتفكير في أفضل خياراتك.'
  }

  const ack = pickAck(nextQuestion.field)
  const why = formatWhy(nextQuestion.reason)

  const lines: string[] = []
  if (learnedText) lines.push(learnedText)
  lines.push(`${ack} ${nextQuestion.text}${WHY_CONNECTOR}${why}`)

  return lines.join('\n')
}

export function buildWelcomeReply(nextQuestion: NextQuestion | null): string {
  if (!nextQuestion) {
    return 'مرحباً! أنا رحّال، مستشارك للسفر. اكتب لي فكرتك عن الرحلة وسأبدأ بالتفكير معك خطوة بخطوة.'
  }
  const why = formatWhy(nextQuestion.reason)
  return `مرحباً! أنا رحّال، مستشارك للسفر.\n${nextQuestion.text}${WHY_CONNECTOR}${why}`
}

export function buildResumedReply(
  currentSession: TravelSession,
  nextQuestion: NextQuestion | null,
): string {
  const dest = currentSession.destination
  const opening = dest
    ? `رحّال يتذكّر خطتك السابقة إلى ${dest}.`
    : 'رحّال يتذكّر خطتك السابقة.'

  if (!nextQuestion) {
    return `${opening}\nلقد فهمت رحلتك بالكامل — رحّال جاهز للتفكير في أفضل خياراتك.`
  }

  const why = formatWhy(nextQuestion.reason)
  return `${opening}\n${nextQuestion.text}${WHY_CONNECTOR}${why}`
}

export function progressText(completion: number): string {
  return `تم التعرف على رحلتك بنسبة ${completion}%`
}
