from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .oil_models import OilUnloading
from .oil_schemas import OilUnloadingCreate

async def create_unloading(
    db: AsyncSession,
    data: OilUnloadingCreate
):
    record = OilUnloading(**data.dict())
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_all_unloadings(db: AsyncSession):
    result = await db.execute(select(OilUnloading).order_by(OilUnloading.id.desc()))
    return result.scalars().all()


async def get_unloading_by_id(db: AsyncSession, record_id: int):
    result = await db.execute(
        select(OilUnloading).where(OilUnloading.id == record_id)
    )
    return result.scalar_one_or_none()
