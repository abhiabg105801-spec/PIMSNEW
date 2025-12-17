from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from .oil_schemas import OilUnloadingCreate, OilUnloadingRead
from .oil_crud import (create_unloading, get_all_unloadings, get_unloading_by_id)

router = APIRouter(
    prefix="/api/oil-unloading",
    tags=["Oil Unloading"]
)

@router.post("/", response_model=OilUnloadingRead)
async def create_oil_unloading(
    data: OilUnloadingCreate,
    db: AsyncSession = Depends(get_db)
):
    return await create_unloading(db, data)


@router.get("/", response_model=list[OilUnloadingRead])
async def list_oil_unloading(
    db: AsyncSession = Depends(get_db)
):
    return await get_all_unloadings(db)


@router.get("/{record_id}", response_model=OilUnloadingRead)
async def get_oil_unloading(
    record_id: int,
    db: AsyncSession = Depends(get_db)
):
    record = await get_unloading_by_id(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record
