import type { SavedPaymentCard, UserVehicle } from './api';
import { formatMaskedCardPan } from './cardPan';
import type { Spot } from './useParkingSpotFlow';

export const SPOT_FLOW_COLUMNS = 4;
export const SPOT_FLOW_GAP = 10;
export const SECTION_TOTAL_DOT = '#0a0a0a';

export type SectionGroup = { key: string; label: string; spots: Spot[] };
export type SectionStats = { total: number; available: number; occupied: number; reserved: number };

export function formatCountdownMmSs(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function vehicleTitleSubtitle(v: UserVehicle): { title: string; subtitle: string | null } {
  const plate = v.plate.trim();
  const label = v.label?.trim();
  if (label) return { title: label, subtitle: plate };
  return { title: plate, subtitle: null };
}

export function cardTitleSubtitle(c: SavedPaymentCard): { title: string; subtitle: string | null } {
  const label = c.label?.trim();
  const masked = formatMaskedCardPan(c.last_four);
  if (label) return { title: label, subtitle: masked };
  return { title: masked, subtitle: null };
}

export function statsForSpots(spots: Spot[]): SectionStats {
  let available = 0;
  let occupied = 0;
  let reserved = 0;
  for (const s of spots) {
    if (s.is_occupied) occupied++;
    else if (s.is_reserved) reserved++;
    else available++;
  }
  return { total: spots.length, available, occupied, reserved };
}

export function sectionValueForPlan(spot: Pick<Spot, 'section'> | null | undefined): string {
  return spot?.section?.trim() || 'Genel';
}

export function formatMoneyAmount(v: string | number | null | undefined, currency: string): string {
  if (v == null || v === '') return '—';
  const n = typeof v === 'string' ? Number(v) : v;
  if (!Number.isFinite(n)) return String(v);
  return `${n.toFixed(2)} ${currency}`;
}

export function groupSpotsBySection(spots: Spot[]): SectionGroup[] {
  const m = new Map<string, Spot[]>();
  for (const s of spots) {
    const raw = s.section?.trim();
    const key = raw && raw.length > 0 ? raw : 'Genel';
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(s);
  }
  for (const arr of m.values()) {
    arr.sort((a, b) => a.spot_number.localeCompare(b.spot_number, 'tr', { numeric: true }));
  }
  return [...m.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'tr', { numeric: true }))
    .map(([key, sp]) => ({
      key,
      label: key === 'Genel' ? 'Genel' : `Bölüm ${key}`,
      spots: sp,
    }));
}
