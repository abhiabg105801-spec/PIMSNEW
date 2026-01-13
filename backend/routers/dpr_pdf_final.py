# backend/routers/dpr_pdf_final_fixed.py
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date, datetime
from typing import Dict, Any, Optional
import os
import logging
import traceback
import tempfile

# Check if reportlab is installed
try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False
    print("=" * 60)
    print("⚠️  WARNING: ReportLab is not installed!")
    print("   Install it with: pip install reportlab --break-system-packages")
    print("=" * 60)

from database import get_db
from auth import get_current_user
from models import UserDB

# Setup logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/dpr")


def parse_iso_date(s: str) -> date:
    """Parse ISO date string"""
    try:
        return date.fromisoformat(s)
    except Exception:
        try:
            return datetime.fromisoformat(s).date()
        except Exception:
            raise HTTPException(status_code=422, detail="Invalid date format")


async def fetch_kpi_data_from_preview(db: AsyncSession, report_date: date) -> Dict[str, Any]:
    """
    Fetch KPI data by calling the SAME logic as /dpr/kpi/preview endpoint.
    This ensures the PDF shows exactly the same data as the web page.
    """
    
    logger.info(f"📊 Fetching KPI data using preview endpoint logic for: {report_date}")
    
    # Import the preview endpoint logic
    try:
        from routers.dpr_backend import dpr_kpi_preview
        
        # Call the preview endpoint directly (simulating the API call)
        # We can't use the actual endpoint, so we'll import its core function
        # or replicate the logic here
        
        # For now, let's make an internal API call
        import httpx
        
        # This is a workaround - ideally we'd refactor to share the logic
        # For production, you should extract the KPI calculation logic into a shared function
        
        logger.warning("⚠️  Using API call to fetch KPI data. Consider refactoring to share logic.")
        
        # Instead, let's import and use the actual calculation
        # We need to import from dpr_backend
        from routers import dpr_backend
        
        # Create a fake Query parameter object
        class FakeQuery:
            def __init__(self, date_val):
                self.date = date_val
        
        # This won't work directly, so let's fetch data differently...
        # The best solution is to replicate the exact logic from /dpr/kpi/preview
        
    except Exception as e:
        logger.error(f"Could not import dpr_backend: {e}")
    
    # FALLBACK: Replicate the /dpr/kpi/preview logic here
    # This is copied from your dpr_backend.py
    
    from sqlalchemy import select, func
    from models import KPIRecordDB, TotalizerReadingDB, ShutdownRecordDB
    from routers.totalizers import TOTALIZER_MASTER
    from datetime import timedelta
    from services.kpi_calculations import (
        compute_unit_auto_kpis,
        compute_energy_meter_auto_kpis,
        compute_station_auto_kpis,
    )
    
    # Helper functions
    def fy_start(d: date):
        return date(d.year if d.month >= 4 else d.year - 1, 4, 1)
    
    def month_start(d: date):
        return d.replace(day=1)
    
    async def compute_shutdown_kpis(db, unit, start_date, end_date):
        from datetime import time
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)
        
        total_days = (end_date - start_date).days + 1
        total_hours = total_days * 24.0

        rows = (
            await db.execute(
                select(ShutdownRecordDB).where(
                    ShutdownRecordDB.unit == unit,
                    ShutdownRecordDB.datetime_from <= end_dt,
                    func.coalesce(ShutdownRecordDB.datetime_to, end_dt) >= start_dt,
                )
            )
        ).scalars().all()

        planned = 0.0
        strategic = 0.0
        total_shutdown = 0.0

        for r in rows:
            shutdown_start = max(r.datetime_from, start_dt)
            shutdown_end = min(r.datetime_to or end_dt, end_dt)
            
            hrs = (shutdown_end - shutdown_start).total_seconds() / 3600.0
            
            if hrs > 0:
                total_shutdown += hrs
                
                if r.shutdown_type == "Planned Outage":
                    planned += hrs
                elif r.shutdown_type == "Strategic Outage":
                    strategic += hrs

        running = max(0.0, total_hours - total_shutdown)

        return {
            "running_hour": round(running, 2),
            "plant_availability_percent": round((running / total_hours) * 100, 2),
            "planned_outage_hour": round(planned, 2),
            "planned_outage_percent": round((planned / total_hours) * 100, 2),
            "strategic_outage_hour": round(strategic, 2),
        }
    
    async def calculate_single_day(db: AsyncSession, d: date) -> Dict[str, Dict[str, float]]:
        diffs_by_unit = {
            "Unit-1": {},
            "Unit-2": {},
            "Station": {},
            "Energy-Meter": {},
        }

        today = (
            await db.execute(
                select(TotalizerReadingDB).where(TotalizerReadingDB.date == d)
            )
        ).scalars().all()

        yesterday = d - timedelta(days=1)
        y_map = {
            r.totalizer_id: float(r.reading_value or 0)
            for r in (
                await db.execute(
                    select(TotalizerReadingDB).where(TotalizerReadingDB.date == yesterday)
                )
            ).scalars().all()
        }

        for r in today:
            meta = TOTALIZER_MASTER.get(r.totalizer_id)
            if not meta:
                continue

            name, unit = meta
            diff = (
                float(r.reading_value or 0)
                - y_map.get(r.totalizer_id, 0)
                + float(r.adjust_value or 0)
            )
            diffs_by_unit[unit][name] = diff

        for _, (name, unit) in TOTALIZER_MASTER.items():
            diffs_by_unit[unit].setdefault(name, 0.0)

        energy = compute_energy_meter_auto_kpis(diffs_by_unit["Energy-Meter"], {})
        u1_gen = energy.get("unit1_generation", 0.0)
        u2_gen = energy.get("unit2_generation", 0.0)

        unit1 = compute_unit_auto_kpis(diffs_by_unit["Unit-1"], u1_gen)
        unit2 = compute_unit_auto_kpis(diffs_by_unit["Unit-2"], u2_gen)
        station_water = compute_station_auto_kpis(
            diffs_by_unit["Station"],
            {"unit1_generation": u1_gen, "unit2_generation": u2_gen},
        )

        unit1["generation"] = u1_gen / 1000.0
        unit1["plf_percent"] = energy.get("unit1_plf_percent", 0.0)
        unit1["aux_power"] = energy.get("unit1_aux_consumption_mwh", 0.0) / 1000.0
        unit1["aux_power_percent"] = energy.get("unit1_aux_percent", 0.0)

        unit2["generation"] = u2_gen / 1000.0
        unit2["plf_percent"] = energy.get("unit2_plf_percent", 0.0)
        unit2["aux_power"] = energy.get("unit2_aux_consumption_mwh", 0.0) / 1000.0
        unit2["aux_power_percent"] = energy.get("unit2_aux_percent", 0.0)

        unit1_shutdown = await compute_shutdown_kpis(db, "Unit-1", d, d)
        unit2_shutdown = await compute_shutdown_kpis(db, "Unit-2", d, d)
        
        unit1.update(unit1_shutdown)
        unit2.update(unit2_shutdown)

        station = {}
        station["generation"] = unit1["generation"] + unit2["generation"]
        station["coal_consumption"] = unit1["coal_consumption"] + unit2["coal_consumption"]
        station["oil_consumption"] = unit1["oil_consumption"] + unit2["oil_consumption"]
        station["aux_power"] = unit1["aux_power"] + unit2["aux_power"]
        station["steam_generation"] = unit1["steam_generation"] + unit2["steam_generation"]
        station["dm_water"] = unit1["dm_water"] + unit2["dm_water"]
        
        total_gen = station["generation"]
        
        if total_gen > 0:
            station["specific_coal"] = (
                (unit1["specific_coal"] * unit1["generation"] + 
                 unit2["specific_coal"] * unit2["generation"]) / total_gen
            )
            station["specific_oil"] = (
                (unit1["specific_oil"] * unit1["generation"] + 
                 unit2["specific_oil"] * unit2["generation"]) / total_gen
            )
            station["specific_steam"] = (
                (unit1["specific_steam"] * unit1["generation"] + 
                 unit2["specific_steam"] * unit2["generation"]) / total_gen
            )
            station["aux_power_percent"] = (
                (unit1["aux_power_percent"] * unit1["generation"] + 
                 unit2["aux_power_percent"] * unit2["generation"]) / total_gen
            )
        else:
            station["specific_coal"] = 0.0
            station["specific_oil"] = 0.0
            station["specific_steam"] = 0.0
            station["aux_power_percent"] = 0.0
        
        total_steam = station["steam_generation"]
        if total_steam > 0:
            station["specific_dm_percent"] = (
                (unit1["specific_dm_percent"] * unit1["steam_generation"] + 
                 unit2["specific_dm_percent"] * unit2["steam_generation"]) / total_steam
            )
        else:
            station["specific_dm_percent"] = 0.0
        
        station["plf_percent"] = (station["generation"] / 6.0) * 100.0 if station["generation"] > 0 else 0.0
        
        station["running_hour"] = unit1["running_hour"] + unit2["running_hour"]
        station["planned_outage_hour"] = unit1["planned_outage_hour"] + unit2["planned_outage_hour"]
        station["strategic_outage_hour"] = unit1["strategic_outage_hour"] + unit2["strategic_outage_hour"]
        
        station["plant_availability_percent"] = (
            (unit1["plant_availability_percent"] + unit2["plant_availability_percent"]) / 2.0
        )
        station["planned_outage_percent"] = (
            (unit1["planned_outage_percent"] + unit2["planned_outage_percent"]) / 2.0
        )
        
        station["gcv"] = None
        station["heat_rate"] = None
        station["stack_emission"] = None
        
        unit1["gcv"] = None
        unit1["heat_rate"] = None
        unit1["stack_emission"] = None
        
        unit2["gcv"] = None
        unit2["heat_rate"] = None
        unit2["stack_emission"] = None

        return {
            "Unit-1": unit1,
            "Unit-2": unit2,
            "Station": station,
        }
    
    # Now calculate for day/month/year
    SUM_KPIS = {
        "generation", "coal_consumption", "oil_consumption", "aux_power",
        "steam_generation", "dm_water", "running_hour", "planned_outage_hour",
        "strategic_outage_hour"
    }
    
    AVG_KPIS = {
        "plf_percent", "plant_availability_percent", "aux_power_percent",
        "heat_rate", "gcv", "stack_emission", "planned_outage_percent"
    }
    
    SPECIFIC_KPIS = {
        "specific_coal", "specific_oil", "specific_steam", "specific_dm_percent"
    }
    
    ALL_KPIS = [
        "generation", "plf_percent", "running_hour", "plant_availability_percent",
        "planned_outage_hour", "planned_outage_percent", "strategic_outage_hour",
        "coal_consumption", "specific_coal", "gcv", "heat_rate",
        "oil_consumption", "specific_oil", "aux_power", "aux_power_percent",
        "stack_emission", "steam_generation", "specific_steam",
        "dm_water", "specific_dm_percent"
    ]
    
    ranges = {
        "day": (report_date, report_date),
        "month": (month_start(report_date), report_date),
        "year": (fy_start(report_date), report_date),
    }
    
    result = {u: {k: {} for k in ALL_KPIS} for u in ["Unit-1", "Unit-2", "Station"]}
    
    for period, (start, end) in ranges.items():
        logger.info(f"  Calculating {period}: {start} to {end}")
        daily_values = []

        cur = start
        while cur <= end:
            daily_values.append(await calculate_single_day(db, cur))
            cur += timedelta(days=1)

        for unit in ["Unit-1", "Unit-2", "Station"]:
            for kpi in ALL_KPIS:
                vals = [d[unit].get(kpi) for d in daily_values if d[unit].get(kpi) is not None]

                if not vals:
                    result[unit][kpi][period] = None
                elif kpi in AVG_KPIS or kpi in SPECIFIC_KPIS:
                    result[unit][kpi][period] = sum(vals) / len(vals)
                else:
                    result[unit][kpi][period] = sum(vals)
    
    logger.info("✅ KPI data calculation complete")
    return result


