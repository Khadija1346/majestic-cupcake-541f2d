import { useTown } from '@/lib/store'

export function Toasts() {
  const { toasts } = useTown()
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex flex-col items-center gap-2 px-4">
      {toasts.map((t) => (
        <div key={t.id} className="pop panel flex max-w-sm items-center gap-3 px-4 py-3">
          <span className="text-2xl">{t.icon}</span>
          <div>
            <div className="font-display text-sm text-gold">{t.title}</div>
            {t.body && <div className="text-xs text-cream/75">{t.body}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}
