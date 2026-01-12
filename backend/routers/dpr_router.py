from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from datetime import datetime, date, time, timedelta
from typing import Dict, List

from database import get_db
from models import KPIRecordDB, ShutdownRecordDB, TotalizerReadingDB
from routers.totalizers import TOTALIZER_MASTER
from services.kpi_calculations import (
    compute_unit_auto_kpis,
    compute_energy_meter_auto_kpis,
    compute_station_auto_kpis,
)

router = APIRouter(prefix="/api/dpr", tags=["DPR"])

# ======================================================
# KPI GROUPING
# ======================================================

SUM_KPIS = {
    "generation",
    "coal_consumption",
    "oil_consumption",
    "aux_power",
    "steam_generation",
    "dm_water",
}

AVG_KPIS = {
    "plf_percent",
    "plant_availability_percent",
    "aux_power_percent",
    "heat_rate",
    "gcv",
    "stack_emission",
}

SPECIFIC_KPIS = {
    "specific_coal",
    "specific_oil",
    "specific_steam",
    "specific_dm_percent",
}

SHUTDOWN_KPIS = {
    "running_hour",
    "plant_availability_percent",
    "planned_outage_hour",
    "planned_outage_percent",
    "strategic_outage_hour",
}

ALL_KPIS = [
    "generation",
    "plf_percent",
    "running_hour",
    "plant_availability_percent",
    "planned_outage_hour",
    "planned_outage_percent",
    "strategic_outage_hour",
    "coal_consumption",
    "specific_coal",
    "gcv",
    "heat_rate",
    "oil_consumption",
    "specific_oil",
    "aux_power",
    "aux_power_percent",
    "stack_emission",
    "steam_generation",
    "specific_steam",
    "dm_water",
    "specific_dm_percent",
]

# ======================================================
# DATE HELPERS
# ======================================================

def fy_start(d: date):
    return date(d.year if d.month >= 4 else d.year - 1, 4, 1)

def month_start(d: date):
    return d.replace(day=1)

# ======================================================
# SHUTDOWN KPIs
# ======================================================

async def compute_shutdown_kpis(db, unit, start_date, end_date):
    """
    Calculate shutdown-related KPIs for a given unit and date range.
    
    Logic:
    - Total hours in period = (end_date - start_date + 1) × 24
    - Query shutdown records that overlap with the period
    - Sum up shutdown hours by type
    - Running hours = Total hours - All shutdown hours
    - Plant availability % = (Running hours / Total hours) × 100
    """
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time.max)
    
    # Calculate total hours in the period
    total_days = (end_date - start_date).days + 1
    total_hours = total_days * 24.0

    rows = (
        await db.execute(
            select(ShutdownRecordDB).where(
                ShutdownRecordDB.unit == unit,
                ShutdownRecordDB.datetime_from <= end_dt,
                func.coalesce(ShutdownRecordDB.datetime_to, end_dt) >= start_dt,
            )
        )
    ).scalars().all()

    planned = 0.0
    strategic = 0.0
    total_shutdown = 0.0

    for r in rows:
        # Calculate overlap between shutdown period and query period
        shutdown_start = max(r.datetime_from, start_dt)
        shutdown_end = min(r.datetime_to or end_dt, end_dt)
        
        # Calculate hours of overlap
        hrs = (shutdown_end - shutdown_start).total_seconds() / 3600.0
        
        if hrs > 0:
            total_shutdown += hrs
            
            if r.shutdown_type == "Planned Outage":
                planned += hrs
            elif r.shutdown_type == "Strategic Outage":
                strategic += hrs

    # Running hours = Total hours - Shutdown hours
    running = max(0.0, total_hours - total_shutdown)

    return {
        "running_hour": round(running, 2),
        "plant_availability_percent": round((running / total_hours) * 100, 2),
        "planned_outage_hour": round(planned, 2),
        "planned_outage_percent": round((planned / total_hours) * 100, 2),
        "strategic_outage_hour": round(strategic, 2),
    }
