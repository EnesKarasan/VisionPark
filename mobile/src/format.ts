/**
 * Backend, datetime alanlarını UTC olarak hesaplayıp Z suffix'i olmadan döner
 * (örn. "2026-05-23T02:37:10.263488"). JavaScript bunu yerel saat sanır.
 * Bu helper string'i UTC olarak parse eder.
 */
export function parseUtcDate(iso: string): Date {
  if (!iso) return new Date(NaN);
  // Zaten Z veya +/-offset varsa olduğu gibi parse et
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(iso)) return new Date(iso);
  // Aksi halde UTC olarak yorumla
  return new Date(iso + 'Z');
}

export function formatDateTimeTr(iso: string): string {
  try {
    const d = parseUtcDate(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatSessionSummaryDate(iso: string): string {
  try {
    const d = parseUtcDate(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString('tr-TR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}
