from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from .oil_schemas import OilUnloadingCreate, OilUnloadingRead, FuelTankRead
from .oil_crud import create_unloading, get_all_unloadings, get_tanks

router = APIRouter(prefix="/api/oil-unloading", tags=["Oil Unloading"])

@router.post("/", response_model=OilUnloadingRead)
async def add_unloading(data: OilUnloadingCreate, db: AsyncSession = Depends(get_db)):
    return await create_unloading(db, data)

@router.get("/", response_model=list[OilUnloadingRead])
async def list_unloading(db: AsyncSession = Depends(get_db)):
    return await get_all_unloadings(db)

@router.get("/tanks", response_model=list[FuelTankRead])
async def tank_stock(
    plant: str,
    oil_type: str,
    db: AsyncSession = Depends(get_db)
):
    return await get_tanks(db, plant, oil_type)
