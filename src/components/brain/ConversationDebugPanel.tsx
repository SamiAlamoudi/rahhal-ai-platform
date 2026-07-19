import type { BrainResponsePlan, ConversationContext, IntentClassification } from '../../lib/brain'
import { IntentViewer } from './IntentViewer'
import { MemoryViewer } from './MemoryViewer'
import { PlannerViewer } from './PlannerViewer'

export interface ConversationDebugPanelProps {
  context: ConversationContext
  classification?: IntentClassification | null
  plan?: BrainResponsePlan | null
  className?: string
}

/**
 * Debug panel for Sprint 19 brain — gated by brain.debug (not mounted in prod routes).
 */
export function ConversationDebugPanel({
  context,
  classification = null,
  plan = null,
  className = '',
}: ConversationDebugPanelProps) {
  return (
    <aside
      data-testid="brain-debug-panel"
      className={`space-y-3 rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-sm ${className}`}
    >
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900">Conversation Brain Debug</h2>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-500">
          {context.conversationId.slice(0, 12)}
        </span>
      </header>
      <IntentViewer
        intent={classification?.intent ?? context.lastIntent}
        confidence={classification?.confidence ?? null}
        signals={classification?.signals ?? []}
      />
      <MemoryViewer memory={context.memory} missingFields={context.missingFields} />
      <PlannerViewer plan={plan} />
    </aside>
  )
}
