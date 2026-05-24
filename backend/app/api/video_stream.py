"""
MJPEG video stream endpoint.
Mask → park alanı bbox + YOLOv11n → araç tespiti + IoU threshold → dolu/boş.
HTTP üzerinden canlı yayın.
"""
import time
import asyncio
import threading
from pathlib import Path

import cv2
import numpy as np
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse, Response

from app.core.database import SessionLocal
from app.core.config import get_settings
from app.core.logging_config import get_logger
from app.cv import YOLOVehicleDetector
from app.models import Spot, ParkingLot, ParkingSession
from app.models.parking_session import SessionStatus

router = APIRouter(prefix="/video", tags=["video"])
logger = get_logger("api.video_stream")
settings = get_settings()

ROOT = Path(settings.PROJECT_ROOT)

VIDEO_PATH = settings.CV_VIDEO_PATH
MODEL_PATH = settings.CV_MODEL_PATH
IOU_THRESHOLD = settings.CV_IOU_THRESHOLD
CONFIDENCE = settings.CV_CONFIDENCE
YOLO_STEP = settings.CV_STREAM_YOLO_STEP
TARGET_FPS = settings.CV_STREAM_TARGET_FPS
JPEG_QUALITY = settings.CV_STREAM_JPEG_QUALITY


def _resolve_device(requested: str) -> str:
    if requested != "auto":
        return requested
    try:
        import torch
        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


_device = _resolve_device(settings.CV_DEVICE)

_shutdown = threading.Event()


# ── Shared state: YOLO sonuçlarını hem stream hem JSON endpoint paylaşır ──
class _DetectionState:
    def __init__(self):
        self.lock = threading.Lock()
        self.total = 0
        self.available = 0
        self.occupied = 0
        self.reserved = 0
        self.spots_detail: list[dict] = []

    def update(self, spots_bboxes: list, spots_status: list,
               labels: list[str] | None = None,
               reserved: list[bool] | None = None):
        with self.lock:
            self.total = len(spots_status)
            self.reserved = sum(1 for r in (reserved or []) if r)
            self.available = sum(
                1 for i, s in enumerate(spots_status)
                if s and not (reserved and i < len(reserved) and reserved[i])
            )
            self.occupied = self.total - self.available - self.reserved
            self.spots_detail = []
            for i, bbox in enumerate(spots_bboxes):
                is_empty = spots_status[i] if i < len(spots_status) else True
                is_res = reserved[i] if reserved and i < len(reserved) else False
                lbl = labels[i] if labels and i < len(labels) else f"P-{i+1:02d}"
                self.spots_detail.append({
                    "index": i + 1,
                    "spot_number": lbl,
                    "bbox": bbox,
                    "is_occupied": not is_empty,
                    "is_reserved": is_res,
                })

    def snapshot(self) -> dict:
        with self.lock:
            return {
                "total": self.total,
                "available": self.available,
                "occupied": self.occupied,
                "reserved": self.reserved,
                "spots": list(self.spots_detail),
            }


_state = _DetectionState()


def _sync_db(spots_status: list) -> list[bool]:
    """
    YOLO sonuçlarını DB'ye yaz ve is_reserved listesini döndür.

    Kaynak güvenilirlik hiyerarşisi:
      1. is_reserved=True       → YOLO dokunmaz (sarı kalır)
      2. Aktif ParkingSession   → is_occupied=True (kırmızı kalır, QR çıkışa kadar)
      3. Hiçbiri yok            → YOLO tespitine güven (kamera tespit/boş)
    """
    global _spots_reserved, _spots_active_session
    db = SessionLocal()
    reserved_flags: list[bool] = [False] * len(spots_status)
    session_flags: list[bool] = [False] * len(spots_status)
    try:
        lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
        if not lot:
            return reserved_flags
        db_spots = (
            db.query(Spot)
            .filter(Spot.parking_lot_id == lot.id)
            .order_by(Spot.mask_index, Spot.spot_number)
            .all()
        )

        # Aktif session'lı spot id'leri (QR ile giriş yapılmış)
        active_session_spot_ids = {
            row[0]
            for row in db.query(ParkingSession.spot_id)
            .filter(ParkingSession.status == SessionStatus.active)
            .all()
        }

        preserved_session = 0
        preserved_reserved = 0
        for i in range(min(len(db_spots), len(spots_status))):
            spot = db_spots[i]
            reserved_flags[i] = spot.is_reserved
            if spot.is_reserved:
                preserved_reserved += 1
                continue  # rezerve, YOLO dokunmaz
            if spot.id in active_session_spot_ids:
                # Aktif oturum: kırmızı kalmalı, YOLO override etmesin
                if not spot.is_occupied:
                    spot.is_occupied = True
                session_flags[i] = True
                preserved_session += 1
                continue
            # Bağlı bir oturum yok → YOLO tespitine güven
            spot.is_occupied = not spots_status[i]
        db.commit()
        _spots_reserved = reserved_flags
        _spots_active_session = session_flags
        if preserved_session or preserved_reserved:
            logger.debug(
                "YOLO sync: %d spot · %d aktif-session korundu · %d rezerve korundu",
                len(db_spots), preserved_session, preserved_reserved,
            )
    except Exception:
        logger.exception("DB güncelleme hatası")
        db.rollback()
    finally:
        db.close()
    return reserved_flags


