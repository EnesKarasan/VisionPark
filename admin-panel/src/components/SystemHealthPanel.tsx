import { useCallback, useEffect, useState } from 'react'
import { getSystemHealth, redirectIfUnauthorized, type SystemHealth } from '../api'

export default function SystemHealthPanel() {
  const [health, setHealth] = useState<SystemHealth | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(() => {
    const t = localStorage.getItem('token')
    if (!t) return
    setLoading(true)
    setErr(null)
    getSystemHealth(t)
      .then(setHealth)
      .catch((e) => {
        if (!redirectIfUnauthorized(e)) setErr((e as Error).message)
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 10_000)
    return () => clearInterval(id)
  }, [load])

  if (loading && !health) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
        Sistem durumu okunuyor…
      </div>
    )
  }

  if (err || !health) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
        Sistem durumu okunamadı: {err || 'bilinmiyor'}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Üst grid: 4 küçük durum kartı */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusTile
          label="Backend"
          value={health.backend.status === 'ok' ? 'Çalışıyor' : 'Hata'}
          accent={health.backend.status === 'ok' ? 'emerald' : 'red'}
          detail={health.backend.python_version}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 0 0-.12-1.03l-2.268-9.64a3.375 3.375 0 0 0-3.285-2.602H7.923a3.375 3.375 0 0 0-3.285 2.602l-2.268 9.64a4.5 4.5 0 0 0-.12 1.03v.228m19.5 0a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3m19.5 0a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3" />
            </svg>
          }
        />
        <StatusTile
          label="Veritabanı"
          value={health.database.size_human}
          accent="indigo"
          detail={health.database.type.toUpperCase()}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75" />
            </svg>
          }
        />
        <StatusTile
          label="YOLO"
          value={health.cv.status === 'ready' ? 'Hazır' : 'Beklemede'}
          accent={health.cv.status === 'ready' ? 'emerald' : 'amber'}
          detail={`Cihaz: ${health.cv.device}`}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          }
        />
        <StatusTile
          label="Otopark"
          value={`${health.parking_lot.spot_count} alan`}
          accent="slate"
          detail={`${health.parking_lot.active_sessions} aktif oturum`}
          icon={
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.7} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Sistem detay kartı */}
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Sistem Detayı</h3>
          <dl className="space-y-2.5 text-sm">
            <Row label="Python" value={health.backend.python_version} />
            <Row label="Platform" value={health.backend.platform} mono />
            <Row label="DB Türü" value={health.database.type.toUpperCase()} />
            <Row label="DB Yolu" value={health.database.path ?? '—'} mono small />
            <Row label="DB Boyutu" value={health.database.size_human} />
            <Row label="CV Model" value={health.cv.model_path.split(/[\\/]/).pop() ?? '—'} mono />
            <Row label="CV Interval" value={`${health.cv.interval_sec} sn`} />
            <Row label="CV Cihaz" value={health.cv.device.toUpperCase()} />
            <Row label="Son Kontrol" value={new Date(health.checked_at).toLocaleTimeString('tr')} />
          </dl>
        </div>

        {/* Kullanıcı dağılımı + son yedekler */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Kullanıcı Dağılımı</h3>
            <div className="space-y-2 text-sm">
              {Object.entries(health.users).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between">
                  <span className="text-slate-600 capitalize">
                    {role === 'admin' ? 'Yönetici' : role === 'operator' ? 'Operatör' : 'Müşteri'}
                  </span>
                  <span className="font-semibold text-slate-800">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5">
            <h3 className="text-sm font-semibold text-slate-800 mb-3">Son Yedekler</h3>
            {health.backups.length === 0 ? (
              <p className="text-xs text-slate-400">Henüz yedek dosyası yok</p>
            ) : (
              <ul className="space-y-1.5">
                {health.backups.slice(0, 5).map((b) => (
                  <li key={b.name} className="text-xs flex items-center justify-between">
                    <span className="font-mono text-slate-700 truncate" title={b.name}>
                      {b.name}
                    </span>
                    <span className="ml-2 shrink-0 text-slate-400">
                      {(b.size_bytes / 1024).toFixed(0)} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface StatusTileProps {
  label: string
  value: string
  detail?: string
  accent: 'emerald' | 'indigo' | 'amber' | 'slate' | 'red'
  icon: React.ReactNode
}

const tileAccent: Record<StatusTileProps['accent'], { bg: string; fg: string }> = {
  emerald: { bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  indigo: { bg: 'bg-indigo-50', fg: 'text-indigo-700' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-700' },
  slate: { bg: 'bg-slate-100', fg: 'text-slate-700' },
  red: { bg: 'bg-red-50', fg: 'text-red-700' },
}

function StatusTile({ label, value, detail, accent, icon }: StatusTileProps) {
  const a = tileAccent[accent]
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${a.bg} ${a.fg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500">{label}</p>
          <p className="text-base font-semibold text-slate-800 truncate">{value}</p>
          {detail && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{detail}</p>}
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, mono, small }: { label: string; value: string; mono?: boolean; small?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className={`text-right text-slate-800 min-w-0 truncate ${mono ? 'font-mono' : ''} ${small ? 'text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
