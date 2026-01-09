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

def compute_energy_meter_auto_kpis(
    diffs: Dict[str, float],
    station_gen_cache: Dict[str, float] = None
) -> Dict[str, float]:

    station_gen_cache = station_gen_cache or {}

    def d(k: str) -> float:
        return float(diffs.get(k, 0.0) or 0.0)

    # -------------------------------------------------
    # UNIT AUX (EXACT MATCH WITH FRONTEND)
    # -------------------------------------------------
    unit1_unit_aux_mwh = (
        d("1lsr01_ic1")
        + d("1lsr02_ic1")
        + d("1lsr01_ic2_tie")
        - d("SST_10")
        - d("UST_15")
    )

    unit2_unit_aux_mwh = (
        d("2lsr01_ic1")
        + d("2lsr02_ic1")
        + d("2lsr01_ic2_tie")
        - d("UST_25")
    )

    # -------------------------------------------------
    # STATION AUX (EXACT MATCH WITH FRONTEND)
    # -------------------------------------------------
    total_station_aux_mwh = (
        d("rlsr01")
        + d("rlsr02")
        + d("rlsr03")
        + d("rlsr04")
        - d("1lsr01_ic2_tie")
        - d("1lsr02_ic2_tie")
        - d("2lsr01_ic2_tie")
        - d("2lsr02_ic2_tie")
        + d("SST_10")
        + d("UST_15")
        + d("UST_25")
        + d("SST_10")   # repeated intentionally (as per frontend)
        + d("UST_15")   # repeated intentionally (as per frontend)
    )

    # -------------------------------------------------
    # STATION TIE
    # -------------------------------------------------
    total_station_tie_mwh = (
        d("1lsr01_ic2_tie")
        + d("1lsr02_ic2_tie")
        + d("2lsr01_ic2_tie")
        + d("2lsr02_ic2_tie")
    )

    # -------------------------------------------------
    # GENERATION
    # -------------------------------------------------
    unit1_gen = float(
        station_gen_cache.get("unit1_generation", d("unit1_gen"))
    )

    unit2_gen = float(
        station_gen_cache.get("unit2_generation", d("unit2_gen"))
    )

    # -------------------------------------------------
    # AUX CONSUMPTION (HALF STATION AUX)
    # -------------------------------------------------
    unit1_aux_consumption_mwh = unit1_unit_aux_mwh + (total_station_aux_mwh / 2.0)
    unit2_aux_consumption_mwh = unit2_unit_aux_mwh + (total_station_aux_mwh / 2.0)

    # -------------------------------------------------
    # AUX %
    # -------------------------------------------------
    unit1_aux_percent = (
        (unit1_aux_consumption_mwh / unit1_gen) * 100.0
        if unit1_gen > 0 else 0.0
    )

    unit2_aux_percent = (
        (unit2_aux_consumption_mwh / unit2_gen) * 100.0
        if unit2_gen > 0 else 0.0
    )

    # -------------------------------------------------
    # PLF
    # -------------------------------------------------
    unit1_plf_percent = (unit1_gen / 3000.0) * 100.0 if unit1_gen > 0 else 0.0
    unit2_plf_percent = (unit2_gen / 3000.0) * 100.0 if unit2_gen > 0 else 0.0

    station_plf_percent = (
        ((unit1_gen + unit2_gen) / 3000.0) * 100.0
        if (unit1_gen + unit2_gen) > 0 else 0.0
    )

    # -------------------------------------------------
    # FINAL OUTPUT (ROUNDING SAME AS FRONTEND)
    # -------------------------------------------------
    return {
        "unit1_generation": round(unit1_gen, 3),
        "unit2_generation": round(unit2_gen, 3),

        "unit1_unit_aux_mwh": round(unit1_unit_aux_mwh, 3),
        "unit2_unit_aux_mwh": round(unit2_unit_aux_mwh, 3),

        "total_station_aux_mwh": round(total_station_aux_mwh, 3),
        "total_station_tie_mwh": round(total_station_tie_mwh, 3),

        "unit1_aux_consumption_mwh": round(unit1_aux_consumption_mwh, 3),
        "unit1_aux_percent": round(unit1_aux_percent, 3),

        "unit2_aux_consumption_mwh": round(unit2_aux_consumption_mwh, 3),
        "unit2_aux_percent": round(unit2_aux_percent, 3),

        "unit1_plf_percent": round(unit1_plf_percent, 3),
        "unit2_plf_percent": round(unit2_plf_percent, 3),
        "station_plf_percent": round(station_plf_percent, 3),
    }

