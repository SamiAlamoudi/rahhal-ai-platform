/**
 * Sprint 121 — Premium Home theme helpers (presentation only).
 * Uses system Canvas colors + CSS variables for light/dark compatibility.
 */

import type { CSSProperties } from 'react'
import { animation, elevation, radius, spacing, typography } from '../tokens'

export const SPRINT121_PREMIUM_HOME_VERSION = '1.0.0-premium-home'

export const PREMIUM_HOME_SECTIONS = [
  'hero',
  'conversation_entry',
  'continue_conversation',
  'recent_trips',
  'upcoming_trips',
  'suggested_destinations',
  'travel_inspiration',
  'recommended_actions',
  'quick_actions',
  'smart_search',
  'featured_experiences',
] as const

export type PremiumHomeSectionId = (typeof PREMIUM_HOME_SECTIONS)[number]

/** Semantic colors that follow `color-scheme` / Canvas without hardcoded fills. */
export const homeColors = {
  fg: 'var(--ui-home-fg, CanvasText)',
  fgMuted: 'var(--ui-home-fg-muted, color-mix(in srgb, CanvasText 62%, transparent))',
  surface: 'var(--ui-home-surface, color-mix(in srgb, Canvas 92%, transparent))',
  surfaceElevated: 'var(--ui-home-surface-elevated, Canvas)',
  border: 'var(--ui-home-border, color-mix(in srgb, CanvasText 12%, transparent))',
  brand: 'var(--ui-home-brand, #1c80f0)',
  brandSoft: 'var(--ui-home-brand-soft, color-mix(in srgb, #1c80f0 14%, Canvas))',
  brandDeep: 'var(--ui-home-brand-deep, #122e57)',
  accent: 'var(--ui-home-accent, #de9106)',
  focus: 'var(--ui-home-focus, #1569de)',
} as const

export const homeMotion = {
  enter: `ui-home-fade-in ${animation.duration.normal}ms ${animation.easing.standard}`,
  hover: `transform ${animation.duration.fast}ms ${animation.easing.standard}, box-shadow ${animation.duration.fast}ms ${animation.easing.standard}, background-color ${animation.duration.fast}ms ${animation.easing.standard}`,
  staggerMs: 40,
} as const

export function homePageStyle(): CSSProperties {
  return {
    minHeight: '100%',
    color: homeColors.fg,
    backgroundImage: `
      radial-gradient(120% 80% at 100% 0%, color-mix(in srgb, #1c80f0 18%, transparent), transparent 55%),
      linear-gradient(180deg, color-mix(in srgb, #122e57 6%, Canvas), Canvas 42%)
    `,
    paddingBlock: spacing['2xl'],
    paddingInline: `max(${spacing.lg}px, env(safe-area-inset-left))`,
    fontFamily: typography.family.body,
  }
}

export function homeShellStyle(): CSSProperties {
  return {
    width: '100%',
    maxWidth: 1120,
    marginInline: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing['2xl'],
  }
}

export function homeCardStyle(options?: { interactive?: boolean }): CSSProperties {
  return {
    background: homeColors.surfaceElevated,
    border: `1px solid ${homeColors.border}`,
    borderRadius: radius.xl,
    boxShadow: elevation.sm,
    padding: spacing.lg,
    color: homeColors.fg,
    transition: options?.interactive ? homeMotion.hover : undefined,
  }
}

export function homeChipStyle(): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
    border: `1px solid ${homeColors.border}`,
    background: homeColors.brandSoft,
    color: homeColors.fg,
    paddingBlock: spacing.sm,
    paddingInline: spacing.md,
    fontFamily: typography.family.body,
    fontSize: typography.size.sm,
    fontWeight: typography.weight.semibold,
    cursor: 'pointer',
    transition: homeMotion.hover,
  }
}
