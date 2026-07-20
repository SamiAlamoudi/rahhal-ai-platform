/**
 * Sprint 52 — Self Review Engine.
 * Runs last; improves the composed response once.
 */

import type { SelfReviewFinding } from '../../os/types'
import type {
  EngineRunResult,
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../../platform/engineContract'

export function createSelfReviewEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'self_review',
    version: '1.0.0',
    name: 'Self Review Engine',
    description: 'Pre-response review for accuracy, consistency, hallucination risk, and weak recommendations.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const findings: string[] = []
      if (!ctx.userText.trim()) findings.push('missing:user_text')
      if (ctx.profile.travelStyle.rejectedDestinations.some((d) =>
        (ctx.reasoningResult?.primary?.name ?? '').toLowerCase().includes(d.toLowerCase()))) {
        findings.push('conflict:rejected_primary')
      }
      return {
        engineId: 'self_review',
        findings,
        signals: { pendingReview: true },
        priority: findings.length > 0 ? 'high' : 'medium',
      }
    },

    plan(ctx) {
      return {
        engineId: 'self_review',
        actions: [{
          id: 'review_once',
          description: ctx.locale === 'ar'
            ? 'مراجعة ذاتية وتحسين واحد للرد'
            : 'Self-review and improve the reply once',
          priority: 'high',
        }],
        alternatives: [],
      }
    },

    execute(ctx) {
      // Standalone execute collects lightweight findings; orchestrator calls improveReplyOnce.
      const findings = reviewDraft({
        locale: ctx.locale,
        userText: ctx.userText,
        reply: null,
        runs: [],
        rejectedDestinations: ctx.profile.travelStyle.rejectedDestinations,
        primaryName: ctx.reasoningResult?.primary?.name ?? null,
      })

      return {
        engineId: 'self_review',
        applied: true,
        effects: ['self_review'],
        replyFragment: null,
        alerts: findings
          .filter((f) => f.severity === 'high')
          .map((f) => ({
            priority: 'high' as const,
            message: f.message,
            category: 'self_review',
          })),
        recommendations: [],
        memoryNotes: [],
        nextBestAction: null,
        metadata: { findings, improvedOnce: false },
      }
    },

    confidence() {
      return 0.9
    },
  }
}

export function reviewDraft(input: {
  locale: 'ar' | 'en'
  userText: string
  reply: string | null
  runs: EngineRunResult[]
  rejectedDestinations: string[]
  primaryName: string | null
}): SelfReviewFinding[] {
  const { locale, reply, runs, rejectedDestinations, primaryName } = input
  const findings: SelfReviewFinding[] = []
  const ar = locale === 'ar'

  if (!reply || !reply.trim()) {
    findings.push({
      kind: 'missing',
      severity: 'medium',
      message: ar ? 'لا يوجد رد تنفيذي مركّب بعد' : 'No composed executive reply yet',
    })
  }

  const titles = runs.flatMap((run) => run.execution.recommendations.map((r) => r.title.toLowerCase()))
  const dupes = titles.filter((title, index) => titles.indexOf(title) !== index)
  if (dupes.length > 0) {
    findings.push({
      kind: 'duplicate',
      severity: 'low',
      message: ar
        ? `اقتراحات مكررة: ${[...new Set(dupes)].join(', ')}`
        : `Duplicate suggestions: ${[...new Set(dupes)].join(', ')}`,
    })
  }

  if (primaryName && rejectedDestinations.some((d) =>
    primaryName.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(primaryName.toLowerCase()))) {
    findings.push({
      kind: 'conflict',
      severity: 'high',
      message: ar
        ? `تعارض مع الذاكرة: ${primaryName} مرفوضة سابقاً`
        : `Memory conflict: ${primaryName} was previously rejected`,
    })
  }

  const weak = runs.flatMap((run) => run.execution.recommendations)
    .filter((row) => row.confidence < 0.45)
  if (weak.length > 0) {
    findings.push({
      kind: 'weak',
      severity: 'medium',
      message: ar
        ? `توصيات ضعيفة الثقة: ${weak.map((w) => w.title).join(', ')}`
        : `Low-confidence recommendations: ${weak.map((w) => w.title).join(', ')}`,
    })
  }

  const confidences = runs.map((run) => run.confidence)
  if (confidences.some((c) => c >= 0.95) && confidences.some((c) => c <= 0.3)) {
    findings.push({
      kind: 'consistency',
      severity: 'low',
      message: ar
        ? 'تباين كبير في ثقة المحركات'
        : 'Large variance in engine confidence',
    })
  }

  if (reply && /\b(TODO|TBD|undefined|null)\b/i.test(reply)) {
    findings.push({
      kind: 'hallucination',
      severity: 'high',
      message: ar
        ? 'عناصر غير مكتملة في الرد'
        : 'Incomplete placeholder content in reply',
    })
  }

  if (reply && reply.length < 40 && runs.some((r) => r.execution.applied)) {
    findings.push({
      kind: 'accuracy',
      severity: 'medium',
      message: ar
        ? 'الرد أقصر من مخرجات المحركات — يحتاج إثراء'
        : 'Reply shorter than engine output — needs enrichment',
    })
  }

  return findings
}

export function improveReplyOnce(input: {
  locale: 'ar' | 'en'
  reply: string | null
  findings: SelfReviewFinding[]
  runs: EngineRunResult[]
}): { reply: string | null; improvedOnce: boolean; findings: SelfReviewFinding[] } {
  const { locale, findings, runs } = input
  let reply = input.reply
  if (!reply) {
    return { reply, improvedOnce: false, findings }
  }

  const ar = locale === 'ar'
  const additions: string[] = []
  let improvedOnce = false

  const conflict = findings.find((f) => f.kind === 'conflict')
  if (conflict) {
    const alt = runs
      .flatMap((run) => run.execution.recommendations)
      .find((row) => !conflict.message.includes(row.title))
    additions.push(ar
      ? `تصحيح: تجنّبنا الوجهة المرفوضة${alt ? ` وفضّلنا ${alt.title}` : ''}.`
      : `Correction: avoided the rejected destination${alt ? ` in favor of ${alt.title}` : ''}.`)
    improvedOnce = true
  }

  const weak = findings.find((f) => f.kind === 'weak')
  if (weak) {
    additions.push(ar
      ? 'تنبيه: بعض البدائل بثقة منخفضة — اعتبرها استطلاعية فقط.'
      : 'Note: some alternatives are low-confidence — treat as exploratory only.')
    improvedOnce = true
  }

  const missing = findings.find((f) => f.kind === 'accuracy' || f.kind === 'missing')
  if (missing && runs.length > 0) {
    const best = runs
      .flatMap((run) => run.execution.recommendations)[0]
    if (best && !reply.includes(best.title)) {
      additions.push(ar
        ? `إضافة: التوصية الأساسية ${best.title}.`
        : `Enrichment: primary recommendation ${best.title}.`)
      improvedOnce = true
    }
  }

  const hallucination = findings.find((f) => f.kind === 'hallucination')
  if (hallucination) {
    reply = reply.replace(/\b(TODO|TBD|undefined|null)\b/gi, ar ? '—' : '—')
    improvedOnce = true
  }

  if (additions.length > 0) {
    reply = `${reply}\n\n${ar ? 'مراجعة ذاتية:' : 'Self-review:'}\n${additions.join('\n')}`
  }

  return { reply, improvedOnce, findings }
}
