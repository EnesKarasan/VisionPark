"""Veritabanı seed - ilk park alanları, admin kullanıcı, pricing."""
import sys
from copy import deepcopy
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.core.database import SessionLocal, engine
from app.core.logging_config import get_logger

from app.models import User, ParkingLot, Spot, Pricing
from app.services.parking_fee import DEFAULT_PRICING_RULES
from app.models.user import UserRole
from app.core.security import get_password_hash

logger = get_logger("db.seed")

# Proje kökü (mask / video gibi statik varlıklara ulaşmak için)
ROOT = Path(__file__).resolve().parents[3]


def seed_database():
    """Seed parking lot, spots, admin user, pricing."""
    from app.core.database import Base
    from app.models import (
        User,
        ParkingLot,
        Spot,
        Pricing,
    )

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        existing_lot = db.query(ParkingLot).first()
        if existing_lot:
            admin = db.query(User).filter(User.email == "admin@carparking.com").first()
            if admin:
                admin.hashed_password = get_password_hash("Admin1234")
                admin.role = UserRole.admin
                admin.is_active = True
                db.commit()
                logger.info("Admin şifresi güncellendi: admin@carparking.com / Admin1234")
            else:
                db.add(
                    User(
                        email="admin@carparking.com",
                        hashed_password=get_password_hash("Admin1234"),
                        full_name="Yönetici",
                        role=UserRole.admin,
                    )
                )
                db.commit()
                logger.info("Admin kullanıcı eklendi: admin@carparking.com / Admin1234")
            return

        # Otopark
        mask_path = str(ROOT / "mask_1920_1080.png")
        video_path = str(ROOT / "samples" / "parking_1920_1080_loop.mp4")
        lot = ParkingLot(
            name="Ana Otopark",
            address="Demo Adres",
            mask_path=mask_path,
            video_path=video_path,
        )
        db.add(lot)
        db.flush()

        # Mask'tan spot'ları oku (opencv gerekli) - yoksa demo spotlar
        spots_bboxes = []
        try:
            import cv2
            from app.cv import get_parking_spots_bboxes
            mask = cv2.imread(mask_path, 0)
            if mask is not None:
                cc = cv2.connectedComponentsWithStats(mask, 4, cv2.CV_32S)
                spots_bboxes = get_parking_spots_bboxes(cc)
        except Exception:
            pass

        if spots_bboxes:
            for i, bbox in enumerate(spots_bboxes):
                db.add(Spot(
                    parking_lot_id=lot.id,
                    spot_number=f"S{i + 1:03d}",
                    bbox=bbox,
                    mask_index=i + 1,
                    is_occupied=False,
                ))
        else:
            for i in range(10):
                db.add(Spot(
                    parking_lot_id=lot.id,
                    spot_number=f"S{i + 1:03d}",
                    bbox=[100 + i * 80, 100, 60, 40],
                    mask_index=i,
                    is_occupied=False,
                ))

        # Pricing (kademeli tarife + ücretsiz dakika)
        pricing = Pricing(
            parking_lot_id=lot.id,
            hourly_rate=0,
            first_hour_rate=None,
            min_charge_minutes=60,
            pricing_rules=deepcopy(DEFAULT_PRICING_RULES),
        )
        db.add(pricing)

        # Admin kullanıcı
        admin = User(
            email="admin@carparking.com",
            hashed_password=get_password_hash("Admin1234"),
            full_name="Yönetici",
            role=UserRole.admin,
        )
        db.add(admin)

        db.commit()
        logger.info("Seed tamamlandı. Admin: admin@carparking.com / Admin1234")
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
