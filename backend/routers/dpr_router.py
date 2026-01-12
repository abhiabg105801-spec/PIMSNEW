from fastapi import APIRouter, Depends, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, date, time, timedelta
from typing import Dict

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
# DPR KPI CALCULATION (🔥 SINGLE SOURCE OF TRUTH)
# ======================================================

@router.post("/kpi/calc")
async def dpr_calculate_kpis(
    date_: date = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db),
):
    """
    Calculate ALL KPIs on DPR page
    ❌ No DB write
    """

    diffs_by_unit: Dict[str, Dict[str, float]] = {
        "Unit-1": {},
        "Unit-2": {},
        "Station": {},
        "Energy-Meter": {},
    }

    # ---------- Today readings ----------
    today = (
        await db.execute(
            select(TotalizerReadingDB)
            .where(TotalizerReadingDB.date == date_)
        )
    ).scalars().all()

    # ---------- Yesterday readings ----------
    y = date_ - timedelta(days=1)
    y_map = {
        r.totalizer_id: float(r.reading_value or 0.0)
        for r in (
            await db.execute(
                select(TotalizerReadingDB)
                .where(TotalizerReadingDB.date == y)
            )
        ).scalars().all()
    }

    # ---------- Build diffs ----------
    for r in today:
        meta = TOTALIZER_MASTER.get(r.totalizer_id)
        if not meta:
            continue

        name, unit = meta
        diff = (
            float(r.reading_value or 0.0)
            - y_map.get(r.totalizer_id, 0.0)
            + float(r.adjust_value or 0.0)
        )
        diffs_by_unit[unit][name] = diff

    # Zero-fill
    for tid, (name, unit) in TOTALIZER_MASTER.items():
        diffs_by_unit[unit].setdefault(name, 0.0)

    # ---------- ENERGY KPIs ----------
    energy_kpis = compute_energy_meter_auto_kpis(
        diffs_by_unit["Energy-Meter"],
        {},
    )

    unit1_gen = energy_kpis.get("unit1_generation", 0.0)
    unit2_gen = energy_kpis.get("unit2_generation", 0.0)

    # ---------- UNIT KPIs ----------
    unit1_kpis = compute_unit_auto_kpis(diffs_by_unit["Unit-1"], unit1_gen)
    unit2_kpis = compute_unit_auto_kpis(diffs_by_unit["Unit-2"], unit2_gen)

    # ---------- STATION KPIs ----------
    station_kpis = compute_station_auto_kpis(
        diffs_by_unit["Station"],
        {
            "unit1_generation": unit1_gen,
            "unit2_generation": unit2_gen,
        },
    )

    return {
        "date": date_.isoformat(),
        "computed_kpis": {
            "energy": energy_kpis,
            "Unit-1": unit1_kpis,
            "Unit-2": unit2_kpis,
            "Station": station_kpis,
        },
    }

# ======================================================
# DPR KPI SAVE (ONLY ON SAVE BUTTON)
# ======================================================

@router.post("/kpi/save")
async def dpr_save_kpis(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Save DPR KPIs explicitly
    """
    report_date = date.fromisoformat(payload["date"])
    computed = payload["computed_kpis"]

    for plant, kpis in computed.items():
        kpi_type = "energy" if plant == "energy" else "auto"
        plant_name = "Station" if plant == "energy" else plant

        for name, value in kpis.items():
            await db.execute(
                select(KPIRecordDB).where(
                    KPIRecordDB.report_date == report_date,
                    KPIRecordDB.plant_name == plant_name,
                    KPIRecordDB.kpi_name == name,
                )
            )

            db.add(
                KPIRecordDB(
                    report_date=report_date,
                    kpi_type=kpi_type,
                    plant_name=plant_name,
                    kpi_name=name,
                    kpi_value=value,
                    unit="%" if "percent" in name else "—",
                    created_at=datetime.utcnow(),
                )
            )

    await db.commit()
    return {"message": "DPR KPIs saved successfully"}

# ======================================================
# DPR PAGE-1 (UNCHANGED – READS SAVED KPIs)
# ======================================================

@router.get("/page1")
async def dpr_page1(
    date_: date = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db),
):
    ranges = {
        "day": (date_, date_),
        "month": (month_start(date_), date_),
        "year": (fy_start(date_), date_),
    }

    result = {u: {} for u in ["Unit-1", "Unit-2", "Station"]}

    ENERGY_MAP = {
        "generation": {
            "Unit-1": "unit1_generation",
            "Unit-2": "unit2_generation",
            "Station": None,
        },
        "plf_percent": {
            "Unit-1": "unit1_plf_percent",
            "Unit-2": "unit2_plf_percent",
            "Station": "station_plf_percent",
        },
        "aux_power": {
            "Unit-1": "unit1_aux_consumption_mwh",
            "Unit-2": "unit2_aux_consumption_mwh",
            "Station": "total_station_aux_mwh",
        },
        "aux_power_percent": {
            "Unit-1": "unit1_aux_percent",
            "Unit-2": "unit2_aux_percent",
            "Station": None,
        },
    }

    for unit in ["Unit-1", "Unit-2", "Station"]:
        for kpi in ALL_KPIS:
            result[unit][kpi] = {}

            for p, (s, e) in ranges.items():

                # Shutdown KPIs
                if unit != "Station" and kpi in SHUTDOWN_KPIS:
                    result[unit][kpi][p] = (
                        await compute_shutdown_kpis(db, unit, s, e)
                    )[kpi]
                    continue

                # ENERGY KPIs (DERIVED)
                if kpi in ENERGY_MAP:
                    key = ENERGY_MAP[kpi].get(unit)
                    if not key:
                        result[unit][kpi][p] = None
                        continue

                    q = (
                        select(KPIRecordDB.kpi_value)
                        .where(
                            KPIRecordDB.plant_name == "Station",
                            KPIRecordDB.kpi_name == key,
                            KPIRecordDB.report_date.between(s, e),
                        )
                        .order_by(desc(KPIRecordDB.report_date))
                        .limit(1)
                    )
                    result[unit][kpi][p] = (await db.execute(q)).scalar()
                    continue

                # NORMAL KPIs
                q = (
                    select(KPIRecordDB.kpi_value)
                    .where(
                        KPIRecordDB.plant_name == unit,
                        KPIRecordDB.kpi_name == kpi,
                        KPIRecordDB.report_date.between(s, e),
                    )
                    .order_by(desc(KPIRecordDB.report_date))
                    .limit(1)
                )
                result[unit][kpi][p] = (await db.execute(q)).scalar()

    return result
