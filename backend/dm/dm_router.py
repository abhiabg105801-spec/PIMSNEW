from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from .dm_schemas import DMEntryCreate
from .dm_crud import (
    dm_create_entries,
    dm_get_stats,
    dm_get_raw_by_date,
    dm_get_by_sample,
    dm_update_entries,
    dm_delete_by_sample,
    dm_get_raw_by_range,
)
from database import get_db

router = APIRouter(prefix="/api/dm", tags=["DM Universal"])


# ---------------------------------------------------
# CREATE ENTRY
# ---------------------------------------------------
@router.post("/add")
async def dm_add(payload: DMEntryCreate, db: AsyncSession = Depends(get_db)):
    rows = await dm_create_entries(db, payload.dict())
    return {"saved": len(rows), "sample_no": rows[0].sample_no}


# ---------------------------------------------------
# STATISTICS
# ---------------------------------------------------
@router.get("/report")
async def dm_report(date: str, module: str = None, db: AsyncSession = Depends(get_db)):
    parsed = datetime.strptime(date, "%Y-%m-%d").date()
    return {"stats": await dm_get_stats(db, parsed, module)}


# ---------------------------------------------------
# RAW DATA TABLE
# ---------------------------------------------------
@router.get("/raw")
async def dm_raw(date: str, module: str = None, db: AsyncSession = Depends(get_db)):
    parsed = datetime.strptime(date, "%Y-%m-%d").date()
    rows = await dm_get_raw_by_date(db, parsed, module)
    return {"rows": rows}


# ---------------------------------------------------
# EDIT — LOAD BY SAMPLE NO
# ---------------------------------------------------
@router.get("/entry")
async def dm_entry(sample_no: str, db: AsyncSession = Depends(get_db)):
    rows = await dm_get_by_sample(db, sample_no)
    if not rows:
        raise HTTPException(404, "Sample not found")
    return {"rows": rows}


# ---------------------------------------------------
# UPDATE ENTRY GROUP
# ---------------------------------------------------

@router.post("/update")
async def dm_update(payload: DMEntryCreate, db: AsyncSession = Depends(get_db)):
    if not payload.sample_no:
        raise HTTPException(400, "sample_no is required for update operation")

    rows = await dm_update_entries(db, payload.dict())
    return {"status": "updated", "rows": len(rows)}

# ---------------------------------------------------
# DELETE ENTRY GROUP
# ---------------------------------------------------
@router.delete("/delete")
async def dm_delete(sample_no: str, db: AsyncSession = Depends(get_db)):
    await dm_delete_by_sample(db, sample_no)
    return {"deleted": sample_no}


@router.get("/raw-range")
async def dm_raw_range(
    start: str,
    end: str,
    module: str = None,
    db: AsyncSession = Depends(get_db)
):
    s = datetime.strptime(start, "%Y-%m-%d").date()
    e = datetime.strptime(end, "%Y-%m-%d").date()
    return {"rows": await dm_get_raw_by_range(db, s, e, module)}
