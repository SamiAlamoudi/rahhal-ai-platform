/**
 * Live Concierge Engine — in-trip assistance for urgent traveler needs.
 */

import type {
  ExecutiveEngine,
  ExecutiveEngineContext,
  ExecutiveEngineMetadata,
  ExecutiveExecution,
} from '../platform/engineContract'

type ConciergeNeed =
  | 'hungry'
  | 'tired'
  | 'lost'
  | 'pharmacy'
  | 'hospital'
  | 'transport'
  | 'passport_lost'
  | 'flight_delayed'
  | 'hotel_bad'
  | 'hotel_change'
  | 'local_experience'
  | 'none'

export function createLiveConciergeEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'live_concierge',
    version: '1.0.0',
    name: 'Live Concierge Engine',
    description: 'Understands in-trip needs and recommends immediate actions.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const need = detectNeed(ctx.userText)
      const findings = need === 'none'
        ? []
        : [ctx.locale === 'ar' ? `احتياج فوري: ${need}` : `Immediate need: ${need}`]
      return {
        engineId: 'live_concierge',
        findings,
        signals: {
          need,
          location: ctx.memory.requirements.destination,
          hour: ctx.now.getHours(),
          travelStyle: ctx.executiveContext?.travelStyle ?? 'general',
        },
        priority: need === 'passport_lost' || need === 'hospital'
          ? 'critical'
          : need === 'flight_delayed' || need === 'hotel_bad'
            ? 'high'
            : need === 'none'
              ? 'low'
              : 'medium',
      }
    },

    plan(ctx, analysis) {
      const need = String(analysis.signals.need ?? 'none') as ConciergeNeed
      if (need === 'none') {
        return { engineId: 'live_concierge', actions: [], alternatives: [] }
      }
      return {
        engineId: 'live_concierge',
        actions: [{
          id: `concierge_${need}`,
          description: recommend(need, ctx),
          priority: analysis.priority,
        }],
        alternatives: alternatives(need, ctx),
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return emptyExecution()
      }
      const reply = plan.actions[0]?.description ?? null
      return {
        engineId: 'live_concierge',
        applied: true,
        effects: ['live_assistance'],
        replyFragment: reply,
        alerts: plan.actions.map((a) => ({
          priority: a.priority,
          message: a.description,
          category: 'live_concierge',
        })),
        recommendations: plan.alternatives.map((alt) => ({
          title: alt,
          why: [ctx.locale === 'ar' ? 'بديل سريع' : 'Fast alternative'],
          pros: [],
          cons: [],
          tradeoffs: [],
          confidence: 0.78,
        })),
        memoryNotes: [],
        nextBestAction: ctx.locale === 'ar'
          ? 'هل تريدني أحجز أو أوجّهك الآن؟'
          : 'Should I book or guide you there now?',
        metadata: { need: plan.actions[0]?.id },
      }
    },

    confidence(_ctx, analysis) {
      return analysis.findings.length > 0 ? 0.88 : 0.2
    },
  }
}

function emptyExecution(): ExecutiveExecution {
  return {
    engineId: 'live_concierge',
    applied: false,
    effects: [],
    replyFragment: null,
    alerts: [],
    recommendations: [],
    memoryNotes: [],
    nextBestAction: null,
    metadata: {},
  }
}

