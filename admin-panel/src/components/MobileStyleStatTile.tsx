import type { ReactNode } from 'react'

/** Mobil park özet kartları ile uyumlu kutu (başlık + büyük değer, sağ alt ikon). */
export default function MobileStyleStatTile({
  label,
  value,
  icon,
  className,
  iconClass,
}: {
  label: string
  value: string | number
  icon: ReactNode
  className: string
  iconClass: string
}) {
  return (
    <div
      className={`relative flex min-h-[132px] flex-col overflow-hidden rounded-2xl p-4 shadow-md ring-1 ring-black/5 ${className}`}
    >
      <div className="relative z-10 flex min-w-0 flex-1 flex-col pr-11">
        <p className="text-sm font-bold leading-tight tracking-tight">{label}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums leading-none tracking-tight">{value}</p>
      </div>
      <div className={`pointer-events-none absolute bottom-3 right-3 ${iconClass}`}>{icon}</div>
    </div>
  )
}
