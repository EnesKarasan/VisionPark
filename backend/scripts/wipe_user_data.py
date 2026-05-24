"""
Production öncesi kullanıcı verilerini temizler.

Korunan: parking_lots, spots, pricing, alembic_version, admin kullanıcı (varsa).
Silinen: tüm diğer kullanıcılar, oturumlar, rezervasyonlar, ödemeler, intent'ler,
         araçlar, kartlar, doğrulama kodları + spot.is_occupied/is_reserved sıfırlanır.

Kullanım: python -m scripts.wipe_user_data
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import text
from app.core.database import SessionLocal, engine
from app.models.user import UserRole


TABLES_TO_WIPE = [
    # Önce çocuk tablolar (foreign key sırası)
    "payments",
    "parking_sessions",
    "reservations",
    "parking_intents",
    "user_vehicles",
    "user_payment_cards",
    "signup_verifications",
    "password_reset_verifications",
]


def main():
    db = SessionLocal()
    try:
        print("─" * 60)
        print("Mevcut durum:")
        for t in TABLES_TO_WIPE + ["users", "parking_lots", "spots", "pricing"]:
            try:
                n = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                print(f"  {t:30s}: {n}")
            except Exception:
                pass

        print()
        confirm = input("Tüm kullanıcı verisi silinecek (parking_lots/spots/pricing korunur). Devam? (yes/no): ")
        if confirm.strip().lower() != "yes":
            print("İptal edildi.")
            return

        print()
        print("Siliniyor...")

        # Foreign key sırasına göre child tabloları boşalt
        for t in TABLES_TO_WIPE:
            try:
                n = db.execute(text(f"DELETE FROM {t}")).rowcount
                print(f"  {t:30s}: {n} silindi")
            except Exception as e:
                print(f"  {t:30s}: hata - {e}")

        # Admin olmayan kullanıcıları sil; admin'leri bırak
        admin_role = UserRole.admin.value
        admins = db.execute(
            text("SELECT id, email FROM users WHERE role = :r"),
            {"r": admin_role},
        ).fetchall()
        n = db.execute(
            text("DELETE FROM users WHERE role != :r"),
            {"r": admin_role},
        ).rowcount
        print(f"  users (admin hariç)            : {n} silindi")
        for a in admins:
            print(f"      KORUNDU → admin: {a[1]} (id={a[0]})")

        # Spot flag'lerini sıfırla (eski oturumlardan kalan kirli state)
        n = db.execute(
            text("UPDATE spots SET is_occupied = 0, is_reserved = 0")
        ).rowcount
        print(f"  spots flag'leri sıfırlandı     : {n} satır")

        db.commit()

        print()
        print("─" * 60)
        print("Bitti. Yeni durum:")
        for t in TABLES_TO_WIPE + ["users", "parking_lots", "spots", "pricing"]:
            try:
                n = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
                print(f"  {t:30s}: {n}")
            except Exception:
                pass

        print()
        print("✓ Production öncesi temizleme tamamlandı.")
        print("  Admin hesabı (varsa) korundu. Yoksa: python -m app.db.seed")

    except Exception as e:
        db.rollback()
        print(f"HATA: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