# ── Spot + YOLO init (lazy) ──
_spots_bboxes: list = []
_spot_labels: list[str] = []
_spots_reserved: list[bool] = []
_spots_active_session: list[bool] = []
_detector: YOLOVehicleDetector | None = None
_init_lock = threading.Lock()
_initialized = False


def _load_spots_from_db() -> tuple[list, list[str], list[bool]]:
    """DB'den aktif otoparkın park alanı bbox, etiket ve rezervasyon durumunu yükle."""
    db = SessionLocal()
    try:
        lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
        if not lot:
            return [], [], []
        db_spots = (
            db.query(Spot)
            .filter(Spot.parking_lot_id == lot.id)
            .order_by(Spot.mask_index, Spot.spot_number)
            .all()
        )
        if not db_spots:
            return [], [], []
        bboxes = [s.bbox for s in db_spots]
        labels = [s.spot_number for s in db_spots]
        reserved = [s.is_reserved for s in db_spots]
        return bboxes, labels, reserved
    except Exception:
        logger.exception("DB spot yükleme hatası")
        return [], [], []
    finally:
        db.close()


def _ensure_init():
    global _spots_bboxes, _spot_labels, _spots_reserved, _detector, _initialized
    if _initialized:
        return
    with _init_lock:
        if _initialized:
            return

        bboxes, labels, reserved = _load_spots_from_db()
        if bboxes:
            logger.info("%d park alanı DB'den yüklendi", len(bboxes))
        else:
            logger.warning("DB'de park alanı yok - admin panelden çizim yapılmalı")

        _spots_bboxes = bboxes
        _spot_labels = labels
        _spots_reserved = reserved

        logger.info("YOLO modeli yükleniyor: %s (device=%s)", MODEL_PATH, _device)
        _detector = YOLOVehicleDetector(
            model_path=MODEL_PATH,
            iou_threshold=IOU_THRESHOLD,
            confidence=CONFIDENCE,
            custom_model=True,
            device=_device,
        )
        logger.info("Model hazır.")
        _initialized = True


def reload_spots():
    """Admin spot kaydettiğinde çağrılır - bbox listesini DB'den yeniden yükler."""
    global _spots_bboxes, _spot_labels, _spots_reserved
    with _init_lock:
        bboxes, labels, reserved = _load_spots_from_db()
        _spots_bboxes = bboxes
        _spot_labels = labels
        _spots_reserved = reserved
        if bboxes:
            logger.info("Spot listesi yenilendi: %d alan", len(bboxes))
        else:
            logger.info("Tüm spotlar silindi - ham video gösteriliyor")


# ── Çizim ──
def _draw_frame(frame: np.ndarray, spots: list, spots_status: list,
                labels: list[str] | None = None,
                detections: list | None = None,
                reserved: list[bool] | None = None,
                active_sessions: list[bool] | None = None) -> np.ndarray:
    if not spots_status or len(spots_status) != len(spots):
        return frame

    overlay = frame.copy()
    for idx, spot in enumerate(spots):
        x, y, w, h = spot
        is_reserved = reserved[idx] if reserved and idx < len(reserved) else False
        has_session = active_sessions[idx] if active_sessions and idx < len(active_sessions) else False
        is_empty = spots_status[idx] and not has_session
        if is_reserved:
            fill = (0, 200, 200)   # sarı (BGR)
        elif is_empty:
            fill = (0, 180, 0)     # yeşil
        else:
            fill = (0, 0, 180)     # kırmızı
        cv2.rectangle(overlay, (x, y), (x + w, y + h), fill, -1)
    cv2.addWeighted(overlay, 0.25, frame, 0.75, 0, frame)

    for idx, spot in enumerate(spots):
        x, y, w, h = spot
        is_reserved = reserved[idx] if reserved and idx < len(reserved) else False
        has_session = active_sessions[idx] if active_sessions and idx < len(active_sessions) else False
        is_empty = spots_status[idx] and not has_session
        if is_reserved:
            border = (0, 255, 255)  # parlak sarı (BGR)
        elif is_empty:
            border = (0, 255, 0)    # yeşil
        else:
            border = (0, 0, 255)    # kırmızı
        cv2.rectangle(frame, (x, y), (x + w, y + h), border, 2)

        label = labels[idx] if labels and idx < len(labels) else str(idx + 1)
        font = cv2.FONT_HERSHEY_SIMPLEX
        (tw, th), _ = cv2.getTextSize(label, font, 0.35, 1)
        cx = x + (w - tw) // 2
        cy = y + (h + th) // 2
        cv2.putText(frame, label, (cx, cy), font, 0.35, (255, 255, 255), 1, cv2.LINE_AA)

    return frame