# ======================================================
# 🔥 SINGLE DAY KPI ENGINE (CORE TRUTH)
# ======================================================

async def calculate_single_day(db: AsyncSession, d: date) -> Dict[str, Dict[str, float]]:
    diffs_by_unit = {
        "Unit-1": {},
        "Unit-2": {},
        "Station": {},
        "Energy-Meter": {},
    }

    today = (
        await db.execute(
            select(TotalizerReadingDB).where(TotalizerReadingDB.date == d)
        )
    ).scalars().all()

    yesterday = d - timedelta(days=1)
    y_map = {
        r.totalizer_id: float(r.reading_value or 0)
        for r in (
            await db.execute(
                select(TotalizerReadingDB).where(TotalizerReadingDB.date == yesterday)
            )
        ).scalars().all()
    }

    for r in today:
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

    # zero fill
    for _, (name, unit) in TOTALIZER_MASTER.items():
        diffs_by_unit[unit].setdefault(name, 0.0)

    # Compute energy meter KPIs
    energy = compute_energy_meter_auto_kpis(diffs_by_unit["Energy-Meter"], {})
    u1_gen = energy.get("unit1_generation", 0.0)
    u2_gen = energy.get("unit2_generation", 0.0)

    # Compute unit KPIs
    unit1 = compute_unit_auto_kpis(diffs_by_unit["Unit-1"], u1_gen)
    unit2 = compute_unit_auto_kpis(diffs_by_unit["Unit-2"], u2_gen)
    station_water = compute_station_auto_kpis(
        diffs_by_unit["Station"],
        {"unit1_generation": u1_gen, "unit2_generation": u2_gen},
    )

    # ========================================
    # ADD GENERATION AND ENERGY KPIs
    # ========================================
    unit1["generation"] = u1_gen / 1000.0  # MWh to MU
    unit1["plf_percent"] = energy.get("unit1_plf_percent", 0.0)
    unit1["aux_power"] = energy.get("unit1_aux_consumption_mwh", 0.0) / 1000.0
    unit1["aux_power_percent"] = energy.get("unit1_aux_percent", 0.0)

    unit2["generation"] = u2_gen / 1000.0
    unit2["plf_percent"] = energy.get("unit2_plf_percent", 0.0)
    unit2["aux_power"] = energy.get("unit2_aux_consumption_mwh", 0.0) / 1000.0
    unit2["aux_power_percent"] = energy.get("unit2_aux_percent", 0.0)

    # ========================================
    # COMPUTE SHUTDOWN KPIs
    # ========================================
    unit1_shutdown = await compute_shutdown_kpis(db, "Unit-1", d, d)
    unit2_shutdown = await compute_shutdown_kpis(db, "Unit-2", d, d)
    
    unit1.update(unit1_shutdown)
    unit2.update(unit2_shutdown)

    # ========================================
    # BUILD STATION KPIs
    # ========================================
    station = {}
    
    # SUM KPIs (total across both units)
    station["generation"] = unit1["generation"] + unit2["generation"]
    station["coal_consumption"] = unit1["coal_consumption"] + unit2["coal_consumption"]
    station["oil_consumption"] = unit1["oil_consumption"] + unit2["oil_consumption"]
    station["aux_power"] = unit1["aux_power"] + unit2["aux_power"]
    station["steam_generation"] = unit1["steam_generation"] + unit2["steam_generation"]
    station["dm_water"] = unit1["dm_water"] + unit2["dm_water"]
    
    # AVERAGE KPIs (weighted by generation where applicable)
    total_gen = station["generation"]
    
    if total_gen > 0:
        # Weighted averages based on generation
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
    
    # Specific DM % - weighted by steam generation
    total_steam = station["steam_generation"]
    if total_steam > 0:
        station["specific_dm_percent"] = (
            (unit1["specific_dm_percent"] * unit1["steam_generation"] + 
             unit2["specific_dm_percent"] * unit2["steam_generation"]) / total_steam
        )
    else:
        station["specific_dm_percent"] = 0.0
    
    # PLF for station (based on combined capacity)
    # Installed capacity = 125 MW per unit = 250 MW total
    # Daily capacity = 250 MW * 24 hours = 6000 MWh = 6 MU
    station["plf_percent"] = (station["generation"] / 6.0) * 100.0 if station["generation"] > 0 else 0.0
    
    # Shutdown KPIs - SUM hours, AVERAGE percentages
    station["running_hour"] = unit1["running_hour"] + unit2["running_hour"]
    station["planned_outage_hour"] = unit1["planned_outage_hour"] + unit2["planned_outage_hour"]
    station["strategic_outage_hour"] = unit1["strategic_outage_hour"] + unit2["strategic_outage_hour"]
    
    # Availability is average of both units
    station["plant_availability_percent"] = (
        (unit1["plant_availability_percent"] + unit2["plant_availability_percent"]) / 2.0
    )
    station["planned_outage_percent"] = (
        (unit1["planned_outage_percent"] + unit2["planned_outage_percent"]) / 2.0
    )
    
    # GCV and Heat Rate - these need to be added from manual entries or other sources
    # Set to None for now as they're not auto-calculated
    station["gcv"] = None
    station["heat_rate"] = None
    station["stack_emission"] = None
    
    unit1["gcv"] = None
    unit1["heat_rate"] = None
    unit1["stack_emission"] = None
    
    unit2["gcv"] = None
    unit2["heat_rate"] = None
    unit2["stack_emission"] = None

    return {
        "Unit-1": unit1,
        "Unit-2": unit2,
        "Station": station,
    }
