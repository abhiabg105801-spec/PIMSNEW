# backend/totalizers.py
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, insert, func, or_
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert
from datetime import date, timedelta, datetime, time, timezone

from typing import List, Optional, Dict, Any

from database import get_db
from models import UserDB
from auth import get_current_user
from models import TotalizerMasterDB, TotalizerReadingDB, KPIRecordDB, ShutdownRecordDB
from services.kpi_persistence import upsert_kpi

router = APIRouter(prefix="/api")  # main.py should include this router



# ================= HARDCODED TOTALIZER MASTER =================

TOTALIZER_MASTER = {
    1:  ("feeder_a", "Unit-1"),
    2:  ("feeder_b", "Unit-1"),
    3:  ("feeder_c", "Unit-1"),
    4:  ("feeder_d", "Unit-1"),
    5:  ("feeder_e", "Unit-1"),
    6:  ("ldo_flow", "Unit-1"),
    7:  ("dm7", "Unit-1"),
    8:  ("dm11", "Unit-1"),
    9:  ("main_steam", "Unit-1"),
    10: ("feed_water", "Unit-1"),

    11: ("feeder_a", "Unit-2"),
    12: ("feeder_b", "Unit-2"),
    13: ("feeder_c", "Unit-2"),
    14: ("feeder_d", "Unit-2"),
    15: ("feeder_e", "Unit-2"),
    16: ("ldo_flow", "Unit-2"),
    17: ("dm7", "Unit-2"),
    18: ("dm11", "Unit-2"),
    19: ("main_steam", "Unit-2"),
    20: ("feed_water", "Unit-2"),

    21: ("raw_water", "Station"),

    22: ("unit1_gen", "Energy-Meter"),
    23: ("unit2_gen", "Energy-Meter"),
    24: ("1lsr01_ic1", "Energy-Meter"),
    25: ("1lsr02_ic1", "Energy-Meter"),
    26: ("2lsr01_ic1", "Energy-Meter"),
    27: ("2lsr02_ic1", "Energy-Meter"),
    28: ("rlsr01", "Energy-Meter"),
    29: ("rlsr02", "Energy-Meter"),
    30: ("rlsr03", "Energy-Meter"),
    31: ("rlsr04", "Energy-Meter"),
    32: ("1lsr01_ic2_tie", "Energy-Meter"),
    33: ("1lsr02_ic2_tie", "Energy-Meter"),
    34: ("2lsr01_ic2_tie", "Energy-Meter"),
    35: ("2lsr02_ic2_tie", "Energy-Meter"),
    36: ("SST_10", "Energy-Meter"),
    37: ("UST_15", "Energy-Meter"),
    38: ("UST_25", "Energy-Meter"),
}


# ---------------------------
# Utilities
# ---------------------------
def yesterday(d: date) -> date:
    return d - timedelta(days=1)

def parse_iso_date(s: str) -> date:
    """Try date.fromisoformat first, fall back to datetime parsing."""
    try:
        return date.fromisoformat(s)
    except Exception:
        try:
            return datetime.fromisoformat(s).date()
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid date format. Expect YYYY-MM-DD")


def orm_to_dict_reading(r: TotalizerReadingDB) -> Dict[str, Any]:
    return {
        "id": r.id,
        "totalizer_id": r.totalizer_id,
        "date": r.date.isoformat() if r.date else None,
        "reading_value": r.reading_value,
        "adjust_value": r.adjust_value,
        "difference_value": r.difference_value,
        "created_at": r.created_at.isoformat() if getattr(r, "created_at", None) else None,
        "updated_at": r.updated_at.isoformat() if getattr(r, "updated_at", None) else None,
        "username": getattr(r, "username", None)
    }

def orm_to_dict_kpi(r: KPIRecordDB) -> Dict[str, Any]:
    return {
        "id": r.id,
        "report_date": r.report_date.isoformat() if r.report_date else None,
        "kpi_type": r.kpi_type,
        "plant_name": r.plant_name,
        "kpi_name": r.kpi_name,
        "kpi_value": r.kpi_value,
        "unit": r.unit,
        "created_at": r.created_at.isoformat() if getattr(r, "created_at", None) else None,
        "updated_at": r.updated_at.isoformat() if getattr(r, "updated_at", None) else None,
    }

