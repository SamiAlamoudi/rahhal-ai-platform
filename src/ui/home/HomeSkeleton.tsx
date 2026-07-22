/**
 * Sprint 121 — Premium Home loading skeleton.
 */

import { UiStack } from '../common'
import { Skeleton } from '../loading'
import { spacing } from '../tokens'
import { homeCardStyle, homePageStyle, homeShellStyle } from './homeTheme'

export interface HomeSkeletonProps {
  className?: string
}

export function HomeSkeleton({ className }: HomeSkeletonProps) {
  return (
    <main
      className={className}
      aria-busy="true"
      aria-label="جاري تحميل الصفحة الرئيسية"
      data-ui="home-skeleton"
      style={homePageStyle()}
    >
      <div style={homeShellStyle()}>
        <div style={{ ...homeCardStyle(), padding: spacing['2xl'] }}>
          <UiStack gap="md">
            <Skeleton height={18} width="18%" />
            <Skeleton height={36} width="52%" />
            <Skeleton height={16} width="70%" />
            <Skeleton height={48} width="40%" />
          </UiStack>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: spacing.lg,
          }}
        >
          <div style={homeCardStyle()}>
            <UiStack gap="sm">
              <Skeleton height={20} width="40%" />
              <Skeleton height={72} />
            </UiStack>
          </div>
          <div style={homeCardStyle()}>
            <UiStack gap="sm">
              <Skeleton height={20} width="45%" />
              <Skeleton height={72} />
            </UiStack>
          </div>
        </div>
        <div style={homeCardStyle()}>
          <UiStack gap="sm">
            <Skeleton height={20} width="30%" />
            <Skeleton height={44} />
            <Skeleton height={44} />
          </UiStack>
        </div>
      </div>
    </main>
  )
}
