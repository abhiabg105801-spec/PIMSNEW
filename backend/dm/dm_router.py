from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from .dm_schemas import DMEntryCreate
from .dm_crud import dm_create_entries, dm_get_stats
from database import get_db
from datetime import datetime

from fastapi.responses import Response
from .dm_report_builder import build_dm_pdf
from .dm_crud import dm_get_entries_by_date
router = APIRouter(prefix="/api/dm", tags=["DM Universal"])

@router.post("/add")
async def dm_add(payload: DMEntryCreate, db: AsyncSession = Depends(get_db)):
    rows = await dm_create_entries(db, payload.dict())
    return {"status": "success", "saved": len(rows)}


@router.get("/report")
async def dm_report(date: str, module: str = None, db: AsyncSession = Depends(get_db)):
    try:
        parsed = datetime.strptime(date, "%Y-%m-%d").date()
    except:
        raise HTTPException(400, "Invalid date format, use YYYY-MM-DD")

    stats = await dm_get_stats(db, parsed, module)

    results = []
    for (module, category, parameter, avg, mn, mx, cnt) in stats:
        results.append({
            "module": module,
            "category": category,
            "parameter": parameter,
            "avg": avg,
            "min": mn,
            "max": mx,
            "count": cnt,
        })

    return {"date": date, "stats": results}

@router.get("/report/pdf")
async def dm_report_pdf(date: str, module: str = None, db: AsyncSession = Depends(get_db)):
    try:
        parsed = datetime.strptime(date, "%Y-%m-%d").date()
    except:
        raise HTTPException(400, "Invalid date format, use YYYY-MM-DD")

    entries = await dm_get_entries_by_date(db, parsed, module)
    pdf_bytes = await run_in_threadpool(build_dm_pdf, date, entries)

    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="dm-report-{date}.pdf"'})