# ---------------------------
# Pure KPI compute functions
# ---------------------------
def compute_unit_auto_kpis(diffs: Dict[str, float], generation: float = 0.0) -> Dict[str, float]:
    feederA = diffs.get("feeder_a", 0.0)
    feederB = diffs.get("feeder_b", 0.0)
    feederC = diffs.get("feeder_c", 0.0)
    feederD = diffs.get("feeder_d", 0.0)
    feederE = diffs.get("feeder_e", 0.0)

    coal = feederA + feederB + feederC + feederD + feederE
    oil = diffs.get("ldo_flow", 0.0)
    dm7 = diffs.get("dm7", 0.0)
    dm11 = diffs.get("dm11", 0.0)
    steam = diffs.get("main_steam", 0.0)

    dm_water = dm7 + dm11
    gen = float(generation or 0.0)

    specific_coal = (coal / gen) if gen > 0 else 0.0
    specific_oil = (oil / gen) if gen > 0 else 0.0
    specific_steam = (steam / gen) if gen > 0 else 0.0
    specific_dm_percent = ((dm_water / steam) * 100) if steam > 0 else 0.0

    return {
        "coal_consumption": round(coal, 3),
        "specific_coal": round(specific_coal, 6),
        "oil_consumption": round(oil, 3),
        "specific_oil": round(specific_oil, 6),
        "dm_water": round(dm_water, 3),
        "steam_consumption": round(steam, 3),
        "specific_steam": round(specific_steam, 6),
        "specific_dm_percent": round(specific_dm_percent, 3),
    }






# ---------------------------
# TOTALIZERS endpoints (new)
# ---------------------------



@router.get("/totalizers/{unit}/readings", dependencies=[Depends(get_current_user)])
async def get_readings_for_unit_date(unit: str, date: str = Query(...), db: AsyncSession = Depends(get_db)):
    rpt_date = parse_iso_date(date)

    mids = [tid for tid, (_, u) in TOTALIZER_MASTER.items() if u == unit]
    if not mids:
        return []

    q = await db.execute(
        select(TotalizerReadingDB)
        .where(
            TotalizerReadingDB.totalizer_id.in_(mids),
            TotalizerReadingDB.date == rpt_date
        )
    )
    rows = q.scalars().all()
    return [orm_to_dict_reading(r) for r in rows]

async def get_generation_from_db(
    db: AsyncSession,
    reading_date: date,
):
    q = await db.execute(
        select(KPIRecordDB.kpi_name, KPIRecordDB.kpi_value)
        .where(
            KPIRecordDB.report_date == reading_date,
            KPIRecordDB.kpi_type == "energy",
            KPIRecordDB.plant_name == "Station",
            KPIRecordDB.kpi_name.in_(["unit1_generation", "unit2_generation"]),
        )
    )
    rows = q.all()

    gen = {"unit1_generation": 0.0, "unit2_generation": 0.0}
    for k, v in rows:
        gen[k] = float(v or 0.0)

    return gen
@router.post("/totalizers/submit", dependencies=[Depends(get_current_user)])



async def submit_readings(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):
    """
    Submit readings payload (masterless):
    {
      date: "YYYY-MM-DD",
      plant_name: "Unit-1",
      readings: [{ totalizer_id, reading_value, adjust_value }],
      manual_kpis: [{ name, value, unit }]
    }
    """

    # -------------------- VALIDATION --------------------
    try:
        reading_date = parse_iso_date(payload["date"])
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid date")

    readings = payload.get("readings", [])
    manual_kpis = payload.get("manual_kpis", [])
    role_id = current_user.role_id

    plant_name = payload.get("plant_name")
    if not plant_name:
        if readings:
            meta = TOTALIZER_MASTER.get(readings[0]["totalizer_id"])
            plant_name = meta[1] if meta else None

    if not plant_name:
        raise HTTPException(status_code=422, detail="plant_name required")

    # -------------------- SAVE READINGS --------------------
    for item in readings:
        tid = item["totalizer_id"]
        today_val = float(item.get("reading_value") or 0.0)
        adjust = float(item.get("adjust_value") or 0.0)

        if role_id not in (7, 8):
            adjust = 0.0

        y = yesterday(reading_date)
        q = await db.execute(
            select(TotalizerReadingDB)
            .where(
                TotalizerReadingDB.totalizer_id == tid,
                TotalizerReadingDB.date == y
            )
        )
        yrow = q.scalars().first()
        yval = float(yrow.reading_value or 0.0) if yrow else 0.0

        diff = (today_val - yval) + adjust

        q2 = await db.execute(
            select(TotalizerReadingDB)
            .where(
                TotalizerReadingDB.totalizer_id == tid,
                TotalizerReadingDB.date == reading_date
            )
        )
        existing = q2.scalars().first()

        if existing:
            existing.reading_value = today_val
            existing.adjust_value = adjust
            existing.difference_value = diff
            existing.updated_at = datetime.now(timezone.utc)
        else:
            db.add(
                TotalizerReadingDB(
                    totalizer_id=tid,
                    date=reading_date,
                    reading_value=today_val,
                    adjust_value=adjust,
                    difference_value=diff,
                )
            )

    await db.commit()

   

    return {
    "message": "Totalizer readings saved successfully"
    }

