"""FastAPI uygulama giriş noktası."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.logging_config import setup_logging

setup_logging()
from app.api.auth import router as auth_router
from app.api.spots import router as spots_router, parking_router, pricing_router
from app.api.websocket import router as ws_router
from app.api.admin import router as admin_router
from app.api.video_stream import router as video_router
from app.api.reservations import router as reservations_router
from app.api.vehicles import router as vehicles_router
from app.api.payment_methods import router as payment_methods_router
from app.api.parking_intent import router as parking_intent_router

settings = get_settings()

app = FastAPI(
    title="CarParking API",
    description="Otopark Yönetim Sistemi API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r".*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/api/v1")
app.include_router(spots_router, prefix="/api/v1")
app.include_router(parking_router, prefix="/api/v1")
app.include_router(pricing_router, prefix="/api/v1")
app.include_router(ws_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(video_router, prefix="/api/v1")
app.include_router(reservations_router, prefix="/api/v1")
app.include_router(vehicles_router, prefix="/api/v1")
app.include_router(payment_methods_router, prefix="/api/v1")
app.include_router(parking_intent_router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "CarParking API", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "ok"}
