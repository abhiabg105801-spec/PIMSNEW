from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from datetime import datetime
from .dm_models import DMEntryDB

# =======================================================
# AUTO SAMPLE NUMBER GENERATOR (MODULE + YYYYMM + SEQ)
# =======================================================
async def generate_sample_no(db: AsyncSession, module: str, date_obj):
    """
    Format:
      <MOD>-YYYYMM-0001
    Example:
      PROX-202502-0007
    """
    ym = date_obj.strftime("%Y%m")
    prefix = module[:4].upper()

    stmt = (
        select(DMEntryDB.sample_no)
        .where(DMEntryDB.module == module)
        .where(DMEntryDB.sample_no.like(f"{prefix}-{ym}-%"))
        .order_by(DMEntryDB.sample_no.desc())
        .limit(1)
    )

    last = (await db.execute(stmt)).scalar_one_or_none()

    if last:
        last_num = int(last.split("-")[-1])
        new_num = last_num + 1
    else:
        new_num = 1

    return f"{prefix}-{ym}-{new_num:04d}"


# =======================================================
# CREATE ENTRIES (CREATE + UPDATE REUSE)
# =======================================================
async def dm_create_entries(db: AsyncSession, payload: dict):
    date_obj = payload["date"]
    raw_time = payload["time"]

    # parse time safely
    try:
        py_time = datetime.strptime(raw_time, "%H:%M:%S").time()
    except:
        py_time = datetime.strptime(raw_time, "%H:%M").time()

    # generate sample_no if not provided
    sample_no = payload.get("sample_no")
    if not sample_no:
        sample_no = await generate_sample_no(db, payload["module"], date_obj)

    rows = []

    for entry in payload["entries"]:
        row = DMEntryDB(
            sample_no=sample_no,
            date=date_obj,
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

    await db.commit()
    for r in rows:
        await db.refresh(r)

    return rows


# =======================================================
# DAILY STATISTICS (MODULE SAFE)
# =======================================================
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

    return [
        {
            "module": r[0],
            "category": r[1],
            "parameter": r[2],
            "avg": float(r[3]) if r[3] is not None else None,
            "min": float(r[4]) if r[4] is not None else None,
            "max": float(r[5]) if r[5] is not None else None,
            "count": int(r[6]),
        }
        for r in rows
    ]


# =======================================================
# RAW DATA TABLE (PER ENTRY, INCLUDES sample_no)
# =======================================================
async def dm_get_raw_by_date(db: AsyncSession, date_obj, module=None):
    stmt = select(DMEntryDB).where(DMEntryDB.date == date_obj)

    if module:
        stmt = stmt.where(DMEntryDB.module == module)

    stmt = stmt.order_by(
        DMEntryDB.sample_no.asc(),
        DMEntryDB.parameter.asc()
    )

    return (await db.execute(stmt)).scalars().all()


# =======================================================
# LOAD FULL SAMPLE (EDIT MODE)
# =======================================================
async def dm_get_by_sample(db: AsyncSession, sample_no: str):
    stmt = select(DMEntryDB).where(DMEntryDB.sample_no == sample_no)
    return (await db.execute(stmt)).scalars().all()


# =======================================================
# UPDATE SAMPLE (DELETE + INSERT SAME sample_no)
# =======================================================
async def dm_update_entries(db: AsyncSession, payload: dict):
    sample_no = payload["sample_no"]

    # delete existing rows
    await db.execute(
        delete(DMEntryDB).where(DMEntryDB.sample_no == sample_no)
    )
    await db.commit()

    # reinsert with SAME sample_no
    return await dm_create_entries(db, payload)


# =======================================================
# DELETE SAMPLE GROUP
# =======================================================
async def dm_delete_by_sample(db: AsyncSession, sample_no: str):
    await db.execute(
        delete(DMEntryDB).where(DMEntryDB.sample_no == sample_no)
    )
    await db.commit()
    return True


async def dm_get_raw_by_range(db, start_date, end_date, module=None):
    stmt = select(DMEntryDB).where(
        DMEntryDB.date.between(start_date, end_date)
    )
    if module:
        stmt = stmt.where(DMEntryDB.module == module)

    stmt = stmt.order_by(DMEntryDB.date, DMEntryDB.sample_no)
    return (await db.execute(stmt)).scalars().all()
