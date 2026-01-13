from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert
from sqlalchemy import select

from models import KPIRecordDB


# services/kpi_persistence.py

from datetime import datetime, timezone

async def upsert_kpi(
    db: AsyncSession,
    reading_date,
    kpi_type: str,
    plant: str,
    name: str,
    value: float,
    unit: str = None,
    username: str = None,
):
    """Upsert KPI with username and timestamp"""
    q = await db.execute(
        select(KPIRecordDB).where(
            KPIRecordDB.report_date == reading_date,
            KPIRecordDB.kpi_type == kpi_type,
            KPIRecordDB.plant_name == plant,
            KPIRecordDB.kpi_name == name,
        )
    )
    existing = q.scalar_one_or_none()

    if existing:
        existing.kpi_value = value
        if unit:
            existing.unit = unit
        existing.updated_at = datetime.now(timezone.utc)
        if username:
            existing.username = username
    else:
        db.add(
            KPIRecordDB(
                report_date=reading_date,
                kpi_type=kpi_type,
                plant_name=plant,
                kpi_name=name,
                kpi_value=value,
                unit=unit,
                username=username,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
        )