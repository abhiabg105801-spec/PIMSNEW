# backend/routers/messages.py
from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
import json

from database import get_db
from crud.messages import create_message, get_messages, delete_message, set_pin
from schemas.message import MessageCreate, MessageOut
from auth import get_current_user
from models import UserDB

router = APIRouter(tags=["Messages"])


# =====================================================
#   WEBSOCKET CONNECTION MANAGER
# =====================================================
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, payload: Dict[str, Any]):
        """Send to all active websocket clients"""
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(json.dumps(payload))
            except:
                dead.append(ws)

        # cleanup dead connections
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


# =====================================================
#   POST MESSAGE
# =====================================================
@router.post("/", response_model=MessageOut)
async def post_message(
    msg: MessageCreate,
    user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    message = await create_message(db, user.username, msg.content)
    out = MessageOut.from_orm(message)

    # Send to all websocket listeners
    await manager.broadcast({
        "type": "message:new",
        "message": {
            "id": out.id,
            "username": out.username,
            "content": out.content,
            "created_at": out.created_at.isoformat(),
            "pinned": getattr(out, "pinned", False)
        }
    })

    return out


# =====================================================
#   GET ALL MESSAGES
# =====================================================
@router.get("/", response_model=List[MessageOut])
async def list_messages(db: AsyncSession = Depends(get_db)):
    return await get_messages(db)


# =====================================================
#   DELETE MESSAGE (ADMIN ONLY → role_id=8)
# =====================================================
@router.delete("/{msg_id}")
async def delete_msg(
    msg_id: int,
    user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user.role_id != 8:
        raise HTTPException(403, "Only admin can delete messages")

    await delete_message(db, msg_id)

    await manager.broadcast({
        "type": "message:deleted",
        "id": msg_id
    })

    return {"status": "deleted"}


# =====================================================
#   PIN / UNPIN MESSAGE (ADMIN ONLY → role_id=8)
# =====================================================
@router.post("/{msg_id}/pin")
async def pin_msg(
    msg_id: int,
    pin: bool,
    user: UserDB = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if user.role_id != 8:
        raise HTTPException(403, "Only admin can pin/unpin messages")

    msg = await set_pin(db, msg_id, pin)

    await manager.broadcast({
        "type": "message:pin",
        "message": {
            "id": msg.id,
            "pinned": msg.pinned,
            "pinned_at": msg.pinned_at.isoformat() if msg.pinned_at else None
        }
    })

    return {"status": "ok"}


# =====================================================
#   WEBSOCKET: REALTIME MESSAGES + TYPING INDICATOR
# =====================================================
@router.websocket("/ws")
async def ws_messages(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            data = await ws.receive_text()
            payload = json.loads(data)

            # Broadcast typing or any other events
            await manager.broadcast(payload)

    except WebSocketDisconnect:
        manager.disconnect(ws)
