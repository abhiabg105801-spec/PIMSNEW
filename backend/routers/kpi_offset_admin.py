# routers/kpi_offset_admin.py
"""
KPI Offset Management
Only Admin/HOD can configure
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import date, datetime, timezone
from pydantic import BaseModel
from typing import Dict

from database import get_db
from models import UserDB, KPIOffsetDB
from auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/kpi-offsets")


class KPIOffsetBulkRequest(BaseModel):
    period_type: str  # "month" or "year"
    period_start_date: str  # YYYY-MM-DD
    period_end_date: str  # YYYY-MM-DD
    offsets: Dict[str, Dict[str, float]]  # {"Unit-1": {"generation": 75.5, ...}, ...}
    reason: str
    source: str


@router.post("/bulk")
async def create_bulk_offsets(
    req: KPIOffsetBulkRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Create multiple KPI offsets at once (for system go-live)
    Only Admin/HOD can do this
    """
    
    # Check permissions
    if current_user.role_id not in (7, 8):
        raise HTTPException(status_code=403, detail="Only Admin/HOD can configure offsets")
    
    try:
        start = date.fromisoformat(req.period_start_date)
        end = date.fromisoformat(req.period_end_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    if req.period_type not in ["month", "year"]:
        raise HTTPException(status_code=400, detail="period_type must be 'month' or 'year'")
    
    logger.info(f"📝 Creating bulk KPI offsets: {req.period_type} from {start} to {end}")
    
    # Delete existing offsets for this period
    delete_stmt = delete(KPIOffsetDB).where(
        KPIOffsetDB.period_type == req.period_type,
        KPIOffsetDB.period_start_date == start
    )
    await db.execute(delete_stmt)
    await db.flush()
    
    created_count = 0
    
    for plant_name, plant_kpis in req.offsets.items():
        for kpi_name, offset_value in plant_kpis.items():
            
            offset_record = KPIOffsetDB(
                period_type=req.period_type,
                period_start_date=start,
                period_end_date=end,
                plant_name=plant_name,
                kpi_name=kpi_name,
                offset_value=offset_value,
                reason=req.reason,
                source=req.source,
                configured_by=current_user.username or current_user.full_name,
                configured_at=datetime.now(timezone.utc),
            )
            
            db.add(offset_record)
            created_count += 1
    
    await db.commit()
    
    logger.info(f"✅ Created {created_count} KPI offsets")
    
    return {
        "message": f"Created {created_count} KPI offsets",
        "period_type": req.period_type,
        "period_start": req.period_start_date,
        "period_end": req.period_end_date,
        "count": created_count
    }


@router.get("/list")
async def list_offsets(
    period_type: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """List all configured KPI offsets"""
    
    stmt = select(KPIOffsetDB)
    
    if period_type:
        stmt = stmt.where(KPIOffsetDB.period_type == period_type)
    
    stmt = stmt.order_by(
        KPIOffsetDB.period_start_date.desc(),
        KPIOffsetDB.plant_name,
        KPIOffsetDB.kpi_name
    )
    
    result = await db.execute(stmt)
    offsets = result.scalars().all()
    
    return {
        "offsets": [
            {
                "id": o.id,
                "period_type": o.period_type,
                "period_start_date": o.period_start_date.isoformat(),
                "period_end_date": o.period_end_date.isoformat(),
                "plant_name": o.plant_name,
                "kpi_name": o.kpi_name,
                "offset_value": o.offset_value,
                "reason": o.reason,
                "source": o.source,
                "configured_by": o.configured_by,
                "configured_at": o.configured_at.isoformat() if o.configured_at else None,
            }
            for o in offsets
        ]
    }


@router.delete("/{offset_id}")
async def delete_offset(
    offset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Delete a KPI offset"""
    
    if current_user.role_id not in (7, 8):
        raise HTTPException(status_code=403, detail="Only Admin/HOD can delete offsets")
    
    stmt = select(KPIOffsetDB).where(KPIOffsetDB.id == offset_id)
    result = await db.execute(stmt)
    offset = result.scalars().first()
    
    if not offset:
        raise HTTPException(status_code=404, detail="Offset not found")
    
    await db.delete(offset)
    await db.commit()
    
    return {"message": "Offset deleted successfully"}