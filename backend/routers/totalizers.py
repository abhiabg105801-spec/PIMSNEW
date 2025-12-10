# backend/totalizers.py  -- PART 1 of 3
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, insert, func
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert
from datetime import date, timedelta, datetime, time
from typing import List, Optional, Dict, Any

from database import get_db
from models import UserDB
from auth import get_current_user
from models import TotalizerMasterDB, TotalizerReadingDB, KPIRecordDB, ShutdownRecordDB

router = APIRouter()

# -----------------------------------------------------
# UTIL
# -----------------------------------------------------
def yesterday(d: date):
    return d - timedelta(days=1)

# -----------------------------------------------------
# AUTO KPI COMPUTATION (pure functions)
# -----------------------------------------------------
def compute_unit_auto_kpis(diffs: Dict[str, float], generation: float = 0.0) -> Dict[str, float]:
    """
    Compute the 8 unit KPIs from diffs (by master.name keys) and optional generation.
    diffs keys expected: feeder_a .. feeder_e, ldo_flow, dm7, dm11, main_steam, ...
    """
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

def compute_energy_meter_auto_kpis(diffs: Dict[str, float], station_gen_cache: Dict[str, float] = None) -> Dict[str, float]:
    """
    Compute energy-meter related KPIs from diffs keyed by master.name (Energy-Meter names)
    diffs keys expected: 1lsr01_ic1, 1lsr02_ic1, 2lsr01_ic1, 2lsr02_ic1,
                        rlsr01..rlsr04, 1lsr01_ic2_tie.. etc,
                        SST_10, UST_15, UST_25, unit1_gen, unit2_gen
    station_gen_cache: existing KPI records (e.g. from Station) that may contain unit1_generation/unit2_generation
    """
    station_gen_cache = station_gen_cache or {}

    # Map names used in your frontend (EM)
    def g(k):
        return diffs.get(k, 0.0)

    unit1_unit_aux_mwh = g("1lsr01_ic1") + g("1lsr02_ic1")
    unit2_unit_aux_mwh = g("2lsr01_ic1") + g("2lsr02_ic1")

    total_station_aux = (
        g("rlsr01") + g("rlsr02") + g("rlsr03") + g("rlsr04") + g("SST_10") + g("UST_15") + g("UST_25")
    )

    total_station_tie = (
        g("1lsr01_ic2_tie") + g("1lsr02_ic2_tie") + g("2lsr01_ic2_tie") + g("2lsr02_ic2_tie")
    )

    # unit aux consumption: unit_unit_aux + half of station aux+tie (as in your frontend)
    unit1_aux_consumption = unit1_unit_aux_mwh + (total_station_aux + total_station_tie) / 2.0
    unit2_aux_consumption = unit2_unit_aux_mwh + (total_station_aux + total_station_tie) / 2.0

    # generation: prefer station_gen_cache values (names: unit1_generation, unit2_generation) else diffs unit1_gen/unit2_gen
    unit1_gen = float(station_gen_cache.get("unit1_generation", diffs.get("unit1_gen", 0.0) or 0.0))
    unit2_gen = float(station_gen_cache.get("unit2_generation", diffs.get("unit2_gen", 0.0) or 0.0))

    unit1_plf = (unit1_gen / 3000.0) * 100.0 if unit1_gen > 0 else 0.0
    unit2_plf = (unit2_gen / 3000.0) * 100.0 if unit2_gen > 0 else 0.0
    station_plf = ((unit1_gen + unit2_gen) / 3000.0) * 100.0 if (unit1_gen + unit2_gen) > 0 else 0.0

    unit1_aux_percent = (unit1_aux_consumption / unit1_gen * 100.0) if unit1_gen > 0 else 0.0
    unit2_aux_percent = (unit2_aux_consumption / unit2_gen * 100.0) if unit2_gen > 0 else 0.0

    return {
        "unit1_generation": round(unit1_gen, 3),
        "unit2_generation": round(unit2_gen, 3),
        "unit1_unit_aux_mwh": round(unit1_unit_aux_mwh, 3),
        "unit2_unit_aux_mwh": round(unit2_unit_aux_mwh, 3),
        "total_station_aux_mwh": round(total_station_aux, 3),
        "total_station_tie_mwh": round(total_station_tie, 3),
        "unit1_aux_consumption_mwh": round(unit1_aux_consumption, 3),
        "unit1_aux_percent": round(unit1_aux_percent, 3),
        "unit2_aux_consumption_mwh": round(unit2_aux_consumption, 3),
        "unit2_aux_percent": round(unit2_aux_percent, 3),
        "unit1_plf_percent": round(unit1_plf, 3),
        "unit2_plf_percent": round(unit2_plf, 3),
        "station_plf_percent": round(station_plf, 3),
    }

