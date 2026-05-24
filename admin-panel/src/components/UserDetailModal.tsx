import { useEffect, useState } from 'react'
import {
  getAdminUserDetail,
  redirectIfUnauthorized,
  type UserDetail,
} from '../api'

interface UserDetailModalProps {
  userId: number
  open: boolean
  onClose: () => void
}

type Tab = 'profile' | 'sessions' | 'reservations' | 'vehicles' | 'cards'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Yönetici',
  operator: 'Operatör',
  customer: 'Müşteri',
}

const ROLE_STYLE: Record<string, string> = {
  admin: 'bg-blue-50 text-blue-700 border-blue-200',
  operator: 'bg-amber-50 text-amber-700 border-amber-200',
  customer: 'bg-slate-50 text-slate-700 border-slate-200',
}

export default function UserDetailModal({ userId, open, onClose }: UserDetailModalProps) {
  const [detail, setDetail] = useState<UserDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('profile')

  useEffect(() => {
    if (!open) return
    const t = localStorage.getItem('token')
    if (!t) return
    setLoading(true)
    setErr(null)
    setDetail(null)
    setTab('profile')
    getAdminUserDetail(t, userId)
      .then(setDetail)
      .catch((e) => {
        if (!redirectIfUnauthorized(e)) setErr((e as Error).message)
      })
      .finally(() => setLoading(false))
  }, [open, userId])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-base shrink-0">
              {(detail?.profile.full_name || detail?.profile.email || '?').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-800 truncate">
                {detail?.profile.full_name || (detail?.profile.email.split('@')[0] ?? 'Kullanıcı')}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {detail?.profile.email ?? '—'}
              </p>
            </div>
            {detail && (
              <span className={`shrink-0 ml-2 text-xs font-semibold px-2 py-0.5 rounded-md border ${ROLE_STYLE[detail.profile.role]}`}>
                {ROLE_LABEL[detail.profile.role]}
              </span>
            )}
            {detail && !detail.profile.is_active && (
              <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md border bg-slate-100 text-slate-500 border-slate-200">
                Pasif
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md"
            aria-label="Kapat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        {loading && (
          <div className="p-8 text-center text-sm text-slate-400">Yükleniyor…</div>
        )}
        {err && (
          <div className="p-4 bg-red-50 border-b border-red-200 text-sm text-red-700">{err}</div>
        )}

        {detail && (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-y sm:divide-y-0 divide-slate-100 border-b border-slate-100 text-xs">
              <SummaryCell label="Oturum" value={detail.summary.session_count.toString()} />
              <SummaryCell
                label="Aktif"
                value={detail.summary.active_session ? 'Var' : 'Yok'}
                accent={detail.summary.active_session ? 'green' : 'slate'}
              />
              <SummaryCell
                label="Toplam Ödenen"
                value={`₺${detail.summary.total_paid.toFixed(2)}`}
                accent="blue"
              />
              <SummaryCell
                label="İhlal"
                value={detail.summary.missed_reservation_count.toString()}
                accent={detail.summary.missed_reservation_count > 0 ? 'amber' : 'slate'}
              />
              <SummaryCell label="Araç" value={detail.summary.vehicle_count.toString()} />
              <SummaryCell label="Kart" value={detail.summary.card_count.toString()} />
            </div>

            {/* Tabs */}
            <div className="border-b border-slate-200 px-2 flex flex-wrap gap-1 bg-slate-50/30">
              <TabBtn id="profile" active={tab} onClick={setTab}>Profil</TabBtn>
              <TabBtn id="sessions" active={tab} onClick={setTab} badge={detail.sessions.length}>
                Oturumlar
              </TabBtn>
              <TabBtn id="reservations" active={tab} onClick={setTab} badge={detail.reservations.length}>
                Rezervasyon
              </TabBtn>
              <TabBtn id="vehicles" active={tab} onClick={setTab} badge={detail.vehicles.length}>
                Araçlar
              </TabBtn>
              <TabBtn id="cards" active={tab} onClick={setTab} badge={detail.payment_cards.length}>
                Kartlar
              </TabBtn>
            </div>

            <div className="overflow-y-auto flex-1">
              {tab === 'profile' && <ProfileTab detail={detail} />}
              {tab === 'sessions' && <SessionsTab detail={detail} />}
              {tab === 'reservations' && <ReservationsTab detail={detail} />}
              {tab === 'vehicles' && <VehiclesTab detail={detail} />}
              {tab === 'cards' && <CardsTab detail={detail} />}
            </div>

            {/* KVKK uyarı footer */}
            <footer className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 text-[11px] text-slate-500 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-1.5 0h12a1.5 1.5 0 0 1 1.5 1.5v7.5a1.5 1.5 0 0 1-1.5 1.5h-12a1.5 1.5 0 0 1-1.5-1.5v-7.5a1.5 1.5 0 0 1 1.5-1.5Z" />
              </svg>
              <span>
                Gösterilen tüm bilgiler KVKK uyumludur. Şifre verisi ve tam kart numarası kaydedilmez veya gösterilmez.
              </span>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}

/* ── Cell + Tab + Tabs ─────────────────────────────────────────────────── */

const cellAccent: Record<string, string> = {
  green: 'text-emerald-700',
  blue: 'text-blue-700',
  amber: 'text-amber-700',
  slate: 'text-slate-800',
}

function SummaryCell({ label, value, accent = 'slate' }: { label: string; value: string; accent?: string }) {
  return (
    <div className="px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">{label}</p>
      <p className={`text-sm font-semibold mt-0.5 ${cellAccent[accent] ?? cellAccent.slate}`}>{value}</p>
    </div>
  )
}

interface TabBtnProps {
  id: Tab
  active: Tab
  onClick: (t: Tab) => void
  children: React.ReactNode
  badge?: number
}

function TabBtn({ id, active, onClick, children, badge }: TabBtnProps) {
  const isActive = active === id
  return (
    <button
      type="button"
      onClick={() => onClick(id)}
      className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition ${
        isActive ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
      }`}
    >
      {children}
      {badge !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
          {badge}
        </span>
      )}
    </button>
  )
}

/* ── Profil sekmesi ─────────────────────────────────────────────────────── */

function ProfileTab({ detail }: { detail: UserDetail }) {
  const p = detail.profile
  return (
    <div className="p-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ProfileField label="ID" value={`#${p.id}`} mono />
        <ProfileField label="E-posta" value={p.email} mono />
        <ProfileField label="Tam Ad" value={p.full_name || '—'} />
        <ProfileField label="Ad" value={p.first_name || '—'} />
        <ProfileField label="Soyad" value={p.last_name || '—'} />
        <ProfileField label="Doğum Tarihi" value={p.birth_date ? new Date(p.birth_date).toLocaleDateString('tr') : '—'} />
        <ProfileField
          label="Cinsiyet"
          value={
            p.gender === 'female' ? 'Kadın'
            : p.gender === 'male' ? 'Erkek'
            : p.gender === 'other' ? 'Diğer'
            : p.gender === 'unspecified' ? 'Belirtilmemiş'
            : '—'
          }
        />
        <ProfileField label="Rol" value={ROLE_LABEL[p.role]} />
        <ProfileField label="Durum" value={p.is_active ? 'Aktif' : 'Pasif'} />
        <ProfileField label="Kayıt Tarihi" value={p.created_at ? new Date(p.created_at).toLocaleString('tr') : '—'} />
      </div>
    </div>
  )
}

function ProfileField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500">{label}</p>
      <p className={`text-sm text-slate-800 mt-0.5 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}

/* ── Oturumlar sekmesi ─────────────────────────────────────────────────── */

function SessionsTab({ detail }: { detail: UserDetail }) {
  if (detail.sessions.length === 0) {
    return <EmptyState text="Park oturumu bulunmuyor" />
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-xs">
          <tr>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Alan</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Giriş</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Çıkış</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Süre</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Plaka</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Ücret</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Ödeme</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Durum</th>
          </tr>
        </thead>
        <tbody>
          {detail.sessions.map((s) => (
            <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/50">
              <td className="px-4 py-2 font-semibold text-slate-800">{s.spot_number || '—'}</td>
              <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                {s.started_at ? new Date(s.started_at).toLocaleString('tr', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </td>
              <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                {s.ended_at ? new Date(s.ended_at).toLocaleString('tr', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
              </td>
              <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                {s.duration_minutes != null
                  ? `${Math.floor(s.duration_minutes / 60)}sa ${s.duration_minutes % 60}dk`
                  : '—'}
              </td>
              <td className="px-4 py-2 font-mono text-xs text-slate-700">{s.plate_number || '—'}</td>
              <td className="px-4 py-2 font-medium text-slate-800 whitespace-nowrap">
                {s.total_fee != null ? `₺${s.total_fee.toFixed(2)}` : '—'}
              </td>
              <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">
                {s.payment ? `${(s.payment.card_brand ?? '').toUpperCase()} •••• ${s.payment.card_last_four ?? '----'}` : '—'}
              </td>
              <td className="px-4 py-2"><StatusPill status={s.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Rezervasyonlar sekmesi ─────────────────────────────────────────────── */

function ReservationsTab({ detail }: { detail: UserDetail }) {
  if (detail.reservations.length === 0) {
    return <EmptyState text="Rezervasyon kaydı yok" />
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b border-slate-200 text-xs">
          <tr>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Alan</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Oluşturulma</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Planlanan Saat</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Giriş Son Tarih</th>
            <th className="text-left px-4 py-2 text-slate-500 font-semibold uppercase tracking-wider">Durum</th>
          </tr>
        </thead>
        <tbody>
          {detail.reservations.map((r) => (
            <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50/50">
              <td className="px-4 py-2 font-semibold text-slate-800">{r.spot_number || '—'}</td>
              <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{r.reserved_at ? new Date(r.reserved_at).toLocaleString('tr') : '—'}</td>
              <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{r.scheduled_start_at ? new Date(r.scheduled_start_at).toLocaleString('tr') : '—'}</td>
              <td className="px-4 py-2 text-xs text-slate-600 whitespace-nowrap">{r.entry_deadline_at ? new Date(r.entry_deadline_at).toLocaleString('tr') : '—'}</td>
              <td className="px-4 py-2"><StatusPill status={r.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Araçlar sekmesi ───────────────────────────────────────────────────── */

function VehiclesTab({ detail }: { detail: UserDetail }) {
  if (detail.vehicles.length === 0) {
    return <EmptyState text="Kayıtlı araç yok" />
  }
  return (
    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
      {detail.vehicles.map((v) => (
        <div key={v.id} className="bg-white border border-slate-200 rounded-lg p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono font-semibold text-slate-800 tracking-wide">{v.plate}</div>
            <div className="text-xs text-slate-500 truncate">{v.label || 'Etiketsiz'}</div>
          </div>
          {v.created_at && (
            <span className="text-[11px] text-slate-400 shrink-0">
              {new Date(v.created_at).toLocaleDateString('tr')}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Kartlar sekmesi ───────────────────────────────────────────────────── */

const cardBrandStyle: Record<string, string> = {
  VISA: 'from-blue-500 to-blue-700',
  MASTERCARD: 'from-orange-500 to-red-600',
  AMEX: 'from-emerald-500 to-emerald-700',
  TROY: 'from-red-500 to-red-700',
}

function CardsTab({ detail }: { detail: UserDetail }) {
  if (detail.payment_cards.length === 0) {
    return <EmptyState text="Kayıtlı kart yok" />
  }
  return (
    <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {detail.payment_cards.map((c) => {
        const brand = (c.brand || '').toUpperCase()
        const gradient = cardBrandStyle[brand] ?? 'from-slate-600 to-slate-800'
        return (
          <div
            key={c.id}
            className={`rounded-xl bg-gradient-to-br ${gradient} text-white p-4 shadow-sm`}
          >
            <div className="flex items-start justify-between mb-6">
              <span className="text-xs font-semibold opacity-80 uppercase">{brand || 'KART'}</span>
              <svg className="w-6 h-6 opacity-80" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 5H5a3 3 0 0 0-3 3v8a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3Zm-2 11H5v-2h12v2Zm0-4H5v-2h12v2Z" />
              </svg>
            </div>
            <p className="font-mono text-lg tracking-widest">•••• •••• •••• {c.last_four}</p>
            <div className="mt-3 flex items-center justify-between text-xs opacity-90">
              <span className="truncate" title={c.holder_name}>{c.holder_name || '—'}</span>
              <span className="font-mono">
                {String(c.exp_month).padStart(2, '0')}/{String(c.exp_year).slice(-2)}
              </span>
            </div>
            {c.label && (
              <div className="mt-1 text-[11px] opacity-75 truncate">{c.label}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/* ── Yardımcı ───────────────────────────────────────────────────────────── */

function EmptyState({ text }: { text: string }) {
  return (
    <div className="p-10 text-center">
      <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: 'bg-green-50 text-green-700 border-green-200',
    ended: 'bg-slate-50 text-slate-600 border-slate-200',
    completed: 'bg-slate-50 text-slate-600 border-slate-200',
    cancelled: 'bg-amber-50 text-amber-700 border-amber-200',
    used: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    expired: 'bg-red-50 text-red-700 border-red-200',
  }
  const label: Record<string, string> = {
    active: 'Aktif',
    ended: 'Tamamlandı',
    completed: 'Tamamlandı',
    cancelled: 'İptal',
    used: 'Kullanıldı',
    expired: 'Süre Doldu',
  }
  const cls = map[status] ?? 'bg-slate-50 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {label[status] ?? status}
    </span>
  )
}
