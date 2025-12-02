from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, insert, func
from datetime import date, timedelta, datetime
from typing import List, Optional

from database import get_db
from models import UserDB
from auth import get_current_user
from models import TotalizerMasterDB, TotalizerReadingDB




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
    """Insert master totalizers once (Unit-1, Unit-2, Station)."""

    # Already inserted?
    q = await db.execute(select(TotalizerMasterDB))
    if q.scalars().first():
        return {"message": "Totalizers already exist"}

    seeds = []
    def add(unit, name, display):
        seeds.append(dict(unit=unit, name=name, display_name=display))

    # UNIT 1
    for f in ["A","B","C","D","E"]:
        add("Unit-1", f"feeder_{f.lower()}", f"Unit-1 : Feeder{f} Totalizer")
    add("Unit-1","ldo_flow","Unit-1 : LDO FLOW")
    add("Unit-1","dm7","Unit-1 : DM7 Water")
    add("Unit-1","dm11","Unit-1 : DM11 Water")
    add("Unit-1","main_steam","Unit-1 : Main Steam Used")
    add("Unit-1","feed_water","Unit-1 : Feed Water Totalizer")

    # UNIT 2 (same)
    for f in ["A","B","C","D","E"]:
        add("Unit-2", f"feeder_{f.lower()}", f"Unit-2 : Feeder{f} Totalizer")
    add("Unit-2","ldo_flow","Unit-2 : LDO FLOW")
    add("Unit-2","dm7","Unit-2 : DM7 Water")
    add("Unit-2","dm11","Unit-2 : DM11 Water")
    add("Unit-2","main_steam","Unit-2 : Main Steam Used")
    add("Unit-2","feed_water","Unit-2 : Feed Water Totalizer")

    # STATION
    add("Station","raw_water","Station : Raw Water Totalizer")

    for i,(unit,name,display) in enumerate([(s['unit'],s['name'],s['display_name']) for s in seeds],start=1):
        db.add(TotalizerMasterDB(id=i,unit=unit,name=name,display_name=display,sequence=i))

    await db.commit()
    return {"message":"Master totalizers inserted"}

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
@router.get("/kpi")
async def get_kpi(
    date: date,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user),
):

    # join reading + master
    stmt = select(TotalizerReadingDB, TotalizerMasterDB).join(
        TotalizerMasterDB, TotalizerReadingDB.totalizer_id == TotalizerMasterDB.id
    ).where(TotalizerReadingDB.date == date)

    rows = (await db.execute(stmt)).all()

    coal = 0; ldo = 0; dm = 0; steam = 0; feed = 0

    for reading, master in rows:
        n = master.name
        v = reading.difference_value

        if "feeder_" in n:
            coal += v

        if n == "ldo_flow":
            ldo += v

        if n in ("dm7","dm11"):
            dm += v

        if n == "main_steam":
            steam += v

        if n == "feed_water":
            feed += v

    return {
        "date": date,
        "coal": coal,
        "ldo": ldo,
        "dm": dm,
        "steam": steam,
        "feed_water": feed
    }
