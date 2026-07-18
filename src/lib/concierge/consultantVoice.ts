/**
 * Consultant-style replies (ar/en).
 * Sounds like an experienced travel advisor — not a slot-filling form.
 * No provider names, no booking-engine jargon.
 */

import type { AgentLocale, TripRequirements } from '../agent/types'
import type { ConciergeSoftSignals, ConciergeTurnDecision } from './types'

export interface ConsultantVoiceInput {
  locale: AgentLocale
  decision: ConciergeTurnDecision
  requirements: TripRequirements
  userText?: string
  /** Optional short option lines from the recommendation bridge (Phase 4). */
  optionLines?: string[]
}

export function buildConsultantReply(input: ConsultantVoiceInput): string {
  const { locale, decision, requirements, optionLines } = input
  const heard = decision.state.heardSummary
  const soft = decision.state.softSignals

  switch (decision.action) {
    case 'greet':
      return joinBlocks([
        line(locale, {
          ar: 'مرحباً — أنا مستشارك في رحّال. خلّنا نبني رحلة تناسبك، مو مجرد تعبئة نموذج.',
          en: 'Welcome — I am your Rahhal travel consultant. We will shape a trip around you, not a form.',
        }),
        heardBlock(locale, heard),
        askBlock(locale, decision.askFields, requirements),
      ])
    case 'ask':
    case 'clarify':
      return joinBlocks([
        ackBlock(locale, heard, soft),
        askBlock(locale, decision.askFields, requirements),
      ])
    case 'advise':
      return joinBlocks([
        ackBlock(locale, heard, soft),
        adviseBlock(locale, soft, requirements),
      ])
    case 'propose_options':
      return joinBlocks([
        ackBlock(locale, heard, soft),
        proposeBlock(locale, soft, requirements, optionLines),
        line(locale, {
          ar: 'أي اتجاه أقرب لك؟ أو قل «ابني الخطة» وأكمل لك.',
          en: 'Which direction feels right? Or say “build the plan” and I will continue.',
        }),
      ])
    case 'confirm':
      return joinBlocks([
        line(locale, {
          ar: 'قبل ما أجهّز الخطة — تأكيد سريع على ما فهمته:',
          en: 'Before I prepare the plan — a quick confirmation of what I heard:',
        }),
        heardBlock(locale, heard),
        softSummary(locale, soft),
        line(locale, {
          ar: 'إذا موافق، قل «نعم» أو «ابني الخطة».',
          en: 'If that looks right, say “yes” or “build the plan”.',
        }),
      ])
    case 'plan':
    case 'search':
      // Agent will produce the structured plan reply; Concierge only bridges.
      return line(locale, {
        ar: 'ممتاز — سأجهّز خطتك الآن عبر محرك السفر.',
        en: 'Excellent — I will prepare your plan through the travel engine now.',
      })
    case 'refine':
      return line(locale, {
        ar: 'فهمت التعديل — سأعدّل الخطة بناءً على طلبك.',
        en: 'Understood — I will adjust the plan based on your request.',
      })
    default:
      return askBlock(locale, decision.askFields, requirements)
  }
}

function askBlock(
  locale: AgentLocale,
  fields: Array<keyof TripRequirements>,
  requirements: TripRequirements,
): string {
  if (fields.length === 0) {
    return line(locale, {
      ar: 'هل هناك تفصيل إضافي يهمك قبل ما نكمل؟',
      en: 'Is there anything else that matters before we continue?',
    })
  }

  const questions = fields.map((field) => questionFor(field, locale, requirements))
  if (questions.length === 1) {
    return line(locale, {
      ar: `حتى أوجّهك صح: ${questions[0]}`,
      en: `To steer this well: ${questions[0]}`,
    })
  }

  return [
    line(locale, {
      ar: 'سؤالان سريعان عشان نضبط الاتجاه:',
      en: 'Two quick questions so we set the right direction:',
    }),
    ...questions.map((q) => `• ${q}`),
  ].join('\n')
}

