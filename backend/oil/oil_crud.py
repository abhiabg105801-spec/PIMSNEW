from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .oil_models import OilUnloading, FuelTank

async def create_unloading(db: AsyncSession, data):
    try:
        record = OilUnloading(**data.dict())
        db.add(record)

        result = await db.execute(
            select(FuelTank)
            .where(FuelTank.plant == data.plant)
            .where(FuelTank.oil_type == data.oil_type)
        )
        tank = result.scalar_one_or_none()

        if not tank:
            tank = FuelTank(
                plant=data.plant,
                oil_type=data.oil_type,
                tank_name=f"{data.oil_type} MAIN TANK",
                current_kl=0,
            )
            db.add(tank)

        if data.receipt_kl:
            tank.current_kl += data.receipt_kl

        await db.commit()
        await db.refresh(record)
        return record

    except Exception:
        await db.rollback()
        raise


async def get_all_unloadings(db: AsyncSession):
    result = await db.execute(select(OilUnloading).order_by(OilUnloading.id.desc()))
    return result.scalars().all()


async def get_tanks(db: AsyncSession, plant: str, oil_type: str):
    result = await db.execute(
        select(FuelTank)
        .where(FuelTank.plant == plant)
        .where(FuelTank.oil_type == oil_type)
    )
    return result.scalars().all()
