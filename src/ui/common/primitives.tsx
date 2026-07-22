/**
 * Sprint 119 — shared presentational primitives (no business logic).
 */

import type { CSSProperties, ReactNode } from 'react'
import {
  componentSize,
  elevation,
  radius,
  spacing,
  typography,
} from '../tokens'

export type UiTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger'

export interface UiSurfaceProps {
  children?: ReactNode
  elevated?: boolean
  padded?: boolean
  className?: string
  style?: CSSProperties
  'data-testid'?: string
}

export function UiSurface({
  children,
  elevated = false,
  padded = true,
  className,
  style,
  ...rest
}: UiSurfaceProps) {
  return (
    <div
      className={className}
      data-ui="surface"
      style={{
        borderRadius: radius.lg,
        boxShadow: elevated ? elevation.md : elevation.none,
        padding: padded ? spacing.lg : spacing.none,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

export interface UiStackProps {
  children?: ReactNode
  gap?: keyof typeof spacing
  direction?: 'vertical' | 'horizontal'
  className?: string
  style?: CSSProperties
}

export function UiStack({
  children,
  gap = 'md',
  direction = 'vertical',
  className,
  style,
}: UiStackProps) {
  return (
    <div
      className={className}
      data-ui="stack"
      style={{
        display: 'flex',
        flexDirection: direction === 'vertical' ? 'column' : 'row',
        gap: spacing[gap],
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export interface UiTextProps {
  children?: ReactNode
  size?: keyof typeof typography.size
  weight?: keyof typeof typography.weight
  as?: 'p' | 'span' | 'h1' | 'h2' | 'h3' | 'h4' | 'label'
  className?: string
  style?: CSSProperties
}

export function UiText({
  children,
  size = 'md',
  weight = 'regular',
  as: Tag = 'p',
  className,
  style,
}: UiTextProps) {
  return (
    <Tag
      className={className}
      data-ui="text"
      style={{
        margin: 0,
        fontFamily: typography.family.body,
        fontSize: typography.size[size],
        fontWeight: typography.weight[weight],
        lineHeight: typography.lineHeight.normal,
        ...style,
      }}
    >
      {children}
    </Tag>
  )
}

export interface UiButtonProps {
  children?: ReactNode
  size?: keyof typeof componentSize.controlHeight
  disabled?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
  className?: string
  style?: CSSProperties
  'aria-label'?: string
}

export function UiButton({
  children,
  size = 'md',
  disabled,
  type = 'button',
  onClick,
  className,
  style,
  ...rest
}: UiButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={className}
      data-ui="button"
      style={{
        height: componentSize.controlHeight[size],
        borderRadius: radius.md,
        paddingInline: spacing.lg,
        fontFamily: typography.family.body,
        fontSize: typography.size.sm,
        fontWeight: typography.weight.semibold,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
