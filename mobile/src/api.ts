// API tabanı: EXPO_PUBLIC_API_BASE env'den okunur; yoksa lokal fallback.
// Production / ngrok için mobile/.env içine yaz:
//   EXPO_PUBLIC_API_BASE=https://unhelpful-unplug-backhand.ngrok-free.dev/api/v1
const API_BASE =
  process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:8000/api/v1';

// ngrok ücretsiz planının tarayıcı uyarı sayfasını atlat — global fetch'i sar.
// (Tek dosyada yaz, her endpoint otomatik etkilenir.)
if (typeof globalThis !== 'undefined' && (globalThis as any).fetch && !(globalThis as any).__ngrok_patched) {
  const _origFetch = (globalThis as any).fetch.bind(globalThis);
  (globalThis as any).fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers || {});
    headers.set('ngrok-skip-browser-warning', '1');
    headers.set('bypass-tunnel-reminder', 'true');
    return _origFetch(input, { ...init, headers });
  };
  (globalThis as any).__ngrok_patched = true;
}

export interface Token {
  access_token: string;
  user: { id: number; email: string; role: string };
}

async function apiErrorMessage(res: Response): Promise<string> {
  const err = await res.json().catch(() => ({}));
  const d = err.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d))
    return d.map((x: { msg?: string }) => x?.msg || String(x)).join(', ');
  return 'İşlem başarısız';
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function throwApiError(res: Response): Promise<never> {
  throw new ApiError(res.status, await apiErrorMessage(res));
}

export async function checkEmailExists(email: string): Promise<boolean> {
  const res = await fetch(`${API_BASE}/auth/check-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  const data = (await res.json()) as { exists: boolean };
  return data.exists;
}

export async function requestSignupCode(
  email: string,
): Promise<{ ok: boolean; debug_code?: string | null }> {
  const res = await fetch(`${API_BASE}/auth/request-signup-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  return res.json();
}

export async function verifySignupCode(email: string, code: string): Promise<{ signup_token: string }> {
  const res = await fetch(`${API_BASE}/auth/verify-signup-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), code: code.replace(/\s/g, '') }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  return res.json();
}

export type CompleteSignupProfile = {
  first_name: string;
  last_name: string;
  birth_date: string;
  gender: 'female' | 'male' | 'other' | 'unspecified';
};

export async function completeSignup(
  signupToken: string,
  password: string,
  profile: CompleteSignupProfile,
): Promise<Token> {
  const res = await fetch(`${API_BASE}/auth/complete-signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      signup_token: signupToken,
      password,
      first_name: profile.first_name,
      last_name: profile.last_name,
      birth_date: profile.birth_date,
      gender: profile.gender,
    }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  return res.json();
}

export async function requestPasswordResetCode(
  email: string,
): Promise<{ ok: boolean; debug_code?: string | null }> {
  const res = await fetch(`${API_BASE}/auth/request-password-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim() }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  return res.json();
}

export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<{ reset_token: string }> {
  const res = await fetch(`${API_BASE}/auth/verify-password-reset-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), code: code.replace(/\s/g, '') }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  return res.json();
}

export async function completePasswordReset(
  resetToken: string,
  password: string,
): Promise<{ ok: boolean }> {
  const res = await fetch(`${API_BASE}/auth/complete-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reset_token: resetToken, password }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  return res.json();
}

export async function loginWithGoogle(accessToken: string): Promise<Token> {
  const res = await fetch(`${API_BASE}/auth/google-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ access_token: accessToken }),
  });
  if (!res.ok) {
    throw new ApiError(res.status, await apiErrorMessage(res));
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<Token> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  return res.json();
}

export type CurrentUser = {
  id: number;
  email: string;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  birth_date: string | null;
  gender: string | null;
  role: string;
  is_active: boolean;
  missed_reservation_entry_count?: number;
  show_late_entry_warning?: boolean;
};

export async function getCurrentUser(token: string): Promise<CurrentUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    await throwApiError(res);
  }
  return res.json();
}

export async function updateCurrentUserProfile(
  token: string,
  body: { first_name: string; last_name: string; email: string },
): Promise<CurrentUser> {
  const res = await fetch(`${API_BASE}/auth/me`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      first_name: body.first_name.trim(),
      last_name: body.last_name.trim(),
      email: body.email.trim(),
    }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
  return res.json();
}

export async function changePassword(
  token: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
}

export async function deleteAccount(token: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/delete-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res));
  }
}

/** GET /spots içindeki tek park yeri (park ekranı ile uyumlu) */
export type ParkingSpotRow = {
  id: number;
  spot_number: string;
  is_occupied: boolean;
  is_reserved: boolean;
  bbox?: number[];
  parking_lot_id?: number;
  section?: string | null;
  row_number?: number | null;
};

export type SpotsSummary = {
  total: number;
  available: number;
  occupied: number;
  reserved: number;
  spots: ParkingSpotRow[];
  parking_lot_name?: string | null;
};

export type PricingBracketInfo = {
  label: string;
  price: string | number;
  max_minutes?: number | null;
};

export type PricingInfo = {
  free_minutes: number;
  brackets: PricingBracketInfo[];
  currency: string;
};

