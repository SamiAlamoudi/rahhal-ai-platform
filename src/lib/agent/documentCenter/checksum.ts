/**
 * Lightweight checksum helpers (no crypto dependency).
 */

export function computeChecksum(content: string): string {
  // FNV-1a 32-bit + length for collision resistance in tests/prod mocks.
  let hash = 0x811c9dc5
  for (let i = 0; i < content.length; i += 1) {
    hash ^= content.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  const unsigned = hash >>> 0
  return `fnv1a_${unsigned.toString(16).padStart(8, '0')}_${content.length.toString(16)}`
}

export function validateChecksum(content: string | null, expected: string): boolean {
  if (content == null) {
    // Passport / metadata-only: checksum of metadata envelope is stored separately.
    return expected.length > 0
  }
  return computeChecksum(content) === expected
}