def format_value(value: Optional[float], decimals: int = 2) -> str:
    """Format numeric value or return dash for None"""
    if value is None or (isinstance(value, float) and value != value):
        return "—"
    try:
        return f"{float(value):.{decimals}f}"
    except (ValueError, TypeError):
        return "—"


def create_dpr_pdf(
    report_date: date,
    kpi_data: Dict[str, Any],
    remarks: str = ""
) -> str:
    """Generate DPR PDF report. Returns path to the generated PDF file."""
    
    if not REPORTLAB_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="ReportLab is not installed. Install with: pip install reportlab --break-system-packages"
        )
    
    logger.info(f"🔨 Creating PDF for date: {report_date}")
    
    temp_dir = tempfile.gettempdir()
    temp_filename = os.path.join(temp_dir, f"DPR_Report_{report_date.isoformat()}.pdf")
    
    os.makedirs(temp_dir, exist_ok=True)
    
    try:
        doc = SimpleDocTemplate(
            temp_filename,
            pagesize=landscape(A4),
            rightMargin=10*mm,
            leftMargin=10*mm,
            topMargin=15*mm,
            bottomMargin=15*mm
        )
        
        elements = []
        styles = getSampleStyleSheet()
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=14,
            textColor=colors.HexColor('#1f2937'),
            alignment=TA_CENTER,
            spaceAfter=3*mm,
            fontName='Helvetica-Bold'
        )
        
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#374151'),
            alignment=TA_CENTER,
            spaceAfter=2*mm,
            fontName='Helvetica-Bold'
        )
        
        date_style = ParagraphStyle(
            'DateStyle',
            parent=styles['Normal'],
            fontSize=9,
            textColor=colors.HexColor('#6b7280'),
            alignment=TA_CENTER,
            spaceAfter=5*mm,
            fontName='Helvetica'
        )
        
        elements.append(Paragraph(
            "2×125 MW CPP, JSL STAINLESS LTD, KNIC, JAJPUR, ODISHA",
            title_style
        ))
        elements.append(Paragraph(
            "DAILY PLANT PERFORMANCE REPORT",
            subtitle_style
        ))
        elements.append(Paragraph(
            f"Report Date: {report_date.strftime('%d %B, %Y')}",
            date_style
        ))
        
        kpi_rows = [
            ("Generation (MU)", "generation", 3),
            ("PLF (%)", "plf_percent", 2),
            ("Running Hour (Hr)", "running_hour", 2),
            ("Plant Availability (%)", "plant_availability_percent", 2),
            ("Planned Outage (Hr)", "planned_outage_hour", 2),
            ("Planned Outage (%)", "planned_outage_percent", 2),
            ("Strategic Outage (Hr)", "strategic_outage_hour", 2),
            ("Coal Consumption (T)", "coal_consumption", 3),
            ("Specific Coal (kg/kWh)", "specific_coal", 3),
            ("Average GCV (kcal/kg)", "gcv", 2),
            ("Heat Rate (kcal/kWh)", "heat_rate", 2),
            ("LDO / HSD Consumption (KL)", "oil_consumption", 3),
            ("Specific Oil (ml/kWh)", "specific_oil", 3),
            ("Aux Power Consumption (MU)", "aux_power", 3),
            ("Aux Power (%)", "aux_power_percent", 2),
            ("Steam Generation (T)", "steam_generation", 3),
            ("Specific Steam (T/MWh)", "specific_steam", 3),
            ("DM Water Consumption (Cu.M)", "dm_water", 3),
            ("Specific DM Water (%)", "specific_dm_percent", 2),
        ]
        
        table_data = [
            ["Key Plant Parameters", "UNIT-1", "", "", "UNIT-2", "", "", "STATION", "", ""],
            ["", "Day", "Month", "Year", "Day", "Month", "Year", "Day", "Month", "Year"]
        ]
        
        for label, kpi_name, decimals in kpi_rows:
            row = [label]
            for period in ["day", "month", "year"]:
                row.append(format_value(kpi_data.get("Unit-1", {}).get(kpi_name, {}).get(period), decimals))
            for period in ["day", "month", "year"]:
                row.append(format_value(kpi_data.get("Unit-2", {}).get(kpi_name, {}).get(period), decimals))
            for period in ["day", "month", "year"]:
                row.append(format_value(kpi_data.get("Station", {}).get(kpi_name, {}).get(period), decimals))
            table_data.append(row)
        
        col_widths = [60*mm] + [18*mm] * 9
        table = Table(table_data, colWidths=col_widths, repeatRows=2)
        
        table.setStyle(TableStyle([
            ('SPAN', (0, 0), (0, 1)),
            ('SPAN', (1, 0), (3, 0)),
            ('SPAN', (4, 0), (6, 0)),
            ('SPAN', (7, 0), (9, 0)),
            ('BACKGROUND', (0, 0), (0, 1), colors.HexColor('#374151')),
            ('BACKGROUND', (1, 0), (9, 0), colors.HexColor('#4b5563')),
            ('BACKGROUND', (1, 1), (9, 1), colors.HexColor('#6b7280')),
            ('TEXTCOLOR', (0, 0), (9, 1), colors.whitesmoke),
            ('FONTNAME', (0, 0), (9, 1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (9, 1), 8),
            ('ALIGN', (0, 0), (0, 1), 'LEFT'),
            ('ALIGN', (1, 0), (9, 1), 'CENTER'),
            ('VALIGN', (0, 0), (9, 1), 'MIDDLE'),
            ('BACKGROUND', (7, 0), (9, 0), colors.HexColor('#ea580c')),
            ('BACKGROUND', (7, 1), (9, 1), colors.HexColor('#f97316')),
            ('BACKGROUND', (0, 2), (0, -1), colors.HexColor('#f9fafb')),
            ('FONTNAME', (0, 2), (0, -1), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 2), (-1, -1), 7),
            ('ALIGN', (1, 2), (-1, -1), 'CENTER'),
            ('ALIGN', (0, 2), (0, -1), 'LEFT'),
            ('BACKGROUND', (7, 2), (9, -1), colors.HexColor('#fef3c7')),
            *[('BACKGROUND', (1, i), (6, i), colors.HexColor('#f9fafb'))
              for i in range(2, len(table_data), 2)],
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#d1d5db')),
            ('LINEABOVE', (0, 0), (-1, 0), 1, colors.HexColor('#374151')),
            ('LINEBELOW', (0, 1), (-1, 1), 1, colors.HexColor('#6b7280')),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ]))
        
        elements.append(table)
        elements.append(Spacer(1, 5*mm))
        
        remarks_style = ParagraphStyle(
            'RemarksTitle',
            parent=styles['Heading2'],
            fontSize=10,
            textColor=colors.HexColor('#374151'),
            alignment=TA_LEFT,
            spaceAfter=2*mm,
            fontName='Helvetica-Bold'
        )
        
        remarks_text_style = ParagraphStyle(
            'RemarksText',
            parent=styles['Normal'],
            fontSize=8,
            textColor=colors.HexColor('#4b5563'),
            alignment=TA_LEFT,
            fontName='Helvetica'
        )
        
        elements.append(Paragraph("Remarks:", remarks_style))
        elements.append(Paragraph(remarks or "No remarks recorded.", remarks_text_style))
        elements.append(Spacer(1, 3*mm))
        
        footer_style = ParagraphStyle(
            'Footer',
            parent=styles['Normal'],
            fontSize=7,
            textColor=colors.HexColor('#9ca3af'),
            alignment=TA_CENTER,
            fontName='Helvetica'
        )
        
        elements.append(Paragraph(
            f"Generated on: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')} | JSLO/MIS/CPP-OP/01",
            footer_style
        ))
        
        doc.build(elements)
        
        if not os.path.exists(temp_filename):
            raise Exception(f"PDF file was not created: {temp_filename}")
        
        file_size = os.path.getsize(temp_filename)
        logger.info(f"✅ PDF created: {temp_filename} ({file_size} bytes)")
        
        return temp_filename
        
    except Exception as e:
        logger.error(f"❌ PDF creation error: {str(e)}")
        logger.error(traceback.format_exc())
        raise