def compute_station_auto_kpis(diffs: Dict[str, float], generation_cache: Dict[str, float] = None) -> Dict[str, float]:
    generation_cache = generation_cache or {}
    raw_water = diffs.get("raw_water", 0.0)

    avg_raw_per_hr = raw_water / 24.0 if True else 0.0
    dm_total = diffs.get("dm7", 0.0) + diffs.get("dm11", 0.0)

    gen1 = float(generation_cache.get("unit1_generation", 0.0))
    gen2 = float(generation_cache.get("unit2_generation", 0.0))
    sum_gen = gen1 + gen2

    sp_raw_l_per_kwh = ((raw_water * 1000.0) / sum_gen) if sum_gen > 0 else 0.0

    return {
        "total_raw_water_used_m3": round(raw_water, 3),
        "avg_raw_water_m3_per_hr": round(avg_raw_per_hr, 3),
        "sp_raw_water_l_per_kwh": round(sp_raw_l_per_kwh, 3),
        "total_dm_water_used_m3": round(dm_total, 3),
    }

# -------------------- HELPER (OUTSIDE endpoint) --------------------
async def upsert_kpi(
    db: AsyncSession,
    reading_date: date,
    kpi_type: str,
    plant: str,
    name: str,
    value: float,
    unit: str,
):
    if value is None:
        return

    insert_stmt = sqlite_upsert(KPIRecordDB).values(
        report_date=reading_date,
        kpi_type=kpi_type,
        plant_name=plant,
        kpi_name=name,
        kpi_value=float(value),
        unit=unit,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )

    update_stmt = insert_stmt.on_conflict_do_update(
        index_elements=[
            "report_date",
            "kpi_type",
            "plant_name",
            "kpi_name",
        ],
        set_={
            "kpi_value": insert_stmt.excluded.kpi_value,
            "unit": insert_stmt.excluded.unit,
            "updated_at": datetime.now(timezone.utc),
        },
    )

    await db.execute(update_stmt)


async def get_existing_kpi_value(
    db: AsyncSession,
    reading_date: date,
    kpi_type: str,
    plant: str,
    name: str,
):
    q = await db.execute(
        select(KPIRecordDB.kpi_value)
        .where(
            KPIRecordDB.report_date == reading_date,
            KPIRecordDB.kpi_type == kpi_type,
            KPIRecordDB.plant_name == plant,
            KPIRecordDB.kpi_name == name,
        )
    )
    row = q.first()
    return float(row[0]) if row else None


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

    # -------------------- BUILD GLOBAL DIFFS --------------------
    # -------------------- BUILD UNIT-SCOPED DIFFS --------------------
    diffs_by_unit = {
    "Unit-1": {},
    "Unit-2": {},
    "Station": {},
    "Energy-Meter": {},
    }

# today readings
    q = await db.execute(
     select(TotalizerReadingDB)
     .where(TotalizerReadingDB.date == reading_date)
    )
    today_rows = q.scalars().all()

# yesterday readings
    y = yesterday(reading_date)
    q = await db.execute(
      select(TotalizerReadingDB)
      .where(TotalizerReadingDB.date == y)
    )
    y_map = {r.totalizer_id: float(r.reading_value or 0.0) for r in q.scalars().all()}

# compute diffs per UNIT
    for r in today_rows:
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

# ensure missing totalizers are zeroed per unit
    for tid, (name, unit) in TOTALIZER_MASTER.items():
        diffs_by_unit[unit].setdefault(name, 0.0)

