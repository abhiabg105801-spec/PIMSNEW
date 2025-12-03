from fastapi import APIRouter, Depends, HTTPException, Query,Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, insert, func
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert
from datetime import date, timedelta, datetime
from typing import List, Optional

from database import get_db
from models import UserDB
from auth import get_current_user
from models import TotalizerMasterDB, TotalizerReadingDB,KPIRecordDB




router = APIRouter()

# -----------------------------------------------------
# UTIL
# -----------------------------------------------------
def yesterday(d: date):
    return d - timedelta(days=1)

# -----------------------------------------------------
# SEED MASTER TOTALIZERS (Run once)
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
# GET TOTALIZERS (for frontend display)
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
# GET readings for a day (used to load yesterday)
# -----------------------------------------------------
@router.get("/readings")
async def get_readings(date: date, db: AsyncSession = Depends(get_db), current_user: UserDB = Depends(get_current_user)):
    q = select(TotalizerReadingDB).where(TotalizerReadingDB.date == date)
    res = await db.execute(q)
    return res.scalars().all()

# -----------------------------------------------------
# SAVE TOTALIZER READINGS
# -----------------------------------------------------
@router.post("/submit")
async def submit_readings(
    payload: dict,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):

    reading_date = date.fromisoformat(payload["date"])
    readings = payload["readings"]
    role_id = current_user.role_id

    output = []

    for item in readings:
        tid = item["totalizer_id"]
        today_val = float(item["reading_value"])
        adjust = float(item.get("adjust_value",0))

        # only admin/HOD can adjust (role 7 or 8)
        if role_id not in (7,8):
            adjust = 0

        # get yesterday value
        y = yesterday(reading_date)
        q = select(TotalizerReadingDB).where(
            TotalizerReadingDB.totalizer_id == tid,
            TotalizerReadingDB.date == y
        )
        r = await db.execute(q)
        yrow = r.scalars().first()
        yvalue = yrow.reading_value if yrow else 0

        diff = (today_val - yvalue) + adjust

        # upsert
        q2 = select(TotalizerReadingDB).where(
            TotalizerReadingDB.totalizer_id == tid,
            TotalizerReadingDB.date == reading_date
        )
        ex = (await db.execute(q2)).scalars().first()

        if ex:
            ex.reading_value = today_val
            ex.adjust_value = adjust
            ex.difference_value = diff
            await db.commit()
            output.append(ex)
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
            await db.refresh(new)
            output.append(new)

    return output

# -----------------------------------------------------
# KPI CALCULATION
# -----------------------------------------------------
@router.post("/kpi/store", dependencies=[Depends(get_current_user)])
async def store_kpis(
    payload: dict = Body(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Universal scalable KPI store.
    Example payload:
    {
      "date": "2025-12-02",
      "kpi_type": "energy",
      "plant_name": "Station",
      "kpis": [
        { "name": "unit1_aux_mwh", "value": 33.55, "unit": "MWh" }
      ]
    }
    """

    # Required fields
    if not payload.get("date") or not payload.get("kpi_type") or not payload.get("plant_name"):
        raise HTTPException(status_code=422, detail="date, kpi_type, plant_name are required")

    # Parse date
    try:
        rpt_date = datetime.fromisoformat(payload["date"]).date()
    except:
        raise HTTPException(status_code=422, detail="Invalid date format")

    kpi_type = payload["kpi_type"]
    plant_name = payload["plant_name"]
    kpis = payload.get("kpis", [])

    try:
        # UPSERT each KPI
        for k in kpis:
            stmt = sqlite_upsert(KPIRecordDB).values(
                report_date=rpt_date,
                kpi_type=kpi_type,
                plant_name=plant_name,
                kpi_name=k["name"],
                kpi_value=k["value"],
                unit=k.get("unit")
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
        return {"message": "KPI stored successfully", "count": len(kpis)}

    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    

@router.get("/kpi/get")
async def get_kpi(
    date: str,
    kpi_type: str,
    plant_name: str,
    db: AsyncSession = Depends(get_db)
):
    try:
        rpt_date = datetime.fromisoformat(date).date()
    except:
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
