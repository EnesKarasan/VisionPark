"""
YOLO tabanlı araç tespiti modülü.
Park alanlarının dolu/boş durumunu YOLO ile belirler.
Hem COCO ön-eğitimli hem de kendi eğittiğiniz özel modelleri destekler.
"""

from ultralytics import YOLO
import numpy as np

# COCO dataset araç sınıf ID'leri (yolov8n.pt vb. hazır modeller için)
# car, motorcycle, bus, truck
COCO_VEHICLE_CLASS_IDS = [2, 3, 5, 7]


def _intersection_over_spot(spot_bbox, vehicle_bbox):
    """
    Araç kutusunun park alanını ne kadar kapladığını hesaplar.
    spot_bbox: [x1, y1, w, h]
    vehicle_bbox: [x1, y1, x2, y2]
    """
    sx1, sy1, sw, sh = spot_bbox
    vx1, vy1, vx2, vy2 = vehicle_bbox

    # Kesişim alanı
    ix1 = max(sx1, vx1)
    iy1 = max(sy1, vy1)
    ix2 = min(sx1 + sw, vx2)
    iy2 = min(sy1 + sh, vy2)

    if ix1 >= ix2 or iy1 >= iy2:
        return 0.0

    intersection = (ix2 - ix1) * (iy2 - iy1)
    spot_area = sw * sh

    if spot_area == 0:
        return 0.0

    return intersection / spot_area


class YOLOVehicleDetector:
    """YOLO kullanarak park alanlarının dolu/boş durumunu tespit eder."""

    def __init__(
        self,
        model_path="yolov8n.pt",
        iou_threshold=0.30,
        confidence=0.25,
        custom_model=False,
        classes=None,
        device=None,
    ):
        """
        Args:
            model_path: YOLO model dosyası yolu.
                       - Hazır model: "yolov8n.pt" (otomatik indirilir)
                       - Özel model: "models/best.pt" veya "best.pt"
            iou_threshold: Araç-park alanı örtüşme oranı (0-1).
                           Bu oranın üzerinde örtüşme varsa alan dolu sayılır.
            confidence: YOLO güven eşiği (0-1)
            custom_model: True ise kendi eğittiğiniz model (sınıf filtreleme yapılmaz)
            classes: Hangi sınıf ID'lerini kullanacağı. custom_model=True ise None bırakın
                     (tüm tespitler kullanılır). COCO için [2,3,5,7]
            device: 'cuda', 'cuda:0', 0 = GPU | 'cpu' = CPU | None = otomatik
        """
        self.model = YOLO(model_path)
        self.device = device
        self.iou_threshold = iou_threshold
        self.confidence = confidence
        self.custom_model = custom_model
        # Özel model: None = tüm sınıflar kullanılır. COCO: [2,3,5,7]
        self.classes = (
            classes
            if classes is not None
            else (None if custom_model else COCO_VEHICLE_CLASS_IDS)
        )

    def get_spots_status(self, frame, spots, return_detections=False):
        """
        Tüm park alanlarının dolu/boş durumunu döndürür.

        Args:
            frame: BGR formatında video frame (numpy array)
            spots: Park alanı koordinatları listesi [[x1,y1,w,h], ...]
            return_detections: True ise (spots_status, detections) döner.
                              detections: [(xyxy, class_name, conf), ...]

        Returns:
            spots_status veya (spots_status, detections)
        """
        # YOLO ile araç tespiti (classes=None ise tüm tespitler kullanılır)
        predict_kwargs = dict(conf=self.confidence, verbose=False)
        if self.classes is not None:
            predict_kwargs["classes"] = self.classes
        if self.device is not None:
            predict_kwargs["device"] = self.device

        results = self.model.predict(frame, **predict_kwargs)

        # Tüm araç bounding box'ları ve tespit bilgileri
        vehicle_bboxes = []
        detections = []
        if results and len(results) > 0:
            boxes = results[0].boxes
            names = results[0].names
            if boxes is not None:
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy()  # [x1, y1, x2, y2]
                    vehicle_bboxes.append(xyxy)
                    if return_detections:
                        cls_id = int(box.cls[0].item())
                        conf = float(box.conf[0].item())
                        detections.append((xyxy, names.get(cls_id, "?"), conf))

        # Her park alanı için dolu mu boş mu belirle
        spots_status = []
        for spot in spots:
            spot_bbox = [int(x) for x in spot]  # [x1, y1, w, h]

            occupied = False
            for vb in vehicle_bboxes:
                iou = _intersection_over_spot(spot_bbox, vb)
                if iou >= self.iou_threshold:
                    occupied = True
                    break

            spots_status.append(not occupied)  # True=boş, False=dolu

        if return_detections:
            return spots_status, detections
        return spots_status
