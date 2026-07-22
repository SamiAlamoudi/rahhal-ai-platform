/**
 * Sprint 121 — reusable Home section shell (presentation only).
 */

import type { CSSProperties, ReactNode } from 'react'
import { UiStack, UiText } from '../common'
import { typography } from '../tokens'
import {
  homeCardStyle,
  homeColors,
  homeMotion,
  type PremiumHomeSectionId,
} from './homeTheme'

export interface PremiumHomeSectionProps {
  sectionId: PremiumHomeSectionId
  title?: string
  description?: string
  children?: ReactNode
  className?: string
  style?: CSSProperties
  bare?: boolean
  index?: number
}

export function HomeSection({
  sectionId,
  title,
  description,
  children,
  className,
  style,
  bare = false,
  index = 0,
}: PremiumHomeSectionProps) {
  return (
    <section
      className={className}
      data-ui-premium-home-section={sectionId}
      aria-labelledby={title ? `home-section-${sectionId}` : undefined}
      style={{
        ...(bare ? null : homeCardStyle()),
        position: 'relative',
        isolation: 'isolate',
        minWidth: 0,
        maxWidth: '100%',
        boxSizing: 'border-box',
        // Opacity-only enter — avoid translateY stacking overlaps on mobile Safari.
        animation: homeMotion.enter,
        animationDelay: `${index * homeMotion.staggerMs}ms`,
        animationFillMode: 'backwards',
        ...style,
      }}
    >
      <UiStack gap="md">
        {title || description ? (
          <UiStack gap="xs">
            {title ? (
              <h2
                id={`home-section-${sectionId}`}
                style={{
                  margin: 0,
                  fontFamily: typography.family.display,
                  fontSize: typography.size.lg,
                  fontWeight: typography.weight.semibold,
                  color: homeColors.fg,
                }}
              >
                {title}
              </h2>
            ) : null}
            {description ? (
              <UiText size="sm" style={{ color: homeColors.fgMuted }}>
                {description}
              </UiText>
            ) : null}
          </UiStack>
        ) : null}
        {children}
      </UiStack>
    </section>
  )
}
