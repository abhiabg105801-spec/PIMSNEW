# backend/routers/dpr_complete_final.py

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime, timedelta, time as dt_time
from typing import Dict, Any, Optional, List
import logging
from calendar import monthrange

from database import get_db
from auth import get_current_user
from models import (
    UserDB, TotalizerReadingDB, ShutdownRecordDB, 
    KPIRecordDB, UnitInceptionMetricsDB
)
from routers.totalizers import TOTALIZER_MASTER
from services.kpi_calculations import (
    compute_unit_auto_kpis,
    compute_energy_meter_auto_kpis,
    compute_station_auto_kpis,
)
from services.dpr_gcv_helper import enrich_kpis_with_period_gcv

from sqlalchemy import select, func, delete, and_
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/dpr")


# ============================================================================
#  DATA MODELS
# ============================================================================

class LDOStockData(BaseModel):
    tank1_initial_stock: Optional[float] = None
    tank1_receipt: Optional[float] = None
    tank1_usage: Optional[float] = None
    tank1_closing_stock: Optional[float] = None
    tank2_initial_stock: Optional[float] = None
    tank2_receipt: Optional[float] = None
    tank2_usage: Optional[float] = None
    tank2_closing_stock: Optional[float] = None


class ShutdownSyncDetail(BaseModel):
    unit: str
    outage_type: Optional[str] = None
    shutdown_date: Optional[str] = None
    shutdown_time: Optional[str] = None
    reason: Optional[str] = None
    synchronization_date: Optional[str] = None
    synchronization_time: Optional[str] = None


class DPRSaveRequest(BaseModel):
    date: str
    remarks: Optional[str] = None
    computed_kpis: Dict[str, Dict[str, Any]]
    ldo_stock: Optional[LDOStockData] = None
    shutdown_details: Optional[List[ShutdownSyncDetail]] = None


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
    
    # Calculate total generation (MU)
    total_generation_mu = 0.0
    cur = inception_date
    
    while cur <= report_date:
        daily_data = await calculate_single_day(db, cur)
        unit_data = daily_data.get(unit, {})
        total_generation_mu += unit_data.get("generation", 0.0)
        cur += timedelta(days=1)
    
    # Add offset (convert to MU: offset is in MWh)
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
    """Calculate shutdown-related KPIs"""
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
    """Calculate all KPIs for a single day"""
    
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
    unit1["generation"] = u1_gen
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
    
    # Add station water KPIs
    station["total_raw_water_used_m3"] = station_water.get("total_raw_water_used_m3", 0.0)
    station["avg_raw_water_m3_per_hr"] = station_water.get("avg_raw_water_m3_per_hr", 0.0)
    station["sp_raw_water_l_per_kwh"] = station_water.get("sp_raw_water_l_per_kwh", 0.0)
    station["total_dm_water_used_m3"] = station_water.get("total_dm_water_used_m3", 0.0)
    
    # Initialize GCV and heat_rate
    station["gcv"] = None
    station["heat_rate"] = None
    unit1["gcv"] = None
    unit1["heat_rate"] = None
    unit2["gcv"] = None
    unit2["heat_rate"] = None
    
    # Stack emission
    station["stack_emission"] = None
    unit1["stack_emission"] = None
    unit2["stack_emission"] = None

    return {
        "Unit-1": unit1,
        "Unit-2": unit2,
        "Station": station,
    }


async def get_manual_kpis_for_date(db: AsyncSession, report_date: date):
    """Fetch manual KPIs from KPI records"""
    stmt = select(KPIRecordDB).where(
        KPIRecordDB.report_date == report_date,
        KPIRecordDB.kpi_type == "manual"
    )
    
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    manual_kpis = {
        "Unit-1": {},
        "Unit-2": {},
        "Station": {}
    }
    
    for record in records:
        plant = record.plant_name
        kpi_name = record.kpi_name
        kpi_value = float(record.kpi_value) if record.kpi_value is not None else None
        
        if plant in manual_kpis:
            manual_kpis[plant][kpi_name] = kpi_value
    
    return manual_kpis


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
#  API ENDPOINTS
# ============================================================================