def compute_station_auto_kpis(diffs: Dict[str, float], generation_cache: Dict[str, float] = None) -> Dict[str, float]:
    """
    Station KPIs such as raw water and DM totals
    diffs expected keys: raw_water, dm7 (unit1), dm11, etc — but station DM is sum across units (we will read unit diffs if supplied)
    generation_cache: may contain unit1_generation/unit2_generation for SP calculations
    """
    generation_cache = generation_cache or {}
    raw_water = diffs.get("raw_water", 0.0)

    avg_raw_per_hr = raw_water / 24.0 if True else 0.0  # always divide by 24
    # For total DM we expect diffs from unit totalizers keys present in diffs map,
    # if not present, call with separate diffs built by submit logic.
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

# -----------------------------------------------------
# SEED MASTER TOTALIZERS (unchanged)
# -----------------------------------------------------
@router.post("/seed-master", dependencies=[Depends(get_current_user)])
async def seed_master(db: AsyncSession = Depends(get_db)):
    """Insert master totalizers once (Unit-1, Unit-2, Station, Energy-Meter)."""

    # Check if already inserted
    q = await db.execute(select(TotalizerMasterDB))
    if q.scalars().first():
        return {"message": "Totalizers already exist"}

    seeds = []

    def add(unit, name, display):
        seeds.append(dict(unit=unit, name=name, display_name=display))

    # ---------------------------------------
    # UNIT 1
    # ---------------------------------------
    for f in ["A", "B", "C", "D", "E"]:
        add("Unit-1", f"feeder_{f.lower()}", f"Feeder1{f} Totalizer")

    add("Unit-1", "ldo_flow", "Unit-1 : LDO FLOW")
    add("Unit-1", "dm7", "Unit-1 : DM7 Water")
    add("Unit-1", "dm11", "Unit-1 : DM11 Water")
    add("Unit-1", "main_steam", "Unit-1 : Main Steam Used")
    add("Unit-1", "feed_water", "Unit-1 : Feed Water Totalizer")

    # ---------------------------------------
    # UNIT 2
    # ---------------------------------------
    for f in ["A", "B", "C", "D", "E"]:
        add("Unit-2", f"feeder_{f.lower()}", f"Feeder2{f} Totalizer")

    add("Unit-2", "ldo_flow", "Unit-2 : LDO FLOW")
    add("Unit-2", "dm7", "Unit-2 : DM7 Water")
    add("Unit-2", "dm11", "Unit-2 : DM11 Water")
    add("Unit-2", "main_steam", "Unit-2 : Main Steam Used")
    add("Unit-2", "feed_water", "Unit-2 : Feed Water Totalizer")

    # ---------------------------------------
    # STATION
    # ---------------------------------------
    add("Station", "raw_water", "Station : Raw Water Totalizer")

    # ---------------------------------------
    # ENERGY-METER (New category)
    # ---------------------------------------
    energy_meter_items = [
        ("Energy-Meter", "unit1_gen", "Unit-1 Generation"),
        ("Energy-Meter", "unit2_gen", "Unit-2 Generation"),
        ("Energy-Meter", "1lsr01_ic1", "1LSR01 I/C-1"),
        ("Energy-Meter", "1lsr02_ic1", "1LSR02 I/C-1"),
        ("Energy-Meter", "2lsr01_ic1", "2LSR01 I/C-1"),
        ("Energy-Meter", "2lsr02_ic1", "2LSR02 I/C-1"),

        ("Energy-Meter", "rlsr01", "RLSR01"),
        ("Energy-Meter", "rlsr02", "RLSR02"),
        ("Energy-Meter", "rlsr03", "RLSR03"),
        ("Energy-Meter", "rlsr04", "RLSR04"),

        ("Energy-Meter", "1lsr01_ic2_tie", "1LSR01 I/C-2 (TIE)"),
        ("Energy-Meter", "1lsr02_ic2_tie", "1LSR02 I/C-2 (TIE)"),
        ("Energy-Meter", "2lsr01_ic2_tie", "2LSR01 I/C-2 (TIE)"),
        ("Energy-Meter", "2lsr02_ic2_tie", "2LSR02 I/C-2 (TIE)"),

        ("Energy-Meter", "SST_10", "SST_10"),
        ("Energy-Meter", "UST_15", "UST_15"),
        ("Energy-Meter", "UST_25", "UST-25"),
    ]

    for unit, name, disp in energy_meter_items:
        add(unit, name, disp)

    # ---------------------------------------
    # INSERT ALL
    # ---------------------------------------
    for i, (unit, name, display) in enumerate(
        [(s["unit"], s["name"], s["display_name"]) for s in seeds],
        start=1,
    ):
        db.add(
            TotalizerMasterDB(
                id=i,
                unit=unit,
                name=name,
                display_name=display,
                sequence=i,
            )
        )

    await db.commit()
    return {"message": "Master totalizers inserted"}

