/** Sunucuda yalnızca son 4 hane saklanır; UI’da ilk 12 hane maskelenir. */

export function formatMaskedCardPan(lastFour: string): string {
  const four = String(lastFour ?? '').replace(/\D/g, '').slice(0, 4);
  return `•••• •••• •••• ${four}`;
}

/** Liste satırı — ör. 411156********07 benzeri (yalnızca son 4 bilindiğinden 12 yıldız + 4 hane) */
export function formatPaymentListMask(lastFour: string): string {
  const four = String(lastFour ?? '').replace(/\D/g, '').slice(0, 4);
  return `${'*'.repeat(12)}${four}`;
}

export function sanitizeCardPanInput(raw: string, maxLen = 16): string {
  return raw.replace(/\D/g, '').slice(0, maxLen);
}

/** 16 rakamı 4444 4444 4444 4444 biçiminde gösterir; `value` yalnızca rakamlardan oluşmalıdır. */
export function formatCardPanWithSpaces(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 16);
  if (!d) return '';
  return d.match(/.{1,4}/g)?.join(' ') ?? d;
}

export function lastFourFromPan(digits: string): string {
  return digits.replace(/\D/g, '').slice(-4);
}

export function validatePanLength16(digits: string): string | null {
  const d = digits.replace(/\D/g, '');
  if (d.length !== 16) return 'Kart numarası 16 hane olmalıdır.';
  return null;
}

/** Görüntü AA/YY; en fazla 4 rakam. */
export function formatCardExpiryAAYY(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

/** Tam 4 rakamdan AA/YY ayrıştırır; YY → 20YY. */
export function parseCardExpiryAAYY(formatted: string): { month: number; yearFull: number } | null {
  const d = formatted.replace(/\D/g, '');
  if (d.length !== 4) return null;
  const month = parseInt(d.slice(0, 2), 10);
  const yy = parseInt(d.slice(2), 10);
  if (month < 1 || month > 12 || Number.isNaN(yy)) return null;
  const yearFull = 2000 + yy;
  return { month, yearFull };
}

/** Kart ilgili ay sonuna kadar geçerlidir; bu ay dahil henüz geçerliyse true. */
export function isCardExpiryNotExpired(
  month: number,
  yearFull: number,
  now: Date = new Date(),
): boolean {
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  return yearFull * 12 + month >= cy * 12 + cm;
}
