import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  deleteAdminUser,
  redirectIfUnauthorized,
  type AdminUserRow,
  type UserRoleValue,
} from '../api'
import UserDetailModal from '../components/UserDetailModal'
import { TableSkeleton } from '../components/Skeleton'
import EmptyState from '../components/EmptyState'
import { useToast } from '../components/Toast'

const ROLE_LABEL: Record<UserRoleValue, string> = {
  admin: 'Yönetici',
  operator: 'Operatör',
  customer: 'Müşteri',
}

const ROLE_STYLE: Record<UserRoleValue, string> = {
  admin: 'bg-blue-50 text-blue-700 border-blue-200',
  operator: 'bg-amber-50 text-amber-700 border-amber-200',
  customer: 'bg-slate-50 text-slate-700 border-slate-200',
}

type Filter = 'all' | UserRoleValue

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [err, setErr] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailUserId, setDetailUserId] = useState<number | null>(null)
  const toast = useToast()

  const token = localStorage.getItem('token') ?? ''

  const load = useCallback(() => {
    setLoading(true)
    setErr(null)
    listAdminUsers(token)
      .then(setUsers)
      .catch((e) => {
        if (!redirectIfUnauthorized(e)) setErr((e as Error).message)
      })
      .finally(() => setLoading(false))
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter((u) => {
      if (filter !== 'all' && u.role !== filter) return false
      if (!q) return true
      return (
        u.email.toLowerCase().includes(q) ||
        (u.full_name ?? '').toLowerCase().includes(q)
      )
    })
  }, [users, filter, search])

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: users.length, admin: 0, operator: 0, customer: 0 }
    for (const u of users) c[u.role] += 1
    return c
  }, [users])

  async function handleToggleActive(u: AdminUserRow) {
    try {
      const updated = await updateAdminUser(token, u.id, { is_active: !u.is_active })
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)))
      toast.success(
        `${u.email} ${updated.is_active ? 'aktifleştirildi' : 'pasifleştirildi'}.`,
        'Durum güncellendi',
      )
    } catch (e) {
      if (!redirectIfUnauthorized(e)) toast.error((e as Error).message, 'Güncelleme başarısız')
    }
  }

  async function handleDelete(u: AdminUserRow) {
    if (!confirm(`${u.email} kullanıcısını silmek istediğinize emin misiniz?`)) return
    try {
      await deleteAdminUser(token, u.id)
      setUsers((prev) => prev.filter((x) => x.id !== u.id))
      toast.success(`${u.email} silindi.`, 'Kullanıcı kaldırıldı')
    } catch (e) {
      if (!redirectIfUnauthorized(e)) toast.error((e as Error).message, 'Silme başarısız')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Kullanıcılar</h2>
            <p className="text-sm text-slate-500 mt-1">
              Yönetici, operatör ve müşteri hesaplarını yönetin. Roller ve durumlar anında etkilidir.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg shadow-sm transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Yeni Kullanıcı
          </button>
        </div>

        {/* Filter chips */}
        <div className="mt-4 flex flex-wrap gap-2">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="Tümü" count={counts.all} />
          <FilterChip active={filter === 'admin'} onClick={() => setFilter('admin')} label="Yöneticiler" count={counts.admin} accent="blue" />
          <FilterChip active={filter === 'operator'} onClick={() => setFilter('operator')} label="Operatörler" count={counts.operator} accent="amber" />
          <FilterChip active={filter === 'customer'} onClick={() => setFilter('customer')} label="Müşteriler" count={counts.customer} accent="slate" />
        </div>

        <div className="mt-3">
          <div className="relative max-w-md">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="E-posta veya isim ile ara…"
              className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 outline-none"
            />
          </div>
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {err ? (
          <div className="p-4 bg-red-50 border-b border-red-200 text-sm text-red-700">{err}</div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50/60 border-b border-slate-200">
              <tr>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kullanıcı</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Rol</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">İhlal</th>
                <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden md:table-cell">Kayıt</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6}>
                    <TableSkeleton rows={5} cols={5} />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title={search || filter !== 'all' ? 'Filtreye uygun kullanıcı yok' : 'Henüz kullanıcı kaydı yok'}
                      description={
                        search || filter !== 'all'
                          ? 'Aramayı temizleyin veya "Tümü" filtresine geçin.'
                          : 'Yeni Kullanıcı düğmesi ile ilk hesabı oluşturabilirsiniz.'
                      }
                      icon={
                        <svg className="w-12 h-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
                        </svg>
                      }
                    />
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{u.full_name || u.email.split('@')[0]}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center text-xs font-semibold px-2 py-1 rounded-md border ${ROLE_STYLE[u.role]}`}
                      >
                        {ROLE_LABEL[u.role]}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${
                          u.is_active
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-green-500' : 'bg-slate-400'}`} />
                        {u.is_active ? 'Aktif' : 'Pasif'}
                      </button>
                    </td>
                    <td className="py-3 px-4 hidden lg:table-cell">
                      <span className={`text-xs font-medium ${u.missed_reservation_entry_count > 0 ? 'text-amber-700' : 'text-slate-400'}`}>
                        {u.missed_reservation_entry_count}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 hidden md:table-cell">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('tr') : '—'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailUserId(u.id)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition"
                          title="Detayları görüntüle"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                          </svg>
                          Detay
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(u)}
                          className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Kullanıcıyı sil"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen && (
        <CreateUserModal
          token={token}
          onClose={() => setCreateOpen(false)}
          onCreated={(u) => {
            setUsers((prev) => [u, ...prev])
            setCreateOpen(false)
          }}
        />
      )}

      <UserDetailModal
        open={detailUserId !== null}
        userId={detailUserId ?? 0}
        onClose={() => setDetailUserId(null)}
      />
    </div>
  )
}

