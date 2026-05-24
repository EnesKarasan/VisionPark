// Dev: Vite proxy /api → localhost:8000. Prod (Vercel): VITE_API_BASE env'i tam URL ile dolu.
const API = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? '/api/v1';

async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers || {});
  headers.set('ngrok-skip-browser-warning', '1');
  headers.set('bypass-tunnel-reminder', 'true');
  try {
    return await fetch(input, { ...init, headers });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (
      msg === 'Failed to fetch' ||
      msg.includes('NetworkError') ||
      msg.includes('Load failed') ||
      msg.includes('Network request failed')
    ) {
      throw new Error(
        'API sunucusuna ulaşılamıyor. FastAPI backend\'i çalıştırın (örn. port 8000). ' +
          'Admin panel `npm run dev` ile açıksa Vite, /api isteklerini http://localhost:8000 adresine yönlendirir.',
      );
    }
    throw e;
  }
}

/** FastAPI hata gövdesinden okunabilir mesaj (401/403 için kullanıcıya gösterilir). */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** 401/403 sonrası panel oturumunu kapatır ve giriş ekranına döner. */
export function redirectIfUnauthorized(error: unknown): boolean {
  if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
    localStorage.removeItem('token');
    window.location.reload();
    return true;
  }
  return false;
}

async function parseErrorResponse(res: Response): Promise<string> {
  try {
    const j = await res.json();
    if (typeof j.detail === 'string') return j.detail;
    if (Array.isArray(j.detail)) {
      return j.detail.map((d: { msg?: string }) => d.msg ?? '').filter(Boolean).join(', ');
    }
  } catch {
    /* ignore */
  }
  return `HTTP ${res.status}`;
}

async function throwIfNotOk(res: Response): Promise<void> {
  if (res.ok) return;
  const msg = await parseErrorResponse(res);
  throw new ApiError(msg, res.status);
}

export const VIDEO_STREAM_URL = `${API}/video/stream`;

/** Genel GET /spots yanıtı (mobil park haritası ile aynı kaynak) */
export interface PublicSpot {
  id: number;
  spot_number: string;
  is_occupied: boolean;
  is_reserved: boolean;
  bbox: number[];
  parking_lot_id: number;
  section: string | null;
  row_number: number | null;
}

export interface SpotsSummary {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  spots: PublicSpot[];
  parking_lot_name: string | null;
}

export async function getSpots(): Promise<SpotsSummary> {
  const res = await apiFetch(`${API}/spots`);
  if (!res.ok) throw new Error('Spots alınamadı');
  return res.json();
}

export interface Token {
  access_token: string;
  token_type: string;
  user: { id: number; email: string; role: string; full_name?: string };
}

export async function login(email: string, password: string): Promise<Token> {
  const res = await apiFetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Giriş başarısız');
  }
  return res.json();
}

export interface AdminSessionPayment {
  id: number;
  amount: number;
  status: string;
  provider: string | null;
  created_at: string | null;
  card_last_four: string | null;
  card_brand: string | null;
}

export interface AdminSessionRow {
  id: number;
  user_id: number;
  spot_id: number;
  spot_number: string;
  started_at: string;
  ended_at: string | null;
  total_fee: number | null;
  status: string;
  plate_number: string | null;
  customer_name: string;
  customer_email: string;
  payment: AdminSessionPayment | null;
}

export interface AdminSessionsQuery {
  limit?: number;
  offset?: number;
  status?: string;
  started_after?: string;
  started_before?: string;
}

