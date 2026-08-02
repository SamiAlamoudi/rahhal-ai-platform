export type LuxuryEmptyCopy = {
  title: string
  body: string
  cta: string
  illustration: 'horizon' | 'dune' | 'companion' | 'atlas'
}

export function luxuryEmptyFor(
  surface: 'chat' | 'recommendations' | 'planning' | 'timeline' | 'dashboard',
  locale: 'ar' | 'en' = 'en',
): LuxuryEmptyCopy {
  const ar = locale === 'ar'
  switch (surface) {
    case 'chat':
      return {
        title: ar ? 'مساحة هادئة للتخطيط' : 'A quiet room for planning',
        body: ar
          ? 'أخبرني بما تحلم به — سأتذكر ذوقك وأرتّب الخيارات بأناقة.'
          : 'Tell me what you’re dreaming of — I’ll remember your taste and compose options with care.',
        cta: ar ? 'ابدأ بلطف' : 'Begin gently',
        illustration: 'horizon',
      }
    case 'recommendations':
      return {
        title: ar ? 'التوصيات تنتظر إشارتك' : 'Recommendations await your cue',
        body: ar
          ? 'محادثة قصيرة تكفي لأقترح ما يناسبك — مع سبب واضح لكل خيار.'
          : 'A short conversation is enough — every option will arrive with a clear why.',
        cta: ar ? 'اقترح لي' : 'Suggest for me',
        illustration: 'companion',
      }
    case 'planning':
      return {
        title: ar ? 'الخطة لم تُرسم بعد' : 'The plan is still a blank atlas',
        body: ar
          ? 'عندما تتضح الوجهة، أبني هيكلاً هادئاً لأيامك.'
          : 'Once the destination settles, I’ll draft a calm skeleton for your days.',
        cta: ar ? 'ابنِ خطة' : 'Shape a plan',
        illustration: 'atlas',
      }
    case 'timeline':
      return {
        title: ar ? 'جدول بانتظار أول خطوة' : 'A timeline waiting for a first step',
        body: ar
          ? 'كل قرار أنيق سيظهر هنا — للمراجعة أو الاستعادة.'
          : 'Each elegant decision will appear here — to review or restore.',
        cta: ar ? 'ابدأ الرحلة' : 'Start the journey',
        illustration: 'dune',
      }
    case 'dashboard':
    default:
      return {
        title: ar ? 'لوحة الاستعداد فارغة بهدوء' : 'Readiness still at rest',
        body: ar
          ? 'مع كل تفصيلة تكتمل، يرتفع مؤشر رحلتك برقي.'
          : 'As each detail settles, your trip score rises with grace.',
        cta: ar ? 'أكمل التفاصيل' : 'Complete the details',
        illustration: 'horizon',
      }
  }
}