function detectNeed(text: string): ConciergeNeed {
  const t = text.toLowerCase()
  if (/lost (?:my )?passport|ضايع جواز|فقدت جواز|جواز.*ضاع/.test(t) || /ضايع|فقدت/.test(text) && /جواز/.test(text)) {
    return 'passport_lost'
  }
  if (/\b(?:need|find|nearest)\s+(?:a\s+)?hospital\b|emergency room|ambulance|مستشفى|طوارئ/.test(t) || /مستشفى/.test(text)) {
    return 'hospital'
  }
  if (/\b(?:need|find|nearest)\s+(?:a\s+)?pharmacy\b|medicine|صيدلية|دواء/.test(t) || /صيدلية/.test(text)) {
    return 'pharmacy'
  }
  if (
    /\bi(?:'m| am)?\s+hungry\b|\bneed food\b|\bwant (?:to eat|food)\b|جوعان|جائع|أبي آكل|ابي اكل/.test(t)
    || /جوعان|جائع|أبي آكل/.test(text)
  ) {
    return 'hungry'
  }
  if (/\bi(?:'m| am)?\s+tired\b|exhausted|تعبان|مرهق|نعسان/.test(t) || /تعبان|مرهق/.test(text)) {
    return 'tired'
  }
  if (/\bi(?:'m| am)?\s+lost\b|where am i|ضايع|أنا وين|وين أنا/.test(t) || /ضايع|وين أنا/.test(text)) {
    return 'lost'
  }
  if (/flight (?:is )?delayed|تأخير.*طيران|الطيران تأخر/.test(t) || /تأخير/.test(text) && /طيران/.test(text)) {
    return 'flight_delayed'
  }
  if (/hotel (?:is )?(?:bad|terrible|awful)|فندق.*(سيء|وحش|تعبان)/.test(t) || /فندق سيء/.test(text)) {
    return 'hotel_bad'
  }
  if (/another hotel|change hotel|فندق آخر|غير الفندق/.test(t) || /فندق آخر/.test(text)) {
    return 'hotel_change'
  }
  if (/\bneed (?:a )?(?:taxi|uber|transport)\b|مواصلات|تاكسي|أوبر/.test(t) || /تاكسي|مواصلات/.test(text)) {
    return 'transport'
  }
  if (/local experience|something local|تجربة محلية|شيء محلي/.test(t) || /تجربة محلية/.test(text)) {
    return 'local_experience'
  }
  return 'none'
}

function recommend(need: ConciergeNeed, ctx: ExecutiveEngineContext): string {
  const dest = ctx.memory.requirements.destination ?? (ctx.locale === 'ar' ? 'موقعك' : 'your area')
  const luxury = ctx.executiveContext?.luxuryPreference
  const ar = ctx.locale === 'ar'

  switch (need) {
    case 'hungry':
      return ar
        ? luxury
          ? `أقترح مطعماً راقياً قريباً في ${dest} — هدوء وإطلالة جيدة. أرسل موقعك لأوجّهك.`
          : `أقترح مطاعم موثوقة قريبة في ${dest} تناسب ذوقك. أرسل موقعك لأرتّب الأقرب.`
        : luxury
          ? `I recommend a refined nearby restaurant in ${dest}. Share your pin and I will guide you.`
          : `I will short-list trusted nearby restaurants in ${dest}. Share your location for the closest fit.`
    case 'tired':
      return ar
        ? 'أفهم — أقترح العودة للفندق، مشروب هادئ، وإلغاء الأنشطة الثقيلة الليلة.'
        : 'Understood — I suggest returning to the hotel, a quiet reset, and skipping heavy activities tonight.'
    case 'lost':
      return ar
        ? `أرسل موقعك الحالي وسأوجّهك لأقرب معلم/فندق في ${dest} بخطوات واضحة.`
        : `Share your live location and I will guide you to the nearest landmark/hotel in ${dest}.`
    case 'pharmacy':
      return ar
        ? 'أقرب صيدليات 24 ساعة مع اتجاهات — قل لي إن كان لديك حساسية أدوية.'
        : 'Nearest 24h pharmacies with directions — tell me any medication allergies.'
    case 'hospital':
      return ar
        ? 'حرج: سأوجّهك لأقرب مستشفى/طوارئ موثوق مع رقم طوارئ محلي. هل أنت بأمان الآن؟'
        : 'Critical: I will route you to the nearest trusted ER/hospital and local emergency number. Are you safe right now?'
    case 'transport':
      return ar
        ? 'رتّبت خيارات نقل فورية (تاكسي/تطبيق) مع تقدير الوقت والتكلفة.'
        : 'I lined up immediate transport options (taxi/app) with time and cost estimates.'
    case 'passport_lost':
      return ar
        ? 'حرج: اتصل بالسفارة فوراً، قدّم بلاغاً، واحتفظ بصورة الجواز إن وُجدت. أجهّز لك خطوات السفارة.'
        : 'Critical: contact your embassy immediately, file a report, keep any passport copy. I will prepare embassy steps.'
    case 'flight_delayed':
      return ar
        ? 'سأراقب التأخير، أتحقق من الربط التالي، وأقترح بدائل فندق/نقل إن لزم.'
        : 'I will monitor the delay, check your connection, and propose hotel/transfer alternatives if needed.'
    case 'hotel_bad':
    case 'hotel_change':
      return ar
        ? 'سأبحث عن فندق بديل بنفس المنطقة مع إلغاء مرن ونقل سريع.'
        : 'I will find a same-area alternative hotel with flexible cancellation and quick transfer.'
    case 'local_experience':
      return ar
        ? `أقترح تجربة محلية قصيرة تناسب أسلوبك في ${dest} دون إرهاق.`
        : `I suggest a short local experience matching your style in ${dest} without overloading the day.`
    default:
      return ar ? 'كيف أقدر أساعدك الآن؟' : 'How can I help you right now?'
  }
}

function alternatives(need: ConciergeNeed, ctx: ExecutiveEngineContext): string[] {
  const ar = ctx.locale === 'ar'
  if (need === 'hungry') {
    return ar
      ? ['مطعم سريع قريب', 'توصيل للفندق', 'مقهى هادئ']
      : ['Nearby quick bite', 'Hotel delivery', 'Quiet cafe']
  }
  if (need === 'hotel_bad' || need === 'hotel_change') {
    return ar
      ? ['فندق 4 نجوم قريب', 'شقة مفروشة لليلة', 'ترقية في نفس السلسلة']
      : ['Nearby 4-star hotel', 'Serviced apartment for tonight', 'Same-chain upgrade']
  }
  if (need === 'flight_delayed') {
    return ar
      ? ['إعادة حجز رحلة لاحقة', 'صالة انتظار', 'فندق ليلي إن فُقد الربط']
      : ['Rebook later flight', 'Lounge access', 'Overnight hotel if connection missed']
  }
  return []
}