function questionFor(
  field: keyof TripRequirements,
  locale: AgentLocale,
  requirements: TripRequirements,
): string {
  const dest = requirements.destination || requirements.destinations[0]
  switch (field) {
    case 'destination':
      return line(locale, {
        ar: 'وين تبي تسافر؟ (مدينة أو بلد)',
        en: 'Where would you like to go? (city or country)',
      })
    case 'durationDays':
      return line(locale, {
        ar: dest
          ? `كم يوم تتخيّل لـ${dest}؟ أو عندك تواريخ؟`
          : 'How many days are you imagining, or do you have dates?',
        en: dest
          ? `How many days are you imagining for ${dest}? Or do you have dates?`
          : 'How many days are you imagining, or do you have dates?',
      })
    case 'budgetAmount':
      return line(locale, {
        ar: 'وش الميزانية التقريبية؟ (أو قل «مرنة»)',
        en: 'What budget range feels comfortable? (or say “flexible”)',
      })
    case 'travelers':
      return line(locale, {
        ar: 'كم شخص بيسافر معك؟',
        en: 'How many people are traveling?',
      })
    case 'travelerType':
      return line(locale, {
        ar: 'سفر فردي، زوجين، عائلة، أصدقاء، ولا عمل؟',
        en: 'Solo, couple, family, friends, or business?',
      })
    case 'interests':
      return line(locale, {
        ar: 'وش يهمك أكثر: طعام، ثقافة، شاطئ، طبيعة، تسوق، مغامرة…؟',
        en: 'What matters most: food, culture, beach, nature, shopping, adventure…?',
      })
    case 'budgetStyle':
      return line(locale, {
        ar: 'تميل لفاخر، متوسط، ولا اقتصادي؟',
        en: 'Do you lean luxury, mid-range, or budget?',
      })
    case 'hotelPreference':
      return line(locale, {
        ar: 'تفضل فندق وسط المدينة، منتجع، بوتيك، ولا أي شيء مناسب؟',
        en: 'Prefer a central hotel, resort, boutique, or whatever fits?',
      })
    case 'weatherPreference':
      return line(locale, {
        ar: 'تحب طقس معتدل، دافئ، بارد، ولا مرن؟',
        en: 'Mild, warm, cool weather — or flexible?',
      })
    case 'packageScope':
      return line(locale, {
        ar: 'تبي طيران فقط، ولا باقة كاملة (طيران + إقامة + أنشطة)؟',
        en: 'Flights only, or a full package (flights + stay + activities)?',
      })
    default:
      return line(locale, {
        ar: 'هل تقدر توضّح هذا التفصيل؟',
        en: 'Could you clarify that detail?',
      })
  }
}

function ackBlock(
  locale: AgentLocale,
  heard: string[],
  soft: ConciergeSoftSignals,
): string {
  if (heard.length === 0 && !soft.pace && soft.mustHaves.length === 0) {
    return line(locale, {
      ar: 'تمام، خلّنا نكمّل بهدوء.',
      en: 'Got it — let’s keep shaping this carefully.',
    })
  }
  const bits: string[] = []
  if (heard.length) {
    bits.push(line(locale, {
      ar: `سجلت: ${heard.join(' · ')}`,
      en: `Noted: ${heard.join(' · ')}`,
    }))
  }
  if (soft.pace) {
    bits.push(line(locale, {
      ar: soft.pace === 'relaxed'
        ? 'واضح إنك تبي إيقاع مرتاح.'
        : soft.pace === 'packed'
          ? 'واضح إنك تبي جدول غني.'
          : 'واضح إنك تبي إيقاع متوازن.',
      en: soft.pace === 'relaxed'
        ? 'I hear you want a relaxed pace.'
        : soft.pace === 'packed'
          ? 'I hear you want a full, active schedule.'
          : 'I hear you want a balanced pace.',
    }))
  }
  return bits.join('\n')
}

