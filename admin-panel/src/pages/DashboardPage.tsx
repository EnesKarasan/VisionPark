import { useState, useEffect } from 'react'
import {
  getAdminStats,
  getAdminSessions,
  redirectIfUnauthorized,
  VIDEO_STREAM_URL,
  type AdminSessionRow,
} from '../api'
import MobileStyleStatTile from '../components/MobileStyleStatTile'
import DashboardParkingMap from '../components/DashboardParkingMap'
import DashboardQuickNav from '../components/DashboardQuickNav'
import { CardSkeleton } from '../components/Skeleton'
import type { AdminRole } from '../App'

type MediaTab = 'camera' | 'map'

interface StatsData {
  total_spots: number
  available: number
  occupied: number
  active_sessions: number
  today_revenue: number
}

export default function DashboardPage() {
  const role = (localStorage.getItem('user_role') as AdminRole | null) ?? 'admin'
  const [stats, setStats] = useState<StatsData | null>(null)
  const [sessions, setSessions] = useState<AdminSessionRow[]>([])
  const [streamError, setStreamError] = useState(false)
  const [streamKey, setStreamKey] = useState(0)
  const [mediaTab, setMediaTab] = useState<MediaTab>('camera')

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    function fetchAll() {
      const t = localStorage.getItem('token')!
      getAdminStats(t)
        .then(setStats)
        .catch((e) => {
          if (!redirectIfUnauthorized(e)) console.error(e)
        })
      getAdminSessions(t)
        .then(setSessions)
        .catch((e) => {
          if (!redirectIfUnauthorized(e)) console.error(e)
        })
    }

    fetchAll()
    const id = setInterval(fetchAll, 5000)
    return () => clearInterval(id)
  }, [])

  const occupancyRate =
    stats && stats.total_spots > 0 ? Math.round((stats.occupied / stats.total_spots) * 100) : 0

  function handleStreamRetry() {
    setStreamError(false)
    setStreamKey((k) => k + 1)
  }

  return (
    <div className="space-y-6">
      {!stats && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} className="h-[88px]" />
          ))}
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          <MobileStyleStatTile
            label="Toplam Alan"
            value={stats.total_spots}
            className="bg-slate-800 text-white"
            iconClass="text-white/90"
            icon={
              <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
              </svg>
            }
          />
          <MobileStyleStatTile
            label="Boş Alan"
            value={stats.available}
            className="bg-[#15803d] text-white"
            iconClass="text-white/90"
            icon={
              <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <MobileStyleStatTile
            label="Dolu Alan"
            value={stats.occupied}
            className="bg-[#b91c1c] text-white"
            iconClass="text-white/90"
            icon={
              <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            }
          />
          <MobileStyleStatTile
            label="Doluluk oranı"
            value={`%${occupancyRate}`}
            className="bg-indigo-950 text-white"
            iconClass="text-white/90"
            icon={
              <svg className="h-9 w-9" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M10.5 6a7.5 7.5 0 1 0 7.5 7.5h-7.5V6Z"
                />
              </svg>
            }
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <div
            className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs font-medium"
            role="tablist"
            aria-label="Görünüm"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mediaTab === 'camera'}
              onClick={() => setMediaTab('camera')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                mediaTab === 'camera'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Canlı kamera
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mediaTab === 'map'}
              onClick={() => setMediaTab('map')}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                mediaTab === 'map'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Park haritası
            </button>
          </div>
        </div>
        <div className="relative bg-slate-900">
          {mediaTab === 'camera' ? (
            !streamError ? (
              <img
                key={streamKey}
                src={VIDEO_STREAM_URL}
                alt="YOLOv11n canlı araç tespiti"
                className="h-auto w-full"
                onError={() => setStreamError(true)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-400">
                <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
                <p className="text-sm font-medium">Video akışı bağlanamıyor</p>
                <p className="max-w-xs text-center text-xs text-slate-500">
                  Backend servisini başlatın ve YOLOv11n modelinin yüklendiğinden emin olun
                </p>
                <button
                  type="button"
                  onClick={handleStreamRetry}
                  className="mt-2 rounded-lg bg-slate-700 px-4 py-2 text-sm text-white transition-colors hover:bg-slate-600"
                >
                  Tekrar Dene
                </button>
              </div>
            )
          ) : (
            <DashboardParkingMap />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Son Oturumlar</h2>
          <span className="text-xs text-slate-400">Son 5 kayıt</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-3 px-2 text-slate-500 font-medium">Alan</th>
                <th className="text-left py-3 px-2 text-slate-500 font-medium">Müşteri</th>
                <th className="text-left py-3 px-2 text-slate-500 font-medium">Plaka</th>
                <th className="text-left py-3 px-2 text-slate-500 font-medium">Kart</th>
                <th className="text-left py-3 px-2 text-slate-500 font-medium">Başlangıç</th>
                <th className="text-left py-3 px-2 text-slate-500 font-medium">Bitiş</th>
                <th className="text-left py-3 px-2 text-slate-500 font-medium">Ücret</th>
                <th className="text-left py-3 px-2 text-slate-500 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody>
              {sessions.slice(0, 5).map((s) => (
                <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="py-3 px-2 font-medium text-slate-700 whitespace-nowrap">{s.spot_number}</td>
                  <td className="py-3 px-2 text-slate-700">
                    <div className="font-medium truncate max-w-[180px]" title={s.customer_name || s.customer_email}>
                      {s.customer_name || '—'}
                    </div>
                    {s.customer_email && (
                      <div className="text-xs text-slate-400 truncate max-w-[180px]">{s.customer_email}</div>
                    )}
                  </td>
                  <td className="py-3 px-2 text-slate-600 whitespace-nowrap font-mono text-xs">
                    {s.plate_number || '—'}
                  </td>
                  <td className="py-3 px-2 text-slate-600 whitespace-nowrap">
                    <CardChip brand={s.payment?.card_brand ?? null} last4={s.payment?.card_last_four ?? null} />
                  </td>
                  <td className="py-3 px-2 text-slate-600 whitespace-nowrap text-xs">
                    {new Date(s.started_at).toLocaleString('tr', {
                      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                    })}
                  </td>
                  <td className="py-3 px-2 text-slate-600 whitespace-nowrap text-xs">
                    {s.ended_at
                      ? new Date(s.ended_at).toLocaleString('tr', {
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })
                      : '-'}
                  </td>
                  <td className="py-3 px-2 whitespace-nowrap">
                    {s.total_fee == null ? (
                      <span className="text-slate-400">—</span>
                    ) : Number(s.total_fee) === 0 ? (
                      <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md">
                        Ücretsiz
                      </span>
                    ) : (
                      <span className="font-semibold text-slate-800">₺{Number(s.total_fee).toLocaleString('tr', { minimumFractionDigits: 2 })}</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <StatusBadge status={s.status} />
                  </td>
                </tr>
              ))}
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Henüz oturum kaydı yok</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-3">Hızlı Erişim</h2>
        <DashboardQuickNav
          role={role}
          totalSpots={stats?.total_spots ?? 0}
          availableSpots={stats?.available ?? 0}
          todayRevenue={stats?.today_revenue ?? 0}
          activeSessions={stats?.active_sessions ?? 0}
          recentSessions={sessions}
        />
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const isActive = status === 'active'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
    }`}>
      {isActive ? 'Aktif' : 'Tamamlandı'}
    </span>
  )
}

function CardChip({ brand, last4 }: { brand: string | null; last4: string | null }) {
  if (!last4) return <span className="text-slate-300">—</span>
  const label = brand ? brand.toUpperCase() : 'KART'
  const palette: Record<string, string> = {
    VISA: 'bg-blue-50 text-blue-700 border-blue-200',
    MASTERCARD: 'bg-orange-50 text-orange-700 border-orange-200',
    AMEX: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    TROY: 'bg-red-50 text-red-700 border-red-200',
  }
  const cls = palette[label] ?? 'bg-slate-50 text-slate-700 border-slate-200'
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${cls}`}>
      <span>{label}</span>
      <span className="font-mono">•••• {last4}</span>
    </span>
  )
}