@router.get("/pdf/download")
async def download_dpr_pdf(
    date: str = Query(..., description="Report date in YYYY-MM-DD format"),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    """Download DPR report as PDF - uses SAME calculation as /dpr/kpi/preview"""
    try:
        logger.info("=" * 60)
        logger.info(f"📄 PDF download request for date: {date}")
        
        if not REPORTLAB_AVAILABLE:
            raise HTTPException(
                status_code=500,
                detail="ReportLab not installed. Run: pip install reportlab --break-system-packages"
            )
        
        report_date = parse_iso_date(date)
        logger.info(f"✓ Parsed date: {report_date}")
        
        # Fetch KPI data using the SAME logic as preview endpoint
        logger.info("📊 Calculating KPIs (same as /dpr/kpi/preview)...")
        kpi_data = await fetch_kpi_data_from_preview(db, report_date)
        logger.info("✓ KPI calculation complete")
        
        # Generate PDF
        pdf_path = create_dpr_pdf(report_date, kpi_data, "")
        
        logger.info("=" * 60)
        
        return FileResponse(
            path=pdf_path,
            filename=f"DPR_Report_{report_date.isoformat()}.pdf",
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=DPR_Report_{report_date.isoformat()}.pdf"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("=" * 60)
        logger.error(f"❌ PDF generation failed: {str(e)}")
        logger.error(traceback.format_exc())
        logger.error("=" * 60)
        raise HTTPException(
            status_code=500,
            detail=f"PDF generation failed: {str(e)}"
        )