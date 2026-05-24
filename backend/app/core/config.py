"""Uygulama konfigürasyonu."""
from pathlib import Path
from pydantic_settings import BaseSettings
from functools import lru_cache

# backend/ dizinindeki carparking.db (migration ve seed burada çalışır)
_backend_dir = Path(__file__).resolve().parents[2]
_project_root = _backend_dir.parent
_default_db = f"sqlite:///{_backend_dir / 'carparking.db'}"


class Settings(BaseSettings):
    """Uygulama ayarları."""

    # Veritabanı - SQLite varsayılan (geliştirme), production için PostgreSQL
    DATABASE_URL: str = _default_db

    # JWT
    SECRET_KEY: str = "your-super-secret-key-change-in-production-32chars"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 saat

    # Kayıt e-posta doğrulama (üretimde DEBUG_RETURN_SIGNUP_CODE kapalı tutun)
    SIGNUP_CODE_EXPIRE_MINUTES: int = 15
    SIGNUP_JWT_EXPIRE_MINUTES: int = 15
    DEBUG_RETURN_SIGNUP_CODE: bool = False

    # Google OAuth
    GOOGLE_CLIENT_ID: str = ""  # Google Cloud Console'dan Web Client ID

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173", "http://localhost:8081"]

    # Mobil/QR redeem için backend'in dış adresi (telefonların erişeceği)
    # Örn: http://192.168.1.50:8000  veya  https://carparking.example.com
    # Boşsa request URL'inden çıkarılır.
    PUBLIC_BASE_URL: str = ""

    # ── SMTP / E-posta ──
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""  # Gmail adresiniz
    SMTP_PASSWORD: str = ""  # Gmail uygulama şifresi (App Password)
    SMTP_FROM_NAME: str = "CarParking"
    SMTP_USE_TLS: bool = True

    # ── CV / YOLO ayarları ──
    PROJECT_ROOT: Path = _project_root
    CV_VIDEO_PATH: str = str(_project_root / "samples" / "parking_1920_1080_loop.mp4")
    CV_MODEL_PATH: str = str(_project_root / "runs" / "train" / "fine_tune_11n" / "weights" / "best.pt")
    CV_IOU_THRESHOLD: float = 0.30
    CV_CONFIDENCE: float = 0.25
    CV_DEVICE: str = "auto"  # "auto" | "cuda" | "cpu"
    CV_WORKER_INTERVAL_SEC: float = 3.0
    CV_STREAM_YOLO_STEP: int = 30
    CV_STREAM_TARGET_FPS: int = 24
    CV_STREAM_JPEG_QUALITY: int = 75

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()
