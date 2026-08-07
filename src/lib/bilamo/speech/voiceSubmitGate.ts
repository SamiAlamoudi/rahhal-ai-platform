/**
 * Voice submit gate — prevents orb "stuck recovery" from killing an in-flight turn.
 * Pure helpers for regression tests (no React).
 */

export type VoiceSubmitGateInput = {
  /** Final transcript received; chat send not finished yet. */
  voiceSubmitInFlight: boolean
  sendLocked: boolean
  busy: boolean
  voiceState: string
  orbState: string
}

/**
 * True when a second orb tap must be ignored (not barge-in).
 * Covers the race: EOS → processing → (submit not busy yet) → user taps →
 * previous "voiceStuck" workaround called bargeIn and dropped the request.
 */
export function shouldIgnoreOrbTapDuringVoiceSubmit(input: VoiceSubmitGateInput): boolean {
  if (input.voiceSubmitInFlight || input.sendLocked) return true
  if (input.busy || input.orbState === 'thinking') return true
  return false
}

/**
 * Barge-in is only for audible speaking. Never treat processing/thinking as stuck
 * while a voice submit is in flight — that cancelled backend requests on real devices.
 */
export function shouldBargeInFromOrb(input: VoiceSubmitGateInput): boolean {
  if (input.voiceSubmitInFlight || input.sendLocked || input.busy) return false
  return input.orbState === 'speaking' || input.voiceState === 'speaking'
}
