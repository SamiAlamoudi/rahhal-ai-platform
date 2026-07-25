/**
 * Integration Sprint 5 — destination comparison (Casablanca vs Marrakech, etc.).
 */

import type { TripRequirements } from '../types'
import { findKnowledgeByName } from './knowledge'
import { buildRecommendation } from './matching'
import type { DestinationComparison, DestinationRecommendation } from './types'

const COMPARISON_PAIRS: Array<{
  a: string
  b: string
  differencesEn: string[]
  differencesAr: string[]
  chooseAWhenEn: string
  chooseAWhenAr: string
  chooseBWhenEn: string
  chooseBWhenAr: string
}> = [
  {
    a: 'casablanca',
    b: 'marrakech',
    differencesEn: [
      'Casablanca is a modern business + coastal hub; Marrakech is culture, souks, and atmosphere.',
      'Casablanca is easier for meetings and airport logistics; Marrakech wins for holiday mood.',
      'Daily tourism spend is often more flexible in Marrakech; Casablanca skews practical/business.',
    ],
    differencesAr: [
      'الدار البيضاء مدينة أعمال وميناء حديث؛ مراكش وجهة ثقافية وأسواق وأجواء أوضح.',
      'البيضاء أسهل لرحلات العمل والمطارات؛ مراكش أقوى للعطلة والتصوير.',
      'التكلفة اليومية السياحية في مراكش غالباً أكثر مرونة؛ البيضاء أعلى قليلاً في الجانب العملي.',
    ],
    chooseAWhenEn: 'Choose Casablanca for business, meetings, or a short modern stop.',
    chooseAWhenAr: 'اختر الدار البيضاء إذا كان هدفك أعمال، اجتماعات، أو محطة سريعة حديثة.',
    chooseBWhenEn: 'Choose Marrakech for culture, souks, and a warmer holiday feel.',
    chooseBWhenAr: 'اختر مراكش إذا أردت ثقافة وأسواق وتجربة مغربية أدفأ للعائلة أو العطلة.',
  },
  {
    a: 'paris',
    b: 'rome',
    differencesEn: [
      'Paris leads on fashion and major museums; Rome is daily Roman history and piazza life.',
      'Paris is usually pricier for stays and dining; Rome often gives clearer mid-budget value.',
      'Rome walks past ruins daily; Paris needs more neighborhood/museum planning.',
    ],
    differencesAr: [
      'باريس أرقى في الموضة والمتاحف الكبرى؛ روما أقرب للتاريخ الروماني والحياة في الساحات.',
      'باريس أغلى عادةً في الإقامة والوجبات؛ روما تعطي قيمة أوضح للميزانية المتوسطة.',
      'المشي في روما يمرّ على آثار يومياً؛ باريس تحتاج تخطيطاً أكثر حسب الحي والمتحف.',
    ],
    chooseAWhenEn: 'Choose Paris for polished culture, luxury, and high-end shopping.',
    chooseAWhenAr: 'اختر باريس للرفاهية والثقافة الراقية والتسوق الراقي.',
    chooseBWhenEn: 'Choose Rome for family history, food, and a calmer budget.',
    chooseBWhenAr: 'اختر روما للتاريخ العائلي والطعام الأصيل وميزانية أهدأ.',
  },
  {
    a: 'tokyo',
    b: 'seoul',
    differencesEn: [
      'Tokyo is broader and more meticulously organized; Seoul is faster and trend-forward.',
      'Seoul often wins on fashion value; Tokyo wins on neighborhood depth and specialty scenes.',
      'Both can be English-light; Tokyo signage/metro still make navigation workable.',
    ],
    differencesAr: [
      'طوكيو أدق تنظيماً وأوسع في الأحياء؛ سيول أسرع إيقاعاً وأقرب للترند.',
      'التسوق في سيول غالباً أوضح قيمة؛ طوكيو أوسع في التخصصات.',
      'اللغة الإنجليزية متفاوتة؛ لافتات ومترو طوكيو يسهّلان التنقل رغم ذلك.',
    ],
    chooseAWhenEn: 'Choose Tokyo for depth, organization, and a classic big-city Japan trip.',
    chooseAWhenAr: 'اختر طوكيو إذا أردت عمقاً ثقافياً وتنظيماً عالياً ومغامرة مدينة كبيرة.',
    chooseBWhenEn: 'Choose Seoul for shopping, modern energy, and an easier first Asia city trip.',
    chooseBWhenAr: 'اختر سيول إذا أردت تسوقاً وترفاً عصرياً ووتيرة أخف للزيارة الأولى.',
  },
]

