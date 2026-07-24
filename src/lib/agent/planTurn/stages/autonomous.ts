import { upsertTravelGoal } from '../../autonomous'
import type { PlanTurnContext, PlanTurnDeps } from '../context'

export function autonomous(ctx: PlanTurnContext, deps: PlanTurnDeps): void {
  // Sprint 54 — keep the travel goal alive across clarification turns.
  if (deps.isAutonomousEnabled()) {
    const goal = upsertTravelGoal({
      conversationId: ctx.input.conversationId,
      userText: ctx.userText,
      memory: ctx.memory,
      priorGoal: ctx.autonomousSnapshot?.goal ?? ctx.priorAutonomous?.goal ?? null,
    })
    if (!ctx.autonomousSnapshot || ctx.autonomousSnapshot.outcome === 'blocked' || !ctx.autonomousSnapshot.plan) {
      ctx.autonomousSnapshot = {
        state: 'COMPLETE',
        progressPhase: ctx.objective === 'collect_missing' ? 'Completed' : (ctx.autonomousSnapshot?.progressPhase ?? 'Thinking'),
        goal,
        plan: ctx.autonomousSnapshot?.plan ?? null,
        completedTaskIds: ctx.autonomousSnapshot?.completedTaskIds ?? ctx.priorAutonomous?.completedTaskIds ?? [],
        pendingTaskIds: ctx.autonomousSnapshot?.pendingTaskIds ?? ctx.priorAutonomous?.pendingTaskIds ?? [],
        lastProviderId: ctx.autonomousSnapshot?.lastProviderId ?? ctx.priorAutonomous?.lastProviderId ?? null,
        totalRetries: ctx.autonomousSnapshot?.totalRetries ?? ctx.priorAutonomous?.totalRetries ?? 0,
        durationMs: ctx.autonomousSnapshot?.durationMs ?? 0,
        outcome: ctx.objective === 'collect_missing' ? 'blocked' : (ctx.autonomousSnapshot?.outcome ?? 'ok'),
        logs: ctx.autonomousSnapshot?.logs ?? ctx.priorAutonomous?.logs ?? [],
        recoveredFromFailures: ctx.autonomousSnapshot?.recoveredFromFailures
          ?? ctx.priorAutonomous?.recoveredFromFailures
          ?? false,
      }
    } else {
      ctx.autonomousSnapshot = { ...ctx.autonomousSnapshot, goal }
    }
  }
}
