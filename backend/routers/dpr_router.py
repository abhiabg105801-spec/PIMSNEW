# backend/routers/dpr_backend_with_gcv.py
"""
Updated DPR Backend - Integrates GCV from dm_plant_entries and Heat Rate calculation
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime, timedelta
from typing import Dict, Any, Optional
import logging

from database import get_db
from auth import get_current_user
from models import UserDB, TotalizerReadingDB, ShutdownRecordDB, KPIRecordDB
from routers.totalizers import TOTALIZER_MASTER
from services.kpi_calculations import (
    compute_unit_auto_kpis,
    compute_energy_meter_auto_kpis,
    compute_station_auto_kpis,
)
from services.dpr_gcv_helper import enrich_kpis_with_period_gcv

from sqlalchemy import select, func, delete
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dpr")


# ============================================================================
#  HELPER FUNCTIONS
# ============================================================================

def fy_start(d: date):
    """Get financial year start (April 1st)"""
    return date(d.year if d.month >= 4 else d.year - 1, 4, 1)


def month_start(d: date):
    """Get month start"""
    return d.replace(day=1)


async def compute_shutdown_kpis(db: AsyncSession, unit: str, start_date: date, end_date: date):
    """
    Calculate shutdown-related KPIs (running hour, availability, planned/strategic outage)
    """
    from datetime import time as dt_time
    
    start_dt = datetime.combine(start_date, dt_time.min)
    end_dt = datetime.combine(end_date, dt_time.max)
    
    total_days = (end_date - start_date).days + 1
    total_hours = total_days * 24.0

    stmt = select(ShutdownRecordDB).where(
        ShutdownRecordDB.unit == unit,
        ShutdownRecordDB.datetime_from <= end_dt,
        func.coalesce(ShutdownRecordDB.datetime_to, end_dt) >= start_dt,
    )
    
    rows = (await db.execute(stmt)).scalars().all()

    planned = 0.0
    strategic = 0.0
    total_shutdown = 0.0

    for r in rows:
        shutdown_start = max(r.datetime_from, start_dt)
        shutdown_end = min(r.datetime_to or end_dt, end_dt)
        
        hrs = (shutdown_end - shutdown_start).total_seconds() / 3600.0
        
        if hrs > 0:
            total_shutdown += hrs
            
            if r.shutdown_type == "Planned Outage":
                planned += hrs
            elif r.shutdown_type == "Strategic Outage":
                strategic += hrs

    running = max(0.0, total_hours - total_shutdown)

    return {
        "running_hour": round(running, 2),
        "plant_availability_percent": round((running / total_hours) * 100, 2) if total_hours > 0 else 0.0,
        "planned_outage_hour": round(planned, 2),
        "planned_outage_percent": round((planned / total_hours) * 100, 2) if total_hours > 0 else 0.0,
        "strategic_outage_hour": round(strategic, 2),
    }


async def calculate_single_day(db: AsyncSession, d: date) -> Dict[str, Dict[str, float]]:
    """
    Calculate all KPIs for a single day based on totalizer readings.
    Returns: {"Unit-1": {...}, "Unit-2": {...}, "Station": {...}}
    """
    
    # Initialize difference storage
    diffs_by_unit = {
        "Unit-1": {},
        "Unit-2": {},
        "Station": {},
        "Energy-Meter": {},
    }

    # Fetch today's readings
    today_stmt = select(TotalizerReadingDB).where(TotalizerReadingDB.date == d)
    today_rows = (await db.execute(today_stmt)).scalars().all()

    # Fetch yesterday's readings
    yesterday = d - timedelta(days=1)
    yesterday_stmt = select(TotalizerReadingDB).where(TotalizerReadingDB.date == yesterday)
    yesterday_rows = (await db.execute(yesterday_stmt)).scalars().all()
    
    y_map = {r.totalizer_id: float(r.reading_value or 0) for r in yesterday_rows}

    # Calculate differences
    for r in today_rows:
        meta = TOTALIZER_MASTER.get(r.totalizer_id)
        if not meta:
            continue

        name, unit = meta
        diff = (
            float(r.reading_value or 0)
            - y_map.get(r.totalizer_id, 0)
            + float(r.adjust_value or 0)
        )
        diffs_by_unit[unit][name] = diff

    # Ensure all keys exist
    for _, (name, unit) in TOTALIZER_MASTER.items():
        diffs_by_unit[unit].setdefault(name, 0.0)

    # Compute KPIs
    energy = compute_energy_meter_auto_kpis(diffs_by_unit["Energy-Meter"], {})
    u1_gen = energy.get("unit1_generation", 0.0)
    u2_gen = energy.get("unit2_generation", 0.0)

    unit1 = compute_unit_auto_kpis(diffs_by_unit["Unit-1"], u1_gen)
    unit2 = compute_unit_auto_kpis(diffs_by_unit["Unit-2"], u2_gen)
    station_water = compute_station_auto_kpis(
        diffs_by_unit["Station"],
        {"unit1_generation": u1_gen, "unit2_generation": u2_gen},
    )

    # Unit-1 KPIs
    unit1["generation"] = u1_gen   # Convert to MU
    unit1["plf_percent"] = energy.get("unit1_plf_percent", 0.0)
    unit1["aux_power"] = energy.get("unit1_aux_consumption_mwh", 0.0) 
    unit1["aux_power_percent"] = energy.get("unit1_aux_percent", 0.0)

    # Unit-2 KPIs
    unit2["generation"] = u2_gen
    unit2["plf_percent"] = energy.get("unit2_plf_percent", 0.0)
    unit2["aux_power"] = energy.get("unit2_aux_consumption_mwh", 0.0) 
    unit2["aux_power_percent"] = energy.get("unit2_aux_percent", 0.0)

    # Shutdown KPIs
    unit1_shutdown = await compute_shutdown_kpis(db, "Unit-1", d, d)
    unit2_shutdown = await compute_shutdown_kpis(db, "Unit-2", d, d)
    
    unit1.update(unit1_shutdown)
    unit2.update(unit2_shutdown)

    # Station KPIs
    station = {}
    station["generation"] = unit1["generation"] + unit2["generation"]
    station["coal_consumption"] = unit1["coal_consumption"] + unit2["coal_consumption"]
    station["oil_consumption"] = unit1["oil_consumption"] + unit2["oil_consumption"]
    station["aux_power"] = unit1["aux_power"] + unit2["aux_power"]
    station["steam_generation"] = unit1["steam_generation"] + unit2["steam_generation"]
    station["dm_water"] = unit1["dm_water"] + unit2["dm_water"]
    
    total_gen = station["generation"]
    
    if total_gen > 0:
        station["specific_coal"] = (
            (unit1["specific_coal"] * unit1["generation"] + 
             unit2["specific_coal"] * unit2["generation"]) / total_gen
        )
        station["specific_oil"] = (
            (unit1["specific_oil"] * unit1["generation"] + 
             unit2["specific_oil"] * unit2["generation"]) / total_gen
        )
        station["specific_steam"] = (
            (unit1["specific_steam"] * unit1["generation"] + 
             unit2["specific_steam"] * unit2["generation"]) / total_gen
        )
        station["aux_power_percent"] = (
            (unit1["aux_power_percent"] * unit1["generation"] + 
             unit2["aux_power_percent"] * unit2["generation"]) / total_gen
        )
    else:
        station["specific_coal"] = 0.0
        station["specific_oil"] = 0.0
        station["specific_steam"] = 0.0
        station["aux_power_percent"] = 0.0
    
    total_steam = station["steam_generation"]
    if total_steam > 0:
        station["specific_dm_percent"] = (
            (unit1["specific_dm_percent"] * unit1["steam_generation"] + 
             unit2["specific_dm_percent"] * unit2["steam_generation"]) / total_steam
        )
    else:
        station["specific_dm_percent"] = 0.0
    
    station["plf_percent"] = (station["generation"] / 6.0) * 100.0 if station["generation"] > 0 else 0.0
    
    station["running_hour"] = unit1["running_hour"] + unit2["running_hour"]
    station["planned_outage_hour"] = unit1["planned_outage_hour"] + unit2["planned_outage_hour"]
    station["strategic_outage_hour"] = unit1["strategic_outage_hour"] + unit2["strategic_outage_hour"]
    
    station["plant_availability_percent"] = (
        (unit1["plant_availability_percent"] + unit2["plant_availability_percent"]) / 2.0
    )
    station["planned_outage_percent"] = (
        (unit1["planned_outage_percent"] + unit2["planned_outage_percent"]) / 2.0
    )
    
    # Initialize GCV and heat_rate as None (will be populated from dm_plant_entries)
    station["gcv"] = None
    station["heat_rate"] = None
    unit1["gcv"] = None
    unit1["heat_rate"] = None
    unit2["gcv"] = None
    unit2["heat_rate"] = None
    
    # Stack emission placeholder
    station["stack_emission"] = None
    unit1["stack_emission"] = None
    unit2["stack_emission"] = None

    return {
        "Unit-1": unit1,
        "Unit-2": unit2,
        "Station": station,
    }


# ============================================================================
#  API ENDPOINTS
# ============================================================================

@router.get("/kpi/preview")
async def dpr_kpi_preview(
    date: str = Query(..., description="Report date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    try:
        report_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")


    logger.info(f"📊 DPR Preview Request: {report_date}")

    # rest of your logic stays exactly the same

    
    # Define aggregation types
    SUM_KPIS = {
        "generation", "coal_consumption", "oil_consumption", "aux_power",
        "steam_generation", "dm_water", "running_hour", "planned_outage_hour",
        "strategic_outage_hour"
    }
    
    AVG_KPIS = {
        "plf_percent", "plant_availability_percent", "aux_power_percent",
        "heat_rate", "gcv", "stack_emission", "planned_outage_percent"
    }
    
    SPECIFIC_KPIS = {
        "specific_coal", "specific_oil", "specific_steam", "specific_dm_percent"
    }
    
    ALL_KPIS = [
        "generation", "plf_percent", "running_hour", "plant_availability_percent",
        "planned_outage_hour", "planned_outage_percent", "strategic_outage_hour",
        "coal_consumption", "specific_coal", "gcv", "heat_rate",
        "oil_consumption", "specific_oil", "aux_power", "aux_power_percent",
        "stack_emission", "steam_generation", "specific_steam",
        "dm_water", "specific_dm_percent"
    ]
    
    # Define date ranges
    ranges = {
        "day": (report_date, report_date),
        "month": (month_start(report_date), report_date),
        "year": (fy_start(report_date), report_date),
    }
    
    logger.info(f"Date ranges: {ranges}")
    
    # Initialize result structure
    result = {
        unit: {kpi: {} for kpi in ALL_KPIS}
        for unit in ["Unit-1", "Unit-2", "Station"]
    }
    
    # Calculate KPIs for each period
    for period, (start, end) in ranges.items():
        logger.info(f"Calculating {period}: {start} to {end}")
        daily_values = []

        cur = start
        while cur <= end:
            daily_values.append(await calculate_single_day(db, cur))
            cur += timedelta(days=1)

        # Aggregate daily values
        for unit in ["Unit-1", "Unit-2", "Station"]:
            for kpi in ALL_KPIS:
                vals = [d[unit].get(kpi) for d in daily_values if d[unit].get(kpi) is not None]

                if not vals:
                    result[unit][kpi][period] = None
                elif kpi in AVG_KPIS or kpi in SPECIFIC_KPIS:
                    result[unit][kpi][period] = sum(vals) / len(vals)
                else:
                    result[unit][kpi][period] = sum(vals)
    
    # ⭐ FETCH GCV FROM dm_plant_entries AND CALCULATE HEAT RATE
    logger.info("🔬 Fetching GCV from dm_plant_entries and calculating heat rate...")
    result = await enrich_kpis_with_period_gcv(db, report_date, result, ranges)
    
    logger.info("✅ DPR Preview Complete")
    return result


class DPRSaveRequest(BaseModel):
    date: str
    remarks: Optional[str] = None
    computed_kpis: Dict[str, Dict[str, float]]


@router.post("/kpi/save")
async def save_dpr_kpis(
    req: DPRSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Save DPR KPIs to database as 'manual' entries.
    """
    
    try:
        report_date = date.fromisoformat(req.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    logger.info(f"💾 Saving DPR for {report_date}")
    
    # Delete existing manual KPIs for this date
    delete_stmt = delete(KPIRecordDB).where(
        KPIRecordDB.report_date == report_date,
        KPIRecordDB.kpi_type == "manual"
    )
    await db.execute(delete_stmt)
    
    # Insert new KPI records
    saved_count = 0
    for unit_name, kpis in req.computed_kpis.items():
        for kpi_name, kpi_value in kpis.items():
            if kpi_value is not None:
                record = KPIRecordDB(
                    report_date=report_date,
                    kpi_type="manual",
                    plant_name=unit_name,
                    kpi_name=kpi_name,
                    kpi_value=float(kpi_value),
                    unit=None,
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                )
                db.add(record)
                saved_count += 1
    
    await db.commit()
    
    logger.info(f"✅ Saved {saved_count} KPI records")
    
    return {
        "message": "DPR saved successfully",
        "date": req.date,
        "records_saved": saved_count
    }