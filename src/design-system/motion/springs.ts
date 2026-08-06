import type { Transition } from 'framer-motion'
import { springs } from '../tokens'

export const bilamoSprings = springs

/** Quiet enter — no blur gimmick. */
export const fadeUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 4 },
  transition: springs.soft as Transition,
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.99 },
  transition: springs.gentle as Transition,
}

export const glassReveal = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: springs.soft as Transition,
}

/** Optional micro-haptic on supported devices. Never required. */
export function bilamoHaptic(ms = 8) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ms)
    }
  } catch {
    /* ignore */
  }
}