def _draw_hud(frame: np.ndarray, total: int, available: int, occupied: int,
              reserved: int = 0) -> np.ndarray:
    bar_h = 44
    bar_w = frame.shape[1]
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (bar_w, bar_h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.85, frame, 0.15, 0, frame)

    font = cv2.FONT_HERSHEY_SIMPLEX

    cv2.circle(frame, (20, 22), 5, (0, 220, 0), -1)
    cv2.putText(frame, "CANLI", (30, 27), font, 0.45, (0, 220, 0), 1, cv2.LINE_AA)

    base_txt = f"Toplam: {total}   Bos: {available}   Dolu: {occupied}"
    cv2.putText(frame, base_txt, (100, 28), font, 0.6, (255, 255, 255), 1, cv2.LINE_AA)

    if reserved > 0:
        (bw, _), _ = cv2.getTextSize(base_txt + "   ", font, 0.6, 1)
        res_txt = f"Rezerve: {reserved}"
        cv2.putText(frame, res_txt, (100 + bw, 28), font, 0.6, (0, 255, 255), 1, cv2.LINE_AA)

    model_txt = f"YOLOv11n  |  IoU>{IOU_THRESHOLD}  |  conf>{CONFIDENCE}"
    (tw, _), _ = cv2.getTextSize(model_txt, font, 0.35, 1)
    cv2.putText(frame, model_txt, (bar_w - tw - 15, 28), font, 0.35, (160, 160, 160), 1, cv2.LINE_AA)

    return frame


# ── MJPEG generator (async, disconnect-aware) ──
async def _generate_frames(request: Request):
    _ensure_init()

    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        raise RuntimeError(f"Video açılamadı: {VIDEO_PATH}")

    frame_nmr = 0
    spots_status: list = [None] * len(_spots_bboxes)
    last_detections: list = []

    interval = 1.0 / TARGET_FPS

    try:
        while not _shutdown.is_set():
            if await request.is_disconnected():
                break

            t0 = time.time()

            ret, frame = cap.read()
            if not ret:
                cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                ret, frame = cap.read()
                if not ret:
                    await asyncio.sleep(0.5)
                    continue
                frame_nmr = 0

            if frame_nmr % YOLO_STEP == 0:
                spots_status, last_detections = _detector.get_spots_status(
                    frame, _spots_bboxes, return_detections=True
                )
                reserved_flags = _sync_db(spots_status)
                _state.update(_spots_bboxes, spots_status, _spot_labels, reserved_flags)

            if spots_status and None not in spots_status:
                frame = _draw_frame(frame, _spots_bboxes, spots_status, _spot_labels,
                                    last_detections, _spots_reserved, _spots_active_session)

                total = len(spots_status)
                res_count = sum(1 for r in _spots_reserved if r)
                available = sum(
                    1 for i, s in enumerate(spots_status)
                    if s
                    and not (i < len(_spots_reserved) and _spots_reserved[i])
                    and not (i < len(_spots_active_session) and _spots_active_session[i])
                )
                occupied = total - available - res_count
                frame = _draw_hud(frame, total, available, occupied, res_count)

            _, jpeg = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY])
            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n" + jpeg.tobytes() + b"\r\n"
            )

            frame_nmr += 1

            elapsed = time.time() - t0
            sleep_time = interval - elapsed
            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

    except (asyncio.CancelledError, GeneratorExit):
        pass
    finally:
        cap.release()
        logger.info("Stream bağlantısı kapandı.")


# ── Endpoints ──
@router.get("/stream")
async def video_stream(request: Request):
    """MJPEG canlı video - YOLOv11n araç tespiti ile park alanı durumu."""
    return StreamingResponse(
        _generate_frames(request),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@router.on_event("shutdown")
def on_shutdown():
    _shutdown.set()


@router.get("/frame")
def get_single_frame():
    """Video'dan tek bir JPEG frame döner (admin editör için)."""
    cap = cv2.VideoCapture(VIDEO_PATH)
    if not cap.isOpened():
        return Response(status_code=503, content="Video açılamadı")
    ret, frame = cap.read()
    cap.release()
    if not ret:
        return Response(status_code=503, content="Frame okunamadı")
    _, jpeg = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return Response(content=jpeg.tobytes(), media_type="image/jpeg")


@router.get("/status")
def video_status():
    """Son YOLO tespitinin JSON özeti (stream açıkken güncellenir)."""
    return _state.snapshot()
