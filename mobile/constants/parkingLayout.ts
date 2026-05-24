/** Kamera / maske ile uyumlu referans çözünürlük (proje verisi: 1920×1080). */
export const PARK_FRAME = { width: 1920, height: 1080 } as const;

export type BBoxLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/** bbox: [x, y, w, h] — video koordinatlarından harita piksellerine */
export function bboxToLayout(
  bbox: number[],
  mapWidth: number,
  mapHeight: number,
): BBoxLayout | null {
  if (!Array.isArray(bbox) || bbox.length < 4) return null;
  const [x, y, w, h] = bbox;
  if (w <= 0 || h <= 0) return null;
  const sx = mapWidth / PARK_FRAME.width;
  const sy = mapHeight / PARK_FRAME.height;
  return {
    left: x * sx,
    top: y * sy,
    width: w * sx,
    height: h * sy,
  };
}

export function isValidBbox(bbox: unknown): bbox is number[] {
  return (
    Array.isArray(bbox) &&
    bbox.length >= 4 &&
    typeof bbox[0] === 'number' &&
    typeof bbox[1] === 'number' &&
    typeof bbox[2] === 'number' &&
    typeof bbox[3] === 'number' &&
    bbox[2] > 0 &&
    bbox[3] > 0
  );
}

/** Liste içindeki tüm bbox’ların birleşimi + boşluk (sadece bu alan ekranda gösterilir). */
export function unionBBoxViewport(
  bboxes: number[][],
  padding = 56,
): { viewX: number; viewY: number; viewW: number; viewH: number } | null {
  if (!bboxes.length) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const b of bboxes) {
    if (!isValidBbox(b)) continue;
    const [x, y, w, h] = b;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + w);
    maxY = Math.max(maxY, y + h);
  }
  if (!Number.isFinite(minX)) return null;

  let viewW = maxX - minX + 2 * padding;
  let viewH = maxY - minY + 2 * padding;
  let viewX = minX - padding;
  let viewY = minY - padding;

  const MIN_SPAN = 200;
  if (viewW < MIN_SPAN) {
    const cx = (minX + maxX) / 2;
    viewX = cx - MIN_SPAN / 2 - padding;
    viewW = MIN_SPAN + 2 * padding;
  }
  if (viewH < MIN_SPAN) {
    const cy = (minY + maxY) / 2;
    viewY = cy - MIN_SPAN / 2 - padding;
    viewH = MIN_SPAN + 2 * padding;
  }

  return { viewX, viewY, viewW, viewH };
}

/** bbox’ı görünüm alanına göre ekran piksellerine (kırpılmış plan). */
export function bboxToLayoutInViewport(
  bbox: number[],
  viewX: number,
  viewY: number,
  viewW: number,
  viewH: number,
  displayW: number,
  displayH: number,
): BBoxLayout | null {
  if (!isValidBbox(bbox) || viewW <= 0 || viewH <= 0) return null;
  const [x, y, w, h] = bbox;
  if (w <= 0 || h <= 0) return null;
  const sx = displayW / viewW;
  const sy = displayH / viewH;
  return {
    left: (x - viewX) * sx,
    top: (y - viewY) * sy,
    width: w * sx,
    height: h * sy,
  };
}
