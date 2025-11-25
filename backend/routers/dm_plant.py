# routers/dm_plant.py
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
import json

from database import get_db
from auth import get_current_user, require_role
from schemas.dm_plant import (
    DMEntryCreate,
    DMEntry,
    DMSectionCreate,   # <-- FIXED
    DMSectionEntry
)
from crud.dm_plant import (
    create_dm_entry,
    create_dm_section_entries,
    get_entries_by_date
)

from utils.dm_stats import calculate_stats
from models import UserDB

router = APIRouter(prefix="/api/dm-plant", tags=["DM Plant"])

# SAMPLE PDF path (local) — transform to served URL as needed on your side
SAMPLE_PDF_LOCAL_PATH = "/mnt/data/dm plant daily report dated 14.12.2023 (1).pdf"


# --------------------------------------------------------------------
# ADD ENTRY → only users with role_id 5 or 8
# --------------------------------------------------------------------
@router.post("/add", response_model=DMEntry)
async def add_dm_entry(
    entry: DMEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(require_role([5, 8]))
):
    # create_dm_entry sanitizes string fields
    return await create_dm_entry(db, entry)

@router.post("/add-section")
async def add_dm_section(
    payload: DMSectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(require_role([5, 8]))   # ONLY role 5 / 8 allowed
):
    if len(payload.entries) == 0:
        raise HTTPException(status_code=400, detail="No entries provided.")

    saved = await create_dm_section_entries(db, payload)

    return {
        "status": "success",
        "saved_count": len(saved),
        "unit": payload.unit,
        "section": payload.section
    }


# --------------------------------------------------------------------
# DAILY REPORT VIEW → any authenticated user
# --------------------------------------------------------------------
@router.get("/report")
async def get_dm_report(
    date: str = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    # Strict date parsing
    from datetime import datetime

    try:
        parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Invalid date format. Use YYYY-MM-DD."
        )

    # Fetch DB rows
    entries = await get_entries_by_date(db, parsed_date)

    # Compute stats
    stats = calculate_stats(entries)

    # Convert tuple keys -> clean JSON string
    clean_stats = {}
    for (unit, section, parameter), values in stats.items():
        key = f"{unit} | {section} | {parameter}"
        clean_stats[key] = values

    # Sample PDF (local path)
    sample_pdf = "/mnt/data/dm plant daily report dated 14.12.2023 (1).pdf"

    return {
        "date": parsed_date.isoformat(),
        "total_entries": len(entries),
        "stats": clean_stats,
        "sample_pdf": sample_pdf
    }