import { useState, useEffect, useCallback } from 'react'
import {
  getAdminPricing,
  updateAdminPricing,
  redirectIfUnauthorized,
  buildAdminPricingUpdateBody,
  type AdminPricing,
} from '../api'

const TIER_LABELS = [
  '0-1 saat',
  '1-2 saat',
  '2-4 saat',
  '4-8 saat',
  '8-12 saat',
  'Tam gün',
] as const

const FREE_PRESETS = [15, 30, 60, 120] as const

export default function AdminPricingPanel() {
  const [freeMinutes, setFreeMinutes] = useState('15')
  const [tierPrices, setTierPrices] = useState<string[]>(() => TIER_LABELS.map(() => ''))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const applyPricing = useCallback((p: AdminPricing) => {
    setFreeMinutes(String(p.free_minutes))
    const prices = TIER_LABELS.map((_, i) => {
      const b = p.brackets[i]
      return b != null ? String(b.price) : ''
    })
    setTierPrices(prices)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return
    setLoading(true)
    setLoadError(null)
    getAdminPricing(token)
      .then(applyPricing)
      .catch((e) => {
        if (!redirectIfUnauthorized(e)) {
          setLoadError(e instanceof Error ? e.message : 'Ücret bilgisi yüklenemedi')
        }
      })
      .finally(() => setLoading(false))
  }, [applyPricing])

  async function handleSave() {
    const token = localStorage.getItem('token')
    if (!token) return

    const free = Number.parseInt(freeMinutes, 10)
    if (!Number.isFinite(free) || free < 0 || free > 24 * 60) {
      setSaveError('Ücretsiz süre 0–1440 dakika arasında olmalıdır.')
      return
    }

    const parsedTiers: number[] = []
    for (let i = 0; i < TIER_LABELS.length; i++) {
      const n = Number(tierPrices[i])
      if (!Number.isFinite(n) || n < 0) {
        setSaveError(`"${TIER_LABELS[i]}" için geçerli bir tutar girin.`)
        return
      }
      parsedTiers.push(n)
    }

    setSaving(true)
    setSaveError(null)
    try {
      const body = buildAdminPricingUpdateBody(free, parsedTiers)
      const updated = await updateAdminPricing(token, body)
      applyPricing(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      if (!redirectIfUnauthorized(e)) {
        setSaveError(e instanceof Error ? e.message : 'Kayıt başarısız')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Ücretsiz dakika kartı */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Ücretsiz Süre</h2>
            <p className="text-xs text-slate-500 mt-1">
              Park başlangıcından itibaren ücret hesaplanmadan geçen süre. 0–1440 dakika arası.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
        ) : loadError ? (
          <ErrorBanner text={loadError} />
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative max-w-[200px]">
              <input
                id="free-minutes"
                type="number"
                min={0}
                max={1440}
                value={freeMinutes}
                onChange={(e) => setFreeMinutes(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-12 text-base font-semibold tabular-nums text-slate-800 outline-none focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
                dakika
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-400 mr-1">Hızlı seç:</span>
              {FREE_PRESETS.map((m) => {
                const active = freeMinutes === String(m)
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setFreeMinutes(String(m))}
                    className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {m} dk
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Tarife dilimleri kartı */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Saat Dilimleri ve Tarifeler</h2>
            <p className="text-xs text-slate-500 mt-1">
              Park süresine göre hangi dilimde bulunulursa o dilim ücreti uygulanır (kümülatif değildir).
            </p>
          </div>
          <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            ₺ TRY
          </span>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TIER_LABELS.map((t) => (
                <div key={t} className="h-20 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {TIER_LABELS.map((label, i) => (
                <div
                  key={label}
                  className="border border-slate-200 rounded-lg p-3.5 hover:border-blue-300 transition-colors bg-slate-50/30"
                >
                  <label htmlFor={`tier-${i}`} className="block text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">
                    {label}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400 tabular-nums">
                      ₺
                    </span>
                    <input
                      id={`tier-${i}`}
                      type="number"
                      step="0.01"
                      min={0}
                      value={tierPrices[i]}
                      onChange={(e) => {
                        const next = [...tierPrices]
                        next[i] = e.target.value
                        setTierPrices(next)
                      }}
                      placeholder="0"
                      className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm font-semibold tabular-nums text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {saveError && (
            <div className="mt-4">
              <ErrorBanner text={saveError} />
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && !loadError && (
          <div className="px-6 py-3 border-t border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2.5 py-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
                Kaydedildi
              </span>
            )}
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 px-4 py-2 text-sm font-medium text-white shadow-sm transition"
            >
              {saving ? (
                <>
                  <Spinner /> Kaydediliyor…
                </>
              ) : (
                <>
                  <SaveIcon /> Değişiklikleri Kaydet
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorBanner({ text }: { text: string }) {
  return (
    <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12V15Z" />
      </svg>
      <span>{text}</span>
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function SaveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}
