# routers/totalizers.py
"""
Totalizer entry and KPI auto-calculation endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, datetime, timezone
from typing import List, Dict, Any

from database import get_db
from models import UserDB, TotalizerReadingDB, KPIRecordDB
from auth import get_current_user
from services.kpi_calculator import KPICalculator

from constants.totalizer_master import TOTALIZER_MASTER  # ✅ Import from constants
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api")


def parse_iso_date(s: str) -> date:
    """Parse ISO date string"""
    try:
        return date.fromisoformat(s)
    except Exception:
        try:
            return datetime.fromisoformat(s).date()
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid date format")

# ============================================================================
#  TOTALIZER READING ENDPOINTS
# ============================================================================

@router.get("/totalizers/{unit}/readings")
async def get_readings_for_unit_date(
    unit: str,
    date: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get totalizer readings for a unit and date"""
    
    rpt_date = parse_iso_date(date)
    
    # Get totalizer IDs for this unit
    mids = [tid for tid, (_, u) in TOTALIZER_MASTER.items() if u == unit]
    if not mids:
        return []
    
    stmt = select(TotalizerReadingDB).where(
        TotalizerReadingDB.totalizer_id.in_(mids),
        TotalizerReadingDB.date == rpt_date
    )
    
    result = await db.execute(stmt)
    rows = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "totalizer_id": r.totalizer_id,
            "date": r.date.isoformat(),
            "reading_value": r.reading_value,
            "adjust_value": r.adjust_value,
            "difference_value": r.difference_value,
            "username": r.username,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.post("/totalizers/submit")
