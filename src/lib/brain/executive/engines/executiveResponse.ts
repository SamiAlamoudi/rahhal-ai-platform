/**
 * Executive Response Engine — luxury consultant voice assembly.
 */

import type {
  EngineRunResult,
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../platform/engineContract'

export function createExecutiveResponseEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'executive_response',
    version: '1.0.0',
    name: 'Executive Response Engine',
    description: 'Composes senior luxury travel consultant replies from engine outputs.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      return {
        engineId: 'executive_response',
        findings: ctx.userText ? ['compose'] : [],
        signals: {},
        priority: 'medium',
      }
    },

    plan(ctx) {
      return {
        engineId: 'executive_response',
        actions: [{
          id: 'compose_reply',
          description: ctx.locale === 'ar'
            ? 'صياغة رد مستشار تنفيذي'
            : 'Compose executive consultant reply',
          priority: 'medium',
        }],
        alternatives: [],
      }
    },

    execute(_ctx) {
      // Standalone execute is a no-op; orchestrator calls composeExecutiveReply.
      return {
        engineId: 'executive_response',
        applied: false,
        effects: [],
        replyFragment: null,
        alerts: [],
        recommendations: [],
        memoryNotes: [],
        nextBestAction: null,
        metadata: {},
      }
    },

    confidence() {
      return 0.85
    },
  }
}

export function composeExecutiveReply(input: {
  locale: 'ar' | 'en'
  runs: EngineRunResult[]
  summaryHint?: string | null
}): string | null {
  const { locale, runs } = input
  const fragments = runs
    .map((run) => run.execution.replyFragment)
    .filter((line): line is string => Boolean(line && line.trim()))

  const alerts = runs.flatMap((run) => run.execution.alerts)
    .filter((a) => a.priority === 'critical' || a.priority === 'high')
  const recommendations = runs.flatMap((run) => run.execution.recommendations).slice(0, 3)
  const next = runs.map((run) => run.execution.nextBestAction).find(Boolean) ?? null
  const confidence = average(runs.map((run) => run.confidence))

  if (fragments.length === 0 && alerts.length === 0 && recommendations.length === 0) {
    return null
  }

  const blocks: string[] = []

  blocks.push(locale === 'ar'
    ? 'ملخص تنفيذي:'
    : 'Executive summary:')
  if (input.summaryHint) {
    blocks.push(input.summaryHint)
  } else if (fragments[0]) {
    blocks.push(fragments[0].split('\n')[0]!)
  }

  if (fragments.length > 0) {
    blocks.push('')
    blocks.push(locale === 'ar' ? 'التوصية والتفكير:' : 'Recommendation & reasoning:')
    for (const fragment of fragments.slice(0, 4)) {
      blocks.push(fragment)
    }
  }

  if (recommendations.length > 0) {
    blocks.push('')
    blocks.push(locale === 'ar' ? 'بدائل:' : 'Alternatives:')
    for (const row of recommendations) {
      blocks.push(`• ${row.title}${row.why[0] ? ` — ${row.why[0]}` : ''}`)
    }
  }

  if (alerts.length > 0) {
    blocks.push('')
    blocks.push(locale === 'ar' ? 'تحذيرات:' : 'Warnings:')
    for (const alert of alerts.slice(0, 3)) {
      blocks.push(`• [${alert.priority}] ${alert.message}`)
    }
  }

  blocks.push('')
  blocks.push(locale === 'ar'
    ? `الثقة: ${(confidence * 100).toFixed(0)}%`
    : `Confidence: ${(confidence * 100).toFixed(0)}%`)

  if (next) {
    blocks.push('')
    blocks.push(locale === 'ar' ? `الخطوة التالية: ${next}` : `Next: ${next}`)
  }

  return blocks.join('\n').trim()
}

function average(values: number[]): number {
  if (values.length === 0) return 0.5
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
