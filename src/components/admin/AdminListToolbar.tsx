interface StatusOption {
  value: string
  label: string
}

interface AdminListToolbarProps {
  searchId: string
  searchValue: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  statusValue: string
  onStatusChange: (value: string) => void
  statusOptions: StatusOption[]
}

export default function AdminListToolbar({
  searchId,
  searchValue,
  onSearchChange,
  searchPlaceholder,
  statusValue,
  onStatusChange,
  statusOptions,
}: AdminListToolbarProps) {
  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_12rem]">
      <div>
        <label className="sr-only" htmlFor={searchId}>بحث</label>
        <input
          id={searchId}
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
        />
      </div>
      <div>
        <label className="sr-only" htmlFor={`${searchId}-status`}>الحالة</label>
        <select
          id={`${searchId}-status`}
          value={statusValue}
          onChange={(e) => onStatusChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-400/20"
        >
          {statusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
