import type { ShortTermMemory } from '../memory/types'
import type { TravelDraft } from '../travel/types'

export type ResolvedReference = {
  phrase: string
  kind:
    | 'destination'
    | 'hotel'
    | 'date'
    | 'price'
    | 'option_index'
    | 'flight'
    | 'unknown'
  value: string
  confidence: number
}

const REF_PATTERNS: Array<{
  re: RegExp
  kind: ResolvedReference['kind']
  resolve: (stm: ShortTermMemory, draft: TravelDraft, match: RegExpMatchArray) => string | null
}> = [
  {
    re: /\bthere\b|هناك|هنالك|نفس المدينة/i,
    kind: 'destination',
    resolve: (_s, draft) => draft.destination ?? null,
  },
  {
    re: /\bsame hotel\b|نفس الفندق|نفس\s*الفندق/i,
    kind: 'hotel',
    resolve: (stm) => stm.lastMentionedOptions.find((x) => x.startsWith('ht-')) ?? 'same_hotel',
  },
  {
    re: /\bnext week\b|الأسبوع القادم|الاسبوع القادم/i,
    kind: 'date',
    resolve: () => 'next_week',
  },
  {
    re: /\bcheaper option\b|أرخص|خيار أرخص|ارخص/i,
    kind: 'price',
    resolve: () => 'cheaper',
  },
  {
    re: /\bfirst one\b|الأول|الاول|الخيار الأول/i,
    kind: 'option_index',
    resolve: (stm) => stm.lastMentionedOptions[0] ?? 'index:0',
  },
  {
    re: /\bsecond (one|flight)\b|الثاني|الرحلة الثانية|الخيار الثاني/i,
    kind: 'flight',
    resolve: (stm) => {
      const flights = stm.lastMentionedOptions.filter((x) => x.startsWith('fl-'))
      return flights[1] ?? stm.lastMentionedOptions[1] ?? 'index:1'
    },
  },
]

/**
 * Maintains conversational context and resolves anaphoric references.
 */
export class ContextEngine {
  resolve(text: string, shortTerm: ShortTermMemory, draft: TravelDraft): ResolvedReference[] {
    const resolved: ResolvedReference[] = []
    for (const pattern of REF_PATTERNS) {
      const match = text.match(pattern.re)
      if (!match) continue
      const value = pattern.resolve(shortTerm, draft, match)
      if (value == null) {
        resolved.push({
          phrase: match[0],
          kind: pattern.kind,
          value: '',
          confidence: 0.35,
        })
        continue
      }
      resolved.push({
        phrase: match[0],
        kind: pattern.kind,
        value,
        confidence: 0.82,
      })
    }
    return resolved
  }

  applyResolutions(draft: TravelDraft, refs: ResolvedReference[]): TravelDraft {
    const next = { ...draft }
    for (const ref of refs) {
      if (ref.kind === 'destination' && ref.value) next.destination = ref.value
      if (ref.kind === 'date' && ref.value === 'next_week' && !next.departureDate) {
        next.departureDate = 'RELATIVE:next_week'
      }
    }
    return next
  }

  rememberOptions(shortTerm: ShortTermMemory, optionIds: string[]): ShortTermMemory {
    return {
      ...shortTerm,
      lastMentionedOptions: optionIds.slice(0, 12),
      unresolvedReferences: shortTerm.unresolvedReferences.filter(Boolean),
    }
  }
}
