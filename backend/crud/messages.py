# backend/crud/messages.py
from models import MessageDB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from datetime import datetime

async def create_message(db: AsyncSession, username: str, content: str):
    msg = MessageDB(username=username, content=content)
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return msg

async def get_messages(db: AsyncSession):
    # pinned first (most recent pinned first), then recent messages
    q = await db.execute(select(MessageDB).order_by(MessageDB.pinned.desc(), MessageDB.pinned_at.desc().nulls_last(), MessageDB.created_at.desc()))
    return q.scalars().all()

async def delete_message(db: AsyncSession, msg_id: int):
    result = await db.execute(select(MessageDB).where(MessageDB.id == msg_id))
    msg = result.scalar_one_or_none()
    if msg:
        await db.delete(msg)
        await db.commit()

async def set_pin(db: AsyncSession, msg_id: int, pin: bool):
    values = {"pinned": pin, "pinned_at": datetime.utcnow() if pin else None}
    await db.execute(update(MessageDB).where(MessageDB.id == msg_id).values(**values))
    await db.commit()
    result = await db.execute(select(MessageDB).where(MessageDB.id == msg_id))
    return result.scalar_one_or_none()
