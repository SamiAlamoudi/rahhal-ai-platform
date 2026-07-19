/** Production-ready confirmation references until/unless supplier PNR replaces them. */

export function generateConfirmationReference(sessionId: string): string {
  const compact = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase() || 'PENDING'
  return `RHL-CONF-${compact}`
}

export function resolveConfirmationReference(input: {
  sessionId: string
  supplierReference?: string | null
  existing?: string | null
}): string {
  if (input.supplierReference && input.supplierReference.trim()) {
    return input.supplierReference.trim()
  }
  if (input.existing && input.existing.trim()) {
    return input.existing.trim()
  }
  return generateConfirmationReference(input.sessionId)
}
