"""
Otopark Alan Tespit Sistemi
YOLO ile araç tespiti + mask ile park alanı konumları
"""

import cv2
import numpy as np

from util import get_parking_spots_bboxes
from yolo_detector import YOLOVehicleDetector

# ========== DOSYA YOLLARI ==========
MASK_PATH = "./mask_1920_1080.png"
VIDEO_PATH = "./samples/parking_1920_1080_loop.mp4"

# ========== MODEL AYARLARI ==========
# Kendi eğittiğiniz model: runs/train/<klasör>/weights/best.pt
USE_CUSTOM_MODEL = True
CUSTOM_MODEL_PATH = "runs/train/fine_tune_11n/weights/best.pt"
# Diğer modeller: fine_tune_11s, fine_tune_12n, fine_tune_12s

# Tespit parametreleri
IOU_THRESHOLD = 0.30   # Araç-park örtüşme eşiği
CONFIDENCE = 0.25      # YOLO güven eşiği

# GPU kullanımı: 'cuda' veya 0 = GPU, 'cpu' = CPU, None = otomatik
USE_GPU = "cuda"  # GPU varsa kullan. CUDA yoksa 'cpu' yazın

# GPU kontrolü - yoksa CPU'ya geç
try:
    import torch
    if USE_GPU and USE_GPU != "cpu" and not torch.cuda.is_available():
        USE_GPU = "cpu"
        print("GPU bulunamadı, CPU kullanılıyor.")
except ImportError:
    USE_GPU = "cpu"

# Model seçimi
if USE_CUSTOM_MODEL:
    detector = YOLOVehicleDetector(
        model_path=CUSTOM_MODEL_PATH,
        iou_threshold=IOU_THRESHOLD,
        confidence=CONFIDENCE,
        custom_model=True,  # car, truck sınıfları (data/yolo Yolo12)
        device=USE_GPU,
    )
else:
    detector = YOLOVehicleDetector(
        model_path="yolov8n.pt",
        iou_threshold=IOU_THRESHOLD,
        confidence=CONFIDENCE,
        device=USE_GPU,
    )

mask = cv2.imread(MASK_PATH, 0)
cap = cv2.VideoCapture(VIDEO_PATH)

connected_components = cv2.connectedComponentsWithStats(mask, 4, cv2.CV_32S)
spots = get_parking_spots_bboxes(connected_components)

spots_status = [None for _ in spots]
last_detections = []  # YOLO tespitlerini göstermek için

# ========== GÖRSELLEŞTİRME ==========
SHOW_YOLO_DETECTIONS = False  # True = araç tespit kutuları (mavi) görünür

frame_nmr = 0
ret = True
step = 30  # Her 30 framede bir YOLO çalıştır (performans için)
while ret:
    ret, frame = cap.read()
    if not ret:
        break

    # Her step framede bir YOLO ile tüm park alanlarını kontrol et
    if frame_nmr % step == 0:
        if SHOW_YOLO_DETECTIONS:
            spots_status, last_detections = detector.get_spots_status(
                frame, spots, return_detections=True
            )
        else:
            spots_status = detector.get_spots_status(frame, spots)

    # YOLO araç tespitlerini çiz (mavi kutular + etiket)
    if SHOW_YOLO_DETECTIONS and last_detections:
        for (x1, y1, x2, y2), label, conf in last_detections:
            x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
            cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 200, 0), 2)  # Mavi-turuncu
            txt = f"{label} {conf:.0%}"
            (tw, th), _ = cv2.getTextSize(txt, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)
            cv2.rectangle(frame, (x1, y1 - th - 8), (x1 + tw + 4, y1), (255, 200, 0), -1)
            cv2.putText(frame, txt, (x1 + 2, y1 - 4), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 2)

    # Sadece geçerli sonuç varsa çiz (ilk birkaç frame için)
    if spots_status and None not in spots_status:
        for spot_indx, spot in enumerate(spots):
            spot_status = spots_status[spot_indx]
            x1, y1, w, h = spots[spot_indx]

            if spot_status:  # True = boş
                frame = cv2.rectangle(frame, (x1, y1), (x1 + w, y1 + h), (0, 255, 0), 2)
            else:  # False = dolu
                frame = cv2.rectangle(frame, (x1, y1), (x1 + w, y1 + h), (0, 0, 255), 2)

    cv2.rectangle(frame, (80, 20), (550, 100), (0, 0, 0), -1)
    available = sum(s for s in spots_status if s is not None) if spots_status else 0
    total = len(spots_status) if spots_status else 0
    cv2.putText(frame, 'Available spots: {} / {}'.format(available, total), (100, 55),
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    if SHOW_YOLO_DETECTIONS:
        cv2.putText(frame, 'Mavi kutular: YOLO araç tespitleri | Q: çıkış', (100, 88),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (180, 180, 180), 1)

    cv2.namedWindow('frame', cv2.WINDOW_NORMAL)
    cv2.imshow('frame', frame)
    if cv2.waitKey(25) & 0xFF == ord('q'):
        break

    frame_nmr += 1

cap.release()
cv2.destroyAllWindows()
