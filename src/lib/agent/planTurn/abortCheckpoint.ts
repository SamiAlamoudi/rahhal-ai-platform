export function assertTurnNotAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return
  const error = new Error('Travel agent turn aborted')
  error.name = 'AbortError'
  throw error
}
