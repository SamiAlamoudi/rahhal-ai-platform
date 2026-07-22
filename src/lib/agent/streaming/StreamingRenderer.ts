/**
 * Sprint 116 — StreamingRenderer
 * Turns streaming events into progressive conversation lines (no UI dependency).
 */

import type { StreamingEvent } from './StreamingEvents'
import { getStreamingStageDefinition } from './StreamingStage'

export function renderStreamingEvent(event: StreamingEvent): string {
  switch (event.kind) {
    case 'started':
      return event.message || getStreamingStageDefinition(event.stage).startedMessage
    case 'progress':
      return `${getStreamingStageDefinition(event.stage).label}… ${event.progressPercent}%`
    case 'completed':
      return `✓ ${event.message || getStreamingStageDefinition(event.stage).completedMessage}`
    case 'skipped':
      return `↷ Skipped ${getStreamingStageDefinition(event.stage).label}`
    case 'warning':
      return `⚠ ${event.warning || event.message}`
    case 'error':
      return `✕ ${event.error || event.message}`
    default:
      return event.message
  }
}

export function renderStreamingTranscript(
  events: readonly StreamingEvent[],
): string[] {
  return events.map(renderStreamingEvent)
}

export class StreamingRenderer {
  render(event: StreamingEvent): string {
    return renderStreamingEvent(event)
  }

  transcript(events: readonly StreamingEvent[]): string[] {
    return renderStreamingTranscript(events)
  }
}

export function createStreamingRenderer(): StreamingRenderer {
  return new StreamingRenderer()
}
