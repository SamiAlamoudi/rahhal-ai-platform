import { DsText } from '../../design-system/components/primitives'
import type { BrainTurnTrace } from '../../brain'

export function MemoryDebugPanel({
  enabled,
  trace,
}: {
  enabled: boolean
  trace: BrainTurnTrace | null
}) {
  if (!enabled || !trace) return null
  const payload = {
    intent: trace.intent,
    entities: trace.entities,
    preferences: trace.preferences,
    memory: {
      lastMentionedOptions: trace.shortTerm.lastMentionedOptions,
      draft: trace.draft,
      turns: trace.shortTerm.recentTurns.length,
    },
    context: trace.references,
    decision: trace.decision,
  }
  return (
    <aside
      className="rh-glass-signature"
      style={{
        padding: 12,
        borderRadius: 'var(--ds-radius-lg)',
        maxHeight: 220,
        overflow: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      }}
    >
      <DsText variant="micro" tone="primary" style={{ letterSpacing: '0.08em' }}>
        MEMORY DEBUG · DEV
      </DsText>
      <pre
        style={{
          margin: '8px 0 0',
          fontSize: 11,
          lineHeight: 1.45,
          whiteSpace: 'pre-wrap',
          color: 'var(--ds-ink-secondary)',
        }}
      >
        {JSON.stringify(payload, null, 2)}
      </pre>
    </aside>
  )
}
