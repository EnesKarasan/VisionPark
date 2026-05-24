import { useRef, useState } from 'react'
import { downloadBackup, redirectIfUnauthorized, uploadRestore } from '../api'

export default function SettingsPage({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Bildirim Ayarları</h2>
            <div className="space-y-4">
              <ToggleSetting
                label="E-posta Bildirimleri"
                description="Önemli olaylar için e-posta bildirimi alın"
                defaultChecked
              />
              <ToggleSetting
                label="Doluluk Uyarıları"
                description="Park alanı %90 dolduğunda bildirim alın"
                defaultChecked
              />
              <ToggleSetting
                label="Gelir Raporları"
                description="Günlük gelir raporlarını e-posta ile alın"
              />
            </div>
          </div>

          <BackupCard />
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Hesap</h2>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-slate-500">Rol</p>
                <p className="text-sm font-medium text-slate-700">Yönetici</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Durum</p>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                  Aktif
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-red-200 p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-2">Tehlikeli Bölge</h2>
            <p className="text-sm text-slate-500 mb-4">
              Oturumu kapatmak tüm yerel verileri temizler.
            </p>
            <button
              onClick={onLogout}
              className="w-full px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg border border-red-200 transition-colors"
            >
              Oturumu Kapat
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ToggleSetting({ label, description, defaultChecked = false }: {
  label: string
  description: string
  defaultChecked?: boolean
}) {
  const [enabled, setEnabled] = useState(defaultChecked)

  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm font-medium text-slate-700">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => setEnabled(!enabled)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          enabled ? 'bg-blue-600' : 'bg-slate-200'
        }`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
          enabled ? 'translate-x-5' : 'translate-x-0'
        }`} />
      </button>
    </div>
  )
}


function BackupCard() {
  const [busy, setBusy] = useState<'backup' | 'restore' | null>(null)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err' | 'warn'; text: string } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [confirming, setConfirming] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function token(): string {
    return localStorage.getItem('token') ?? ''
  }

  async function handleBackup() {
    setMsg(null)
    setBusy('backup')
    try {
      await downloadBackup(token())
      setMsg({ kind: 'ok', text: 'Yedek başarıyla indirildi.' })
    } catch (e) {
      if (redirectIfUnauthorized(e)) return
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  function pickFile() {
    fileInputRef.current?.click()
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    setMsg(null)
    const f = e.target.files?.[0] ?? null
    setSelectedFile(f)
    e.target.value = ''
  }

  async function handleRestore() {
    if (!selectedFile) return
    setMsg(null)
    setBusy('restore')
    try {
      const res = await uploadRestore(token(), selectedFile)
      if (res.restart_required) {
        setMsg({
          kind: 'warn',
          text:
            'Geri yükleme tamamlandı. Lütfen backend\'i yeniden başlatın; ardından sayfayı yenileyin.',
        })
      } else {
        setMsg({ kind: 'ok', text: res.detail })
      }
      setSelectedFile(null)
      setConfirming(false)
    } catch (e) {
      if (redirectIfUnauthorized(e)) return
      setMsg({ kind: 'err', text: (e as Error).message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Veritabanı Yedekleme</h2>
          <p className="text-xs text-slate-500 mt-1">
            SQLite veritabanını dosya olarak indirin veya daha önce alınmış bir yedeği geri yükleyin.
          </p>
        </div>
        <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
          Yönetici
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Backup */}
        <div className="border border-slate-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Yedek Al</h3>
          <p className="text-xs text-slate-500 mb-3">
            Sistem çalışırken canlı bir snapshot indirir. Güvenli yere saklayın.
          </p>
          <button
            type="button"
            onClick={handleBackup}
            disabled={busy !== null}
            className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition"
          >
            {busy === 'backup' ? (
              <>
                <Spinner /> Hazırlanıyor…
              </>
            ) : (
              <>
                <DownloadIcon /> Yedeği İndir
              </>
            )}
          </button>
        </div>

        {/* Restore */}
        <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/30">
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Geri Yükle</h3>
          <p className="text-xs text-slate-500 mb-3">
            Yüklediğiniz dosya mevcut veriyi <strong>tamamen değiştirir</strong>. Eski veritabanı
            otomatik olarak zaman damgalı yedek olarak korunur.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.sqlite,application/octet-stream"
            onChange={handleFile}
            className="hidden"
          />

          {!selectedFile ? (
            <button
              type="button"
              onClick={pickFile}
              disabled={busy !== null}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg transition"
            >
              <UploadIcon /> Dosya Seç (.db)
            </button>
          ) : !confirming ? (
            <div className="space-y-2">
              <div className="text-xs text-slate-700 bg-white border border-slate-200 rounded px-2 py-1.5 truncate" title={selectedFile.name}>
                {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="flex-1 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg"
                >
                  Vazgeç
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg"
                >
                  Devam et
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-amber-800 bg-amber-100 border border-amber-200 rounded p-2 leading-snug">
                Bu işlem geri alınamaz. Mevcut tüm veriler yeni dosyayla değiştirilecek. Devam etmek
                istediğinize emin misiniz?
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={busy !== null}
                  className="flex-1 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-sm font-medium rounded-lg"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={busy !== null}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-300 text-white text-sm font-medium rounded-lg"
                >
                  {busy === 'restore' ? <Spinner /> : null} Geri Yükle
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {msg ? (
        <div
          className={`mt-4 text-sm rounded-lg px-3 py-2 border ${
            msg.kind === 'ok'
              ? 'bg-green-50 text-green-800 border-green-200'
              : msg.kind === 'warn'
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {msg.text}
        </div>
      ) : null}
    </div>
  )
}

function DownloadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  )
}

function UploadIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
    </svg>
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