# ---------------------------
# KPI endpoints
# ---------------------------



@router.get("/kpi/manual", dependencies=[Depends(get_current_user)])
async def get_saved_manual_kpis(date: str = Query(...), unit: str = Query(...), db: AsyncSession = Depends(get_db)):
    """
    Get saved MANUAL KPIs:
    /kpi/manual?date=YYYY-MM-DD&unit=Unit-1
    """
    rpt_date = parse_iso_date(date)
    q = await db.execute(select(KPIRecordDB).where(KPIRecordDB.report_date == rpt_date, KPIRecordDB.kpi_type == "manual", KPIRecordDB.plant_name == unit))
    rows = q.scalars().all()
    return {"date": rpt_date.isoformat(), "unit": unit, "kpis": [orm_to_dict_kpi(r) for r in rows]}
@router.post("/kpi/manual", dependencies=[Depends(get_current_user)])
async def save_manual_kpis(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db),
):
    """
    payload:
    {
      "date": "YYYY-MM-DD",
      "plant_name": "Unit-1" | "Unit-2" | "Station",
      "kpis": [
        { "name": "stack_emission", "value": 45, "unit": "mg/Nm3" },
        { "name": "clarifier_level", "value": 78, "unit": "%" }
      ]
    }
    """

    reading_date = parse_iso_date(payload["date"])
    plant = payload["plant_name"]
    kpis = payload.get("kpis", [])

    for k in kpis:
        await upsert_kpi(
            db=db,
            reading_date=reading_date,
            kpi_type="manual",
            plant=plant,
            name=k["name"],
            value=k["value"],
            unit=k.get("unit"),
        )

    await db.commit()

    return {"message": "Manual KPIs saved successfully"}

@router.get("/kpi/shutdown/{unit}", dependencies=[Depends(get_current_user)])
async def get_shutdown_kpis(unit: str, date: str = Query(...), db: AsyncSession = Depends(get_db)):
    """
    Calculate running hours / availability / planned / strategic outage hours
    for a unit within the provided date.
    e.g. GET /kpi/shutdown/Unit-1?date=YYYY-12-11
    """
    report_date = parse_iso_date(date)

    start_day = datetime.combine(report_date, time.min)
    end_day = datetime.combine(report_date, time.max)

    q = await db.execute(select(ShutdownRecordDB).where(ShutdownRecordDB.unit == unit))
    records = q.scalars().all()

    total_shutdown = 0.0
    planned = 0.0
    strategic = 0.0

    def overlap(start, end):
        if not start:
            return 0.0
        if not end:
            # ongoing treat as till end_of_day
            end = end_day
        s = max(start, start_day)
        e = min(end, end_day)
        if e <= s:
            return 0.0
        return (e - s).total_seconds() / 3600.0

    for r in records:
        hrs = overlap(r.datetime_from, r.datetime_to)
        if hrs <= 0:
            continue
        total_shutdown += hrs
        if r.shutdown_type == "Planned Outage":
            planned += hrs
        if r.shutdown_type == "Strategic Outage":
            strategic += hrs

    running = max(0.0, 24.0 - total_shutdown)

    return {
        "running_hour": round(running, 2),
        "plant_availability_percent": round((running / 24.0) * 100.0, 2),
        "planned_outage_hour": round(planned, 2),
        "planned_outage_percent": round((planned / 24.0) * 100.0, 2),
        "strategic_outage_hour": round(strategic, 2),
        "strategic_outage_percent": round((strategic / 24.0) * 100.0, 2),
    }
