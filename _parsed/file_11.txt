import { useState } from 'react'

const SUGGESTIONS = [
  { id: 'vacation', label: '🏖 عطلة' },
  { id: 'family', label: '👨‍👩‍👧‍👦 عائلة' },
  { id: 'business', label: '💼 عمل' },
  { id: 'honeymoon', label: '❤️ شهر عسل' },
  { id: 'novisa', label: '🌍 بدون تأشيرة' },
  { id: 'adventure', label: '🗺 مغامرة' },
]

interface Props {
  value: string
  onChange: (value: string) => void
  onStartPlanning: () => void
}

export default function TravelConversationCard({ value, onChange, onStartPlanning }: Props) {
  const [focused, setFocused] = useState(false)
  const [activeChip, setActiveChip] = useState<string | null>(null)

  const handleChipClick = (chip: { id: string; label: string }) => {
    setActiveChip(chip.id === activeChip ? null : chip.id)
  }

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-2xl shadow-slate-900/5 sm:p-7">
      <div className="text-center">
        <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">
          إلى أين تحلم أن تسافر؟
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-500 sm:text-base">
          اكتب رحلتك بطريقتك... ورحّال سيفكر ويخطط لك.
        </p>
      </div>

      <div
        className={`mt-5 rounded-2xl border-2 bg-slate-50 transition-all duration-200 ${
          focused ? 'border-primary-500 bg-white shadow-md shadow-primary-500/10' : 'border-slate-200'
        }`}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={4}
          placeholder={`مثال:
أريد السفر إلى اليابان لمدة 10 أيام مع العائلة وميزانيتي ٢٠ ألف ريال.`}
          className="w-full resize-none rounded-2xl bg-transparent px-4 py-3.5 text-right text-sm leading-relaxed text-slate-800 placeholder:text-slate-400 focus:outline-none sm:text-base"
        />
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            onClick={() => handleChipClick(chip)}
            className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all duration-200 active:scale-95 ${
              activeChip === chip.id
                ? 'border-primary-500 bg-primary-50 text-primary-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:bg-primary-50/50 hover:text-primary-600'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onStartPlanning}
          className="group inline-flex items-center gap-2 rounded-2xl bg-primary-600 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-primary-600/30 transition-all duration-200 hover:bg-primary-700 hover:shadow-xl hover:shadow-primary-600/40 active:scale-95"
        >
          ابدأ التخطيط
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}