interface FilterChipProps {
  active: boolean
  onClick: () => void
  label: string
  count: number
  accent?: 'blue' | 'amber' | 'slate'
}

function FilterChip({ active, onClick, label, count, accent }: FilterChipProps) {
  const activeStyle =
    accent === 'blue'
      ? 'bg-blue-600 text-white border-blue-600'
      : accent === 'amber'
        ? 'bg-amber-500 text-white border-amber-500'
        : 'bg-slate-700 text-white border-slate-700'
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border transition ${
        active ? activeStyle : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
      <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-white/20' : 'bg-slate-100'}`}>{count}</span>
    </button>
  )
}

interface CreateModalProps {
  token: string
  onClose: () => void
  onCreated: (u: AdminUserRow) => void
}

function CreateUserModal({ token, onClose, onCreated }: CreateModalProps) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRoleValue>('operator')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const toast = useToast()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      const u = await createAdminUser(token, { email, password, full_name: fullName || undefined, role })
      toast.success(`${u.email} oluşturuldu.`, 'Kullanıcı eklendi')
      onCreated(u)
    } catch (ex) {
      if (!redirectIfUnauthorized(ex)) setErr((ex as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-base font-semibold text-slate-800">Yeni Kullanıcı Ekle</h3>
          <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </header>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">E-posta</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Ad Soyad (opsiyonel)</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Şifre (min 8 karakter)</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500/60 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Rol</label>
            <div className="grid grid-cols-3 gap-2">
              {(['admin', 'operator', 'customer'] as UserRoleValue[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`px-3 py-2 text-sm font-medium rounded-lg border transition ${
                    role === r
                      ? ROLE_STYLE[r] + ' ring-2 ring-offset-1 ring-blue-400'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div className="text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg px-3 py-2">{err}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50">
              Vazgeç
            </button>
            <button type="submit" disabled={busy} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 rounded-lg">
              {busy ? 'Ekleniyor…' : 'Ekle'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