# -----------------------------------------------------
# GET TOTALIZERS (for frontend display) - unchanged
# -----------------------------------------------------
@router.get("/list")
async def list_totalizers(
    unit: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    q = select(TotalizerMasterDB)
    if unit:
        q = q.where(TotalizerMasterDB.unit == unit)
    q = q.order_by(TotalizerMasterDB.sequence)

    res = await db.execute(q)
    return res.scalars().all()

# -----------------------------------------------------
# GET readings for a day (unchanged)
# -----------------------------------------------------
@router.get("/readings")
async def get_readings(date: date, db: AsyncSession = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    q = select(TotalizerReadingDB).where(TotalizerReadingDB.date == date)
    res = await db.execute(q)
    return res.scalars().all()

# -----------------------------------------------------
# 🔥 NEW: LIVE KPI CALC ENDPOINT (supports all tabs)
# -----------------------------------------------------
@router.post("/kpi/calc")
async def calc_kpi_live(payload: dict = Body(...), db: AsyncSession = Depends(get_db)):
    """
    payload:
      { date: "YYYY-MM-DD", plant_name: "Unit-1"/"Unit-2"/"Energy-Meter"/"Station", readings: [{totalizer_id, reading_value, adjust_value}, ...] }

    Returns auto_kpis computed for that plant (does NOT persist).
    """
    try:
        rpt_date = date.fromisoformat(payload["date"])
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid date")

    plant_name = payload.get("plant_name")
    readings = payload.get("readings", [])

    # Build diffs map (by master.name)
    diffs: Dict[str, float] = {}
    for item in readings:
        tid = item.get("totalizer_id")
        today_val = float(item.get("reading_value") or 0.0)
        adjust = float(item.get("adjust_value") or 0.0)

        # fetch yesterday
        y = yesterday(rpt_date)
        q = await db.execute(
            select(TotalizerReadingDB).where(
                TotalizerReadingDB.totalizer_id == tid,
                TotalizerReadingDB.date == y
            )
        )
        yrow = q.scalars().first()
        yval = float(yrow.reading_value) if yrow else 0.0

        diff = (today_val - yval) + adjust

        # map to master name
        q2 = await db.execute(select(TotalizerMasterDB).where(TotalizerMasterDB.id == tid))
        m = q2.scalars().first()
        if m:
            diffs[m.name] = diff

    # load station generation cache (if any) to help energy calc
    station_gen_cache: Dict[str, float] = {}
    try:
        q = await db.execute(select(KPIRecordDB).where(KPIRecordDB.report_date == rpt_date, KPIRecordDB.kpi_type == "energy", KPIRecordDB.plant_name == "Station"))
        rows = q.scalars().all()
        for r in rows:
            station_gen_cache[r.kpi_name] = float(r.kpi_value or 0.0)
    except Exception:
        station_gen_cache = {}

    # Decide which compute function to call
    if plant_name in ("Unit-1", "Unit-2"):
        # determine generation for this unit (try station cache first)
        gen_key = "unit1_generation" if plant_name == "Unit-1" else "unit2_generation"
        generation = float(station_gen_cache.get(gen_key, diffs.get("unit1_gen" if plant_name=="Unit-1" else "unit2_gen", 0.0) or 0.0))
        auto = compute_unit_auto_kpis(diffs, generation)
        return {"auto_kpis": auto}

    if plant_name == "Energy-Meter":
        auto = compute_energy_meter_auto_kpis(diffs, station_gen_cache)
        return {"auto_kpis": auto}

    if plant_name == "Station":
        auto = compute_station_auto_kpis(diffs, station_gen_cache)
        return {"auto_kpis": auto}

    # unknown plant
    raise HTTPException(status_code=422, detail="Unknown plant_name")
# -----------------------------------------------------
# 🔧 MODIFIED: SAVE TOTALIZER READINGS + compute & persist KPIs
# -----------------------------------------------------
@router.post("/submit")
async def submit_readings(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):

    # validate date
    try:
        reading_date = date.fromisoformat(payload["date"])
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid date")

    readings = payload.get("readings", [])
    role_id = current_user.role_id
    plant_name = payload.get("plant_name")  # frontend should pass explicit plant_name
    manual_kpis = payload.get("manual_kpis", [])  # optional list of {name,value,unit}

    if not plant_name:
        # infer from first reading if missing
        if readings:
            first_tid = readings[0].get("totalizer_id")
            q = await db.execute(select(TotalizerMasterDB).where(TotalizerMasterDB.id == first_tid))
            m = q.scalars().first()
            plant_name = m.unit if m else None

    if not plant_name:
        raise HTTPException(status_code=422, detail="plant_name required")

    # -----------------------------------------------------
    # 1) SAVE TOTALIZER READINGS & BUILD DIFFS
    # -----------------------------------------------------
    diffs: Dict[str, float] = {}

    for item in readings:
        tid = item.get("totalizer_id")
        today_val = float(item.get("reading_value") or 0.0)
        adjust = float(item.get("adjust_value") or 0.0)

        if role_id not in (7, 8):
            adjust = 0.0

        # yesterday reading
        y = yesterday(reading_date)
        q = select(TotalizerReadingDB).where(
            TotalizerReadingDB.totalizer_id == tid,
            TotalizerReadingDB.date == y
        )
        r = await db.execute(q)
        yrow = r.scalars().first()
        yvalue = float(yrow.reading_value) if yrow else 0.0

        diff = (today_val - yvalue) + adjust

        # map to master name
        q2 = await db.execute(select(TotalizerMasterDB).where(TotalizerMasterDB.id == tid))
        m = q2.scalars().first()
        if m:
            diffs[m.name] = diff

        # upsert reading
        q3 = select(TotalizerReadingDB).where(
            TotalizerReadingDB.totalizer_id == tid,
            TotalizerReadingDB.date == reading_date
        )
        ex = (await db.execute(q3)).scalars().first()
        if ex:
            ex.reading_value = today_val
            ex.adjust_value = adjust
            ex.difference_value = diff
            ex.updated_at = datetime.utcnow()
        else:
            new = TotalizerReadingDB(
                totalizer_id=tid,
                date=reading_date,
                reading_value=today_val,
                adjust_value=adjust,
                difference_value=diff
            )
            db.add(new)

    await db.commit()

    # -----------------------------------------------------
    # 2) LOAD STATION GENERATION CACHE (for energy KPIs)
    # -----------------------------------------------------
    station_gen_cache: Dict[str, float] = {}
    try:
        q = await db.execute(
            select(KPIRecordDB).where(
                KPIRecordDB.report_date == reading_date,
                KPIRecordDB.kpi_type == "energy",
                KPIRecordDB.plant_name == "station"
            )
        )
        rows = q.scalars().all()
        for r in rows:
            station_gen_cache[r.kpi_name] = float(r.kpi_value or 0.0)
    except Exception:
        station_gen_cache = {}

    # -----------------------------------------------------
    # 3) AUTO-KPI COMPUTATION BASED ON PLANT TYPE
    # -----------------------------------------------------
    computed_auto_kpis: Dict[str, float] = {}

    # ------------------------------
    # UNIT-1 & UNIT-2
    # ------------------------------
    if plant_name in ("Unit-1", "Unit-2"):

        gen_key = "unit1_generation" if plant_name == "Unit-1" else "unit2_generation"
        generation = float(station_gen_cache.get(gen_key, 0.0))
        computed_auto_kpis = compute_unit_auto_kpis(diffs, generation)

        save_kpi_type = "Unit"
        save_plant_name = plant_name

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

        for k, unit in UNIT_SAVE_LIST:
            val = computed_auto_kpis.get(k, 0.0)
            stmt = sqlite_upsert(KPIRecordDB).values(
                report_date=reading_date,
                kpi_type=save_kpi_type,
                plant_name=save_plant_name,
                kpi_name=k,
                kpi_value=val,
                unit=unit,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
                set_={
                    "kpi_value": stmt.excluded.kpi_value,
                    "unit": stmt.excluded.unit,
                    "updated_at": datetime.utcnow()
                }
            )
            await db.execute(stmt)

        await db.commit()

    # ------------------------------
    # ENERGY-METER TAB
    # ------------------------------
    elif plant_name == "Energy-Meter":

        computed_auto_kpis = compute_energy_meter_auto_kpis(diffs, station_gen_cache)

        save_kpi_type = "energy"
        save_plant_name = "station"

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
            val = computed_auto_kpis.get(k, 0.0)
            stmt = sqlite_upsert(KPIRecordDB).values(
                report_date=reading_date,
                kpi_type=save_kpi_type,
                plant_name=save_plant_name,
                kpi_name=k,
                kpi_value=val,
                unit=unit,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
                set_={
                    "kpi_value": stmt.excluded.kpi_value,
                    "unit": stmt.excluded.unit,
                    "updated_at": datetime.utcnow()
                }
            )
            await db.execute(stmt)

        await db.commit()

    # ------------------------------
    # STATION TAB
    # ------------------------------
    elif plant_name == "Station":

        computed_auto_kpis = compute_station_auto_kpis(diffs, station_gen_cache)

        save_kpi_type = "station"
        save_plant_name = "Station"

        ST_SAVE_LIST = [
            ("total_raw_water_used_m3", "m3"),
            ("avg_raw_water_m3_per_hr", "m3/hr"),
            ("sp_raw_water_l_per_kwh", "L/kWh"),
            ("total_dm_water_used_m3", "m3"),
        ]

        for k, unit in ST_SAVE_LIST:
            val = computed_auto_kpis.get(k, 0.0)
            stmt = sqlite_upsert(KPIRecordDB).values(
                report_date=reading_date,
                kpi_type=save_kpi_type,
                plant_name=save_plant_name,
                kpi_name=k,
                kpi_value=val,
                unit=unit,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            stmt = stmt.on_conflict_do_update(
                index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
                set_={
                    "kpi_value": stmt.excluded.kpi_value,
                    "unit": stmt.excluded.unit,
                    "updated_at": datetime.utcnow()
                }
            )
            await db.execute(stmt)

        await db.commit()

    # Unknown plant (should not happen)
    else:
        computed_auto_kpis = {}

    # -----------------------------------------------------
    # 4) SAVE MANUAL KPIs
    # -----------------------------------------------------
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
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["report_date", "kpi_type", "plant_name", "kpi_name"],
            set_={
                "kpi_value": stmt.excluded.kpi_value,
                "unit": stmt.excluded.unit,
                "updated_at": datetime.utcnow()
            }
        )
        await db.execute(stmt)

    await db.commit()

    # -----------------------------------------------------
    # RETURN RESPONSE
    # -----------------------------------------------------
    return {
        "message": "Saved successfully",
        "computed_auto_kpis": computed_auto_kpis
    }
# -----------------------------------------------------
# KPI READ (unchanged behaviour)
# -----------------------------------------------------
@router.get("/kpi/get")
async def get_kpi(
    date: str,
    kpi_type: str,
    plant_name: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Returns KPI records for given date, kpi_type and plant_name.
    Query params:
      - date: "YYYY-MM-DD"
      - kpi_type: e.g. "energy", "manual", "Unit", "station"
      - plant_name: e.g. "Unit-1", "Station", "station"
    """
    try:
        rpt_date = datetime.fromisoformat(date).date()
    except Exception:
        raise HTTPException(status_code=422, detail="Invalid date")

    q = await db.execute(
        select(KPIRecordDB).where(
            KPIRecordDB.report_date == rpt_date,
            KPIRecordDB.kpi_type == kpi_type,
            KPIRecordDB.plant_name == plant_name
        )
    )

    rows = q.scalars().all()

    return {
        "date": date,
        "kpi_type": kpi_type,
        "plant_name": plant_name,
        "kpis": [
            {
                "name": r.kpi_name,
                "value": r.kpi_value,
                "unit": r.unit
            }
            for r in rows
        ]
    }

# -----------------------------------------------------
# SHUTDOWN KPI (running hours / availability) endpoint
# -----------------------------------------------------
@router.get("/kpi/{unit}/{report_date}")
async def get_shutdown_kpis(
    unit: str,
    report_date: date,
    db: AsyncSession = Depends(get_db)
):
    """
    Calculate running hours / availability / planned / strategic outage hours
    for a unit within the provided report_date (date path param).
    """

    # day bounds
    start_day = datetime.combine(report_date, time.min)
    end_day = datetime.combine(report_date, time.max)

    # fetch all shutdown records for this unit (no date filter; we'll calculate overlap)
    q = await db.execute(select(ShutdownRecordDB).where(ShutdownRecordDB.unit == unit))
    records = q.scalars().all()

    total_shutdown = 0.0
    planned = 0.0
    strategic = 0.0

    def overlap(start, end):
        """return overlapping hours between [start,end] and report_date bounds"""
        if not start:
            return 0.0

        # ongoing shutdown (no end) treat as ongoing until end_day
        if not end:
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

# -----------------------------------------------------
# End of file
# -----------------------------------------------------