@router.get("/kpi/preview")
async def dpr_kpi_preview(
    date: str = Query(..., description="Report date YYYY-MM-DD"),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get DPR KPIs for preview"""
    try:
        report_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")

    logger.info(f"📊 DPR Preview Request: {report_date}")
    
    ALL_KPIS = [
        "generation", "plf_percent", "running_hour", "plant_availability_percent",
        "planned_outage_hour", "planned_outage_percent", "strategic_outage_hour",
        "coal_consumption", "specific_coal", "gcv", "heat_rate",
        "oil_consumption", "specific_oil", "aux_power", "aux_power_percent",
        "stack_emission", "steam_generation", "specific_steam",
        "dm_water", "specific_dm_percent",
        "total_raw_water_used_m3", "avg_raw_water_m3_per_hr", "sp_raw_water_l_per_kwh",
        "total_dm_water_used_m3"
    ]
    
    SUM_KPIS = {
        "generation", "coal_consumption", "oil_consumption", "aux_power",
        "steam_generation", "dm_water", "running_hour", "planned_outage_hour",
        "strategic_outage_hour", "total_raw_water_used_m3", "total_dm_water_used_m3"
    }
    
    AVG_KPIS = {
        "plf_percent", "plant_availability_percent", "aux_power_percent",
        "heat_rate", "gcv", "stack_emission", "planned_outage_percent",
        "avg_raw_water_m3_per_hr", "sp_raw_water_l_per_kwh"
    }
    
    SPECIFIC_KPIS = {
        "specific_coal", "specific_oil", "specific_steam", "specific_dm_percent"
    }
    
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
    
    # Calculate KPIs for each period
    for period, (start, end) in ranges.items():
        daily_values = []

        cur = start
        while cur <= end:
            daily_values.append(await calculate_single_day(db, cur))
            cur += timedelta(days=1)

        # Aggregate
        for unit in ["Unit-1", "Unit-2", "Station"]:
            for kpi in ALL_KPIS:
                vals = [d[unit].get(kpi) for d in daily_values if d[unit].get(kpi) is not None]

                if not vals:
                    result[unit][kpi][period] = None
                elif kpi in AVG_KPIS or kpi in SPECIFIC_KPIS:
                    result[unit][kpi][period] = sum(vals) / len(vals)
                else:
                    result[unit][kpi][period] = sum(vals)
    
    # Enrich with GCV
    result = await enrich_kpis_with_period_gcv(db, report_date, result, ranges)
    
    # Get manual KPIs
    manual_kpis = await get_manual_kpis_for_date(db, report_date)
    
    # Merge manual KPIs
    for unit in ["Unit-1", "Unit-2", "Station"]:
        for kpi_name, value in manual_kpis[unit].items():
            if kpi_name not in result[unit]:
                result[unit][kpi_name] = {}
            result[unit][kpi_name]["day"] = value
    
    # Calculate inception metrics
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
    req: DPRSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Save complete DPR data"""
    
    try:
        report_date = date.fromisoformat(req.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format")
    
    logger.info(f"💾 Saving DPR for {report_date}")
    
    # Delete existing records
    delete_stmt = delete(KPIRecordDB).where(
        KPIRecordDB.report_date == report_date,
        KPIRecordDB.kpi_type == "manual"
    )
    await db.execute(delete_stmt)
    
    # Save all KPIs
    saved_count = 0
    for unit_name, kpis in req.computed_kpis.items():
        for kpi_name, kpi_value in kpis.items():
            if kpi_value is not None and kpi_value != "":
                record = KPIRecordDB(
                    report_date=report_date,
                    kpi_type="manual",
                    plant_name=unit_name,
                    kpi_name=kpi_name,
                    kpi_value=float(kpi_value),
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                )
                db.add(record)
                saved_count += 1
    
    await db.commit()
    
    logger.info(f"✅ Saved {saved_count} records")
    
    return {
        "message": "DPR saved successfully",
        "date": req.date,
        "records_saved": saved_count
    }


@router.get("/monthly-summary")
async def get_monthly_summary(
    year: int = Query(..., description="Year"),
    month: int = Query(..., description="Month (1-12)"),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """Get monthly summary for Sheet 3 format"""
    try:
        start_date = date(year, month, 1)
        _, last_day = monthrange(year, month)
        end_date = date(year, month, last_day)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid year/month")
    
    logger.info(f"📅 Monthly Summary: {year}-{month:02d}")
    
    daily_summary = []
    month_totals = {
        "Unit-1": {"paf": [], "plf": [], "apc": [], "scc": [], "run_hrs": []},
        "Unit-2": {"paf": [], "plf": [], "apc": [], "scc": [], "run_hrs": []},
        "Station": {"paf": [], "plf": [], "apc": [], "scc": [], "run_hrs": []}
    }
    
    cur_date = start_date
    while cur_date <= end_date:
        day_data = await calculate_single_day(db, cur_date)
        
        day_summary = {
            "date": cur_date.isoformat(),
            "Unit-1": {
                "paf_percent": day_data["Unit-1"].get("plant_availability_percent", 0),
                "plf_percent": day_data["Unit-1"].get("plf_percent", 0),
                "apc_percent": day_data["Unit-1"].get("aux_power_percent", 0),
                "scc": day_data["Unit-1"].get("specific_coal", 0),
                "run_hrs": day_data["Unit-1"].get("running_hour", 0)
            },
            "Unit-2": {
                "paf_percent": day_data["Unit-2"].get("plant_availability_percent", 0),
                "plf_percent": day_data["Unit-2"].get("plf_percent", 0),
                "apc_percent": day_data["Unit-2"].get("aux_power_percent", 0),
                "scc": day_data["Unit-2"].get("specific_coal", 0),
                "run_hrs": day_data["Unit-2"].get("running_hour", 0)
            },
            "Station": {
                "paf_percent": day_data["Station"].get("plant_availability_percent", 0),
                "plf_percent": day_data["Station"].get("plf_percent", 0),
                "apc_percent": day_data["Station"].get("aux_power_percent", 0),
                "scc": day_data["Station"].get("specific_coal", 0),
                "run_hrs": day_data["Station"].get("running_hour", 0)
            }
        }
        
        daily_summary.append(day_summary)
        
        for unit in ["Unit-1", "Unit-2", "Station"]:
            month_totals[unit]["paf"].append(day_summary[unit]["paf_percent"])
            month_totals[unit]["plf"].append(day_summary[unit]["plf_percent"])
            month_totals[unit]["apc"].append(day_summary[unit]["apc_percent"])
            month_totals[unit]["scc"].append(day_summary[unit]["scc"])
            month_totals[unit]["run_hrs"].append(day_summary[unit]["run_hrs"])
        
        cur_date += timedelta(days=1)
    
    # Calculate monthly averages/sums
    monthly_avg = {}
    for unit in ["Unit-1", "Unit-2", "Station"]:
        monthly_avg[unit] = {
            "paf_percent": sum(month_totals[unit]["paf"]) / len(month_totals[unit]["paf"]) if month_totals[unit]["paf"] else 0,
            "plf_percent": sum(month_totals[unit]["plf"]) / len(month_totals[unit]["plf"]) if month_totals[unit]["plf"] else 0,
            "apc_percent": sum(month_totals[unit]["apc"]) / len(month_totals[unit]["apc"]) if month_totals[unit]["apc"] else 0,
            "scc": sum(month_totals[unit]["scc"]) / len(month_totals[unit]["scc"]) if month_totals[unit]["scc"] else 0,
            "run_hrs": sum(month_totals[unit]["run_hrs"])
        }
    
    return {
        "year": year,
        "month": month,
        "daily_data": daily_summary,
        "monthly_average": monthly_avg
    }