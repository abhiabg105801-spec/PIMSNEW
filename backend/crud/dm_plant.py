# cUud/dm_plant.py

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, time as dt_time

from models import DMPlantEntryDB


# -------------------------------------------------------------
#  SINGLE ENTRY INSERT
# -------------------------------------------------------------
async def create_dm_entry(db: AsyncSession, entry):
    """
    Create and save a single DM plant entry.
    Ensures string sanitization to avoid weird values.
    """

    unit = str(entry.unit).strip()
    section = str(entry.section).strip()
    parameter = str(entry.parameter).strip()
    remarks = str(entry.remarks).strip() if entry.remarks else None

    # If time is string, convert
    raw_time = entry.time
    if isinstance(raw_time, dt_time):
        py_time = raw_time
    else:
        # Accept HH:MM or HH:MM:SS
        try:
            py_time = datetime.strptime(raw_time, "%H:%M:%S").time()
        except:
            py_time = datetime.strptime(raw_time, "%H:%M").time()

    db_obj = DMPlantEntryDB(
        date=entry.date,
        time=py_time,
        unit=unit,
        section=section,
        parameter=parameter,
        value=float(entry.value),
        remarks=remarks,
    )

    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj


# -------------------------------------------------------------
#  BULK SECTION INSERT (POST /dm-plant/add-section)
# -------------------------------------------------------------
async def create_dm_section_entries(db: AsyncSession, section_data):
    """
    Inserts multiple parameters belonging to the same unit + section.
    Ensures Time is always converted into Python datetime.time
    """

    # Convert time to Python time object
    raw_time = section_data.time
    if isinstance(raw_time, dt_time):
        py_time = raw_time
    else:
        try:
            py_time = datetime.strptime(raw_time, "%H:%M:%S").time()
        except:
            py_time = datetime.strptime(raw_time, "%H:%M").time()

    saved_rows = []

    for item in section_data.entries:
        new_row = DMPlantEntryDB(
            date=section_data.date,
            time=py_time,
            unit=str(section_data.unit).strip(),
            section=str(section_data.section).strip(),
            parameter=str(item.parameter).strip(),
            value=float(item.value),
            remarks=str(item.remarks).strip() if item.remarks else None,
        )

        db.add(new_row)
        saved_rows.append(new_row)

    await db.commit()

    # refresh after commit
    for row in saved_rows:
        await db.refresh(row)

    return saved_rows


# -------------------------------------------------------------
#  FETCH ENTRIES FOR A DATE
# -------------------------------------------------------------
async def get_entries_by_date(db: AsyncSession, target_date):
    """
    Returns all DM entries for a specific date.
    Dates stored in DB are DATE (not datetime), so match only by DATE.
    """

    # Ensure date is date obj
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, "%Y-%m-%d").date()

    stmt = (
        select(DMPlantEntryDB)
        .where(DMPlantEntryDB.date == target_date)
        .order_by(DMPlantEntryDB.time.asc())
    )

    result = await db.execute(stmt)
    return result.scalars().all()

async def get_raw_entries(db: AsyncSession, date, unit, section, parameter):
    """Return all raw entries for given filters."""
    q = (
        select(
            DMPlantEntryDB.time,
            DMPlantEntryDB.value,
            DMPlantEntryDB.remarks
        )
        .where(DMPlantEntryDB.date == date)
        .where(DMPlantEntryDB.unit == unit)
        .where(DMPlantEntryDB.section == section)
        .where(DMPlantEntryDB.parameter == parameter)
        .order_by(DMPlantEntryDB.time.asc())
    )

    rows = (await db.execute(q)).all()

    # Convert to serializable dicts
    return [
        {
            "time": str(r.time),
            "value": float(r.value) if r.value is not None else None,
            "remarks": r.remarks or ""
        }
        for r in rows
    ]