export async function getSpots(): Promise<SpotsSummary> {
  const res = await fetch(`${API_BASE}/spots`);
  if (!res.ok) throw new Error('Veriler alınamadı');
  return res.json();
}

export async function getPricing(): Promise<PricingInfo> {
  const res = await fetch(`${API_BASE}/pricing`);
  if (!res.ok) throw new Error('Ücret bilgisi alınamadı');
  return res.json();
}

export async function startParking(
  spotId: number,
  token: string,
  opts?: { plate_number?: string | null },
) {
  const body: { spot_id: number; plate_number?: string } = { spot_id: spotId };
  const plate = opts?.plate_number?.trim();
  if (plate) body.plate_number = plate;

  const res = await fetch(`${API_BASE}/parking/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Park başlatılamadı');
  }
  return res.json();
}

export type ParkingIntentKind = 'entry' | 'exit';

export type ParkingIntent = {
  token: string;
  kind: ParkingIntentKind;
  spot_id: number;
  spot_number: string | null;
  expires_at: string;
  ttl_minutes: number;
  redeem_url: string;
};

export async function createParkingIntent(
  spotId: number,
  token: string,
  opts?: { plate_number?: string | null },
): Promise<ParkingIntent> {
  const body: { kind: 'entry'; spot_id: number; plate_number?: string } = {
    kind: 'entry',
    spot_id: spotId,
  };
  const plate = opts?.plate_number?.trim();
  if (plate) body.plate_number = plate;

  const res = await fetch(`${API_BASE}/parking/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'QR oluşturulamadı');
  }
  return res.json();
}

export async function createExitParkingIntent(token: string): Promise<ParkingIntent> {
  const res = await fetch(`${API_BASE}/parking/intent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ kind: 'exit' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Çıkış QR oluşturulamadı');
  }
  return res.json();
}

export async function getActiveParkingIntent(
  token: string,
  kind: ParkingIntentKind = 'entry',
): Promise<ParkingIntent | null> {
  const res = await fetch(`${API_BASE}/parking/intent/active?kind=${kind}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data ?? null;
}

export async function endParking(token: string) {
  const res = await fetch(`${API_BASE}/parking/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Park bitirilemedi');
  }
  return res.json();
}

export async function getActiveSession(token: string) {
  const res = await fetch(`${API_BASE}/parking/active`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data;
}

export type ParkingSessionRow = {
  id: number;
  user_id: number;
  spot_id: number;
  started_at: string;
  ended_at: string | null;
  total_fee: string | number | null;
  status: string;
  spot_number: string | null;
};

export async function getMySessions(token: string): Promise<ParkingSessionRow[]> {
  const res = await fetch(`${API_BASE}/parking/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Oturumlar alınamadı');
  return res.json();
}

export type UserVehicle = {
  id: number;
  plate: string;
  label: string | null;
  created_at: string;
};

export async function getMyVehicles(token: string): Promise<UserVehicle[]> {
  const res = await fetch(`${API_BASE}/vehicles/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res));
  return res.json();
}

export async function addVehicle(
  token: string,
  body: { plate: string; label?: string | null },
): Promise<UserVehicle> {
  const res = await fetch(`${API_BASE}/vehicles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      plate: body.plate.trim(),
      label: body.label?.trim() ? body.label.trim() : null,
    }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res));
  return res.json();
}

export async function deleteVehicle(token: string, vehicleId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/vehicles/${vehicleId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res));
}

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'troy' | 'other';

export type SavedPaymentCard = {
  id: number;
  last_four: string;
  holder_name: string;
  exp_month: number;
  exp_year: number;
  brand: CardBrand | string;
  label: string | null;
  created_at: string;
};

export async function getMyPaymentCards(token: string): Promise<SavedPaymentCard[]> {
  const res = await fetch(`${API_BASE}/payment-methods/my`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res));
  return res.json();
}

export async function addPaymentCard(
  token: string,
  body: {
    last_four: string;
    holder_name: string;
    exp_month: number;
    exp_year: number;
    brand: CardBrand;
    label?: string | null;
  },
): Promise<SavedPaymentCard> {
  const res = await fetch(`${API_BASE}/payment-methods`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res));
  return res.json();
}

export async function deletePaymentCard(token: string, cardId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/payment-methods/${cardId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res));
}

// ── Rezervasyon API ──

export async function createReservation(
  spotId: number,
  token: string,
  options?: { plate_number?: string | null; scheduled_start_at?: string },
) {
  const body: Record<string, unknown> = { spot_id: spotId };
  if (options?.plate_number != null) body.plate_number = options.plate_number;
  if (options?.scheduled_start_at != null) body.scheduled_start_at = options.scheduled_start_at;
  const res = await fetch(`${API_BASE}/reservations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Rezervasyon oluşturulamadı');
  }
  return res.json();
}

export async function cancelReservation(reservationId: number, token: string) {
  const res = await fetch(`${API_BASE}/reservations/${reservationId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Rezervasyon iptal edilemedi');
  }
  return res.json();
}

export async function getActiveReservation(token: string) {
  const res = await fetch(`${API_BASE}/reservations/active`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}