export async function getAdminSessions(
  token: string,
  query?: AdminSessionsQuery,
): Promise<AdminSessionRow[]> {
  const params = new URLSearchParams();
  if (query?.limit != null) params.set('limit', String(query.limit));
  if (query?.offset != null) params.set('offset', String(query.offset));
  if (query?.status) params.set('status', query.status);
  if (query?.started_after) params.set('started_after', query.started_after);
  if (query?.started_before) params.set('started_before', query.started_before);
  const qs = params.toString();
  const res = await apiFetch(`${API}/admin/sessions${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return res.json();
}

export interface TimeseriesBucket {
  label: string;
  revenue: number;
  sessions: number;
}

export interface TimeseriesResponse {
  granularity: string;
  start: string | null;
  end: string | null;
  buckets: TimeseriesBucket[];
}

export type TimeseriesGranularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

export async function getAdminReportsTimeseries(
  token: string,
  opts: {
    granularity: TimeseriesGranularity;
    days?: number;
    start?: string;
    end?: string;
  },
): Promise<TimeseriesResponse> {
  const params = new URLSearchParams();
  params.set('granularity', opts.granularity);
  if (opts.days != null) params.set('days', String(opts.days));
  if (opts.start) params.set('start', opts.start);
  if (opts.end) params.set('end', opts.end);
  const res = await apiFetch(`${API}/admin/reports/timeseries?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return res.json();
}

export async function getAdminStats(token: string) {
  const res = await apiFetch(`${API}/admin/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return res.json();
}

// ── Park Alanı Editörü API ──

const VIDEO_FRAME_URL = `${API}/video/frame`;

export interface SpotWithSection {
  id: number;
  spot_number: string;
  bbox: number[];
  is_occupied: boolean;
  is_reserved: boolean;
  parking_lot_id: number;
  section: string | null;
  row_number: number | null;
}

export interface SpotCreatePayload {
  spot_number: string;
  bbox: number[];
  section?: string;
  row_number?: number;
}

export async function getVideoFrame(): Promise<string> {
  const res = await apiFetch(VIDEO_FRAME_URL);
  if (!res.ok) throw new Error('Video frame alınamadı');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function getAdminSpots(token: string): Promise<SpotWithSection[]> {
  const res = await apiFetch(`${API}/admin/spots`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return res.json();
}

export async function saveAdminSpotsBulk(
  token: string,
  spots: SpotCreatePayload[]
): Promise<SpotWithSection[]> {
  const res = await apiFetch(`${API}/admin/spots/bulk`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ spots }),
  });
  if (!res.ok) throw new Error('Park alanları kaydedilemedi');
  return res.json();
}

export async function deleteAllAdminSpots(token: string): Promise<void> {
  const res = await apiFetch(`${API}/admin/spots`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Park alanları silinemedi');
}

// ── Ücretlendirme (mobil /pricing ile aynı veri) ──

export interface AdminPricingBracket {
  label: string;
  price: string;
  max_minutes?: number | null;
}

export interface AdminPricing {
  free_minutes: number;
  brackets: AdminPricingBracket[];
  currency: string;
}

const BRACKET_MAX_MINUTES = [60, 120, 240, 480, 720] as const;

export interface AdminPricingUpdate {
  free_minutes?: number;
  brackets?: Array<{ max_minutes?: number; price: number }>;
  currency?: string;
}

/** Panel formundan API gövdesi üretir (son dilim üst süresiz); para birimi sabit TRY. */
export function buildAdminPricingUpdateBody(freeMinutes: number, tierPrices: number[]): AdminPricingUpdate {
  const brackets: Array<{ max_minutes?: number; price: number }> = BRACKET_MAX_MINUTES.map(
    (max_minutes, i) => ({ max_minutes, price: tierPrices[i] ?? 0 }),
  );
  brackets.push({ price: tierPrices[BRACKET_MAX_MINUTES.length] ?? 0 });
  return { free_minutes: freeMinutes, brackets, currency: 'TRY' };
}

export async function getAdminPricing(token: string): Promise<AdminPricing> {
  const res = await apiFetch(`${API}/admin/pricing`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return res.json();
}

export async function updateAdminPricing(token: string, body: AdminPricingUpdate): Promise<AdminPricing> {
  const res = await apiFetch(`${API}/admin/pricing`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res);
  return res.json();
}


// ─── Veritabanı yedekleme / geri yükleme ─────────────────────────────────

/** SQLite veritabanının canlı snapshot'ını indirir. Dosya adı sunucudan gelir. */
export async function downloadBackup(token: string): Promise<void> {
  const res = await apiFetch(`${API}/admin/backup`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);

  // Content-Disposition header'ından dosya adını çıkar
  const cd = res.headers.get('content-disposition') || '';
  const match = cd.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] ?? `carparking_${new Date().toISOString().slice(0, 10)}.db`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export type RestoreResponse = {
  ok: boolean;
  detail: string;
  restart_required: boolean;
};

/** Bir .db dosyasını sunucuya yükler ve geri yükler. Backend yeniden başlatılmalıdır. */
export async function uploadRestore(token: string, file: File): Promise<RestoreResponse> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiFetch(`${API}/admin/restore`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  await throwIfNotOk(res);
  return res.json();
}


// ─── Kullanıcı yönetimi ────────────────────────────────────────────────

export type UserRoleValue = 'admin' | 'operator' | 'customer';

export interface AdminUserRow {
  id: number;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  role: UserRoleValue;
  is_active: boolean;
  created_at: string | null;
  missed_reservation_entry_count: number;
}

export interface AdminUserCreate {
  email: string;
  password: string;
  full_name?: string;
  role: UserRoleValue;
}

export interface AdminUserUpdate {
  role?: UserRoleValue;
  is_active?: boolean;
  full_name?: string;
}

export async function listAdminUsers(
  token: string,
  options?: { role?: UserRoleValue; q?: string },
): Promise<AdminUserRow[]> {
  const params = new URLSearchParams();
  if (options?.role) params.set('role', options.role);
  if (options?.q) params.set('q', options.q);
  const qs = params.toString();
  const res = await apiFetch(`${API}/admin/users${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return res.json();
}

export async function createAdminUser(token: string, body: AdminUserCreate): Promise<AdminUserRow> {
  const res = await apiFetch(`${API}/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res);
  return res.json();
}

export async function updateAdminUser(
  token: string,
  userId: number,
  body: AdminUserUpdate,
): Promise<AdminUserRow> {
  const res = await apiFetch(`${API}/admin/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  await throwIfNotOk(res);
  return res.json();
}

export async function deleteAdminUser(token: string, userId: number): Promise<void> {
  const res = await apiFetch(`${API}/admin/users/${userId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
}


// ─── Kullanıcı detayı (KVKK uyumlu özet) ─────────────────────────────────

export interface UserDetailProfile {
  id: number;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  gender: string | null;
  role: UserRoleValue;
  is_active: boolean;
  created_at: string | null;
}

export interface UserDetailSummary {
  session_count: number;
  active_session: boolean;
  total_paid: number;
  missed_reservation_count: number;
  vehicle_count: number;
  card_count: number;
}

export interface UserDetailSession {
  id: number;
  spot_number: string | null;
  section: string | null;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number | null;
  plate_number: string | null;
  total_fee: number | null;
  status: string;
  payment: AdminSessionPayment | null;
}

export interface UserDetailReservation {
  id: number;
  spot_number: string | null;
  reserved_at: string | null;
  scheduled_start_at: string | null;
  expires_at: string | null;
  entry_deadline_at: string | null;
  status: string;
}

export interface UserDetailVehicle {
  id: number;
  plate: string;
  label: string | null;
  created_at: string | null;
}

export interface UserDetailCard {
  id: number;
  last_four: string;
  brand: string;
  holder_name: string;
  exp_month: number;
  exp_year: number;
  label: string | null;
  created_at: string | null;
}

export interface UserDetail {
  profile: UserDetailProfile;
  summary: UserDetailSummary;
  sessions: UserDetailSession[];
  reservations: UserDetailReservation[];
  vehicles: UserDetailVehicle[];
  payment_cards: UserDetailCard[];
}

export async function getAdminUserDetail(token: string, userId: number): Promise<UserDetail> {
  const res = await apiFetch(`${API}/admin/users/${userId}/detail`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return res.json();
}


// ─── Sistem sağlığı ────────────────────────────────────────────────────

export interface SystemHealthBackend {
  status: string;
  python_version: string;
  platform: string;
}

export interface SystemHealthDatabase {
  type: string;
  path: string | null;
  size_bytes: number;
  size_human: string;
}

export interface SystemHealthCV {
  status: string;
  device: string;
  interval_sec: number;
  model_path: string;
}

export interface SystemHealthParkingLot {
  name: string | null;
  spot_count: number;
  active_sessions: number;
}

export interface SystemHealthBackup {
  name: string;
  size_bytes: number;
  modified_at: string;
}

export interface SystemHealth {
  backend: SystemHealthBackend;
  database: SystemHealthDatabase;
  cv: SystemHealthCV;
  parking_lot: SystemHealthParkingLot;
  users: Record<string, number>;
  backups: SystemHealthBackup[];
  checked_at: string;
}

export async function getSystemHealth(token: string): Promise<SystemHealth> {
  const res = await apiFetch(`${API}/admin/health`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwIfNotOk(res);
  return res.json();
}

