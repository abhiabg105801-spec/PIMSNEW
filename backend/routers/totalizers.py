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

def orm_to_dict_totalizer(m: TotalizerMasterDB) -> Dict[str, Any]:
    return {
        "id": m.id,
        "unit": m.unit,
        "name": m.name,
        "display_name": m.display_name,
        "sequence": m.sequence,
        "unit_label": getattr(m, "unit_label", None)
    }

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

# ---------------------------
# TOTALIZERS endpoints (new)
# ---------------------------

@router.get("/totalizers/{unit}/master", dependencies=[Depends(get_current_user)])
async def get_master_for_unit(unit: str, db: AsyncSession = Depends(get_db)):
    """
    Return master totalizers for a unit.
    unit examples: "Unit-1", "Unit-2", "Station", "Energy-Meter"
    """
    q = await db.execute(select(TotalizerMasterDB).where(TotalizerMasterDB.unit == unit).order_by(TotalizerMasterDB.sequence))
    rows = q.scalars().all()
    return [orm_to_dict_totalizer(r) for r in rows]

@router.get("/totalizers/{unit}/readings", dependencies=[Depends(get_current_user)])
async def get_readings_for_unit_date(unit: str, date: str = Query(...), db: AsyncSession = Depends(get_db)):
    """
    Return readings for all totalizers for the given unit and date.
    Query param: date=YYYY-MM-DD
    """
    rpt_date = parse_iso_date(date)
    # find master ids for this unit
    q = await db.execute(select(TotalizerMasterDB.id).where(TotalizerMasterDB.unit == unit))
    mids = [r[0] for r in q.all()]  # list of ids
    if not mids:
        # return empty list if no totalizers configured for this unit
        return []

    q2 = await db.execute(select(TotalizerReadingDB).where(TotalizerReadingDB.totalizer_id.in_(mids), TotalizerReadingDB.date == rpt_date))
    rows = q2.scalars().all()
    return [orm_to_dict_reading(r) for r in rows]

