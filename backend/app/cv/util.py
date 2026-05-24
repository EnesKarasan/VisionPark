"""
Park alanı (slot) yardımcı fonksiyonları.
Mask'tan connected components ile park alanı koordinatlarını çıkarır.
"""

import numpy as np
import cv2


def get_parking_spots_bboxes(connected_components):
    """Connected components'tan park alanı [x, y, w, h] listesi döndürür."""
    (totalLabels, label_ids, values, centroid) = connected_components

    slots = []
    coef = 1
    for i in range(1, totalLabels):
        x1 = int(values[i, cv2.CC_STAT_LEFT] * coef)
        y1 = int(values[i, cv2.CC_STAT_TOP] * coef)
        w = int(values[i, cv2.CC_STAT_WIDTH] * coef)
        h = int(values[i, cv2.CC_STAT_HEIGHT] * coef)

        slots.append([x1, y1, w, h])

    return slots
