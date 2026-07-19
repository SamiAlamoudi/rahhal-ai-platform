/**
 * Daily planner — intelligent placeholders; LLM-ready architecture.
 */

import type { BookingRecord } from '../booking/bookingRecord'
import { addDays, parseIso, toDateKey, tripDurationDays } from './timeHelpers'
import type { DayPlan, DayPartBlock } from './types'

function part(
  p: DayPartBlock['part'],
  titleAr: string,
  titleEn: string,
  bodyAr: string,
  bodyEn: string,
): DayPartBlock {
  return {
    part: p,
    titleAr,
    titleEn,
    bodyAr,
    bodyEn,
    generatedBy: 'placeholder',
  }
}

function buildDayParts(
  _dayIndex: number,
  destination: string,
  isArrivalDay: boolean,
  isLastDay: boolean,
): DayPartBlock[] {
  if (isArrivalDay) {
    return [
      part(
        'morning',
        'الصباح',
        'Morning',
        'رحلة الوصول — استرح بعد الهبوط وتأكد من الأمتعة.',
        'Arrival day — rest after landing and collect luggage.',
      ),
      part(
        'afternoon',
        'بعد الظهر',
        'Afternoon',
        `التوجه إلى الإقامة في ${destination} واستكشاف الحي المحيط.`,
        `Head to your stay in ${destination} and explore the nearby area.`,
      ),
      part(
        'evening',
        'المساء',
        'Evening',
        'عشاء خفيف والتعرّف على إيقاع المدينة.',
        'Light dinner and get a feel for the city rhythm.',
      ),
      part(
        'free_time',
        'وقت حر',
        'Free time',
        'اترك مساحة للراحة حسب حالة الرحلة.',
        'Keep buffer time depending on how the flight went.',
      ),
    ]
  }

  if (isLastDay) {
    return [
      part(
        'morning',
        'الصباح',
        'Morning',
        'إفطار مبكر وإنهاء أي تسوق أخير.',
        'Early breakfast and last-minute shopping.',
      ),
      part(
        'afternoon',
        'بعد الظهر',
        'Afternoon',
        'التوجه للمطار حسب توصية الوصول.',
        'Head to the airport per the arrival recommendation.',
      ),
      part(
        'evening',
        'المساء',
        'Evening',
        'رحلة العودة أو الاستعداد للمغادرة.',
        'Return flight or departure prep.',
      ),
      part(
        'free_time',
        'وقت حر',
        'Free time',
        'تحقق من وثائق السفر قبل المغادرة.',
        'Double-check travel documents before leaving.',
      ),
    ]
  }

  return [
    part(
      'morning',
      'الصباح',
      'Morning',
      `نشاط صباحي في ${destination} — معالم أو مقهى محلي.`,
      `Morning activity in ${destination} — landmarks or a local café.`,
    ),
    part(
      'afternoon',
      'بعد الظهر',
      'Afternoon',
      'تجربة ثقافية أو تسوق — حسب تفضيلات المسافرين.',
      'Culture or shopping — tuned to passenger preferences later.',
    ),
    part(
      'evening',
      'المساء',
      'Evening',
      'عشاء وتجربة ليلية خفيفة.',
      'Dinner and a light evening experience.',
    ),
    part(
      'free_time',
      'وقت حر',
      'Free time',
      'مساحة مرنة — جاهزة لمحتوى الذكاء الاصطناعي لاحقاً.',
      'Flexible block — ready for AI-generated content later.',
    ),
  ]
}

export function buildDailyPlans(record: BookingRecord, opts?: { dayCount?: number }): DayPlan[] {
  const destination = record.flight?.destination || 'your destination'
  const dep = parseIso(record.flight?.departureTime)
  const dayCount = opts?.dayCount
    ?? tripDurationDays(record.flight?.departureTime, record.flight?.arrivalTime, 3)
  const start = dep ?? new Date()

  const days: DayPlan[] = []
  for (let i = 0; i < dayCount; i++) {
    const date = addDays(start, i)
    const isArrival = i === 0
    const isLast = i === dayCount - 1
    days.push({
      dayIndex: i + 1,
      date: toDateKey(date),
      titleAr: isArrival
        ? `اليوم ${i + 1} — الوصول`
        : isLast
          ? `اليوم ${i + 1} — المغادرة`
          : `اليوم ${i + 1}`,
      titleEn: isArrival
        ? `Day ${i + 1} — Arrival`
        : isLast
          ? `Day ${i + 1} — Departure`
          : `Day ${i + 1}`,
      parts: buildDayParts(i + 1, destination, isArrival, isLast),
      notesAr: 'ملاحظات قابلة للتخصيص — ستُثرى بالذكاء الاصطناعي لاحقاً.',
      notesEn: 'Customizable notes — will be enriched by AI later.',
    })
  }
  return days
}