function fallbackDifferences(
  left: DestinationRecommendation,
  right: DestinationRecommendation,
): { differencesEn: string[]; differencesAr: string[]; verdictEn: string; verdictAr: string } {
  const a = left.knowledge
  const b = right.knowledge
  return {
    differencesEn: [
      `${a.nameEn} leans ${a.themes.slice(0, 3).join(', ')}.`,
      `${b.nameEn} leans ${b.themes.slice(0, 3).join(', ')}.`,
      `Local daily mid spend ~${a.dailyBudgetSar.mid} vs ~${b.dailyBudgetSar.mid} SAR.`,
    ],
    differencesAr: [
      `${a.nameAr} تبرز في: ${a.themes.slice(0, 3).join('، ')}.`,
      `${b.nameAr} تبرز في: ${b.themes.slice(0, 3).join('، ')}.`,
      `إنفاق يومي متوسط تقريباً ${a.dailyBudgetSar.mid} مقابل ${b.dailyBudgetSar.mid} ر.س.`,
    ],
    verdictEn: left.score >= right.score
      ? `Lean ${a.nameEn} for your current brief (${left.score} vs ${right.score}).`
      : `Lean ${b.nameEn} for your current brief (${right.score} vs ${left.score}).`,
    verdictAr: left.score >= right.score
      ? `أميل إلى ${a.nameAr} لطلبك الحالي (${left.score} مقابل ${right.score}).`
      : `أميل إلى ${b.nameAr} لطلبك الحالي (${right.score} مقابل ${left.score}).`,
  }
}

export async function compareDestinations(
  leftQuery: string,
  rightQuery: string,
  requirements: TripRequirements,
): Promise<DestinationComparison | null> {
  const leftKnowledge = findKnowledgeByName(leftQuery)
  const rightKnowledge = findKnowledgeByName(rightQuery)
  if (!leftKnowledge || !rightKnowledge) return null

  const [left, right] = await Promise.all([
    buildRecommendation(leftKnowledge, requirements),
    buildRecommendation(rightKnowledge, requirements),
  ])

  const pair = COMPARISON_PAIRS.find(
    (p) =>
      (p.a === leftKnowledge.id && p.b === rightKnowledge.id)
      || (p.a === rightKnowledge.id && p.b === leftKnowledge.id),
  )

  if (!pair) {
    const fb = fallbackDifferences(left, right)
    return {
      left,
      right,
      differencesEn: fb.differencesEn,
      differencesAr: fb.differencesAr,
      verdictEn: fb.verdictEn,
      verdictAr: fb.verdictAr,
    }
  }

  const swapped = pair.a === rightKnowledge.id
  const chooseLeftEn = swapped ? pair.chooseBWhenEn : pair.chooseAWhenEn
  const chooseLeftAr = swapped ? pair.chooseBWhenAr : pair.chooseAWhenAr
  const chooseRightEn = swapped ? pair.chooseAWhenEn : pair.chooseBWhenEn
  const chooseRightAr = swapped ? pair.chooseAWhenAr : pair.chooseBWhenAr

  return {
    left,
    right,
    differencesEn: pair.differencesEn,
    differencesAr: pair.differencesAr,
    verdictEn: `${chooseLeftEn} ${chooseRightEn} Score: ${left.knowledge.nameEn} ${left.score} vs ${right.knowledge.nameEn} ${right.score}.`,
    verdictAr: `${chooseLeftAr} ${chooseRightAr} النتيجة: ${left.knowledge.nameAr} ${left.score} مقابل ${right.knowledge.nameAr} ${right.score}.`,
  }
}

const VS_PATTERN =
  /(?:قارن|مقارنة|versus|\bvs\.?\b|ضد)\s+([^\n،,]{2,40}?)\s+(?:و|vs\.?|versus|ضد|مع)\s+([^\n؟?]{2,40})/i
const VS_SIMPLE =
  /([A-Za-z\u0600-\u06FF]{3,30})\s+(?:vs\.?|versus|ضد)\s+([A-Za-z\u0600-\u06FF]{3,30})/i

export function detectComparisonQuery(message: string): { left: string; right: string } | null {
  const text = message.trim()
  const m1 = text.match(VS_PATTERN)
  if (m1?.[1] && m1[2]) return { left: m1[1].trim(), right: m1[2].trim() }
  const m2 = text.match(VS_SIMPLE)
  if (m2?.[1] && m2[2]) return { left: m2[1].trim(), right: m2[2].trim() }
  return null
}

export function isOpenEndedDestinationAsk(message: string): boolean {
  const t = message.trim().toLowerCase()
  if (!t) return false
  return (
    /where should i (travel|go|visit)/i.test(t)
    || /recommend (a |me )?(destination|place|city)/i.test(t)
    || /أين\s+(أ|ا)?سافر|وين\s+أسافر|اقترح\s+(عليّ|علي|لي)?\s*(وجهة|مدينة|مكان)|ما\s+هي\s+أفضل\s+وجهة/i.test(message)
    || /somewhere\s+(warm|cold|beach|nice)/i.test(t)
  )
}
