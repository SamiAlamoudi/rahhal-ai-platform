import { assertTurnNotAborted } from './abortCheckpoint'

type MaybePromise<T> = T | Promise<T>
type StageRunner<T> = () => MaybePromise<T>

export function stageInitMemory<T>(
  signal: AbortSignal | undefined,
  run: () => T,
): T {
  const result = run()
  assertTurnNotAborted(signal)
  return result
}

export function stagePreBrainEnrichers<T>(run: () => T): T {
  return run()
}

export async function stageRahhalBrain<T>(run: StageRunner<T>): Promise<T> {
  return run()
}

export async function stageBrainPipeline<T>(run: StageRunner<T>): Promise<T> {
  return run()
}

export async function stageEarlyIntentRouters<T>(run: StageRunner<T>): Promise<T> {
  return run()
}

export async function stageConcierge<T>(
  signal: AbortSignal | undefined,
  run: StageRunner<T>,
): Promise<T> {
  assertTurnNotAborted(signal)
  return run()
}

export async function stageLlmAndTools<T>(
  signal: AbortSignal | undefined,
  run: StageRunner<T>,
): Promise<T> {
  assertTurnNotAborted(signal)
  return run()
}

export function stageAutonomous<T>(run: () => T): T {
  return run()
}

export function stagePresentation<T>(run: () => T): T {
  return run()
}

export async function stageFinalSpeak<T>(
  signal: AbortSignal | undefined,
  run: StageRunner<T>,
): Promise<T> {
  assertTurnNotAborted(signal)
  return run()
}