function heardBlock(locale: AgentLocale, heard: string[]): string {
  if (!heard.length) return ''
  return line(locale, {
    ar: `ما فهمته حتى الآن: ${heard.join(' · ')}`,
    en: `What I have so far: ${heard.join(' · ')}`,
  })
}

function softSummary(locale: AgentLocale, soft: ConciergeSoftSignals): string {
  const rows: string[] = []
  if (soft.mustHaves.length) {
    rows.push(locale === 'ar'
      ? `مهم لك: ${soft.mustHaves.join('، ')}`
      : `Important to you: ${soft.mustHaves.join(', ')}`)
  }
  if (soft.dealBreakers.length) {
    rows.push(locale === 'ar'
      ? `نبتعد عن: ${soft.dealBreakers.join('، ')}`
      : `We will avoid: ${soft.dealBreakers.join(', ')}`)
  }
  if (soft.tradeoffs.length) {
    rows.push(locale === 'ar'
      ? `مفاضلات محتملة: ${soft.tradeoffs.join('، ')}`
      : `Tradeoffs to keep in mind: ${soft.tradeoffs.join(', ')}`)
  }
  return rows.join('\n')
}

function adviseBlock(
  locale: AgentLocale,
  soft: ConciergeSoftSignals,
  requirements: TripRequirements,
): string {
  const dest = requirements.destination || requirements.destinations[0] || (locale === 'ar' ? 'وجهتك' : 'your destination')
  const paceNote = soft.pace === 'relaxed'
    ? (locale === 'ar' ? 'بإيقاع هادئ' : 'at a relaxed pace')
    : soft.pace === 'packed'
      ? (locale === 'ar' ? 'بجدول غني' : 'with a fuller schedule')
      : (locale === 'ar' ? 'بتوازن عملي' : 'with a practical balance')

  return line(locale, {
    ar: `لو كنت مكانك في ${dest}، أنصح نبني الرحلة ${paceNote} ونحافظ على مساحة للمرونة.`,
    en: `If I were advising you on ${dest}, I would shape the trip ${paceNote} and keep room to adapt.`,
  })
}

function proposeBlock(
  locale: AgentLocale,
  soft: ConciergeSoftSignals,
  requirements: TripRequirements,
  optionLines?: string[],
): string {
  if (optionLines && optionLines.length > 0) {
    return [
      line(locale, {
        ar: 'عندي ثلاث اتجاهات منطقية:',
        en: 'I see three sensible directions:',
      }),
      ...optionLines.map((row, i) => `${i + 1}. ${row}`),
    ].join('\n')
  }

  const dest = requirements.destination || requirements.destinations[0] || ''
  const comfort = soft.pace === 'relaxed' || requirements.budgetStyle === 'luxury'
  const lines = locale === 'ar'
    ? [
        `${dest || 'الوجهة'}: تركيز على الراحة${comfort ? ' والفنادق الجيدة' : ''} مع أنشطة مختارة.`,
        `${dest || 'الوجهة'}: توازن بين المعالم والتجارب المحلية.`,
        `${dest || 'الوجهة'}: جدول أوفر مع مرونة أعلى في الميزانية.`,
      ]
    : [
        `${dest || 'Destination'}: comfort-first${comfort ? ' with stronger stays' : ''} and selective activities.`,
        `${dest || 'Destination'}: balanced landmarks plus local experiences.`,
        `${dest || 'Destination'}: leaner schedule with more budget flexibility.`,
      ]
  return [
    line(locale, {
      ar: 'عندي ثلاث اتجاهات منطقية:',
      en: 'I see three sensible directions:',
    }),
    ...lines.map((row, i) => `${i + 1}. ${row}`),
  ].join('\n')
}

function line(locale: AgentLocale, copy: { ar: string; en: string }): string {
  return locale === 'ar' ? copy.ar : copy.en
}

function joinBlocks(blocks: string[]): string {
  return blocks.filter((b) => b && b.trim().length > 0).join('\n\n')
}
