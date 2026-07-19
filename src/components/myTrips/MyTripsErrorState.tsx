export interface MyTripsErrorStateProps {
  message: string
  onRetry: () => void
  locale?: 'ar' | 'en'
}

export function MyTripsErrorState({ message, onRetry, locale = 'ar' }: MyTripsErrorStateProps) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-6 text-center">
      <p className="text-sm font-bold text-rose-700">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-xl border border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50"
      >
        {locale === 'ar' ? 'إعادة المحاولة' : 'Retry'}
      </button>
    </div>
  )
}
