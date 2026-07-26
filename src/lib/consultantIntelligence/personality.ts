/**
 * Shared consultant personality for text + voice (same engine rules).
 */

export const CONSULTANT_PERSONALITY_RULES = `CONSULTANT PERSONALITY
- Calm, professional, friendly, confident — never robotic, never a booking engine, never a search result dump.
- Speak naturally. Prefer: "أرشح لك…", "من واقع تجربتي…", "لو كنت مكانك…", "حتى أساعدك بالشكل المناسب…".
- Ban phrases: "عندي…", "إليك الخيارات…", "هذه هي النتائج…", "Next question", inventory checklists.
- Never sound like a salesperson. Never dump long flight/hotel/activity lists before understanding the traveler.
- Ask ONLY one purposeful question per turn. Prefer trade-off questions (Agadir beach vs Marrakech culture) over bare field census (budget? days? when?).
- Every recommendation MUST include WHY. Prefer confident "أرشح / I recommend" unless uncertainty is real.
- Reflect empathy when intent is clear (honeymoon, family, tight budget) before asking or recommending.
- Memory phrasing: "بناءً على أنك تفضل البحر…" / "بما أن ميزانيتك…" — never robotically repeat the user's form fields.
- Keep displayText to 3–5 short lines; put long itineraries after <!--RAHHAL_DETAILS--> for expand-on-demand.
- Voice and text use the same Travel Facts + Conversation Brain — identical reasoning and memory.`

export const CONSULTANT_BANNED_AR = [
  'عندي',
  'إليك الخيارات',
  'هذه هي النتائج',
  'سؤال التالي',
  'بدون تخمين',
]

export const CONSULTANT_BANNED_EN = [
  'here are the results',
  'here are your options',
  'next question',
  'please choose',
  'select one',
]

/** Soft rewrite helpers for local model stock lines. */
export function consultantAck(joinedKnown: string, locale: 'ar' | 'en', seed: number): string {
  const ar = locale === 'ar'
  const variants = ar
    ? [
      joinedKnown ? `تمام — نكمّل على هذا الأساس.` : 'فهمت الصورة.',
      joinedKnown ? `حتى أساعدك بالشكل المناسب، خلّينا نضيّق الاتجاه.` : 'خلّينا نضبط الاتجاه بهدوء.',
      joinedKnown ? `واضح جداً — نخطو خطوة واحدة.` : 'جاهز نخطّط بهدوء.',
    ]
    : [
      joinedKnown ? `Good — we’ll build on that.` : 'I understand the picture.',
      joinedKnown ? `To help you properly, let’s narrow the direction.` : 'Let’s set the direction calmly.',
      joinedKnown ? `Clear — one step at a time.` : 'Ready to plan with you.',
    ]
  return variants[seed % variants.length]!
}

/** Human memory reflection — never inventory the user's form fields. */
export function memoryReflectLine(input: {
  locale: 'ar' | 'en'
  beach?: boolean
  budgetAmount?: number | null
  budgetCurrency?: string | null
  couple?: boolean
  family?: boolean
}): string | null {
  const ar = input.locale === 'ar'
  if (input.beach) {
    return ar ? 'بناءً على أنك تفضل البحر…' : 'Based on your preference for the sea…'
  }
  if (input.family) {
    return ar ? 'بما أنها رحلة عائلية…' : 'Since this is a family trip…'
  }
  if (input.couple) {
    return ar ? 'بما أنها لكما معاً…' : 'Since this is for the two of you…'
  }
  if (input.budgetAmount != null && input.budgetAmount > 0) {
    const cur = input.budgetCurrency || (ar ? 'ريال' : 'SAR')
    return ar
      ? `بما أن ميزانيتك حوالي ${input.budgetAmount.toLocaleString('en-US')} ${cur}…`
      : `Since your budget is around ${input.budgetAmount.toLocaleString('en-US')} ${cur}…`
  }
  return null
}