async def submit_readings(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Submit totalizer readings
    ✅ Only updates KPIs affected by changed totalizers
    """
    
    try:
        reading_date = parse_iso_date(payload["date"])
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid date")
    
    readings = payload.get("readings", [])
    username = current_user.username or current_user.full_name
    
    logger.info(f"📥 Totalizer submit by {username} on {reading_date}")
    
    # ✅ Track which totalizers actually changed
    changed_totalizers = set()
    
    # Step 1: Save totalizer readings and track changes
    for item in readings:
        tid = item["totalizer_id"]
        today_val = float(item.get("reading_value") or 0.0)
        adjust = float(item.get("adjust_value") or 0.0)
        
        # Only HOD/Admin can adjust
        if current_user.role_id not in (7, 8):
            adjust = 0.0
        
        # Calculate difference
        from datetime import timedelta
        yesterday = reading_date - timedelta(days=1)
        
        q = await db.execute(
            select(TotalizerReadingDB).where(
                TotalizerReadingDB.totalizer_id == tid,
                TotalizerReadingDB.date == yesterday
            )
        )
        yrow = q.scalars().first()
        yval = float(yrow.reading_value or 0.0) if yrow else 0.0
        diff = (today_val - yval) + adjust
        
        # Check if this totalizer changed
        q2 = await db.execute(
            select(TotalizerReadingDB).where(
                TotalizerReadingDB.totalizer_id == tid,
                TotalizerReadingDB.date == reading_date
            )
        )
        existing = q2.scalars().first()
        
        value_changed = False
        
        if existing:
            # Check if value actually changed
            if (abs(existing.reading_value - today_val) > 0.0001 or 
                abs(existing.adjust_value - adjust) > 0.0001):
                value_changed = True
                existing.reading_value = today_val
                existing.adjust_value = adjust
                existing.difference_value = diff
                existing.updated_at = datetime.now(timezone.utc)
                existing.username = username
        else:
            value_changed = True
            db.add(
                TotalizerReadingDB(
                    totalizer_id=tid,
                    date=reading_date,
                    reading_value=today_val,
                    adjust_value=adjust,
                    difference_value=diff,
                    username=username,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
            )
        
        # ✅ Track if this totalizer changed
        if value_changed:
            changed_totalizers.add(tid)
            logger.info(f"   Changed: Totalizer {tid}")
    
    await db.commit()
    
    if not changed_totalizers:
        logger.info("⏭️  No changes detected, skipping KPI recalculation")
        return {
            "message": "No changes detected",
            "date": reading_date.isoformat()
        }
    
    # Step 2: Recalculate ALL KPIs (we need complete picture)
    logger.info("🔄 Recalculating KPIs...")
    calculator = KPICalculator(db)
    all_kpis = await calculator.calculate_all_kpis_for_date(reading_date)
    
    # Step 3: Smart save - only update affected KPIs
    from services.kpi_persistence import smart_save_kpis_to_db
    updated_count = await smart_save_kpis_to_db(
        db, 
        reading_date, 
        all_kpis, 
        changed_totalizers,  # ✅ Pass changed totalizers
        username
    )
    
    logger.info(f"✅ Submit complete: {len(changed_totalizers)} totalizers changed, {updated_count} KPIs updated")
    
    return {
        "message": f"Readings saved, {updated_count} KPIs updated",
        "date": reading_date.isoformat(),
        "totalizers_changed": len(changed_totalizers),
        "kpis_updated": updated_count
    }


# ============================================================================
#  MANUAL KPI ENDPOINTS
# ============================================================================

@router.post("/kpi/manual")
async def save_manual_kpis(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Save manual KPIs
    ✅ Only updates changed KPIs with individual timestamps
    """
    
    reading_date = parse_iso_date(payload["date"])
    plant = payload["plant_name"]
    kpis = payload.get("kpis", [])
    username = current_user.username or current_user.full_name
    
    logger.info(f"📝 Saving manual KPIs: {plant} on {reading_date} by {username}")
    
    updated_count = 0
    unchanged_count = 0
    
    for k in kpis:
        kpi_name = k["name"]
        kpi_value = float(k["value"])
        kpi_unit = k.get("unit")
        
        # Check if this KPI exists and if value changed
        stmt = select(KPIRecordDB).where(
            KPIRecordDB.report_date == reading_date,
            KPIRecordDB.kpi_type == "manual",
            KPIRecordDB.plant_name == plant,
            KPIRecordDB.kpi_name == kpi_name
        )
        
        result = await db.execute(stmt)
        existing = result.scalars().first()
        
        if existing:
            # Check if value changed
            if abs(existing.kpi_value - kpi_value) < 0.0001:
                unchanged_count += 1
                logger.info(f"   ⏭️  Unchanged: {kpi_name}")
                continue
            
            # ✅ Update only this KPI
            existing.kpi_value = kpi_value
            existing.unit = kpi_unit
            existing.username = username
            existing.updated_at = datetime.now(timezone.utc)
            logger.info(f"   ✏️  Updated: {kpi_name} = {kpi_value}")
            updated_count += 1
        else:
            # Create new
            record = KPIRecordDB(
                report_date=reading_date,
                kpi_type="manual",
                plant_name=plant,
                kpi_name=kpi_name,
                kpi_value=kpi_value,
                unit=kpi_unit,
                username=username,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            db.add(record)
            logger.info(f"   ➕ Created: {kpi_name} = {kpi_value}")
            updated_count += 1
    
    await db.commit()
    
    logger.info(f"✅ Manual KPI save: {updated_count} updated, {unchanged_count} unchanged")
    
    return {
        "message": f"Manual KPIs saved: {updated_count} updated",
        "updated": updated_count,
        "unchanged": unchanged_count
    }


@router.post("/kpi/manual")
async def save_manual_kpis(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Save manual KPIs
    ✅ These are stored separately and don't trigger recalculation
    """
    
    reading_date = parse_iso_date(payload["date"])
    plant = payload["plant_name"]
    kpis = payload.get("kpis", [])
    username = current_user.username or current_user.full_name
    
    logger.info(f"📝 Saving manual KPIs: {plant} on {reading_date}")
    
    # Delete existing manual KPIs for this unit/date
    from sqlalchemy import delete
    delete_stmt = delete(KPIRecordDB).where(
        KPIRecordDB.report_date == reading_date,
        KPIRecordDB.kpi_type == "manual",
        KPIRecordDB.plant_name == plant
    )
    await db.execute(delete_stmt)
    await db.flush()
    
    # Insert new manual KPIs
    for k in kpis:
        record = KPIRecordDB(
            report_date=reading_date,
            kpi_type="manual",
            plant_name=plant,
            kpi_name=k["name"],
            kpi_value=float(k["value"]),
            unit=k.get("unit"),
            username=username,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        db.add(record)
    
    await db.commit()
    
    logger.info(f"✅ Saved {len(kpis)} manual KPIs")
    
    return {"message": "Manual KPIs saved successfully"}


@router.get("/kpi/generation")
async def get_generation_for_date(
    date: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get Unit-1 and Unit-2 generation for a specific date"""
    
    rpt_date = parse_iso_date(date)
    
    # Get generation from energy totalizers
    gen_ids = [22, 23]  # unit1_gen, unit2_gen
    
    stmt = select(TotalizerReadingDB).where(
        TotalizerReadingDB.totalizer_id.in_(gen_ids),
        TotalizerReadingDB.date == rpt_date
    )
    
    result = await db.execute(stmt)
    rows = result.scalars().all()
    
    generation = {
        "unit1_generation": 0.0,
        "unit2_generation": 0.0
    }
    
    for r in rows:
        if r.totalizer_id == 22:  # unit1_gen
            generation["unit1_generation"] = float(r.difference_value or 0)
        elif r.totalizer_id == 23:  # unit2_gen
            generation["unit2_generation"] = float(r.difference_value or 0)
    
    return generation


@router.get("/kpi/shutdown/{unit}")
async def get_shutdown_kpis(
    unit: str,
    date: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Get shutdown KPIs for a unit"""
    
    report_date = parse_iso_date(date)
    
    calculator = KPICalculator(db)
    shutdown_kpis = await calculator._calculate_shutdown_kpis(unit, report_date)
    
    return shutdown_kpis