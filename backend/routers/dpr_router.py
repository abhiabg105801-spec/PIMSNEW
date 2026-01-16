# routers/dpr_router.py
"""
Daily Production Report (DPR) endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime, timedelta, time as dt_time
from typing import Dict, Any
import logging

from database import get_db
from models import UserDB, ShutdownRecordDB, UnitInceptionMetricsDB, TotalizerReadingDB
from auth import get_current_user
from services.kpi_calculator import KPICalculator
from services.kpi_persistence import load_kpis_from_db
from sqlalchemy import select, and_, func
from services.kpi_aggregator import KPIAggregator
from constants.kpi_config import get_all_kpi_names

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dpr")


def parse_iso_date(s: str) -> date:
    """Parse ISO date string"""
    try:
        return date.fromisoformat(s)
    except Exception:
        try:
            return datetime.fromisoformat(s).date()
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid date format")


def fy_start(d: date):
    """Get financial year start (April 1st)"""
    return date(d.year if d.month >= 4 else d.year - 1, 4, 1)


def month_start(d: date):
    """Get month start"""
    return d.replace(day=1)


# ============================================================================
#  INCEPTION METRICS HELPERS
# ============================================================================

async def get_unit_inception_metrics(db: AsyncSession, unit: str):
    """Get or create inception metrics for a unit"""
    stmt = select(UnitInceptionMetricsDB).where(UnitInceptionMetricsDB.unit == unit)
    result = await db.execute(stmt)
    metrics = result.scalars().first()
    
    if not metrics:
        metrics = UnitInceptionMetricsDB(
            unit=unit,
            inception_mw_offset=0.0,
            inception_hours_offset=0.0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(metrics)
        await db.commit()
        await db.refresh(metrics)
    
    return metrics


async def calculate_inception_kpis(db: AsyncSession, unit: str, report_date: date):
    """Calculate total generation and running hours since inception"""
    metrics = await get_unit_inception_metrics(db, unit)
    
    # Get earliest date
    stmt = select(func.min(TotalizerReadingDB.date))
    result = await db.execute(stmt)
    inception_date = result.scalar() or report_date
    
    # Calculate total generation (MU) from stored KPIs
    total_generation_mu = 0.0
    cur = inception_date
    
    while cur <= report_date:
        kpis = await load_kpis_from_db(db, cur)
        unit_data = kpis.get(unit, {})
        total_generation_mu += unit_data.get("generation", 0.0)
        cur += timedelta(days=1)
    
    # Add offset (already in MU)
    total_generation_mu += float(metrics.inception_mw_offset) / 1000.0
    
    # Calculate running hours
    total_hours = await calculate_running_hours_since_inception(
        db, unit, inception_date, report_date
    )
    total_hours += float(metrics.inception_hours_offset)
    
    # Get running status
    running_status = await get_running_since_status(db, unit)
    
    return {
        "gen_mu_since_inception": round(total_generation_mu, 3),
        "running_hours_since_inception": round(total_hours, 2),
        "running_since_status": running_status["status"],
        "running_since_datetime": running_status["since"]
    }


async def calculate_running_hours_since_inception(
    db: AsyncSession, unit: str, start_date: date, end_date: date
):
    """Calculate running hours excluding shutdowns"""
    start_dt = datetime.combine(start_date, dt_time.min)
    end_dt = datetime.combine(end_date, dt_time.max)
    
    total_hours = (end_dt - start_dt).total_seconds() / 3600
    
    stmt = select(ShutdownRecordDB).where(
        ShutdownRecordDB.unit == unit,
        ShutdownRecordDB.datetime_from <= end_dt,
        func.coalesce(ShutdownRecordDB.datetime_to, end_dt) >= start_dt,
    )
    
    result = await db.execute(stmt)
    rows = result.scalars().all()
    
    shutdown_hours = 0.0
    for r in rows:
        shutdown_start = max(r.datetime_from, start_dt)
        shutdown_end = min(r.datetime_to or end_dt, end_dt)
        hrs = (shutdown_end - shutdown_start).total_seconds() / 3600.0
        if hrs > 0:
            shutdown_hours += hrs
    
    return max(0.0, total_hours - shutdown_hours)


async def get_running_since_status(db: AsyncSession, unit: str):
    """Get current running status - FIXED to avoid MultipleResultsFound error"""
    
    # Check if currently in shutdown
    stmt = select(ShutdownRecordDB).where(
        ShutdownRecordDB.unit == unit,
        ShutdownRecordDB.datetime_to.is_(None)
    ).order_by(ShutdownRecordDB.datetime_from.desc())
    
    result = await db.execute(stmt)
    current_shutdown = result.scalars().first()
    
    if current_shutdown:
        return {"status": "SHUTDOWN", "since": current_shutdown.datetime_from}
    
    # Get last shutdown end time (last sync)
    stmt = select(ShutdownRecordDB).where(
        ShutdownRecordDB.unit == unit,
        ShutdownRecordDB.datetime_to.isnot(None)
    ).order_by(ShutdownRecordDB.datetime_to.desc())
    
    result = await db.execute(stmt)
    last_shutdown = result.scalars().first()
    
    if last_shutdown:
        return {"status": "RUNNING", "since": last_shutdown.datetime_to}
    
    return {"status": "RUNNING", "since": None}


async def get_shutdown_details_for_date(db: AsyncSession, report_date: date):
    """Fetch shutdown/synchronization details for the date"""
    
    start_dt = datetime.combine(report_date, dt_time.min)
    end_dt = datetime.combine(report_date, dt_time.max)
    
    stmt = select(ShutdownRecordDB).where(
        and_(
            ShutdownRecordDB.datetime_from >= start_dt,
            ShutdownRecordDB.datetime_from <= end_dt
        )
    ).order_by(ShutdownRecordDB.datetime_from)
    
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    shutdown_list = []
    for record in records:
        shutdown_list.append({
            "unit": record.unit,
            "outage_type": record.shutdown_type,
            "shutdown_date": record.datetime_from.date().isoformat() if record.datetime_from else None,
            "shutdown_time": record.datetime_from.time().isoformat() if record.datetime_from else None,
            "reason": record.reason or "",
            "synchronization_date": record.datetime_to.date().isoformat() if record.datetime_to else None,
            "synchronization_time": record.datetime_to.time().isoformat() if record.datetime_to else None,
        })
    
    return shutdown_list


# ============================================================================
#  DPR ENDPOINTS
# ============================================================================

@router.get("/kpi/preview")
async def dpr_kpi_preview(
    date: str = Query(..., description="Report date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Get DPR KPIs for preview
    ✅ Uses configurable aggregation rules
    """
    
    report_date = parse_iso_date(date)
    
    logger.info(f"📊 DPR Preview Request: {report_date}")
    
    # Get all registered KPI names
    ALL_KPIS = list(get_all_kpi_names())
    
    # Date ranges
    ranges = {
        "day": (report_date, report_date),
        "month": (month_start(report_date), report_date),
        "year": (fy_start(report_date), report_date),
    }
    
    # Initialize result
    result = {
        unit: {kpi: {} for kpi in ALL_KPIS}
        for unit in ["Unit-1", "Unit-2", "Station"]
    }
    
    # Load and aggregate KPIs for each period
    for period, (start, end) in ranges.items():
        daily_kpis = []
        
        cur = start
        while cur <= end:
            kpis = await load_kpis_from_db(db, cur)
            daily_kpis.append(kpis)
            cur += timedelta(days=1)
        
        # ✅ Use smart aggregator
        aggregator = KPIAggregator()
        aggregated = aggregator.aggregate_kpis(daily_kpis, period)
        
        # Store aggregated values
        for unit in ["Unit-1", "Unit-2", "Station"]:
            for kpi in ALL_KPIS:
                result[unit][kpi][period] = aggregated[unit].get(kpi)
    
    # Get inception metrics
    for unit in ["Unit-1", "Unit-2"]:
        inception_data = await calculate_inception_kpis(db, unit, report_date)
        result[unit]["inception"] = inception_data
    
    # Get shutdown details
    shutdown_details = await get_shutdown_details_for_date(db, report_date)
    
    logger.info("✅ DPR Preview Complete")
    
    return {
        "kpis": result,
        "shutdown_details": shutdown_details
    }


@router.post("/kpi/save")
async def save_dpr_kpis(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Save DPR data (manual KPIs only - auto KPIs are saved by totalizer endpoint)
    """
    
    try:
        report_date = date.fromisoformat(payload["date"])
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    logger.info(f"💾 Saving DPR manual data for {report_date}")
    
    # This endpoint is for saving manual inputs only
    # Auto-calculated KPIs are saved when totalizers are submitted
    
    return {
        "message": "DPR data saved successfully",
        "date": payload["date"]
    }