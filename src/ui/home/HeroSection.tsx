/**
 * Sprint 121 — Hero AI greeting (brand-first, no cards overlay).
 */

import type { ReactNode } from 'react'
import { UiStack, UiText } from '../common'
import { radius, spacing, typography } from '../tokens'
import { homeColors, homeMotion } from './homeTheme'

export interface HeroSectionProps {
  brandName?: string
  greeting: string
  insight?: string | null
  primaryAction?: ReactNode
  secondaryAction?: ReactNode
  className?: string
}

export function HeroSection({
  brandName = 'رحّال',
  greeting,
  insight,
  primaryAction,
  secondaryAction,
  className,
}: HeroSectionProps) {
  return (
    <header
      className={className}
      data-ui="home-hero"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius.xl,
        paddingBlock: spacing['3xl'],
        paddingInline: spacing['2xl'],
        color: '#f8fafc',
        backgroundImage: `
          linear-gradient(135deg, ${homeColors.brandDeep} 0%, #1755b4 48%, ${homeColors.brand} 100%)
        `,
        isolation: 'isolate',
        maxWidth: '100%',
        boxSizing: 'border-box',
        animation: homeMotion.enter,
        animationFillMode: 'backwards',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          insetInlineEnd: '-12%',
          insetBlockStart: '-30%',
          width: '58%',
          maxWidth: '100%',
          height: '140%',
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,255,255,0.16) 0%, transparent 68%)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <UiStack gap="lg" style={{ position: 'relative', zIndex: 1, maxWidth: 640, minWidth: 0 }}>
        <UiText
          as="p"
          size="sm"
          weight="semibold"
          style={{
            margin: 0,
            letterSpacing: '0.04em',
            color: 'rgba(248, 250, 252, 0.78)',
            fontFamily: typography.family.display,
          }}
        >
          مساعدك الذكي للسفر
        </UiText>
        <UiText
          as="h1"
          size="3xl"
          weight="bold"
          style={{
            margin: 0,
            fontFamily: typography.family.display,
            lineHeight: typography.lineHeight.tight,
            color: '#ffffff',
          }}
        >
          {brandName}
        </UiText>
        <UiText
          as="p"
          size="xl"
          weight="semibold"
          style={{
            margin: 0,
            color: 'rgba(248, 250, 252, 0.95)',
            maxWidth: '36ch',
          }}
        >
          {greeting}
        </UiText>
        {insight ? (
          <UiText
            as="p"
            size="sm"
            style={{ margin: 0, color: 'rgba(248, 250, 252, 0.78)', maxWidth: '48ch' }}
          >
            {insight}
          </UiText>
        ) : null}
        {primaryAction || secondaryAction ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: spacing.sm,
              marginTop: spacing.sm,
            }}
          >
            {primaryAction}
            {secondaryAction}
          </div>
        ) : null}
      </UiStack>
    </header>
  )
}
