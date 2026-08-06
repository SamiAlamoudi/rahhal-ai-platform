/**
 * Normalize relative Arabic date phrasing → forms product extractors understand.
 */

export function normalizeRelativeDates(text: string): {
  text: string
  changed: boolean
  relativeDateHint: string | null
} {
  let out = text
  let changed = false
  let relativeDateHint: string | null = null

  const rules: Array<{ re: RegExp; to: string; hint: string }> = [
    { re: /بعد\s*العيد|عقب\s*العيد|بعدين\s*العيد/g, to: 'بعد العيد', hint: 'after_eid' },
    { re: /بعد\s*أسبوعين|بعد\s*اسبوعين|بعد\s*أسبوعي?ن/g, to: 'بعد أسبوعين', hint: 'after_two_weeks' },
    { re: /بعد\s*أسبوع|بعد\s*اسبوع|بعد\s*جمعة/g, to: 'بعد أسبوع', hint: 'after_one_week' },
    {
      re: /الأسبوع\s*الجاي|الاسبوع\s*الجاي|الأسبوع\s*القادم|الاسبوع\s*القادم|الأسبوع\s*المقبل/g,
      to: 'الأسبوع القادم',
      hint: 'next_week',
    },
    { re: /بكره\s*بالليل|بكرة\s*بالليل|غدا\s*مساء|غداً\s*مساءً|بكره\s*العصر/g, to: 'غدا مساء', hint: 'tomorrow_evening' },
    { re: /بكره|بكرة|باكر/g, to: 'غدا', hint: 'tomorrow' },
    { re: /هذا\s*الصيف|هالصيف|الصيف\s*هذا|الصيف\s*الجاي/g, to: 'هذا الصيف', hint: 'this_summer' },
    { re: /آخر\s*الشهر|نهاية\s*الشهر|اخر\s*الشهر/g, to: 'نهاية الشهر', hint: 'end_of_month' },
    { re: /بداية\s*أغسطس|بدايه\s*اغسطس|أول\s*أغسطس|اول\s*اغسطس/g, to: 'بداية أغسطس', hint: 'early_august' },
    { re: /منتصف\s*سبتمبر|نص\s*سبتمبر|منتصف\s*ايلول/g, to: 'منتصف سبتمبر', hint: 'mid_september' },
    { re: /نهاية\s*السنة|اخر\s*السنه|آخر\s*السنة|نهاية\s*العام/g, to: 'نهاية السنة', hint: 'end_of_year' },
    {
      re: /نهاية\s*الأسبوع|نهاية\s*الاسبوع|الويكند|الوكند|عطلة\s*نهاية\s*الأسبوع/g,
      to: 'نهاية الأسبوع',
      hint: 'weekend',
    },
  ]

  for (const rule of rules) {
    rule.re.lastIndex = 0
    if (!rule.re.test(out)) {
      rule.re.lastIndex = 0
      continue
    }
    rule.re.lastIndex = 0
    const next = out.replace(rule.re, rule.to)
    relativeDateHint = relativeDateHint ?? rule.hint
    if (next !== out) {
      changed = true
      out = next
    } else {
      // Canonical form already present — still count as date understanding.
      changed = true
    }
  }

  out = out.replace(/\s+/g, ' ').trim()
  return { text: out, changed, relativeDateHint }
}
