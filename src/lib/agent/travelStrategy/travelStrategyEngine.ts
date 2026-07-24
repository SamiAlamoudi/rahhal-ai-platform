/**
 * Evolution Sprint 8 — Travel Strategy Engine
 *
 * Optimizes HOW to travel — does NOT choose destinations.
 * Not wired into planTurn. CPU-only · offline.
 */

import { isTravelStrategyEnabled } from './strategyRegistry'
import { contextConfidence, withOverall } from './strategyScoring'
import { evaluateSeasonStrategy, evaluateHolidayImpact, evaluateVisaTiming } from './seasonStrategy'
import {
  evaluateBudgetStrategy,
  evaluateOpportunityCost,
  evaluateComfortVsCost,
} from './budgetStrategy'
import {
  evaluateTravelTiming,
  optimizeStayDuration,
  evaluateFlightTiming,
  evaluateHotelTiming,
  evaluateCitySplit,
  evaluateRouteOptimizer,
  evaluateTravelRisk,
} from './travelTiming'
import { formatStrategyResult } from './strategyFormatter'
import {
  isoNow,
  newId,
  uniqueStrings,
  type StrategyKind,
  type StrategyScores,
  type TravelStrategyContext,
  type TravelStrategyOption,
  type TravelStrategyResult,
} from './strategyTypes'

function evidenceFrom(ctx: TravelStrategyContext, texts: string[], now?: Date) {
  const stamp = isoNow(now)
  return uniqueStrings([...(ctx.evidence ?? []), ...texts]).slice(0, 12).map((text, i) => ({
    id: newId('sev', now) + String(i),
    text,
    weight: 1,
    source: 'strategy_context',
    timestamp: stamp,
  }))
}

function clarifications(missing: string[], locale: 'ar' | 'en'): string[] {
  const map: Record<string, { ar: string; en: string }> = {
    month_hint: {
      ar: 'في أي شهر تفضّل السفر؟',
      en: 'Which month do you prefer to travel?',
    },
    budget_amount: {
      ar: 'ما الميزانية التقريبية للرحلة؟',
      en: 'What is the approximate trip budget?',
    },
    duration_days: {
      ar: 'كم يوماً تريد للرحلة؟',
      en: 'How many days should the trip last?',
    },
    destination_season_priors: {
      ar: 'هل يمكننا استخدام معرفة الموسم للوجهة؟',
      en: 'Can we use destination season knowledge for timing?',
    },
    visa_complexity: {
      ar: 'ما وضع التأشيرة المتوقع؟',
      en: 'What visa process should we plan for?',
    },
    public_holiday_calendar: {
      ar: 'هل هناك عطل رسمية يجب تجنبها أو استهدافها؟',
      en: 'Any public holidays to avoid or target?',
    },
  }
  return uniqueStrings(
    missing.map((m) => {
      const hit = Object.keys(map).find((k) => m.includes(k))
      if (hit) return map[hit]![locale]
      return locale === 'ar' ? `هل يمكنك توضيح: ${m}؟` : `Can you clarify: ${m}?`
    }),
  ).slice(0, 5)
}

function buildOption(options: {
  kind: StrategyKind
  title: string
  summary: string
  why: string[]
  whyNot: string[]
  tradeoffs: string[]
  risks: string[]
  opportunityCost: string[]
  expectedValue: string[]
  scores: StrategyScores
  missing: string[]
  clarification: string[]
  evidence: TravelStrategyOption['evidence']
  levers: TravelStrategyOption['levers']
  now?: Date
}): TravelStrategyOption {
  return {
    id: newId(`strat_${options.kind}`, options.now),
    kind: options.kind,
    title: options.title,
    summary: options.summary,
    why: options.why.slice(0, 6),
    whyNot: options.whyNot.slice(0, 5),
    tradeoffs: options.tradeoffs.slice(0, 5),
    risks: options.risks.slice(0, 5),
    opportunityCost: options.opportunityCost.slice(0, 5),
    expectedValue: options.expectedValue.slice(0, 5),
    confidence: options.scores.confidence,
    evidence: options.evidence,
    missingInformation: options.missing,
    suggestedClarification: options.clarification,
    scores: options.scores,
    levers: options.levers,
  }
}

