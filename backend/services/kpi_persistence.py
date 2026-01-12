from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.dialects.sqlite import insert as sqlite_upsert
from sqlalchemy import select

from models import KPIRecordDB


async def upsert_kpi(
    db: AsyncSession,
    reading_date,
    kpi_type: str,
    plant: str,
    name: str,
    value,
    unit: str,
):
    if value is None:
        return

    stmt = sqlite_upsert(KPIRecordDB).values(
        report_date=reading_date,
        kpi_type=kpi_type,
        plant_name=plant,
        kpi_name=name,
        kpi_value=float(value),
        unit=unit,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    ).on_conflict_do_update(
        index_elements=[
            "report_date",
            "kpi_type",
            "plant_name",
            "kpi_name",
        ],
        set_={
            "kpi_value": float(value),
            "unit": unit,
            "updated_at": datetime.now(timezone.utc),
        },
    )

    await db.execute(stmt)
