from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from datetime import datetime, date, time
from io import BytesIO

from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

from database import get_db
from models import KPIRecordDB, ShutdownRecordDB

router = APIRouter(prefix="/api/dpr", tags=["DPR"])


# ================= KPI CLASSIFICATION =================

SUM_KPIS = {
    "generation",
    "coal_consumption",
    "ldo_consumption",
    "aux_power",
    "steam_generation",
    "dm_water",
}

AVG_KPIS = {
    "plf_percent",
    "plant_availability_percent",
    "specific_coal",
    "specific_oil",
    "specific_steam",
    "aux_power_percent",
    "specific_dm_percent",
    "heat_rate",
    "gcv",
    "stack_emission",
}

SHUTDOWN_KPIS = {
    "running_hour",
    "plant_availability_percent",
    "planned_outage_hour",
    "planned_outage_percent",
    "strategic_outage_hour",
}

ALL_KPIS = [
    "generation",
    "plf_percent",
    "running_hour",
    "plant_availability_percent",
    "planned_outage_hour",
    "planned_outage_percent",
    "strategic_outage_hour",
    "coal_consumption",
    "specific_coal",
    "gcv",
    "heat_rate",
    "ldo_consumption",
    "specific_oil",
    "aux_power",
    "aux_power_percent",
    "stack_emission",
    "steam_generation",
    "specific_steam",
    "dm_water",
    "specific_dm_percent",
]


# ================= DATE HELPERS =================

def fy_start(d: date) -> date:
    return date(d.year if d.month >= 4 else d.year - 1, 4, 1)


def month_start(d: date) -> date:
    return d.replace(day=1)


# ================= KPI AGGREGATION =================

async def aggregate_kpi(db: AsyncSession, unit: str, kpi: str, start_date: date, end_date: date):
    q = select(
        func.sum(KPIRecordDB.kpi_value).label("sum"),
        func.avg(KPIRecordDB.kpi_value).label("avg"),
    ).where(
        KPIRecordDB.plant_name == unit,
        KPIRecordDB.kpi_name == kpi,
        KPIRecordDB.report_date.between(start_date, end_date),
    )

    r = (await db.execute(q)).first()
    if not r:
        return None

    return r.avg if kpi in AVG_KPIS else r.sum


# ================= SHUTDOWN KPI COMPUTATION =================

async def compute_shutdown_kpis(
    db: AsyncSession,
    unit: str,
    start_date: date,
    end_date: date,
):
    start_dt = datetime.combine(start_date, time.min)
    end_dt = datetime.combine(end_date, time.max)

    q = select(ShutdownRecordDB).where(
        ShutdownRecordDB.unit == unit,
        ShutdownRecordDB.datetime_from <= end_dt,
        func.coalesce(ShutdownRecordDB.datetime_to, end_dt) >= start_dt,
    )

    rows = (await db.execute(q)).scalars().all()

    total_shutdown = 0.0
    planned = 0.0
    strategic = 0.0

    for r in rows:
        s = max(r.datetime_from, start_dt)
        e = min(r.datetime_to or end_dt, end_dt)
        hrs = max(0.0, (e - s).total_seconds() / 3600.0)

        total_shutdown += hrs

        if r.shutdown_type == "Planned Outage":
            planned += hrs
        elif r.shutdown_type == "Strategic Outage":
            strategic += hrs

    running = max(0.0, 24.0 - total_shutdown)

    return {
        "running_hour": running,
        "plant_availability_percent": (running / 24.0) * 100.0,
        "planned_outage_hour": planned,
        "planned_outage_percent": (planned / 24.0) * 100.0,
        "strategic_outage_hour": strategic,
    }


# ================= DPR JSON API =================

@router.get("/page1")
async def dpr_page1(
    date_: date = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db),
):
    ranges = {
        "day": (date_, date_),
        "month": (month_start(date_), date_),
        "year": (fy_start(date_), date_),
    }

    result = {}
    units = ["Unit-1", "Unit-2"]

    # -------- UNIT DATA --------
    for unit in units:
        result[unit] = {}

        for kpi in ALL_KPIS:
            result[unit][kpi] = {}

            for period, (s, e) in ranges.items():
                if kpi in SHUTDOWN_KPIS:
                    shutdown_vals = await compute_shutdown_kpis(db, unit, s, e)
                    result[unit][kpi][period] = shutdown_vals.get(kpi)
                else:
                    result[unit][kpi][period] = await aggregate_kpi(db, unit, kpi, s, e)

    # -------- STATION AGGREGATION --------
    result["Station"] = {}

    for kpi in ALL_KPIS:
        result["Station"][kpi] = {}

        for period in ["day", "month", "year"]:
            values = [
                result["Unit-1"][kpi][period],
                result["Unit-2"][kpi][period],
            ]
            values = [v for v in values if v is not None]

            if not values:
                result["Station"][kpi][period] = None
            elif kpi in AVG_KPIS or kpi in SHUTDOWN_KPIS:
                result["Station"][kpi][period] = sum(values) / len(values)
            else:
                result["Station"][kpi][period] = sum(values)

    return result


# ================= DPR PDF API =================

@router.get("/page1/pdf")
async def dpr_page1_pdf(
    date_: date = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db),
):
    data = await dpr_page1(date_=date_, db=db)

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    story.append(
        Paragraph(
            "<b>2×125 MW CPP – PLANT PERFORMANCE REPORT</b>",
            styles["Title"],
        )
    )
    story.append(
        Paragraph(f"Date : {date_.strftime('%d-%m-%Y')}", styles["Normal"])
    )

    header = [
        "Parameter",
        "U1-D", "U1-M", "U1-Y",
        "U2-D", "U2-M", "U2-Y",
        "ST-D", "ST-M", "ST-Y",
    ]

    table_data = [header]

    for kpi in ALL_KPIS:
        row = [kpi.replace("_", " ").title()]
        for unit in ["Unit-1", "Unit-2", "Station"]:
            for p in ["day", "month", "year"]:
                v = data[unit][kpi][p]
                row.append(f"{v:.3f}" if isinstance(v, (int, float)) else "—")
        table_data.append(row)

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("GRID", (0,0), (-1,-1), 0.5, colors.black),
        ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
        ("ALIGN", (1,1), (-1,-1), "RIGHT"),
        ("FONT", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 8),
    ]))

    story.append(table)
    doc.build(story)

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=DPR_Page1_{date_}.pdf"
        },
    )