# ======================================================
# 🔥 KPI PREVIEW (DAY / MONTH / YEAR)
# ======================================================

@router.get("/kpi/preview")
async def dpr_kpi_preview(
    date_: date = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db),
):
    ranges = {
        "day": (date_, date_),
        "month": (month_start(date_), date_),
        "year": (fy_start(date_), date_),
    }

    result = {u: {k: {} for k in ALL_KPIS} for u in ["Unit-1", "Unit-2", "Station"]}

    for period, (start, end) in ranges.items():
        daily_values = []

        cur = start
        while cur <= end:
            daily_values.append(await calculate_single_day(db, cur))
            cur += timedelta(days=1)

        for unit in ["Unit-1", "Unit-2", "Station"]:
            for kpi in ALL_KPIS:
                vals = [d[unit].get(kpi) for d in daily_values if d[unit].get(kpi) is not None]

                if not vals:
                    result[unit][kpi][period] = None
                elif kpi in AVG_KPIS or kpi in SPECIFIC_KPIS:
                    result[unit][kpi][period] = sum(vals) / len(vals)
                else:
                    result[unit][kpi][period] = sum(vals)

    return result

# ======================================================
# 💾 SAVE DPR (DAY ONLY)
# ======================================================

@router.post("/kpi/save")
async def dpr_save_kpis(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    report_date = date.fromisoformat(payload["date"])
    computed = payload["computed_kpis"]

    # ========================================
    # UPSERT: Update if exists, Insert if not
    # ========================================
    for unit in ["Unit-1", "Unit-2", "Station"]:
        for kpi, value in computed.get(unit, {}).items():
            # Skip None values
            if value is None:
                continue
            
            # Prepare data
            data = {
                "report_date": report_date,
                "plant_name": unit,
                "kpi_name": kpi,
                "kpi_type": "auto",
                "kpi_value": float(value),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
            
            # SQLite-specific upsert
            stmt = sqlite_insert(KPIRecordDB).values(**data)
            
            # On conflict, update the value and timestamp
            stmt = stmt.on_conflict_do_update(
                index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
                set_={
                    "kpi_value": float(value),
                    "updated_at": datetime.utcnow(),
                }
            )
            
            await db.execute(stmt)

    await db.commit()
    return {"message": "DPR KPIs saved successfully"}