# -------------------- FLATTEN ENERGY DIFFS (GLOBAL) --------------------
    energy_diffs = diffs_by_unit["Energy-Meter"].copy()


    # -------------------- detect unit --------------------

    entered_units = set()

    for item in readings:
        meta = TOTALIZER_MASTER.get(item["totalizer_id"])
        if meta:
           _, unit = meta
           entered_units.add(unit)
    # -------------------- KPI COMPUTE (UNIT SAFE) --------------------

# ENERGY KPIs (isolated)
    energy_kpis = {}
    unit1_gen = 0.0
    unit2_gen = 0.0

    if "Energy-Meter" in entered_units:
       energy_kpis = compute_energy_meter_auto_kpis(energy_diffs, {})
       unit1_gen = energy_kpis.get("unit1_generation", 0.0)
       unit2_gen = energy_kpis.get("unit2_generation", 0.0)


# UNIT KPIs (isolated)
    unit1_kpis = compute_unit_auto_kpis(
    diffs_by_unit["Unit-1"],
    unit1_gen,
    )

    unit2_kpis = compute_unit_auto_kpis(
    diffs_by_unit["Unit-2"],
    unit2_gen,
    )

# STATION KPIs (isolated + generation cache)
    station_kpis = compute_station_auto_kpis(
    diffs_by_unit["Station"],
    {
        "unit1_generation": unit1_gen,
        "unit2_generation": unit2_gen,
    },
    )


    # -------------------- PERSIST KPIs --------------------



    # -------------------- PERSIST KPIs --------------------

    if "Energy-Meter" in entered_units:
     for k, v in energy_kpis.items():
        existing = await get_existing_kpi_value(
            db, reading_date, "energy", "Station", k
        )
        if existing is not None and round(existing, 6) == round(v, 6):
            continue

        await upsert_kpi(
            db,
            reading_date,
            "energy",
            "Station",
            k,
            v,
            "%" if "percent" in k else "MWh",
        )


    if "Unit-1" in entered_units:
     for k, v in unit1_kpis.items():
        existing = await get_existing_kpi_value(
            db, reading_date, "Unit", "Unit-1", k
        )
        if existing is not None and round(existing, 6) == round(v, 6):
            continue

        await upsert_kpi(
            db,
            reading_date,
            "Unit",
            "Unit-1",
            k,
            v,
            "%",
        )

# UNIT-2 KPIs
    if "Unit-2" in entered_units:
     for k, v in unit2_kpis.items():
        existing = await get_existing_kpi_value(
            db, reading_date, "Unit", "Unit-2", k
        )
        if existing is not None and round(existing, 6) == round(v, 6):
            continue

        await upsert_kpi(
            db,
            reading_date,
            "Unit",
            "Unit-2",
            k,
            v,
            "%",
        )

# STATION KPIs
     if "Station" in entered_units:
      for k, v in station_kpis.items():
        existing = await get_existing_kpi_value(
            db, reading_date, "auto", "Station", k
        )
        if existing is not None and round(existing, 6) == round(v, 6):
            continue

        await upsert_kpi(
            db,
            reading_date,
            "auto",
            "Station",
            k,
            v,
            "%",
        )

# -------------------- MANUAL KPIs (ALWAYS UPDATE) --------------------
    for m in manual_kpis:
      await upsert_kpi(
        db,
        reading_date,
        "manual",
        plant_name,
        m["name"],
        m["value"],
        m.get("unit"),
    )

    await db.commit()

    return {
        "message": "Saved successfully and KPIs recalculated",
        "computed_auto_kpis": {
            "energy": energy_kpis,
            "unit1": unit1_kpis,
            "unit2": unit2_kpis,
            "Station": station_kpis,
        },
    }

# ---------------------------
# KPI endpoints
# ---------------------------

