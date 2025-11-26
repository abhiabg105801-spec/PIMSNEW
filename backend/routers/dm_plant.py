# routers/dm_plant.py

from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import Response
from starlette.concurrency import run_in_threadpool

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from datetime import datetime

from database import get_db
from auth import get_current_user, require_role

from schemas.dm_plant import (
    DMEntryCreate,
    DMEntry,
    DMSectionCreate,
)
from crud.dm_plant import (
    create_dm_entry,
    create_dm_section_entries,
    get_entries_by_date,
)
from utils.dm_stats import calculate_stats
from models import UserDB, DMPlantEntryDB

# ReportLab imports
import io
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

router = APIRouter(prefix="/api/dm-plant", tags=["DM Plant"])


# ================================================================
# ADD ENTRY
# ================================================================
@router.post("/add", response_model=DMEntry)
async def add_dm_entry(
    entry: DMEntryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(require_role([5, 8]))
):
    return await create_dm_entry(db, entry)


@router.post("/add-section")
async def add_dm_section(
    payload: DMSectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(require_role([5, 8]))
):
    if len(payload.entries) == 0:
        raise HTTPException(status_code=400, detail="No entries provided.")

    saved = await create_dm_section_entries(db, payload)

    return {
        "status": "success",
        "saved_count": len(saved),
        "unit": payload.unit,
        "section": payload.section
    }


# ================================================================
# DAILY SUMMARY REPORT
# ================================================================
@router.get("/report")
async def get_dm_report(
    date: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    try:
        parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format. Use YYYY-MM-DD")

    entries = await get_entries_by_date(db, parsed_date)
    stats = calculate_stats(entries)

    clean_stats = {}
    for (unit, section, parameter), values in stats.items():
        clean_stats[f"{unit} | {section} | {parameter}"] = values

    return {
        "date": parsed_date.isoformat(),
        "total_entries": len(entries),
        "stats": clean_stats,
    }


# ================================================================
# RAW VALUES ENDPOINT
# ================================================================
@router.get("/raw")
async def get_raw_dm_values(
    date: str,
    unit: str,
    section: str,
    parameter: str,
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    parsed_date = datetime.strptime(date, "%Y-%m-%d").date()

    stmt = (
        select(
            DMPlantEntryDB.time,
            DMPlantEntryDB.value,
            DMPlantEntryDB.remarks
        )
        .where(
            DMPlantEntryDB.date == parsed_date,
            DMPlantEntryDB.unit == unit,
            DMPlantEntryDB.section == section,
            DMPlantEntryDB.parameter == parameter
        )
        .order_by(DMPlantEntryDB.time.asc())
    )

    rows = (await db.execute(stmt)).all()

    return [
        {"time": str(t), "value": v, "remarks": r}
        for (t, v, r) in rows
    ]


# ================================================================
# PDF GENERATOR (ReportLab)
# ================================================================
def build_pdf(date_str: str, entries):
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = []

    # Title
    story.append(Paragraph("<b>DM Plant Daily Report</b>", styles["Title"]))
    story.append(Paragraph(f"Date: {date_str}", styles["Normal"]))
    story.append(Spacer(1, 12))

    # Summaries
    stats = calculate_stats(entries)

    table_data = [["Unit", "Section", "Parameter", "Avg", "Min", "Max", "Count"]]

    for (unit, section, parameter), s in sorted(stats.items()):
        table_data.append([
            unit, section, parameter,
            s.get("avg"), s.get("min"), s.get("max"), s.get("count")
        ])

    summary_table = Table(table_data, repeatRows=1)
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (3, 1), (-1, -1), "RIGHT"),
    ]))

    story.append(summary_table)
    story.append(Spacer(1, 20))

    # Raw values section
    story.append(Paragraph("<b>Raw Values</b>", styles["Heading2"]))
    story.append(Spacer(1, 10))

    # Group raw values
    raw_map = {}
    for e in entries:
        key = (e.unit, e.section, e.parameter)
        raw_map.setdefault(key, []).append((e.time, e.value, e.remarks))

    for (unit, section, parameter), rows in sorted(raw_map.items()):
        story.append(Paragraph(f"<b>{unit} — {section} — {parameter}</b>", styles["Heading3"]))

        raw_table_data = [["Time", "Value", "Remarks"]]
        for (t, v, r) in sorted(rows):
            raw_table_data.append([str(t), str(v), r or "-"])

        raw_table = Table(raw_table_data, repeatRows=1)
        raw_table.setStyle(TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
            ("BACKGROUND", (0, 0), (-1, 0), colors.whitesmoke),
        ]))

        story.append(raw_table)
        story.append(Spacer(1, 15))

    doc.build(story)
    return buffer.getvalue()


@router.get("/report/pdf")
async def generate_pdf(
    date: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    try:
        parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(400, "Invalid date format")

    entries = await get_entries_by_date(db, parsed_date)

    pdf_bytes = await run_in_threadpool(build_pdf, date, entries)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="dm-plant-{date}.pdf"'
        }
    )