export function runTravelStrategyEngine(ctx: TravelStrategyContext): TravelStrategyResult {
  const now = ctx.now
  const locale = ctx.locale ?? 'ar'
  const baseConf = contextConfidence(ctx)

  const season = evaluateSeasonStrategy(ctx)
  const holiday = evaluateHolidayImpact(ctx)
  const visa = evaluateVisaTiming(ctx)
  const budget = evaluateBudgetStrategy(ctx)
  const opportunity = evaluateOpportunityCost(ctx)
  const comfort = evaluateComfortVsCost(ctx)
  const timing = evaluateTravelTiming(ctx)
  const stay = optimizeStayDuration(ctx)
  const flights = evaluateFlightTiming(ctx)
  const hotels = evaluateHotelTiming(ctx)
  const split = evaluateCitySplit(ctx)
  const route = evaluateRouteOptimizer(ctx)
  const risk = evaluateTravelRisk(ctx)

  const missing = uniqueStrings([
    ...(ctx.missingInformation ?? []),
    ...season.missing,
    ...holiday.missing,
    ...visa.missing,
    ...budget.missing,
    ...stay.missing,
    ...flights.missing,
    ...hotels.missing,
  ])

  const clarification = clarifications(missing, locale)
  const ev = evidenceFrom(
    ctx,
    [
      ...season.notes,
      ...budget.notes,
      ...timing.notes.slice(0, 2),
      ...(ctx.destinationLabel ? [`Destination context (not chosen here): ${ctx.destinationLabel}`] : []),
    ],
    now,
  )

  const transportScore = route.transportation
  const experienceBase = clampExperience(ctx)

  const mkScores = (partial: {
    budget: number
    comfort: number
    time: number
    convenience: number
    experience: number
    weather: number
    crowds: number
    transportation: number
    flexibility: number
    confidence?: number
  }) =>
    withOverall({
      ...partial,
      confidence: clampConf((partial.confidence ?? baseConf) - risk.riskPenalty / 100),
    })

  function clampConf(n: number) {
    return Math.max(0, Math.min(1, n))
  }
  function clampExperience(c: TravelStrategyContext): number {
    let e = 55
    if (c.destinationPriors?.strengths?.length) e += 10
    if (c.purpose) e += 5
    if (season.weatherScore >= 75) e += 8
    if (season.crowdScore <= 40) e -= 8
    return Math.max(0, Math.min(100, Math.round(e)))
  }

  const commonWhyNot = [
    locale === 'ar'
      ? 'هذه الطبقة لا تختار وجهة جديدة — الوجهة سياق وارد من طبقات أخرى.'
      : 'This layer does not pick a new destination — destination is upstream context only.',
  ]

  const primaryLevers = {
    goNowOrLater: timing.goNowOrLater,
    budgetAction: budget.budgetAction,
    splitItinerary: split.splitItinerary,
    adjustFlights: flights.adjustFlights,
    prioritizeComfort: comfort.prioritizeComfort,
    stayDurationDays: stay.stayDurationDays,
    timingNote: timing.notes[0] ?? season.notes[0] ?? null,
  }

  const primary = buildOption({
    kind: 'primary',
    title: locale === 'ar' ? 'الاستراتيجية الأساسية' : 'Primary strategy',
    summary:
      locale === 'ar'
        ? `وازن التوقيت (${timing.goNowOrLater}) والميزانية (${budget.budgetAction}) والراحة.`
        : `Balance timing (${timing.goNowOrLater}), budget (${budget.budgetAction}), and comfort.`,
    why: [...timing.notes.slice(0, 2), ...budget.notes.slice(0, 2), ...comfort.notes.slice(0, 1)],
    whyNot: [
      ...commonWhyNot,
      timing.goNowOrLater === 'later'
        ? (locale === 'ar' ? 'الذهاب فوراً قد يضعف القيمة الموسمية.' : 'Going immediately may weaken seasonal value.')
        : (locale === 'ar' ? 'تأجيل بلا سبب قد يفوّت نافذة مناسبة.' : 'Delaying without cause may miss a workable window.'),
    ],
    tradeoffs: [
      ...split.notes.slice(0, 1),
      comfort.prioritizeComfort
        ? (locale === 'ar' ? 'الراحة قد ترفع التكلفة.' : 'Comfort may raise cost.')
        : (locale === 'ar' ? 'ضغط الميزانية قد يقلل الراحة.' : 'Budget pressure may reduce comfort.'),
    ],
    risks: risk.riskNotes,
    opportunityCost: opportunity.notes,
    expectedValue: [
      locale === 'ar'
        ? 'قيمة أعلى عبر توقيت أفضل وتخصيص ميزانية أوضح لا عبر تغيير الوجهة هنا.'
        : 'Higher value via better timing and budget allocation — not by changing destination here.',
      ...stay.notes.slice(0, 1),
    ],
    scores: mkScores({
      budget: budget.budgetScore,
      comfort: comfort.comfortScore,
      time: timing.timeScore,
      convenience: flights.convenience,
      experience: experienceBase,
      weather: season.weatherScore,
      crowds: season.crowdScore,
      transportation: transportScore,
      flexibility: split.flexibility,
    }),
    missing,
    clarification,
    evidence: ev,
    levers: primaryLevers,
    now,
  })

  const budgetOpt = buildOption({
    kind: 'budget',
    title: locale === 'ar' ? 'استراتيجية الميزانية' : 'Budget strategy',
    summary:
      locale === 'ar'
        ? `إجراء الميزانية: ${budget.budgetAction}.`
        : `Budget action: ${budget.budgetAction}.`,
    why: budget.notes,
    whyNot: [
      ...commonWhyNot,
      locale === 'ar'
        ? 'لا نخفّض الجودة عشوائياً دون موافقة المسافر.'
        : 'Do not cut quality blindly without traveler consent.',
    ],
    tradeoffs: [
      budget.worthIncreasing
        ? (locale === 'ar' ? 'زيادة الميزانية قد تشتري راحة وتقليل مخاطر.' : 'Increasing budget may buy comfort and lower risk.')
        : (locale === 'ar' ? 'الإبقاء على الميزانية يحافظ على السقف.' : 'Keeping budget preserves the ceiling.'),
    ],
    risks: [
      ...(budget.budgetAction === 'increase'
        ? [locale === 'ar' ? 'الزيادة دون موافقة صريحة مخاطرة.' : 'Increasing without explicit consent is risky.']
        : []),
      ...risk.riskNotes.slice(0, 1),
    ],
    opportunityCost: opportunity.notes,
    expectedValue: [
      locale === 'ar'
        ? 'أفضل كفاءة ميزانية عبر إعادة التخصيص (موقع/مرونة) لا أرخص خيار أعمى.'
        : 'Best budget efficiency via reallocation (location/flexibility), not blind cheapest.',
    ],
    scores: mkScores({
      budget: Math.min(95, budget.budgetScore + 10),
      comfort: Math.max(35, comfort.comfortScore - 15),
      time: timing.timeScore,
      convenience: Math.max(40, flights.convenience - 10),
      experience: Math.max(40, experienceBase - 10),
      weather: season.weatherScore,
      crowds: season.crowdScore,
      transportation: transportScore,
      flexibility: split.flexibility + 5,
      confidence: baseConf * 0.95,
    }),
    missing,
    clarification,
    evidence: ev,
    levers: { ...primaryLevers, budgetAction: budget.budgetAction, prioritizeComfort: false },
    now,
  })

  const comfortOpt = buildOption({
    kind: 'comfort',
    title: locale === 'ar' ? 'استراتيجية الراحة' : 'Comfort strategy',
    summary:
      locale === 'ar'
        ? 'قدّم الراحة وتقليل الاحتكاك حتى لو ارتفعت التكلفة قليلاً.'
        : 'Prioritize comfort and low friction even if cost rises modestly.',
    why: [...comfort.notes, ...hotels.notes.slice(0, 1), ...flights.notes.slice(0, 1)],
    whyNot: commonWhyNot,
    tradeoffs: [
      locale === 'ar' ? 'راحة أعلى مقابل ميزانية أعلى.' : 'Higher comfort versus higher spend.',
    ],
    risks: risk.riskNotes,
    opportunityCost: [
      locale === 'ar'
        ? 'التنازل عن أرخص تذكرة/فندق مقابل نوم ووصول أفضل.'
        : 'Forgo cheapest ticket/hotel for better sleep and arrival.',
    ],
    expectedValue: [
      locale === 'ar'
        ? 'قيمة الرحلة عبر تقليل الإرهاق لا عبر تغيير الوجهة.'
        : 'Trip value via less fatigue — not via changing destination.',
    ],
    scores: mkScores({
      budget: Math.max(30, budget.budgetScore - 15),
      comfort: Math.min(95, comfort.comfortScore + 15),
      time: timing.timeScore,
      convenience: Math.min(95, flights.convenience + 15),
      experience: experienceBase + 5,
      weather: season.weatherScore,
      crowds: season.crowdScore,
      transportation: transportScore,
      flexibility: split.flexibility,
    }),
    missing,
    clarification,
    evidence: ev,
    levers: {
      ...primaryLevers,
      prioritizeComfort: true,
      adjustFlights: true,
      budgetAction: budget.worthIncreasing ? 'increase' : 'reallocate',
    },
    now,
  })

  const luxuryOpt = buildOption({
    kind: 'luxury',
    title: locale === 'ar' ? 'استراتيجية الفخامة' : 'Luxury strategy',
    summary:
      locale === 'ar'
        ? 'ارفع معيار الإقامة والتنقل مع الحفاظ على الوجهة الحالية.'
        : 'Raise lodging and transfer standards while keeping current destination context.',
    why: [
      ctx.travelerHints?.luxuryLean && ctx.travelerHints.luxuryLean > 0.4
        ? (locale === 'ar' ? 'ميل واضح نحو الفخامة.' : 'Clear luxury lean from traveler hints.')
        : (locale === 'ar' ? 'خيار فاخر اختياري للمقارنة.' : 'Optional luxury path for comparison.'),
      ...hotels.notes.slice(0, 1),
    ],
    whyNot: [
      ...commonWhyNot,
      locale === 'ar' ? 'غير مناسبة لميزانية صارمة جداً.' : 'Poor fit for a very strict budget.',
    ],
    tradeoffs: [locale === 'ar' ? 'تكلفة أعلى بكثير مقابل راحة وتجربة.' : 'Much higher cost for comfort and experience.'],
    risks: [
      locale === 'ar' ? 'تجاوز الميزانية دون موافقة.' : 'Budget overrun without consent.',
      ...risk.riskNotes.slice(0, 1),
    ],
    opportunityCost: opportunity.notes,
    expectedValue: [
      locale === 'ar'
        ? 'قيمة فاخرة عبر ترقية التنفيذ لا عبر وجهة جديدة.'
        : 'Luxury value via execution upgrades — not a new destination.',
    ],
    scores: mkScores({
      budget: 30,
      comfort: 95,
      time: timing.timeScore,
      convenience: 90,
      experience: Math.min(95, experienceBase + 15),
      weather: season.weatherScore,
      crowds: season.crowdScore,
      transportation: Math.min(95, transportScore + 5),
      flexibility: 45,
      confidence: baseConf * 0.9,
    }),
    missing,
    clarification,
    evidence: ev,
    levers: {
      ...primaryLevers,
      prioritizeComfort: true,
      budgetAction: 'increase',
      adjustFlights: true,
      splitItinerary: false,
    },
    now,
  })

  const fastestOpt = buildOption({
    kind: 'fastest',
    title: locale === 'ar' ? 'أسرع استراتيجية' : 'Fastest strategy',
    summary:
      locale === 'ar'
        ? 'قلّل التنقل والتقسيم؛ ثبّت قاعدة واحدة واتصلات أقل.'
        : 'Minimize transfers and splits; single base and fewer connections.',
    why: [...split.notes, ...route.notes.slice(0, 1), ...flights.notes.slice(0, 1)],
    whyNot: commonWhyNot,
    tradeoffs: [
      locale === 'ar'
        ? 'سرعة أعلى قد تعني مرونة أقل أو تكلفة تذاكر أعلى.'
        : 'More speed may mean less flexibility or higher ticket cost.',
    ],
    risks: risk.riskNotes,
    opportunityCost: [
      locale === 'ar'
        ? 'التخلي عن تقسيم المدن أو رحلات أطول أرخص.'
        : 'Forgo city-splitting or longer cheaper routings.',
    ],
    expectedValue: [
      locale === 'ar' ? 'قيمة الوقت عبر تقليل ساعات التنقل.' : 'Time value via fewer transit hours.',
    ],
    scores: mkScores({
      budget: Math.max(35, budget.budgetScore - 5),
      comfort: comfort.comfortScore,
      time: Math.min(95, timing.timeScore + 20),
      convenience: Math.min(95, flights.convenience + 20),
      experience: Math.max(40, experienceBase - 5),
      weather: season.weatherScore,
      crowds: season.crowdScore,
      transportation: Math.min(95, transportScore + 10),
      flexibility: 40,
    }),
    missing,
    clarification,
    evidence: ev,
    levers: {
      ...primaryLevers,
      splitItinerary: false,
      adjustFlights: true,
      stayDurationDays: stay.stayDurationDays,
    },
    now,
  })

  const valueOpt = buildOption({
    kind: 'highest_value',
    title: locale === 'ar' ? 'أعلى قيمة' : 'Highest value strategy',
    summary:
      locale === 'ar'
        ? 'توقيت أفضل + إعادة تخصيص الميزانية + مدة إقامة مناسبة.'
        : 'Better timing + budget reallocation + appropriate stay length.',
    why: [...season.notes.slice(0, 2), ...budget.notes.slice(0, 1), ...stay.notes.slice(0, 1)],
    whyNot: commonWhyNot,
    tradeoffs: [
      locale === 'ar'
        ? 'قد يتطلب الانتظار لموسم أفضل أو إنفاقاً أعلى قليلاً.'
        : 'May require waiting for a better season or slightly higher spend.',
    ],
    risks: risk.riskNotes,
    opportunityCost: opportunity.notes,
    expectedValue: [
      locale === 'ar'
        ? 'أقصى قيمة متوقعة من التوقيت والكفاءة لا من تغيير الوجهة.'
        : 'Max expected value from timing and efficiency — not destination change.',
    ],
    scores: mkScores({
      budget: budget.budgetScore,
      comfort: comfort.comfortScore,
      time: Math.max(timing.timeScore, season.weatherScore),
      convenience: flights.convenience,
      experience: Math.min(95, experienceBase + 10),
      weather: Math.min(95, season.weatherScore + 5),
      crowds: Math.min(95, season.crowdScore + 5),
      transportation: transportScore,
      flexibility: split.flexibility,
      confidence: Math.min(1, baseConf + 0.05),
    }),
    missing,
    clarification,
    evidence: ev,
    levers: {
      ...primaryLevers,
      goNowOrLater: season.goNowOrLater === 'later' ? 'later' : timing.goNowOrLater,
      budgetAction: 'reallocate',
      stayDurationDays: stay.stayDurationDays,
    },
    now,
  })

  const lowRiskOpt = buildOption({
    kind: 'lowest_risk',
    title: locale === 'ar' ? 'أقل مخاطر' : 'Lowest risk strategy',
    summary:
      locale === 'ar'
        ? 'توقيت محافظ، خيارات مرنة، تنقل أقل، وهامش تأشيرة.'
        : 'Conservative timing, flexible options, fewer transfers, visa buffer.',
    why: [...risk.riskNotes, ...visa.notes.slice(0, 1), ...holiday.notes.slice(0, 1)],
    whyNot: commonWhyNot,
    tradeoffs: [
      locale === 'ar'
        ? 'تقليل المخاطر قد يعني تكلفة أعلى أو مرونة تواريخ أقل إثارة.'
        : 'Lower risk may mean higher cost or less exciting date flexibility.',
    ],
    risks: [
      locale === 'ar'
        ? 'الإفراط في التحفظ قد يفوّت قيمة موسمية.'
        : 'Over-conservatism may miss seasonal value.',
    ],
    opportunityCost: opportunity.notes,
    expectedValue: [
      locale === 'ar'
        ? 'قيمة الاستقرار وإمكانية التعديل.'
        : 'Value from stability and changeability.',
    ],
    scores: mkScores({
      budget: Math.max(40, budget.budgetScore - 5),
      comfort: Math.min(90, comfort.comfortScore + 10),
      time: Math.max(40, timing.timeScore - 5),
      convenience: Math.min(90, flights.convenience + 10),
      experience: experienceBase,
      weather: season.weatherScore,
      crowds: Math.min(90, season.crowdScore + 10),
      transportation: transportScore,
      flexibility: Math.min(90, split.flexibility + 15),
      confidence: baseConf,
    }),
    missing,
    clarification,
    evidence: ev,
    levers: {
      ...primaryLevers,
      goNowOrLater: visa.preferLater ? 'later' : timing.goNowOrLater === 'now' ? 'either' : timing.goNowOrLater,
      prioritizeComfort: true,
      adjustFlights: true,
      splitItinerary: false,
    },
    now,
  })

  const bestTimeOpt = buildOption({
    kind: 'best_time',
    title: locale === 'ar' ? 'أفضل توقيت' : 'Best time strategy',
    summary:
      locale === 'ar'
        ? `التوقيت المقترح: ${timing.goNowOrLater} بناءً على الموسم/الحشود/التأشيرة.`
        : `Suggested timing: ${timing.goNowOrLater} from season/crowds/visa priors.`,
    why: [...season.notes, ...visa.notes.slice(0, 1)],
    whyNot: [
      ...commonWhyNot,
      locale === 'ar'
        ? 'لا نختلق تقويم عطل غير متوفر.'
        : 'We do not invent an unavailable holiday calendar.',
    ],
    tradeoffs: holiday.notes.slice(0, 2),
    risks: risk.riskNotes.slice(0, 2),
    opportunityCost: opportunity.notes.slice(0, 2),
    expectedValue: [
      locale === 'ar'
        ? 'قيمة التوقيت عبر طقس أفضل وحشود أقل عند توفر المعرفة.'
        : 'Timing value via better weather and lower crowds when knowledge exists.',
    ],
    scores: mkScores({
      budget: budget.budgetScore,
      comfort: comfort.comfortScore,
      time: Math.min(95, timing.timeScore + 10),
      convenience: flights.convenience,
      experience: experienceBase,
      weather: Math.min(95, season.weatherScore + 10),
      crowds: Math.min(95, season.crowdScore + 10),
      transportation: transportScore,
      flexibility: split.flexibility,
    }),
    missing,
    clarification,
    evidence: ev,
    levers: {
      ...primaryLevers,
      goNowOrLater: timing.goNowOrLater,
      timingNote: season.notes[0] ?? timing.notes[0] ?? null,
    },
    now,
  })

  const alternative = buildOption({
    kind: 'alternative',
    title: locale === 'ar' ? 'استراتيجية بديلة' : 'Alternative strategy',
    summary:
      timing.goNowOrLater === 'now'
        ? (locale === 'ar'
          ? 'بديل: أجّل قليلاً إن كانت الحشود/التأشيرة تضغط القيمة.'
          : 'Alternative: delay slightly if crowds/visa pressure value.')
        : (locale === 'ar'
          ? 'بديل: سافر في النافذة الحالية مع تقليل التنقل.'
          : 'Alternative: travel in the current window with fewer transfers.'),
    why: [
      timing.goNowOrLater === 'now'
        ? (locale === 'ar' ? 'تقليل ضغط الذروة قد يرفع الراحة.' : 'Easing peak pressure may raise comfort.')
        : (locale === 'ar' ? 'التنفيذ السريع قد يناسب قراراً واضحاً.' : 'Faster execution may suit a clear decision.'),
      ...split.notes.slice(0, 1),
    ],
    whyNot: commonWhyNot,
    tradeoffs: [
      locale === 'ar'
        ? 'البديل يقايض التوقيت مقابل السرعة أو العكس.'
        : 'Alternative trades timing versus speed (or the reverse).',
    ],
    risks: risk.riskNotes.slice(0, 2),
    opportunityCost: opportunity.notes.slice(0, 2),
    expectedValue: [
      locale === 'ar'
        ? 'قيمة بديلة عبر تعديل التوقيت/التقسيم لا عبر وجهة جديدة.'
        : 'Alternative value via timing/split changes — not a new destination.',
    ],
    scores: mkScores({
      budget: budget.budgetScore,
      comfort: comfort.comfortScore,
      time: timing.timeScore,
      convenience: flights.convenience,
      experience: experienceBase,
      weather: season.weatherScore,
      crowds: season.crowdScore,
      transportation: transportScore,
      flexibility: Math.min(95, split.flexibility + 10),
      confidence: baseConf * 0.92,
    }),
    missing,
    clarification,
    evidence: ev,
    levers: {
      ...primaryLevers,
      goNowOrLater: timing.goNowOrLater === 'now' ? 'later' : 'now',
      splitItinerary: split.splitItinerary === true ? false : split.splitItinerary,
    },
    now,
  })

  const byKind: TravelStrategyResult['byKind'] = {
    primary,
    alternative,
    budget: budgetOpt,
    comfort: comfortOpt,
    luxury: luxuryOpt,
    fastest: fastestOpt,
    highest_value: valueOpt,
    lowest_risk: lowRiskOpt,
    best_time: bestTimeOpt,
  }

  const alternatives = [alternative, budgetOpt, comfortOpt, valueOpt, lowRiskOpt, bestTimeOpt, fastestOpt, luxuryOpt]

  let action: TravelStrategyResult['action'] = 'recommend_strategy'
  if (baseConf < 0.45 || missing.length >= 4) action = 'collect_information'
  else if (Math.abs(primary.scores.overallValue - valueOpt.scores.overallValue) < 5) {
    action = 'compare_strategies'
  }

  return {
    locale,
    timestamp: isoNow(now),
    destinationContext: ctx.destinationLabel ?? null,
    primary: action === 'collect_information' ? { ...primary, summary: locale === 'ar'
      ? 'الثقة منخفضة — اجمع المعلومات قبل اعتماد الاستراتيجية.'
      : 'Confidence is low — collect information before adopting a strategy.' } : primary,
    alternatives,
    byKind,
    overallConfidence: baseConf,
    missingInformation: missing,
    suggestedClarification: clarification,
    action,
  }
}

export function tryRunTravelStrategyEngine(
  ctx: TravelStrategyContext,
): TravelStrategyResult | null {
  if (!isTravelStrategyEnabled({ enabled: ctx.enabled })) return null
  return runTravelStrategyEngine(ctx)
}

export const TravelStrategyEngine = {
  run: runTravelStrategyEngine,
  tryRun: tryRunTravelStrategyEngine,
  format: formatStrategyResult,
}
