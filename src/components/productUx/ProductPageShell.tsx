import type { ReactNode } from 'react'
import { BottomNavigation } from '../../design-system'
import { Atmosphere } from './Atmosphere'
import { ProductAppBar, type ProductAppBarProps } from './ProductAppBar'

export interface ProductPageShellProps extends ProductAppBarProps {
  children: ReactNode
  mainClassName?: string
  maxWidthClassName?: string
}

/** Shared Bilamo product page frame for secondary surfaces. */
export function ProductPageShell({
  children,
  mainClassName = '',
  maxWidthClassName = 'max-w-4xl',
  ...bar
}: ProductPageShellProps) {
  return (
    <div data-testid="product-page-shell" className="bilamo-root text-[var(--bilamo-text)]">
      <Atmosphere variant="page" className="min-h-screen pb-28">
        <ProductAppBar {...bar} maxWidthClassName={maxWidthClassName} />
        <main
          className={`relative z-10 mx-auto px-4 py-6 sm:px-6 ${maxWidthClassName} ${mainClassName}`}
        >
          {children}
        </main>
        <BottomNavigation />
      </Atmosphere>
    </div>
  )
}
