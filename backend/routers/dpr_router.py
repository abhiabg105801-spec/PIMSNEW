from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, date, time

from database import get_db
from models import KPIRecordDB, ShutdownRecordDB

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
# KPI → DB NAME MAPPING (🔥 CRITICAL FIX)
# ======================================================

KPI_DB_NAME_MAP = {
    "generation": None,  # handled separately
    "plf_percent": None,

    "coal_consumption": "coal_consumption",
    "specific_coal": "specific_coal",

    "oil_consumption": "oil_consumption",
    "specific_oil": "specific_oil",

    "steam_generation": "steam_consumption",
    "specific_steam": "specific_steam",

    "dm_water": "dm_water",
    "specific_dm_percent": "specific_dm_percent",

    "aux_power": None,
    "aux_power_percent": None,

    "gcv": "gcv",
    "heat_rate": "heat_rate",
    "stack_emission": "stack_emission",
}

# ======================================================
# ENERGY / STATION STORED KPIs
# ======================================================

KPI_NAME_MAP = {
    "generation": {
        "Unit-1": ("Station", "unit1_generation"),
        "Unit-2": ("Station", "unit2_generation"),
    },
    "plf_percent": {
        "Unit-1": ("Station", "unit1_plf_percent"),
        "Unit-2": ("Station", "unit2_plf_percent"),
    },
    "steam_generation": {
        "Unit-1": ("Unit-1", "steam_consumption"),
        "Unit-2": ("Unit-2", "steam_consumption"),
    },
}

ENERGY_KPI_MAP = {
    "aux_power": {
        "Unit-1": "unit1_aux_consumption_mwh",
        "Unit-2": "unit2_aux_consumption_mwh",
    },
    "aux_power_percent": {
        "Unit-1": "unit1_aux_percent",
        "Unit-2": "unit2_aux_percent",
    },
}

# ======================================================
# DATE HELPERS
# ======================================================

def fy_start(d: date):
    return date(d.year if d.month >= 4 else d.year - 1, 4, 1)

def month_start(d: date):
    return d.replace(day=1)

# ======================================================
# CORE FETCHERS
# ======================================================

async def fetch_latest_value(db, plant, kpi_name, start_date, end_date):
    q = (
        select(KPIRecordDB.kpi_value)
        .where(
            KPIRecordDB.plant_name == plant,
            KPIRecordDB.kpi_name == kpi_name,
            KPIRecordDB.report_date.between(start_date, end_date),
        )
        .order_by(desc(KPIRecordDB.report_date))
        .limit(1)
    )
    return (await db.execute(q)).scalar()

async def aggregate_kpi(db, unit, kpi, start_date, end_date):

    # 1️⃣ Specific KPIs → direct fetch from UNIT
    if kpi in SPECIFIC_KPIS:
        db_kpi = KPI_DB_NAME_MAP[kpi]
        return await fetch_latest_value(db, unit, db_kpi, start_date, end_date)

    # 2️⃣ Energy KPIs (stored at Station)
    if kpi in ENERGY_KPI_MAP:
        db_kpi = ENERGY_KPI_MAP[kpi].get(unit)
        return await fetch_latest_value(db, "Station", db_kpi, start_date, end_date)

    # 3️⃣ Mapped KPIs (generation / plf / steam)
    if kpi in KPI_NAME_MAP:
        plant, db_kpi = KPI_NAME_MAP[kpi][unit]
        return await fetch_latest_value(db, plant, db_kpi, start_date, end_date)

    # 4️⃣ Normal KPIs
    db_kpi = KPI_DB_NAME_MAP.get(kpi, kpi)

    q = select(
        func.sum(KPIRecordDB.kpi_value),
        func.avg(KPIRecordDB.kpi_value),
    ).where(
        KPIRecordDB.plant_name == unit,
        KPIRecordDB.kpi_name == db_kpi,
        KPIRecordDB.report_date.between(start_date, end_date),
    )

    s, a = (await db.execute(q)).first()
    return a if kpi in AVG_KPIS else s

# ======================================================
# SHUTDOWN KPIs
# ======================================================

async def compute_shutdown_kpis(db, unit, start_date, end_date):
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time.max)

    rows = (
        await db.execute(
            select(ShutdownRecordDB).where(
                ShutdownRecordDB.unit == unit,
                ShutdownRecordDB.datetime_from <= end_dt,
                func.coalesce(ShutdownRecordDB.datetime_to, end_dt) >= start_dt,
            )
        )
    ).scalars().all()

    planned = strategic = total = 0.0

    for r in rows:
        s = max(r.datetime_from, start_dt)
        e = min(r.datetime_to or end_dt, end_dt)
        hrs = (e - s).total_seconds() / 3600.0
        total += hrs
        if r.shutdown_type == "Planned Outage":
            planned += hrs
        elif r.shutdown_type == "Strategic Outage":
            strategic += hrs

    running = max(0.0, 24.0 - total)

    return {
        "running_hour": running,
        "plant_availability_percent": (running / 24) * 100,
        "planned_outage_hour": planned,
        "planned_outage_percent": (planned / 24) * 100,
        "strategic_outage_hour": strategic,
    }

# ======================================================
# DPR PAGE-1 JSON API
# ======================================================

@router.get("/page1")
async def dpr_page1(date_: date = Query(..., alias="date"), db: AsyncSession = Depends(get_db)):
    ranges = {
        "day": (date_, date_),
        "month": (month_start(date_), date_),
        "year": (fy_start(date_), date_),
    }

    result = {}
    units = ["Unit-1", "Unit-2"]

    for unit in units:
        result[unit] = {}
        for kpi in ALL_KPIS:
            result[unit][kpi] = {}
            for p, (s, e) in ranges.items():
                if kpi in SHUTDOWN_KPIS:
                    result[unit][kpi][p] = (await compute_shutdown_kpis(db, unit, s, e))[kpi]
                else:
                    result[unit][kpi][p] = await aggregate_kpi(db, unit, kpi, s, e)

    # -------- STATION --------
    result["Station"] = {}
    for kpi in ALL_KPIS:
        result["Station"][kpi] = {}
        for p in ["day", "month", "year"]:
            vals = [
                result["Unit-1"][kpi][p],
                result["Unit-2"][kpi][p],
            ]
            vals = [v for v in vals if v is not None]

            if not vals:
                result["Station"][kpi][p] = None
            elif kpi in AVG_KPIS or kpi in SHUTDOWN_KPIS:
                result["Station"][kpi][p] = sum(vals) / len(vals)
            else:
                result["Station"][kpi][p] = sum(vals)

    return result
