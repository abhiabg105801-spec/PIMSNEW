from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from io import BytesIO

from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import cm

from database import get_db
from routers.dpr_router import dpr_page1  # IMPORT YOUR JSON API

router = APIRouter(prefix="/api/dpr", tags=["DPR-PDF"])


# ======================================================
# PDF EXPORT – PAGE 1
# ======================================================

@router.get("/page1/pdf")
async def dpr_page1_pdf(
    date_: date = Query(..., alias="date"),
    db: AsyncSession = Depends(get_db),
):
    # ---------- FETCH DPR DATA ----------
    data = await dpr_page1(date_=date_, db=db)

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.2 * cm,
        leftMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )

    styles = getSampleStyleSheet()
    story = []

    # ---------- TITLE ----------
    story.append(
        Paragraph(
            "<b>2×125 MW CPP – PLANT PERFORMANCE REPORT</b>",
            ParagraphStyle(
                "title",
                fontSize=14,
                alignment=1,
                textColor=colors.HexColor("#ea580c"),
                spaceAfter=6,
            ),
        )
    )

    story.append(
        Paragraph(
            f"<b>Date:</b> {date_.strftime('%d-%m-%Y')}",
            ParagraphStyle(
                "sub",
                fontSize=10,
                alignment=1,
                textColor=colors.grey,
            ),
        )
    )

    story.append(Spacer(1, 10))

    # ---------- TABLE HEADER ----------
    header = [
        "Key Plant Parameters",
        "U1-D", "U1-M", "U1-Y",
        "U2-D", "U2-M", "U2-Y",
        "ST-D", "ST-M", "ST-Y",
    ]

    table_data = [header]

    KPI_ORDER = [
        ("Generation in MU", "generation"),
        ("PLF (%)", "plf_percent"),
        ("Running Hour", "running_hour"),
        ("Plant Availability (%)", "plant_availability_percent"),
        ("Planned Outage (Hr)", "planned_outage_hour"),
        ("Strategic Outage (Hr)", "strategic_outage_hour"),
        ("Coal Consumption (T)", "coal_consumption"),
        ("Specific Coal (kg/kWh)", "specific_coal"),
        ("Average GCV (kcal/kg)", "gcv"),
        ("Heat Rate (kcal/kWh)", "heat_rate"),
        ("LDO / HSD Consumption (KL)", "oil_consumption"),
        ("Specific Oil (ml/kWh)", "specific_oil"),
        ("Aux Power (MU)", "aux_power"),
        ("Aux Power (%)", "aux_power_percent"),
        ("Steam Generation (T)", "steam_generation"),
        ("Specific Steam (T/MWh)", "specific_steam"),
        ("DM Water (Cu.M)", "dm_water"),
        ("Specific DM Water (%)", "specific_dm_percent"),
    ]

    # ---------- DATA ROWS ----------
    for label, kpi in KPI_ORDER:
        row = [label]
        for unit in ["Unit-1", "Unit-2", "Station"]:
            for p in ["day", "month", "year"]:
                val = data.get(unit, {}).get(kpi, {}).get(p)
                row.append(f"{val:.2f}" if isinstance(val, (int, float)) else "—")
        table_data.append(row)

    # ---------- TABLE ----------
    table = Table(
        table_data,
        colWidths=[
            5.2 * cm,
            1.2 * cm, 1.2 * cm, 1.2 * cm,
            1.2 * cm, 1.2 * cm, 1.2 * cm,
            1.2 * cm, 1.2 * cm, 1.2 * cm,
        ],
        repeatRows=1,
    )

    table.setStyle(TableStyle([
        # Grid
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),

        # Header
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ea580c")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONT", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("ALIGN", (1, 0), (-1, 0), "CENTER"),

        # KPI label column
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#f3f4f6")),
        ("ALIGN", (0, 1), (0, -1), "LEFT"),
        ("FONT", (0, 1), (0, -1), "Helvetica-Bold"),

        # Values
        ("ALIGN", (1, 1), (-1, -1), "CENTER"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),

        # Alternate rows
        ("ROWBACKGROUNDS", (0, 1), (-1, -1),
         [colors.white, colors.HexColor("#f9fafb")]),
    ]))

    story.append(table)

    doc.build(story)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                f"attachment; filename=DPR_Page1_{date_}.pdf"
        },
    )