@router.post("/totalizers/submit", dependencies=[Depends(get_current_user)])
async def submit_readings(payload: dict = Body(...), db: AsyncSession = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    """
    Submit readings payload:
    {
      date: "YYYY-MM-DD",
      username: "...",            # optional
      plant_name: "Unit-1",      # required
      readings: [{ totalizer_id, reading_value, adjust_value }, ...],
      manual_kpis: [{ name, value, unit }, ...]   # optional
    }
    Returns saved computed_auto_kpis (all recalculated and persisted).
    """
    # validate date
    try:
        reading_date = parse_iso_date(payload["date"])
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid date")

    readings = payload.get("readings", [])
    role_id = current_user.role_id
    plant_name = payload.get("plant_name")
    manual_kpis = payload.get("manual_kpis", [])

    if not plant_name:
        # try infer from first reading
        if readings:
            first_tid = readings[0].get("totalizer_id")
            q = await db.execute(select(TotalizerMasterDB).where(TotalizerMasterDB.id == first_tid))
            m = q.scalars().first()
            plant_name = m.unit if m else None

    if not plant_name:
        raise HTTPException(status_code=422, detail="plant_name required")

    # 1) save readings and build diffs for submitted items (we'll compute global diffs later)
    for item in readings:
        tid = item.get("totalizer_id")
        today_val = float(item.get("reading_value") or 0.0)
        adjust = float(item.get("adjust_value") or 0.0)

        if role_id not in (7, 8):
            adjust = 0.0

        # yesterday reading
        y = yesterday(reading_date)
        q = select(TotalizerReadingDB).where(TotalizerReadingDB.totalizer_id == tid, TotalizerReadingDB.date == y)
        r = await db.execute(q)
        yrow = r.scalars().first()
        yvalue = float(yrow.reading_value) if yrow else 0.0

        diff = (today_val - yvalue) + adjust

        # upsert reading record
        q3 = select(TotalizerReadingDB).where(TotalizerReadingDB.totalizer_id == tid, TotalizerReadingDB.date == reading_date)
        existing = (await db.execute(q3)).scalars().first()
        if existing:
            existing.reading_value = today_val
            existing.adjust_value = adjust
            existing.difference_value = diff
            existing.updated_at = datetime.now(timezone.utc)
        else:
            new = TotalizerReadingDB(
                totalizer_id=tid,
                date=reading_date,
                reading_value=today_val,
                adjust_value=adjust,
                difference_value=diff
            )
            db.add(new)

    # commit readings first
    await db.commit()

    # -------------------------------------------------------
    # AGGREGATED FULL KPI RECALC & PERSIST (for the whole date)
    # This calculates Energy + Unit1 + Unit2 + Station KPIs using all totalizers' diffs
    # and upserts them so all dependent KPIs remain consistent after any submit.
    # -------------------------------------------------------

    # 1) load all masters to map id -> (name, unit)
    q = await db.execute(select(TotalizerMasterDB.id, TotalizerMasterDB.name, TotalizerMasterDB.unit))
    masters = q.all()  # list of tuples (id, name, unit)
    id_to_name: Dict[int, str] = {}
    id_to_unit: Dict[int, str] = {}
    for row in masters:
        mid, mname, munit = row
        id_to_name[mid] = mname
        id_to_unit[mid] = munit

    # 2) load today's readings for the date
    q = await db.execute(select(TotalizerReadingDB).where(TotalizerReadingDB.date == reading_date))
    today_rows = q.scalars().all()

    # 3) load yesterday readings for the date (to compute diffs globally)
    y = yesterday(reading_date)
    q = await db.execute(select(TotalizerReadingDB).where(TotalizerReadingDB.date == y))
    yesterday_rows = q.scalars().all()
    y_map = {r.totalizer_id: float(r.reading_value or 0.0) for r in yesterday_rows}

    # build diffs_by_name across all masters
    diffs_by_name: Dict[str, float] = {}
    # also collect per-totalizer adjust (from today's row) when present
    today_map = {r.totalizer_id: r for r in today_rows}
    for r in today_rows:
        tid = r.totalizer_id
        today_val = float(r.reading_value or 0.0)
        adjust = float(r.adjust_value or 0.0)
        yval = y_map.get(tid, 0.0)
        diff = (today_val - yval) + adjust
        mname = id_to_name.get(tid)
        if mname:
            diffs_by_name[mname] = diff

    # also ensure missing masters (without today's reading) are present with zero (helps computations)
    for mid, name in id_to_name.items():
        if name not in diffs_by_name:
            diffs_by_name[name] = 0.0

    # 4) compute energy KPIs first (energy may provide generation numbers)
    energy_kpis = compute_energy_meter_auto_kpis(diffs_by_name, station_gen_cache={})
    unit1_gen = energy_kpis.get("unit1_generation", 0.0)
    unit2_gen = energy_kpis.get("unit2_generation", 0.0)

    # 5) compute unit KPIs using generation from energy_kpis
    unit1_kpis = compute_unit_auto_kpis(diffs_by_name, generation=unit1_gen)
    unit2_kpis = compute_unit_auto_kpis(diffs_by_name, generation=unit2_gen)

    # 6) compute station KPIs using generation cache
    generation_cache = {"unit1_generation": unit1_gen, "unit2_generation": unit2_gen}
    station_kpis = compute_station_auto_kpis(diffs_by_name, generation_cache=generation_cache)

    # 7) persist energy KPIs (save as kpi_type="energy", plant_name="Station")
    try:
        EM_SAVE_LIST = [
            ("unit1_generation", "MWh"),
            ("unit2_generation", "MWh"),
            ("unit1_unit_aux_mwh", "MWh"),
            ("unit2_unit_aux_mwh", "MWh"),
            ("total_station_aux_mwh", "MWh"),
            ("total_station_tie_mwh", "MWh"),
            ("unit1_aux_consumption_mwh", "MWh"),
            ("unit1_aux_percent", "%"),
            ("unit2_aux_consumption_mwh", "MWh"),
            ("unit2_aux_percent", "%"),
            ("unit1_plf_percent", "%"),
            ("unit2_plf_percent", "%"),
            ("station_plf_percent", "%"),
        ]
        for k, unit in EM_SAVE_LIST:
            val = float(energy_kpis.get(k, 0.0))
            stmt = sqlite_upsert(KPIRecordDB).values(
                report_date=reading_date,
                kpi_type="energy",
                plant_name="Station",
                kpi_name=k,
                kpi_value=val,
                unit=unit,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
                set_={
                    "kpi_value": stmt.excluded.kpi_value,
                    "unit": stmt.excluded.unit,
                    "updated_at": datetime.now(timezone.utc)
                }
            )
            await db.execute(stmt)
        await db.commit()
    except Exception:
        # swallow DB write errors to avoid breaking entire submit; but surface later if needed
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to persist energy KPIs")

    # 8) persist Unit KPIs (Unit-1 and Unit-2)
    try:
        UNIT_SAVE_LIST = [
            ("coal_consumption", "ton"),
            ("specific_coal", "ton/MWh"),
            ("oil_consumption", "L"),
            ("specific_oil", "L/MWh"),
            ("dm_water", "m3"),
            ("steam_consumption", "kg"),
            ("specific_steam", "kg/MWh"),
            ("specific_dm_percent", "%"),
        ]
        # Unit-1
        for k, unit in UNIT_SAVE_LIST:
            val = float(unit1_kpis.get(k, 0.0))
            stmt = sqlite_upsert(KPIRecordDB).values(
                report_date=reading_date,
                kpi_type="Unit",
                plant_name="Unit-1",
                kpi_name=k,
                kpi_value=val,
                unit=unit,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
                set_={
                    "kpi_value": stmt.excluded.kpi_value,
                    "unit": stmt.excluded.unit,
                    "updated_at": datetime.now(timezone.utc)
                }
            )
            await db.execute(stmt)
        # Unit-2
        for k, unit in UNIT_SAVE_LIST:
            val = float(unit2_kpis.get(k, 0.0))
            stmt = sqlite_upsert(KPIRecordDB).values(
                report_date=reading_date,
                kpi_type="Unit",
                plant_name="Unit-2",
                kpi_name=k,
                kpi_value=val,
                unit=unit,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
                set_={
                    "kpi_value": stmt.excluded.kpi_value,
                    "unit": stmt.excluded.unit,
                    "updated_at": datetime.now(timezone.utc)
                }
            )
            await db.execute(stmt)

        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to persist unit KPIs")

    # 9) persist Station KPIs
    try:
        ST_SAVE_LIST = [
            ("total_raw_water_used_m3", "m3"),
            ("avg_raw_water_m3_per_hr", "m3/hr"),
            ("sp_raw_water_l_per_kwh", "L/kWh"),
            ("total_dm_water_used_m3", "m3"),
        ]
        for k, unit in ST_SAVE_LIST:
            val = float(station_kpis.get(k, 0.0))
            stmt = sqlite_upsert(KPIRecordDB).values(
                report_date=reading_date,
                kpi_type="manual",
                plant_name="Station",
                kpi_name=k,
                kpi_value=val,
                unit=unit,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
                set_={
                    "kpi_value": stmt.excluded.kpi_value,
                    "unit": stmt.excluded.unit,
                    "updated_at": datetime.now(timezone.utc)
                }
            )
            await db.execute(stmt)

        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to persist station KPIs")

    # 10) Save manual KPIs (unchanged behavior)
    try:
        for m in manual_kpis:
            name = m.get("name")
            value = m.get("value")
            unit = m.get("unit")
            if name is None:
                continue

            stmt = sqlite_upsert(KPIRecordDB).values(
                report_date=reading_date,
                kpi_type="manual",
                plant_name=plant_name,
                kpi_name=name,
                kpi_value=value,
                unit=unit,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc)
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
                set_={
                    "kpi_value": stmt.excluded.kpi_value,
                    "unit": stmt.excluded.unit,
                    "updated_at": datetime.now(timezone.utc)
                }
            )
            await db.execute(stmt)

        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Failed to persist manual KPIs")

    # 11) Return aggregated computed values (helpful for frontend to immediately show)
    aggregated = {
        "energy": energy_kpis,
        "unit1": unit1_kpis,
        "unit2": unit2_kpis,
        "Station": station_kpis,
    }

    return {
        "message": "Saved successfully and KPIs recalculated",
        "computed_auto_kpis": aggregated
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
    diffs: Dict[str, float] = {}
    for item in readings:
        tid = item.get("totalizer_id")
        today_val = float(item.get("reading_value") or 0.0)
        adjust = float(item.get("adjust_value") or 0.0)

        y = yesterday(rpt_date)
        q = await db.execute(select(TotalizerReadingDB).where(TotalizerReadingDB.totalizer_id == tid, TotalizerReadingDB.date == y))
        yrow = q.scalars().first()
        yval = float(yrow.reading_value) if yrow else 0.0

        diff = (today_val - yval) + adjust

        q2 = await db.execute(select(TotalizerMasterDB).where(TotalizerMasterDB.id == tid))
        m = q2.scalars().first()
        if m:
            diffs[m.name] = diff

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

    if plant_name in ("Unit-1", "Unit-2"):
        gen_key = "unit1_generation" if plant_name == "Unit-1" else "unit2_generation"
        generation = float(station_gen_cache.get(gen_key, diffs.get("unit1_gen" if plant_name == "Unit-1" else "unit2_gen", 0.0) or 0.0))
        auto = compute_unit_auto_kpis(diffs, generation)
        return {"auto_kpis": auto}

    if plant_name == "Energy-Meter":
        auto = compute_energy_meter_auto_kpis(diffs, station_gen_cache)
        return {"auto_kpis": auto}

    if plant_name == "Station":
        auto = compute_station_auto_kpis(diffs, station_gen_cache)
        return {"auto_kpis": auto}

    raise HTTPException(status_code=422, detail="Unknown plant_name")

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
