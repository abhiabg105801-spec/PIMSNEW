# routers/totalizer_admin.py
"""
Totalizer administration endpoints
Only accessible by Admin/HOD
"""

from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, datetime, timezone
from pydantic import BaseModel
from typing import Optional

from database import get_db
from models import UserDB, TotalizerConfigDB, TotalizerMetadataDB
from auth import get_current_user
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/totalizers")


class TotalizerResetRequest(BaseModel):
    totalizer_id: int
    reset_date: str  # YYYY-MM-DD
    baseline_value: float  # The "previous day" value to use
    reason: str
    notes: Optional[str] = None
    old_meter_final_reading: Optional[float] = None


@router.post("/reset")
async def reset_totalizer(
    req: TotalizerResetRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Reset a totalizer (e.g., meter replacement)
    Only Admin/HOD can do this
    """
    
    # Check permissions
    if current_user.role_id not in (7, 8):  # HOD or Admin
        raise HTTPException(status_code=403, detail="Only Admin/HOD can reset totalizers")
    
    try:
        reset_date = date.fromisoformat(req.reset_date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    logger.info(f"🔄 Totalizer reset: ID={req.totalizer_id}, Date={reset_date}, By={current_user.username}")
    
    # Create reset config
    config = TotalizerConfigDB(
        totalizer_id=req.totalizer_id,
        config_type="reset",
        effective_date=reset_date,
        baseline_value=req.baseline_value,
        reason=req.reason,
        notes=req.notes,
        old_meter_final_reading=req.old_meter_final_reading,
        configured_by=current_user.username or current_user.full_name,
        configured_at=datetime.now(timezone.utc),
    )
    
    db.add(config)
    
    # Update metadata
    metadata_stmt = select(TotalizerMetadataDB).where(
        TotalizerMetadataDB.totalizer_id == req.totalizer_id
    )
    result = await db.execute(metadata_stmt)
    metadata = result.scalars().first()
    
    if metadata:
        metadata.last_reset_date = reset_date
        metadata.updated_at = datetime.now(timezone.utc)
    
    await db.commit()
    
    logger.info("✅ Totalizer reset configured")
    
    return {
        "message": "Totalizer reset configured successfully",
        "totalizer_id": req.totalizer_id,
        "reset_date": req.reset_date,
        "baseline_value": req.baseline_value
    }


@router.get("/config/{totalizer_id}")
async def get_totalizer_config(
    totalizer_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get configuration history for a totalizer"""
    
    stmt = select(TotalizerConfigDB).where(
        TotalizerConfigDB.totalizer_id == totalizer_id
    ).order_by(TotalizerConfigDB.effective_date.desc())
    
    result = await db.execute(stmt)
    configs = result.scalars().all()
    
    return {
        "totalizer_id": totalizer_id,
        "configurations": [
            {
                "id": c.id,
                "config_type": c.config_type,
                "effective_date": c.effective_date.isoformat(),
                "baseline_value": c.baseline_value,
                "reason": c.reason,
                "notes": c.notes,
                "old_meter_final_reading": c.old_meter_final_reading,
                "configured_by": c.configured_by,
                "configured_at": c.configured_at.isoformat() if c.configured_at else None,
            }
            for c in configs
        ]
    }


@router.get("/list")
async def list_totalizers(
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """List all totalizers with their metadata"""
    
    stmt = select(TotalizerMetadataDB).order_by(TotalizerMetadataDB.totalizer_id)
    result = await db.execute(stmt)
    totalizers = result.scalars().all()
    
    return {
        "totalizers": [
            {
                "totalizer_id": t.totalizer_id,
                "name": t.name,
                "display_name": t.display_name,
                "unit_name": t.unit_name,
                "measurement_unit": t.measurement_unit,
                "is_active": t.is_active,
                "last_reset_date": t.last_reset_date.isoformat() if t.last_reset_date else None,
            }
            for t in totalizers
        ]
    }