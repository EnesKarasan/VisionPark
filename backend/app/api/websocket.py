"""WebSocket - gerçek zamanlı park durumu."""
import asyncio

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Spot, ParkingLot
from app.services.spots_summary import compute_spot_counts

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.active_connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)


manager = ConnectionManager()


def _spots_payload(db: Session) -> dict | None:
    lot = db.query(ParkingLot).filter(ParkingLot.is_active).first()
    if not lot:
        return None
    spots = db.query(Spot).filter(Spot.parking_lot_id == lot.id).all()
    counts = compute_spot_counts(spots)
    return {
        "type": "spots_update",
        **counts,
        "spots": [
            {
                "id": s.id,
                "spot_number": s.spot_number,
                "is_occupied": s.is_occupied,
                "is_reserved": s.is_reserved,
            }
            for s in spots
        ],
    }


@router.websocket("/ws/spots")
async def websocket_spots(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                if msg == "ping":
                    await websocket.send_json({"type": "pong"})
            except asyncio.TimeoutError:
                db = SessionLocal()
                try:
                    data = _spots_payload(db)
                    if data:
                        await websocket.send_json(data)
                finally:
                    db.close()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
