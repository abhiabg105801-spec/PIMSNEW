# crud/chemical.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, time as dt_time

from models import ChemicalParamEntryDB

async def create_chemical_section_entries(db: AsyncSession, section_data):
    """
    Insert multiple parameters for the same plant/area/section.
    section_data is schema ChemicalSectionCreate
    """
    raw_time = section_data.time
    if isinstance(raw_time, dt_time):
        py_time = raw_time
    else:
        try:
            py_time = datetime.strptime(raw_time, "%H:%M:%S").time()
        except:
            py_time = datetime.strptime(raw_time, "%H:%M").time()

    saved = []
    for e in section_data.entries:
        row = ChemicalParamEntryDB(
            date=section_data.date,
            time=py_time,
            plant=str(section_data.plant).strip(),
            broad_area=str(section_data.broad_area).strip() if section_data.broad_area else None,
            main_area=str(section_data.main_area).strip() if section_data.main_area else None,
            main_collection_area=str(section_data.main_collection_area).strip() if section_data.main_collection_area else None,
            exact_collection_area=str(section_data.exact_collection_area).strip() if section_data.exact_collection_area else None,
            parameter=str(e.parameter).strip(),
            value=float(e.value) if e.value is not None else None,
            remarks=str(e.remarks).strip() if e.remarks else None,
        )
        db.add(row)
        saved.append(row)

    await db.commit()
    for r in saved:
        await db.refresh(r)
    return saved

async def get_chemical_entries_by_date(db: AsyncSession, target_date):
    if isinstance(target_date, str):
        target_date = datetime.strptime(target_date, "%Y-%m-%d").date()

    stmt = select(ChemicalParamEntryDB).where(ChemicalParamEntryDB.date == target_date).order_by(ChemicalParamEntryDB.time.asc())
    rows = (await db.execute(stmt)).scalars().all()
    return rows

async def get_raw_chemical_entries(db: AsyncSession, date, plant, exact_area, parameter):
    if isinstance(date, str):
        date = datetime.strptime(date, "%Y-%m-%d").date()
    q = (
        select(ChemicalParamEntryDB.time, ChemicalParamEntryDB.value, ChemicalParamEntryDB.remarks)
        .where(ChemicalParamEntryDB.date == date)
        .where(ChemicalParamEntryDB.plant == plant)
        .where(ChemicalParamEntryDB.exact_collection_area == exact_area)
        .where(ChemicalParamEntryDB.parameter == parameter)
        .order_by(ChemicalParamEntryDB.time.asc())
    )
    rows = (await db.execute(q)).all()
    return [{"time": str(t), "value": float(v) if v is not None else None, "remarks": r} for (t, v, r) in rows]
