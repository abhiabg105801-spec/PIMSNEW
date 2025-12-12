from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime
from .dm_models import DMEntryDB

async def dm_create_entries(db: AsyncSession, payload: dict):
    raw_time = payload["time"]

    try:
        py_time = datetime.strptime(raw_time, "%H:%M:%S").time()
    except:
        py_time = datetime.strptime(raw_time, "%H:%M").time()

    rows = []

    for entry in payload["entries"]:
        row = DMEntryDB(
            date=payload["date"],
            time=py_time,
            module=payload["module"],
            category=payload.get("category"),

            plant=payload.get("plant"),
            broad_area=payload.get("broad_area"),
            main_area=payload.get("main_area"),
            main_collection_area=payload.get("main_collection_area"),
            exact_collection_area=payload.get("exact_collection_area"),
            location=payload.get("location"),

            parameter=entry["parameter"],
            value=entry["value"],
            remarks=entry.get("remarks"),
        )

        db.add(row)
        rows.append(row)

    await db.commit()

    for r in rows:
        await db.refresh(r)

    return rows


async def dm_get_stats(db: AsyncSession, date_obj, module=None):
    stmt = (
        select(
            DMEntryDB.module,
            DMEntryDB.category,
            DMEntryDB.parameter,
            func.avg(DMEntryDB.value),
            func.min(DMEntryDB.value),
            func.max(DMEntryDB.value),
            func.count(DMEntryDB.value),
        )
        .where(DMEntryDB.date == date_obj)
        .group_by(
            DMEntryDB.module,
            DMEntryDB.category,
            DMEntryDB.parameter
        )
    )

    if module:
        stmt = stmt.where(DMEntryDB.module == module)

    rows = (await db.execute(stmt)).all()
    return rows
async def dm_create_entries(db: AsyncSession, payload: dict):
    raw_time = payload["time"]
    try:
        py_time = datetime.strptime(raw_time, "%H:%M:%S").time()
    except:
        py_time = datetime.strptime(raw_time, "%H:%M").time()

    rows = []
    for entry in payload["entries"]:
        row = DMEntryDB(
            date=payload["date"],
            time=py_time,
            module=payload["module"],
            category=payload.get("category"),

            plant=payload.get("plant"),
            broad_area=payload.get("broad_area"),
            main_area=payload.get("main_area"),
            main_collection_area=payload.get("main_collection_area"),
            exact_collection_area=payload.get("exact_collection_area"),
            location=payload.get("location"),

            parameter=entry["parameter"],
            value=entry.get("value"),
            remarks=entry.get("remarks"),
        )
        db.add(row)
        rows.append(row)

    if rows:
        await db.commit()
        for r in rows:
            await db.refresh(r)
    return rows


async def dm_get_stats(db: AsyncSession, date_obj, module=None):
    if isinstance(date_obj, str):
        date_obj = datetime.strptime(date_obj, "%Y-%m-%d").date()

    stmt = (
        select(
            DMEntryDB.module,
            DMEntryDB.category,
            DMEntryDB.parameter,
            func.avg(DMEntryDB.value).label("avg"),
            func.min(DMEntryDB.value).label("min"),
            func.max(DMEntryDB.value).label("max"),
            func.count(DMEntryDB.value).label("count"),
        )
        .where(DMEntryDB.date == date_obj)
        .group_by(DMEntryDB.module, DMEntryDB.category, DMEntryDB.parameter)
    )

    if module:
        stmt = stmt.where(DMEntryDB.module == module)

    res = (await db.execute(stmt)).all()
    out = []
    for (mod, cat, param, avg, mn, mx, cnt) in res:
        out.append({
            "module": mod,
            "category": cat,
            "parameter": param,
            "avg": float(avg) if avg is not None else None,
            "min": float(mn) if mn is not None else None,
            "max": float(mx) if mx is not None else None,
            "count": int(cnt),
        })
    return out


async def dm_get_entries_by_date(db: AsyncSession, date_obj, module: str = None):
    """Return all entries for a date (optionally for a module)."""
    if isinstance(date_obj, str):
        date_obj = datetime.strptime(date_obj, "%Y-%m-%d").date()

    stmt = select(DMEntryDB).where(DMEntryDB.date == date_obj)
    if module:
        stmt = stmt.where(DMEntryDB.module == module)

    stmt = stmt.order_by(DMEntryDB.time.asc())
    res = (await db.execute(stmt)).scalars().all()
    return res