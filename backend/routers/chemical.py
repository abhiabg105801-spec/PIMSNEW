# routers/chemical.py
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from database import get_db
from auth import get_current_user, require_role
from schemas.chemical import ChemicalSectionCreate, ChemicalEntry
from crud.chemical import create_chemical_section_entries, get_chemical_entries_by_date, get_raw_chemical_entries

router = APIRouter(prefix="/api/chemical", tags=["Chemical"])

@router.post("/add-section")
async def add_section(payload: ChemicalSectionCreate, db: AsyncSession = Depends(get_db), current_user = Depends(require_role([5,8]))):
    if not payload.entries or len(payload.entries) == 0:
        raise HTTPException(status_code=400, detail="No entries provided")
    saved = await create_chemical_section_entries(db, payload)
    return {"status": "success", "saved_count": len(saved)}

@router.get("/report")
async def get_report(date: str = Query(...), db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    try:
        parsed = datetime.strptime(date, "%Y-%m-%d").date()
    except:
        raise HTTPException(status_code=400, detail="Invalid date format")
    rows = await get_chemical_entries_by_date(db, parsed)

    # Build a flat list grouped by sample (time + plant + exact area)
    # We'll return a list of dicts so frontend can render a table (raw rows).
    out = []
    for r in rows:
        out.append({
            "id": r.id,
            "date": r.date.isoformat(),
            "time": str(r.time),
            "plant": r.plant,
            "broad_area": r.broad_area,
            "main_area": r.main_area,
            "main_collection_area": r.main_collection_area,
            "exact_collection_area": r.exact_collection_area,
            "parameter": r.parameter,
            "value": r.value,
            "remarks": r.remarks,
            "uploaded_at": r.uploaded_at.isoformat() if r.uploaded_at else None
        })

    return {"date": parsed.isoformat(), "total": len(out), "rows": out}

@router.get("/raw")
async def get_raw(date: str, plant: str, exact_area: str, parameter: str, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user)):
    parsed = datetime.strptime(date, "%Y-%m-%d").date()
    return await get_raw_chemical_entries(db, parsed, plant, exact_area, parameter)
