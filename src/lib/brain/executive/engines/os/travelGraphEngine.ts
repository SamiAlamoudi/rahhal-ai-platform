/**
 * Sprint 52 — Travel Graph Engine.
 */

import { buildTravelGraph, relatedDestinations } from '../../os/travelGraph'
import type {
  ExecutiveEngine,
  ExecutiveEngineMetadata,
} from '../../platform/engineContract'

export function createTravelGraphEngine(): ExecutiveEngine {
  const meta: ExecutiveEngineMetadata = {
    engineId: 'travel_graph',
    version: '1.0.0',
    name: 'Travel Graph Engine',
    description: 'Graph relationships across destinations, airports, hotels, airlines, and activities.',
  }

  return {
    metadata: () => meta,

    analyze(ctx) {
      const graph = buildTravelGraph()
      const focus = ctx.reasoningResult?.primary?.id
        ?? ctx.memory.requirements.destination
        ?? null
      const related = focus
        ? relatedDestinations(focus, 'similar_climate', 3)
        : []
      return {
        engineId: 'travel_graph',
        findings: related,
        signals: {
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          focus,
          related,
        },
        priority: focus ? 'medium' : 'low',
      }
    },

    plan(ctx, analysis) {
      if (!analysis.signals.focus && analysis.findings.length === 0) {
        return { engineId: 'travel_graph', actions: [], alternatives: [] }
      }
      return {
        engineId: 'travel_graph',
        actions: [{
          id: 'graph_relations',
          description: ctx.locale === 'ar'
            ? 'استخراج علاقات السفر من الرسم البياني'
            : 'Extract travel relationships from the graph',
          priority: 'medium',
        }],
        alternatives: analysis.findings,
      }
    },

    execute(ctx, plan) {
      if (plan.actions.length === 0) {
        return {
          engineId: 'travel_graph',
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

      const graph = buildTravelGraph()
      const focus = ctx.reasoningResult?.primary?.id
        ?? ctx.memory.requirements.destination
        ?? graph.nodes.find((n) => n.kind === 'destination')?.id.replace(/^dest:/, '')
      const climatePeers = focus ? relatedDestinations(focus, 'similar_climate', 3) : []
      const visaPeers = focus ? relatedDestinations(focus, 'visa_peer', 3) : []
      const fragment = ctx.locale === 'ar'
        ? `رسم السفر: ${graph.nodes.length} عقدة / ${graph.edges.length} علاقة. نظراء مناخيون: ${climatePeers.join(', ') || '—'}.`
        : `Travel graph: ${graph.nodes.length} nodes / ${graph.edges.length} edges. Climate peers: ${climatePeers.join(', ') || '—'}.`

      return {
        engineId: 'travel_graph',
        applied: true,
        effects: ['graph_snapshot'],
        replyFragment: fragment,
        alerts: [],
        recommendations: climatePeers.slice(0, 2).map((id) => ({
          title: id,
          why: [ctx.locale === 'ar' ? 'تشابه مناخي في الرسم' : 'Climate similarity in graph'],
          pros: [],
          cons: [],
          tradeoffs: [],
          confidence: 0.72,
        })),
        memoryNotes: [],
        nextBestAction: null,
        metadata: {
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          climatePeers,
          visaPeers,
          kinds: [...new Set(graph.nodes.map((n) => n.kind))],
        },
      }
    },

    confidence(_ctx, analysis) {
      return Number(analysis.signals.nodeCount ?? 0) > 0 ? 0.91 : 0.2
    },
  }
}
