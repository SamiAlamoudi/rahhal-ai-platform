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
          ar: 'أهلاً بك — أنا معك كمستشار سفر في رحّال. خلّنا نبني رحلة تحس إنها لك.',
          en: 'Welcome — I am here as your Rahhal travel advisor. Let’s shape a trip that feels like you.',
        }),
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
        ar: 'لحظة — خلّني أقارن أفضل الخيارات لحالتك.',
        en: 'One moment — let me compare the best options for your case.',
      })
    case 'refine':
      return line(locale, {
        ar: 'فهمت — خلّني أعدّل الخطة وأشوف إننا نقدر نعمل أفضل.',
        en: 'Got it — let me reshape the plan. I think we can do even better.',
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
      ar: 'في شيء معيّن يهمك قبل ما نكمّل؟',
      en: 'Is there anything that matters most before we continue?',
    })
  }

  // Experience Sprint 1 — never more than one follow-up; never a wizard list.
  const field = fields[0]!
  const question = questionFor(field, locale, requirements)
  return question
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
        ar: 'خبرني أكثر عن الرحلة — وين تتخيّل نفسك؟',
        en: 'Tell me a little more about the trip you are planning.',
      })
    case 'durationDays':
      return line(locale, {
        ar: dest
          ? `متى تتخيّل ${dest} — كم يوم تقريباً، أو عندك تواريخ؟`
          : 'متى تقريباً، وكم يوم تتخيّل للرحلة؟',
        en: dest
          ? `When are you imagining ${dest} — roughly how many days, or do you have dates?`
          : 'When are you thinking, and roughly how many days?',
      })
    case 'budgetAmount':
      return line(locale, {
        ar: 'وش الميزانية اللي ترتاح لها — أو نخليها مرنة؟',
        en: 'What budget range feels comfortable — or shall we keep it flexible?',
      })
    case 'travelers':
      return line(locale, {
        ar: 'بتسافر لوحدك، ولا مع أحد؟',
        en: 'Are you traveling solo, or with someone?',
      })
    case 'travelerType':
      return line(locale, {
        ar: 'هذي رحلة زوجين، عيلة، أصدقاء، ولا عمل؟',
        en: 'Is this more of a couple trip, family, friends, or business?',
      })
    case 'interests':
      return line(locale, {
        ar: 'وش يهمك أكثر في الرحلة — طعام، ثقافة، هدوء، مغامرة؟',
        en: 'What matters most on this trip — food, culture, quiet, adventure?',
      })
    case 'budgetStyle':
      return line(locale, {
        ar: 'تميل لأجواء فاخرة، متوسطة، ولا عملية أكثر؟',
        en: 'Do you lean luxury, mid-range, or more practical?',
      })
    case 'hotelPreference':
      return line(locale, {
        ar: 'تفضل إقامة في وسط المدينة، منتجع، ولا أي مكان يناسب الإيقاع؟',
        en: 'Prefer a central stay, a resort, or wherever fits the rhythm?',
      })
    case 'weatherPreference':
      return line(locale, {
        ar: 'تحب طقس معتدل، دافئ، بارد، ولا ما يفرق؟',
        en: 'Mild, warm, or cool weather — or no strong preference?',
      })
    case 'packageScope':
      return line(locale, {
        ar: 'نركز على الطيران، ولا باقة كاملة مع الإقامة والأنشطة؟',
        en: 'Shall I focus on flights, or a full package with stays and activities?',
      })
    default:
      return line(locale, {
        ar: 'خبرني أكثر عشان أضبط الخيارات لك.',
        en: 'Tell me a little more so I can tune the options for you.',
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
      ar: `واضح من حديثك: ${heard.join(' · ')}.`,
      en: `I have this so far: ${heard.join(' · ')}.`,
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
        ar: 'من واقع تجربتي، ثلاثة اتجاهات منطقية:',
        en: 'From experience, three sensible directions:',
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
      ar: 'من واقع تجربتي، ثلاثة اتجاهات منطقية:',
      en: 'From experience, three sensible directions:',
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