@router.post("/kpi/calc", dependencies=[Depends(get_current_user)])
async def calc_kpi_live(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """
    Live, non-persisting KPI calculation for a given plant and readings.
    payload: { date: "YYYY-MM-DD", plant_name: "Unit-1"/"Unit-2"/"Energy-Meter"/"Station", readings: [{totalizer_id, reading_value, adjust_value}, ...] }
    returns: { auto_kpis: {...} }
    """
    try:
        rpt_date = parse_iso_date(payload["date"])
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid date")

    plant_name = payload.get("plant_name")
    readings = payload.get("readings", [])

    # build diffs map by master.name
    # -------------------- BUILD UNIT-SCOPED DIFFS (LIVE) --------------------
    diffs_by_unit = {
    "Unit-1": {},
    "Unit-2": {},
    "Station": {},
    "Energy-Meter": {},
    }

# yesterday map
    y = yesterday(rpt_date)
    q = await db.execute(
    select(TotalizerReadingDB)
    .where(TotalizerReadingDB.date == y)
    )
    y_map = {
    r.totalizer_id: float(r.reading_value or 0.0)
    for r in q.scalars().all()
    }

# calculate diffs per unit
    for item in readings:
      tid = item.get("totalizer_id")
      today_val = float(item.get("reading_value") or 0.0)
      adjust = float(item.get("adjust_value") or 0.0)

      meta = TOTALIZER_MASTER.get(tid)
      if not meta:
        continue

      name, unit = meta
      diff = (today_val - y_map.get(tid, 0.0)) + adjust
      diffs_by_unit[unit][name] = diff

# ensure all known totalizers exist with zero
    for tid, (name, unit) in TOTALIZER_MASTER.items():
      diffs_by_unit[unit].setdefault(name, 0.0)

    energy_diffs = diffs_by_unit["Energy-Meter"]


    # load station generation cache permissively
    station_gen_cache: Dict[str, float] = {}
    try:
        q = await db.execute(select(KPIRecordDB).where(KPIRecordDB.report_date == rpt_date, KPIRecordDB.kpi_type == "energy",
                                                     or_(KPIRecordDB.plant_name == "station", KPIRecordDB.plant_name == "Station", KPIRecordDB.plant_name.ilike("%station%"))))
        rows = q.scalars().all()
        for r in rows:
            station_gen_cache[r.kpi_name] = float(r.kpi_value or 0.0)
    except Exception:
        station_gen_cache = {}

    # -------------------- UNIT KPIs (LIVE, ISOLATED) --------------------
    if plant_name in ("Unit-1", "Unit-2"):
      gen_key = "unit1_generation" if plant_name == "Unit-1" else "unit2_generation"
      generation = float(station_gen_cache.get(gen_key, 0.0))

      auto = compute_unit_auto_kpis(
        diffs_by_unit[plant_name],
        generation,
      )
      return {"auto_kpis": auto}


    # -------------------- ENERGY KPIs (LIVE, GLOBAL) --------------------
    if plant_name == "Energy-Meter":
      auto = compute_energy_meter_auto_kpis(
        energy_diffs,
        station_gen_cache,
      )
      return {"auto_kpis": auto}

# -------------------- STATION KPIs (LIVE, ISOLATED) --------------------
    if plant_name == "Station":
      auto = compute_station_auto_kpis(
        diffs_by_unit["Station"],
        station_gen_cache,
    )
    return {"auto_kpis": auto}


@router.get("/kpi/auto", dependencies=[Depends(get_current_user)])
async def get_saved_auto_kpis(date: str = Query(...), unit: str = Query(...), db: AsyncSession = Depends(get_db)):
    """
    Get saved AUTO KPIs (energy/unit/station) for a date and unit
    e.g. /kpi/auto?date=2025-12-11&unit=Unit-1
    """
    rpt_date = parse_iso_date(date)
    q = await db.execute(select(KPIRecordDB).where(KPIRecordDB.report_date == rpt_date, KPIRecordDB.plant_name == unit))
    rows = q.scalars().all()
    return {"date": rpt_date.isoformat(), "unit": unit, "kpis": [orm_to_dict_kpi(r) for r in rows]}

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
