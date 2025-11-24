from fastapi import FastAPI, HTTPException, Depends, Body, Form, UploadFile, File,Query, Request

from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, date, timedelta, time
from typing import List, Optional # For response models & Optional fields
import io
import os
import pandas as pd
from reportlab.lib.pagesizes import A4, landscape # Use landscape for wide table
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer,Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

# SQLAlchemy specific imports
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func # Core functions
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.exc import IntegrityError

# Pydantic import needed
from pydantic import BaseModel

# ✅ --- Define Logo Path ---
# This gets the absolute path to the directory where this Python script is running
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# This assumes "jindal-header.png" is in the SAME folder as this Python script
LOGO_PATH = os.path.join(BASE_DIR, "jsl-logo-guide.png")


from models import (
    UnitReportDB,
    StationReportDB,
    MonthlyAggregateDB,
    YearlyAggregateDB,
    StationMonthlyAggregateDB,
    StationYearlyAggregateDB,
    ShutdownRecordDB,
)

from pathlib import Path
import shutil # Keep this import

# Local imports
from database import get_db, create_tables # Import session management and table creation
import models # Import ALL models from models.py
from auth import verify_user

# Define app first
app = FastAPI(title="PIMS System Backend - PostgreSQL")

@app.get("/")
def read_root():
    return {"message": "FastAPI is running successfully on LAN!"}

# --- Event Handlers (Optional: Create tables on startup) ---
# Uncomment to create tables when the server starts
@app.on_event("startup")
async def on_startup():
    print("Creating database tables...")
    await create_tables()
    print("Database tables created.")



# -------------------- MIDDLEWARE --------------------


origins = [
    "http://localhost:4940",        # React local dev
    "http://localhost:5173",        # Vite local dev
    "http://143.143.1.5:4940",
    "https://143.143.1.5:443",     # React on LAN
    "https://localhost:443",     # Vite on LAN
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- UTILS / DEPENDENCIES ---
# Date parsing handled by Pydantic validator in models.py
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Serve the uploads folder at /uploads
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# -------------------- UNIT REPORT ROUTES --------------------
@app.post("/api/reports/", dependencies=[Depends(verify_user)], status_code=201)
async def add_or_update_report(
    report: models.UnitReport,  # Pydantic model
    db: AsyncSession = Depends(get_db)
):
    """
    Handles CREATE or UPDATE of Unit Daily Reports.
    Update rules:
      - If modifying originally filled fields → password required
      - If only filling previously NULL fields → NO password required
    """

    # Convert date
    report_datetime = datetime.combine(report.report_date, datetime.min.time())
    edit_password = report.edit_password

    # Query existing record
    stmt = select(models.UnitReportDB).where(
        models.UnitReportDB.unit == report.unit,
        models.UnitReportDB.report_date == report_datetime
    )
    result = await db.execute(stmt)
    existing_report = result.scalar_one_or_none()

    # Prepare fields for DB (remove password & unset values)
    report_dict = report.dict(
        exclude_unset=True,
        exclude_none=True,
        exclude={"edit_password"}
    )
    report_dict["report_date"] = report_datetime  # enforce correct date

    # -------------------------------------------------------------
    # CASE 1: NEW REPORT (no record exists)
    # -------------------------------------------------------------
    if existing_report is None:
        new_report = models.UnitReportDB(**report_dict)
        db.add(new_report)

        try:
            await db.commit()
            await db.refresh(new_report)

            # Update aggregates (your existing logic)
            pydantic_report = models.UnitReport.from_orm(new_report)
            await update_aggregates(pydantic_report, db)

            return {"message": "Report added successfully"}

        except IntegrityError:
            await db.rollback()
            raise HTTPException(status_code=400, detail="Report for this unit/date already exists.")
        except Exception as e:
            await db.rollback()
            print("Error creating report:", e)
            raise HTTPException(status_code=500, detail="Could not save report.")

    # -------------------------------------------------------------
    # CASE 2: UPDATE EXISTING REPORT
    # -------------------------------------------------------------

    changed_fields = []
    only_new_fields_added = True  # becomes False if modifying originally-filled values

    # Compare new values with DB values
    for field, new_value in report_dict.items():
        if field in ["unit", "report_date"]:
            continue

        old_value = getattr(existing_report, field, None)

        if new_value != old_value:
            changed_fields.append(field)

            # If DB had old_value (not NULL/empty) → password required
            if old_value not in [None, "", 0]:
                only_new_fields_added = False

    # --- Password Rules ---
    # NO password needed when:
    #   ✓ record exists
    #   ✓ but all changes are NEW fields that were previously NULL
    #
    # Password IS required when:
    #   ✓ any originally-filled DB fields were modified
    if not only_new_fields_added:
        if edit_password != "EDIT@123":
            raise HTTPException(
                status_code=403,
                detail="Edit password required or incorrect."
            )

    # If no field changed
    if len(changed_fields) == 0:
        pydantic_report = models.UnitReport.from_orm(existing_report)
        await update_aggregates(pydantic_report, db)
        return {"message": "No values changed. Aggregates refreshed."}

    # Build update dict (exclude unit & report_date)
    update_payload = {
        k: v for k, v in report_dict.items()
        if k not in ["unit", "report_date"]
    }

    stmt = update(models.UnitReportDB).where(
        models.UnitReportDB.id == existing_report.id
    ).values(**update_payload)

    await db.execute(stmt)
    await db.commit()

    updated = await db.get(models.UnitReportDB, existing_report.id)

    if updated:
        pydantic_report = models.UnitReport.from_orm(updated)
        await update_aggregates(pydantic_report, db)

    return {"message": "Report updated successfully"}

@app.get("/api/reports/single/{unit}/{report_date}", response_model=models.UnitReport, dependencies=[Depends(verify_user)])
async def get_single_report(unit: str, report_date: date, db: AsyncSession = Depends(get_db)):
    report_datetime = datetime.combine(report_date, datetime.min.time())
    stmt = select(models.UnitReportDB).where(
        models.UnitReportDB.unit == unit,
        models.UnitReportDB.report_date == report_datetime
    )
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="No record found for this date/unit.")
    return report


"""///////////////////////////////////////////////////////////////////////////////////////////////////////////"""


@app.get("/api/reports/range", dependencies=[Depends(verify_user)])
async def get_reports_by_range(
    start_date: str = Query(..., description="Start date in YYYY-MM-DD"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD"),
    units: str = Query(..., description="Comma-separated list of units"),
    kpis: str = Query(..., description="Comma-separated list of KPIs"),
    db: AsyncSession = Depends(get_db)
):
    # --- 1️⃣ Validate Dates ---
    try:
        start_dt = datetime.combine(date.fromisoformat(start_date.strip()), datetime.min.time())
        end_dt = datetime.combine(date.fromisoformat(end_date.strip()), datetime.max.time())
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD.")

    # --- 2️⃣ Parse Units ---
    unit_list = [u.strip() for u in units.split(',') if u.strip()]
    if not unit_list:
        raise HTTPException(status_code=400, detail="Invalid 'units' format. Must be comma-separated.")

    # --- 3️⃣ Parse KPIs ---
    kpi_list = [k.strip() for k in kpis.split(',') if k.strip()]
    valid_columns = [col.name for col in UnitReportDB.__table__.columns]
    
    # Always include 'unit' and 'report_date'
    selected_columns = [UnitReportDB.unit, UnitReportDB.report_date]

    # Add only valid KPI columns
    for k in kpi_list:
        if k in valid_columns and k not in ("id", "edit_password"):
            selected_columns.append(getattr(UnitReportDB, k))
        else:
            print(f"⚠️ Ignoring invalid or restricted KPI: {k}")

    # --- 4️⃣ Build Query ---
    stmt = (
        select(*selected_columns)
        .where(
            UnitReportDB.unit.in_(unit_list),
            UnitReportDB.report_date.between(start_dt, end_dt)
        )
        .order_by(UnitReportDB.report_date)
    )

    # --- 5️⃣ Execute Query ---
    result = await db.execute(stmt)
    rows = result.all()

    # --- 6️⃣ Format JSON Response ---
    data = []
    for row in rows:
        record = dict(zip([col.key for col in selected_columns], row))
        # Convert datetime → date if needed
        if isinstance(record["report_date"], datetime):
            record["report_date"] = record["report_date"].date().isoformat()
        data.append(record)

    return data



@app.get("/api/reports/{report_date}", response_model=List[models.UnitReport], dependencies=[Depends(verify_user)])
async def get_reports_by_date(report_date: date, db: AsyncSession = Depends(get_db)):
    report_dt_start = datetime.combine(report_date, datetime.min.time())
    report_dt_end = report_dt_start + timedelta(days=1)
    stmt = select(models.UnitReportDB).where(
        models.UnitReportDB.report_date >= report_dt_start,
        models.UnitReportDB.report_date < report_dt_end
    ).order_by(models.UnitReportDB.unit)
    result = await db.execute(stmt)
    reports = result.scalars().all()
    if not reports:
        return []
    return reports


# -------------------- STATION REPORT ROUTES --------------------

@app.get("/api/reports/station/{report_date}", response_model=models.StationReport, dependencies=[Depends(verify_user)])
async def get_station_report(report_date: date, db: AsyncSession = Depends(get_db)):
    report_datetime = datetime.combine(report_date, datetime.min.time())
    stmt = select(models.StationReportDB).where(
        models.StationReportDB.report_date == report_datetime
    )
    result = await db.execute(stmt)
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="No station record found for this date.")
    return report

@app.post("/api/reports/station/", dependencies=[Depends(verify_user)], status_code=201)
async def add_or_update_station_report(
    report: models.StationReport,
    db: AsyncSession = Depends(get_db)
):
    report_datetime = datetime.combine(report.report_date, datetime.min.time())
    report_dict_for_db = report.dict(exclude_unset=True, exclude_none=True, exclude={'report_date'})
    report_dict_for_db['report_date'] = report_datetime
    
    # ✅ CHANGED: Use SQLite insert
    insert_stmt = insert(models.StationReportDB).values(**report_dict_for_db)

    update_dict = {
        col.name: getattr(insert_stmt.excluded, col.name)
        for col in models.StationReportDB.__table__.columns
        if not col.primary_key and not col.unique
    }
    
    # ✅ CHANGED: Use SQLite-compatible upsert
    upsert_stmt = insert_stmt.on_conflict_do_update(
        index_elements=['report_date'], # The column with the unique constraint
        set_=update_dict
    )

    try:
        await db.execute(upsert_stmt)
        await db.commit()
        await update_station_aggregates(report, db)
        return {"message": "Station report added or updated successfully"}
    except Exception as e:
        await db.rollback()
        print(f"Error upserting station report: {e}")
        raise HTTPException(status_code=500, detail="Could not save station report.")

# -------------------- SHUTDOWN LOG ROUTES (NEW) --------------------

@app.post("/api/shutdowns/", response_model=models.ShutdownRecord, status_code=201, dependencies=[Depends(verify_user)])
async def create_shutdown_record(
    unit: str = Form(...),
    datetime_from: datetime = Form(...),
    
    # Accept as string to handle empty "" from form
    datetime_to: Optional[str] = Form(None), 
    duration: Optional[str] = Form(None),
    
    reason: Optional[str] = Form(None),
    responsible_agency: Optional[str] = Form(None),
    notification_no: Optional[str] = Form(None),
    rca_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    # --- Parse optional string fields ---
    parsed_datetime_to: Optional[datetime] = None
    if datetime_to: # Checks if the string is not None and not empty ""
        try:
            parsed_datetime_to = datetime.fromisoformat(datetime_to)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid format for 'To (Date & Time)'.")

    # If duration is an empty string "", this will correctly set it to None
    parsed_duration: Optional[str] = duration if duration else None
    # --- End parsing ---

    file_path_in_db = None
    original_filename = None

    if rca_file:
        if not rca_file.filename:
            raise HTTPException(status_code=400, detail="Uploaded file is missing a filename.")
        original_filename = rca_file.filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_basename = "".join(c if c.isalnum() or c in ['.', '-'] else '_' for c in Path(original_filename).stem)
        safe_suffix = Path(original_filename).suffix
        unique_filename = f"{timestamp}_{safe_basename}{safe_suffix}"
        
        # Ensure UPLOAD_DIR exists
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        destination_path = UPLOAD_DIR / unique_filename
        file_path_in_db = unique_filename
        #file_path_in_db = str(destination_path.relative_to('.'))  Use relative path
        
        try:
            with destination_path.open("wb") as buffer:
                shutil.copyfileobj(rca_file.file, buffer)
        except Exception as e:
            print(f"Error saving file: {e}")
            raise HTTPException(status_code=500, detail=f"Could not save uploaded file: {original_filename}")
        finally:
            await rca_file.close()

    # --- MODIFIED: Use new fields for DB object ---
    db_record = models.ShutdownRecordDB(
        unit=unit,
        datetime_from=datetime_from,
        datetime_to=parsed_datetime_to, # Use parsed value
        duration=parsed_duration,       # Use parsed value
        reason=reason, 
        responsible_agency=responsible_agency,
        notification_no=notification_no, 
        rca_file_path=file_path_in_db
    )
    # --- END MODIFICATION ---

    db.add(db_record)
    try:
        await db.commit()
        await db.refresh(db_record)
        return db_record
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Duplicate shutdown entry detected.")
    except Exception as e:
        await db.rollback()
        print(f"Error saving shutdown record: {e}")
        raise HTTPException(status_code=500, detail="Could not save shutdown record to database.")


@app.get("/api/shutdowns/", response_model=List[models.ShutdownRecord], dependencies=[Depends(verify_user)])
async def get_shutdown_records(
    # Use Query for GET requests
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    unit: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    # --- MODIFIED: Query and filter by datetime_from ---
    query = select(models.ShutdownRecordDB).order_by(models.ShutdownRecordDB.datetime_from.desc())
    
    if start_date:
        # Combine date with min time to get start of the day
        start_datetime = datetime.combine(start_date, time.min)
        query = query.where(models.ShutdownRecordDB.datetime_from >= start_datetime)
        
    if end_date:
        # Combine date with max time to get end of the day
        end_datetime = datetime.combine(end_date, time.max)
        query = query.where(models.ShutdownRecordDB.datetime_from <= end_datetime)
        
    if unit:
        query = query.where(models.ShutdownRecordDB.unit == unit)
    # --- END MODIFICATION ---

    result = await db.execute(query)
    records = result.scalars().all()
    
    if not records:
        # Return 404 to match frontend expectation
        raise HTTPException(status_code=404, detail="No shutdown records found.")
        
    return records


@app.put("/api/shutdowns/{shutdown_id}", response_model=models.ShutdownRecord, dependencies=[Depends(verify_user)])
async def update_shutdown_record(
    shutdown_id: int, # <-- This comes from the URL
    unit: str = Form(...),
    datetime_from: datetime = Form(...),
    
    # Accept as string to handle empty "" from form
    datetime_to: Optional[str] = Form(None), 
    duration: Optional[str] = Form(None),
    
    reason: Optional[str] = Form(None),
    responsible_agency: Optional[str] = Form(None),
    notification_no: Optional[str] = Form(None),
    rca_file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db)
):
    
    # --- 1. Fetch the existing record ---
    result = await db.execute(select(models.ShutdownRecordDB).where(models.ShutdownRecordDB.id == shutdown_id))
    db_record = result.scalars().first()
    
    if not db_record:
        raise HTTPException(status_code=404, detail="Shutdown record not found")

    # --- 2. Parse optional string fields (same as POST) ---
    parsed_datetime_to: Optional[datetime] = None
    if datetime_to: # Checks if the string is not None and not empty ""
        try:
            parsed_datetime_to = datetime.fromisoformat(datetime_to)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid format for 'To (Date & Time)'.")
    
    parsed_duration: Optional[str] = duration if duration else None

    # --- 3. Handle new file upload ---
    ffile_path_in_db = unique_filename # Keep the old path by default
    
    if rca_file:
        if not rca_file.filename:
            raise HTTPException(status_code=400, detail="Uploaded file is missing a filename.")
        
        original_filename = rca_file.filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_basename = "".join(c if c.isalnum() or c in ['.', '-'] else '_' for c in Path(original_filename).stem)
        safe_suffix = Path(original_filename).suffix
        unique_filename = f"{timestamp}_{safe_basename}{safe_suffix}"
        
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True) # Ensure dir exists
        destination_path = UPLOAD_DIR / unique_filename
        file_path_in_db = str(destination_path.relative_to('.')) # Get new path
        
        try:
            with destination_path.open("wb") as buffer:
                shutil.copyfileobj(rca_file.file, buffer)
            
            # (Optional: Delete the old file if it exists)
            # if db_record.rca_file_path:
            #     old_file = Path(db_record.rca_file_path)
            #     if old_file.is_file():
            #         old_file.unlink()
                
        except Exception as e:
            print(f"Error saving file: {e}")
            raise HTTPException(status_code=500, detail=f"Could not save uploaded file: {original_filename}")
        finally:
            await rca_file.close()

    # --- 4. Update the DB object with new values ---
    db_record.unit = unit
    db_record.datetime_from = datetime_from
    db_record.datetime_to = parsed_datetime_to
    db_record.duration = parsed_duration
    db_record.reason = reason
    db_record.responsible_agency = responsible_agency
    db_record.notification_no = notification_no
    db_record.rca_file_path = file_path_in_db # Set the new (or old) path
    
    # --- 5. Commit changes ---
    try:
        await db.commit()
        await db.refresh(db_record)
        return db_record
    except Exception as e:
        await db.rollback()
        print(f"Error updating shutdown record: {e}")
        raise HTTPException(status_code=500, detail="Could not update shutdown record.")


@app.get("/api/shutdowns/export/pdf", dependencies=[Depends(verify_user)])
async def export_shutdown_pdf(
    # Use Query for GET requests
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    unit: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    # --- MODIFIED: Query and filter by datetime_from ---
    query = select(models.ShutdownRecordDB).order_by(models.ShutdownRecordDB.datetime_from.asc())
    
    if start_date:
        start_datetime = datetime.combine(start_date, time.min)
        query = query.where(models.ShutdownRecordDB.datetime_from >= start_datetime)
        
    if end_date:
        end_datetime = datetime.combine(end_date, time.max)
        query = query.where(models.ShutdownRecordDB.datetime_from <= end_datetime)
        
    if unit:
        query = query.where(models.ShutdownRecordDB.unit == unit)
    # --- END MODIFICATION ---
    
    result = await db.execute(query)
    records = result.scalars().all()

    if not records:
        raise HTTPException(status_code=404, detail="No shutdown data found for the selected range.")

    # --- Generate PDF ---
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=0.5*inch, rightMargin=0.5*inch, topMargin=0.5*inch, bottomMargin=0.5*inch)
    styles = getSampleStyleSheet()
    story = []

    # --- Title ---
    title_str = "Plant Shutdown Log"
    date_range_str = ""
    if start_date and end_date:
        date_range_str = f" ({start_date.strftime('%d-%m-%Y')} to {end_date.strftime('%d-%m-%Y')})"
    elif start_date:
        date_range_str = f" (from {start_date.strftime('%d-%m-%Y')})"
    elif end_date:
        date_range_str = f" (up to {end_date.strftime('%d-%m-%Y')})"
    
    if unit:
        title_str += f" for {unit}{date_range_str}"
    else:
        title_str += date_range_str

    story.append(Paragraph(title_str, styles['h1']))
    story.append(Spacer(1, 0.2*inch))

    # --- MODIFIED: Table Header ---
    table_data = [
        ["From (Date/Time)", "To (Date/Time)", "Unit", "Duration", "Reason", "Agency", "Notif. No.", "RCA File"]
    ]
    
    # --- MODIFIED: Table Rows ---
    for record in records:
        # Format datetimes, handling None for 'to'
        from_str = record.datetime_from.strftime('%d-%m-%y %H:%M')
        to_str = record.datetime_to.strftime('%d-%m-%y %H:%M') if record.datetime_to else ""
        
        table_data.append([
            from_str,
            to_str,
            record.unit,
            record.duration or "", # Handle None
            record.reason or "",
            record.responsible_agency or "",
            record.notification_no or "",
            "Yes" if record.rca_file_path else "No"
        ])

    # --- MODIFIED: Create Table Style (adjusted colWidths) ---
    table = Table(table_data, colWidths=[1.2*inch, 1.2*inch, 0.6*inch, 0.7*inch, 2.2*inch, 1.0*inch, 0.8*inch, 0.7*inch])
    style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (4, 1), (4, -1), 'LEFT'), # Align Reason column left
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ])
    table.setStyle(style)
    story.append(table)

    # Build PDF
    doc.build(story)
    buffer.seek(0)
    
    filename = f"shutdown_log{date_range_str.replace(' ', '_').replace('(', '').replace(')', '')}.pdf"
    
    return StreamingResponse(
        buffer, 
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
# -------------------- AGGREGATION & EXPORT ROUTES --------------------

async def update_aggregates(report: models.UnitReport, db: AsyncSession):
    if not isinstance(report.report_date, date):
        print(f"CRITICAL Error: update_aggregates received non-date object for report_date: {type(report.report_date)}")
        return

    report_py_date = report.report_date
    unit = report.unit
    year = report_py_date.year
    month = report_py_date.month
    report_datetime_end = datetime.combine(report_py_date, datetime.max.time())
    month_start_dt = datetime(year, month, 1)
    year_start_dt = datetime(year, 1, 1)

    aggregation_cols = [
        func.sum(models.UnitReportDB.generation_mu).label("generation_mu"),
        func.avg(models.UnitReportDB.plf_percent).label("plf_percent"),
        func.sum(models.UnitReportDB.running_hour).label("running_hour"),
        func.avg(models.UnitReportDB.plant_availability_percent).label("plant_availability_percent"),
        func.sum(models.UnitReportDB.planned_outage_hour).label("planned_outage_hour"),
        func.avg(models.UnitReportDB.planned_outage_percent).label("planned_outage_percent"),
        func.sum(models.UnitReportDB.forced_outage_hour).label("forced_outage_hour"),
        func.avg(models.UnitReportDB.forced_outage_percent).label("forced_outage_percent"),
        func.sum(models.UnitReportDB.strategic_outage_hour).label("strategic_outage_hour"),
        func.sum(models.UnitReportDB.coal_consumption_t).label("coal_consumption_t"),
        func.avg(models.UnitReportDB.sp_coal_consumption_kg_kwh).label("sp_coal_consumption_kg_kwh"),
        func.avg(models.UnitReportDB.avg_gcv_coal_kcal_kg).label("avg_gcv_coal_kcal_kg"),
        func.avg(models.UnitReportDB.heat_rate).label("heat_rate"),
        func.sum(models.UnitReportDB.ldo_hsd_consumption_kl).label("ldo_hsd_consumption_kl"),
        func.avg(models.UnitReportDB.sp_oil_consumption_ml_kwh).label("sp_oil_consumption_ml_kwh"),
        func.sum(models.UnitReportDB.aux_power_consumption_mu).label("aux_power_consumption_mu"),
        func.avg(models.UnitReportDB.aux_power_percent).label("aux_power_percent"),
        func.sum(models.UnitReportDB.dm_water_consumption_cu_m).label("dm_water_consumption_cu_m"),
        func.avg(models.UnitReportDB.sp_dm_water_consumption_percent).label("sp_dm_water_consumption_percent"),
        func.sum(models.UnitReportDB.steam_gen_t).label("steam_gen_t"),
        func.avg(models.UnitReportDB.sp_steam_consumption_kg_kwh).label("sp_steam_consumption_kg_kwh"),
        func.avg(models.UnitReportDB.stack_emission_spm_mg_nm3).label("stack_emission_spm_mg_nm3"),
    ]

    try:
        # --- Monthly Aggregate Calculation ---
        monthly_stmt = select(*aggregation_cols).select_from(models.UnitReportDB).where(
            models.UnitReportDB.unit == unit,
            models.UnitReportDB.report_date >= month_start_dt,
            models.UnitReportDB.report_date <= report_datetime_end
        ).group_by(models.UnitReportDB.unit)
        monthly_result = await db.execute(monthly_stmt)
        monthly_data = monthly_result.mappings().first()
        if monthly_data:
            monthly_values = {**monthly_data, "unit": unit, "year": year, "month": month}
            # ✅ CHANGED: Use SQLite insert
            monthly_insert_stmt = insert(models.MonthlyAggregateDB).values(**monthly_values)
            monthly_update_dict = {k: getattr(monthly_insert_stmt.excluded, k) for k in monthly_data.keys()}
            # ✅ CHANGED: Use SQLite-compatible upsert
            monthly_upsert_stmt = monthly_insert_stmt.on_conflict_do_update( index_elements=['unit', 'year', 'month'], set_=monthly_update_dict )
            await db.execute(monthly_upsert_stmt)

        # --- Yearly Aggregate Calculation ---
        yearly_stmt = select(*aggregation_cols).select_from(models.UnitReportDB).where(
            models.UnitReportDB.unit == unit,
            models.UnitReportDB.report_date >= year_start_dt,
            models.UnitReportDB.report_date <= report_datetime_end
        ).group_by(models.UnitReportDB.unit)
        yearly_result = await db.execute(yearly_stmt)
        yearly_data = yearly_result.mappings().first()
        if yearly_data:
            yearly_values = {**yearly_data, "unit": unit, "year": year}
            # ✅ CHANGED: Use SQLite insert
            yearly_insert_stmt = insert(models.YearlyAggregateDB).values(**yearly_values)
            yearly_update_dict = {k: getattr(yearly_insert_stmt.excluded, k) for k in yearly_data.keys()}
            # ✅ CHANGED: Use SQLite-compatible upsert
            yearly_upsert_stmt = yearly_insert_stmt.on_conflict_do_update( index_elements=['unit', 'year'], set_=yearly_update_dict )
            await db.execute(yearly_upsert_stmt)

        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"Error updating unit aggregates: {e}")


async def update_station_aggregates(report: models.StationReport, db: AsyncSession):
    """Recalculates and upserts monthly/yearly aggregates for station data."""
    if not isinstance(report.report_date, date):
        print(f"CRITICAL Error: update_station_aggregates received non-date object: {type(report.report_date)}")
        return

    report_py_date = report.report_date
    year = report_py_date.year
    month = report_py_date.month
    report_datetime_end = datetime.combine(report_py_date, datetime.max.time())
    month_start_dt = datetime(year, month, 1)
    year_start_dt = datetime(year, 1, 1)

    aggregation_cols = [
        func.avg(models.StationReportDB.avg_raw_water_used_cu_m_hr).label("avg_raw_water_used_cu_m_hr"),
        func.sum(models.StationReportDB.total_raw_water_used_cu_m).label("total_raw_water_used_cu_m"),
        func.avg(models.StationReportDB.sp_raw_water_used_ltr_kwh).label("sp_raw_water_used_ltr_kwh"),
        func.sum(models.StationReportDB.ro_plant_running_hrs).label("ro_plant_running_hrs"),
        func.sum(models.StationReportDB.ro_plant_il).label("ro_plant_il"),
        func.sum(models.StationReportDB.ro_plant_ol).label("ro_plant_ol"),
    ]

    try:
        # --- Monthly Aggregate Calculation ---
        monthly_stmt = select(*aggregation_cols).select_from(models.StationReportDB).where(
            models.StationReportDB.report_date >= month_start_dt,
            models.StationReportDB.report_date <= report_datetime_end
        )
        monthly_result = await db.execute(monthly_stmt)
        monthly_data = monthly_result.mappings().first()
        if monthly_data:
            monthly_values = {**monthly_data, "year": year, "month": month}
            # ✅ CHANGED: Use SQLite insert
            monthly_insert_stmt = insert(models.StationMonthlyAggregateDB).values(**monthly_values)
            monthly_update_dict = {k: getattr(monthly_insert_stmt.excluded, k) for k in monthly_data.keys()}
            # ✅ CHANGED: Use SQLite-compatible upsert
            monthly_upsert_stmt = monthly_insert_stmt.on_conflict_do_update(index_elements=['year', 'month'], set_=monthly_update_dict)
            await db.execute(monthly_upsert_stmt)

        # --- Yearly Aggregate Calculation ---
        yearly_stmt = select(*aggregation_cols).select_from(models.StationReportDB).where(
            models.StationReportDB.report_date >= year_start_dt,
            models.StationReportDB.report_date <= report_datetime_end
        )
        yearly_result = await db.execute(yearly_stmt)
        yearly_data = yearly_result.mappings().first()
        if yearly_data:
            yearly_values = {**yearly_data, "year": year}
            # ✅ CHANGED: Use SQLite insert
            yearly_insert_stmt = insert(models.StationYearlyAggregateDB).values(**yearly_values)
            yearly_update_dict = {k: getattr(yearly_insert_stmt.excluded, k) for k in yearly_data.keys()}
            # ✅ CHANGED: Use SQLite-compatible upsert
            yearly_upsert_stmt = yearly_insert_stmt.on_conflict_do_update(index_elements=['year'], set_=yearly_update_dict)
            await db.execute(yearly_upsert_stmt)
            await db.execute(yearly_upsert_stmt)

        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"Error updating STATION aggregates: {e}")


# --- Unit Aggregate Endpoints (response_model uses models.AggregateResponse) ---
@app.get("/api/aggregate/month/{year}/{month}/{upto_date}", response_model=List[models.AggregateResponse], dependencies=[Depends(verify_user)])
async def get_monthly_summary_upto(year: int, month: int, upto_date: date, db: AsyncSession = Depends(get_db)):
    month_start_dt = datetime(year, month, 1)
    upto_dt = datetime.combine(upto_date, datetime.max.time())
    aggregation_cols = [ models.UnitReportDB.unit.label("unit"), func.sum(models.UnitReportDB.generation_mu).label("generation_mu"), func.avg(models.UnitReportDB.plf_percent).label("plf_percent"), func.sum(models.UnitReportDB.running_hour).label("running_hour"), func.avg(models.UnitReportDB.plant_availability_percent).label("plant_availability_percent"), func.sum(models.UnitReportDB.planned_outage_hour).label("planned_outage_hour"), func.avg(models.UnitReportDB.planned_outage_percent).label("planned_outage_percent"), func.sum(models.UnitReportDB.forced_outage_hour).label("forced_outage_hour"), func.avg(models.UnitReportDB.forced_outage_percent).label("forced_outage_percent"), func.sum(models.UnitReportDB.strategic_outage_hour).label("strategic_outage_hour"), func.sum(models.UnitReportDB.coal_consumption_t).label("coal_consumption_t"), func.avg(models.UnitReportDB.sp_coal_consumption_kg_kwh).label("sp_coal_consumption_kg_kwh"), func.avg(models.UnitReportDB.avg_gcv_coal_kcal_kg).label("avg_gcv_coal_kcal_kg"), func.avg(models.UnitReportDB.heat_rate).label("heat_rate"), func.sum(models.UnitReportDB.ldo_hsd_consumption_kl).label("ldo_hsd_consumption_kl"), func.avg(models.UnitReportDB.sp_oil_consumption_ml_kwh).label("sp_oil_consumption_ml_kwh"), func.sum(models.UnitReportDB.aux_power_consumption_mu).label("aux_power_consumption_mu"), func.avg(models.UnitReportDB.aux_power_percent).label("aux_power_percent"), func.sum(models.UnitReportDB.dm_water_consumption_cu_m).label("dm_water_consumption_cu_m"), func.avg(models.UnitReportDB.sp_dm_water_consumption_percent).label("sp_dm_water_consumption_percent"), func.sum(models.UnitReportDB.steam_gen_t).label("steam_gen_t"), func.avg(models.UnitReportDB.sp_steam_consumption_kg_kwh).label("sp_steam_consumption_kg_kwh"), func.avg(models.UnitReportDB.stack_emission_spm_mg_nm3).label("stack_emission_spm_mg_nm3"), ]
    stmt = select(*aggregation_cols).select_from(models.UnitReportDB).where( models.UnitReportDB.report_date >= month_start_dt, models.UnitReportDB.report_date <= upto_dt ).group_by(models.UnitReportDB.unit).order_by(models.UnitReportDB.unit)
    result = await db.execute(stmt)
    results_list = [dict(row) for row in result.mappings().all()]
    return results_list


@app.get("/api/aggregate/year/{year}/{upto_date}", response_model=List[models.AggregateResponse], dependencies=[Depends(verify_user)])
async def get_yearly_summary_upto(year: int, upto_date: date, db: AsyncSession = Depends(get_db)):
    year_start_dt = datetime(year, 1, 1)
    upto_dt = datetime.combine(upto_date, datetime.max.time())
    aggregation_cols = [ models.UnitReportDB.unit.label("unit"), func.sum(models.UnitReportDB.generation_mu).label("generation_mu"), func.avg(models.UnitReportDB.plf_percent).label("plf_percent"), func.sum(models.UnitReportDB.running_hour).label("running_hour"), func.avg(models.UnitReportDB.plant_availability_percent).label("plant_availability_percent"), func.sum(models.UnitReportDB.planned_outage_hour).label("planned_outage_hour"), func.avg(models.UnitReportDB.planned_outage_percent).label("planned_outage_percent"), func.sum(models.UnitReportDB.forced_outage_hour).label("forced_outage_hour"), func.avg(models.UnitReportDB.forced_outage_percent).label("forced_outage_percent"), func.sum(models.UnitReportDB.strategic_outage_hour).label("strategic_outage_hour"), func.sum(models.UnitReportDB.coal_consumption_t).label("coal_consumption_t"), func.avg(models.UnitReportDB.sp_coal_consumption_kg_kwh).label("sp_coal_consumption_kg_kwh"), func.avg(models.UnitReportDB.avg_gcv_coal_kcal_kg).label("avg_gcv_coal_kcal_kg"), func.avg(models.UnitReportDB.heat_rate).label("heat_rate"), func.sum(models.UnitReportDB.ldo_hsd_consumption_kl).label("ldo_hsd_consumption_kl"), func.avg(models.UnitReportDB.sp_oil_consumption_ml_kwh).label("sp_oil_consumption_ml_kwh"), func.sum(models.UnitReportDB.aux_power_consumption_mu).label("aux_power_consumption_mu"), func.avg(models.UnitReportDB.aux_power_percent).label("aux_power_percent"), func.sum(models.UnitReportDB.dm_water_consumption_cu_m).label("dm_water_consumption_cu_m"), func.avg(models.UnitReportDB.sp_dm_water_consumption_percent).label("sp_dm_water_consumption_percent"), func.sum(models.UnitReportDB.steam_gen_t).label("steam_gen_t"), func.avg(models.UnitReportDB.sp_steam_consumption_kg_kwh).label("sp_steam_consumption_kg_kwh"), func.avg(models.UnitReportDB.stack_emission_spm_mg_nm3).label("stack_emission_spm_mg_nm3"), ]
    stmt = select(*aggregation_cols).select_from(models.UnitReportDB).where( models.UnitReportDB.report_date >= year_start_dt, models.UnitReportDB.report_date <= upto_dt ).group_by(models.UnitReportDB.unit).order_by(models.UnitReportDB.unit)
    result = await db.execute(stmt)
    results_list = [dict(row) for row in result.mappings().all()]
    return results_list


# --- Station Aggregate Endpoints (response_model uses models.StationAggregateResponse) ---
@app.get("/api/aggregate/station/month/{year}/{month}/{upto_date}", response_model=models.StationAggregateResponse, dependencies=[Depends(verify_user)])
async def get_station_monthly_summary_upto(year: int, month: int, upto_date: date, db: AsyncSession = Depends(get_db)):
    month_start_dt = datetime(year, month, 1)
    upto_dt = datetime.combine(upto_date, datetime.max.time())
    aggregation_cols = [ func.avg(models.StationReportDB.avg_raw_water_used_cu_m_hr).label("avg_raw_water_used_cu_m_hr"), func.sum(models.StationReportDB.total_raw_water_used_cu_m).label("total_raw_water_used_cu_m"), func.avg(models.StationReportDB.sp_raw_water_used_ltr_kwh).label("sp_raw_water_used_ltr_kwh"), func.sum(models.StationReportDB.ro_plant_running_hrs).label("ro_plant_running_hrs"), func.sum(models.StationReportDB.ro_plant_il).label("ro_plant_il"), func.sum(models.StationReportDB.ro_plant_ol).label("ro_plant_ol"), ]
    stmt = select(*aggregation_cols).select_from(models.StationReportDB).where( models.StationReportDB.report_date >= month_start_dt, models.StationReportDB.report_date <= upto_dt )
    result = await db.execute(stmt)
    data = result.mappings().first()
    if not data or data['total_raw_water_used_cu_m'] is None: raise HTTPException(status_code=404, detail="No station aggregate data found for this month.")
    return {**data, "year": year, "month": month}

@app.get("/api/aggregate/station/year/{year}/{upto_date}", response_model=models.StationAggregateResponse, dependencies=[Depends(verify_user)])
async def get_station_yearly_summary_upto(year: int, upto_date: date, db: AsyncSession = Depends(get_db)):
    year_start_dt = datetime(year, 1, 1)
    upto_dt = datetime.combine(upto_date, datetime.max.time())
    aggregation_cols = [ func.avg(models.StationReportDB.avg_raw_water_used_cu_m_hr).label("avg_raw_water_used_cu_m_hr"), func.sum(models.StationReportDB.total_raw_water_used_cu_m).label("total_raw_water_used_cu_m"), func.avg(models.StationReportDB.sp_raw_water_used_ltr_kwh).label("sp_raw_water_used_ltr_kwh"), func.sum(models.StationReportDB.ro_plant_running_hrs).label("ro_plant_running_hrs"), func.sum(models.StationReportDB.ro_plant_il).label("ro_plant_il"), func.sum(models.StationReportDB.ro_plant_ol).label("ro_plant_ol"), ]
    stmt = select(*aggregation_cols).select_from(models.StationReportDB).where( models.StationReportDB.report_date >= year_start_dt, models.StationReportDB.report_date <= upto_dt )
    result = await db.execute(stmt)
    data = result.mappings().first()
    if not data or data['total_raw_water_used_cu_m'] is None: raise HTTPException(status_code=404, detail="No station aggregate data found for this year.")
    return {**data, "year": year}


# --- Export Endpoints ---
@app.get("/api/export/excel/{report_date}", dependencies=[Depends(verify_user)])
async def export_excel(report_date: date, db: AsyncSession = Depends(get_db)):
    # ... (function implementation remains the same) ...
    report_dt_start = datetime.combine(report_date, datetime.min.time())
    report_dt_end = report_dt_start + timedelta(days=1)
    stmt = select(models.UnitReportDB).where( models.UnitReportDB.report_date >= report_dt_start, models.UnitReportDB.report_date < report_dt_end ).order_by(models.UnitReportDB.unit)
    result = await db.execute(stmt)
    reports_orm = result.scalars().all()
    if not reports_orm: raise HTTPException(status_code=404, detail="No data found for Excel export.")
    reports_dict = [models.UnitReport.from_orm(r).dict() for r in reports_orm]
    df = pd.DataFrame(reports_dict)
    if 'report_date' in df.columns: df['report_date'] = pd.to_datetime(df['report_date']).dt.date
    output = io.BytesIO()
    df.to_excel(output, index=False); output.seek(0)
    return StreamingResponse( output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=report_{report_date}.xlsx"} )


@app.get("/api/export/pdf/{report_date}", dependencies=[Depends(verify_user)])
async def export_pdf(report_date: date, db: AsyncSession = Depends(get_db)):
    
    # --- Fetch Data ---
    # (Your data fetching logic is correct and unchanged)
    report_dt_start = datetime.combine(report_date, datetime.min.time()); report_dt_end = report_dt_start + timedelta(days=1)
    unit_stmt = select(models.UnitReportDB).where( models.UnitReportDB.report_date >= report_dt_start, models.UnitReportDB.report_date < report_dt_end ).order_by(models.UnitReportDB.unit)
    unit_result = await db.execute(unit_stmt); unit_reports_orm = unit_result.scalars().all()
    station_stmt = select(models.StationReportDB).where( models.StationReportDB.report_date == report_dt_start )
    station_result = await db.execute(station_stmt); station_report_orm = station_result.scalar_one_or_none()
    year = report_date.year; month = report_date.month
    monthly_stmt = select(models.MonthlyAggregateDB).where( models.MonthlyAggregateDB.year == year, models.MonthlyAggregateDB.month == month )
    monthly_result = await db.execute(monthly_stmt); monthly_aggs_orm = monthly_result.scalars().all()
    yearly_stmt = select(models.YearlyAggregateDB).where( models.YearlyAggregateDB.year == year )
    yearly_result = await db.execute(yearly_stmt); yearly_aggs_orm = yearly_result.scalars().all()
    station_monthly_stmt = select(models.StationMonthlyAggregateDB).where( models.StationMonthlyAggregateDB.year == year, models.StationMonthlyAggregateDB.month == month )
    station_monthly_result = await db.execute(station_monthly_stmt); station_monthly_data = station_monthly_result.scalar_one_or_none()
    station_yearly_stmt = select(models.StationYearlyAggregateDB).where( models.StationYearlyAggregateDB.year == year )
    station_yearly_result = await db.execute(station_yearly_stmt); station_yearly_data = station_yearly_result.scalar_one_or_none()
    if not unit_reports_orm and not station_report_orm:
        raise HTTPException(status_code=404, detail="No data found for PDF export.")
    
    # --- Convert Data ---
    # (Your data conversion logic is correct and unchanged)
    unit_reports = [models.UnitReport.from_orm(r).dict() for r in unit_reports_orm]
    station_report = models.StationReport.from_orm(station_report_orm).dict() if station_report_orm else {}
    monthly_aggs_dict = {agg.unit: agg.__dict__ for agg in monthly_aggs_orm}
    yearly_aggs_dict = {agg.unit: agg.__dict__ for agg in yearly_aggs_orm}
    station_monthly_dict = station_monthly_data.__dict__ if station_monthly_data else {}
    station_yearly_dict = station_yearly_data.__dict__ if station_yearly_data else {}

    # --- Helpers ---
    # (Your helper functions are correct and unchanged)
    def get_unit_data_dict(data_list_of_dicts, unit_name):
        for item in data_list_of_dicts:
            if item.get("unit") == unit_name: return item
        return {}
    def format_val(value, precision=2, default="-"):
        if value is None: return default
        try: num = float(value);
        except (ValueError, TypeError): return default
        if precision == 0: return f"{num:.0f}";
        if precision == 1: return f"{num:.1f}";
        if precision == 3: return f"{num:.3f}";
        return f"{num:.2f}"
        
    # --- Prepare Table Data ---
    # (Your table data preparation is correct and unchanged)
    unit1_daily = get_unit_data_dict(unit_reports, "Unit-1"); unit2_daily = get_unit_data_dict(unit_reports, "Unit-2")
    unit1_monthly = monthly_aggs_dict.get("Unit-1", {}); unit2_monthly = monthly_aggs_dict.get("Unit-2", {})
    unit1_yearly = yearly_aggs_dict.get("Unit-1", {}); unit2_yearly = yearly_aggs_dict.get("Unit-2", {})
    station_daily_data = station_report
    def calc_station_agg(field, agg_type='sum', precision=2):
        u1d=unit1_daily.get(field); u2d=unit2_daily.get(field); u1m=unit1_monthly.get(field); u2m=unit2_monthly.get(field); u1y=unit1_yearly.get(field); u2y=unit2_yearly.get(field)
        d, m, y = 0,0,0; n=lambda v: float(v) if v is not None and isinstance(v,(int,float)) else 0
        if agg_type=='sum': d=n(u1d)+n(u2d); m=n(u1m)+n(u2m); y=n(u1y)+n(u2y)
        elif agg_type=='avg': cd=(1 if u1d is not None else 0)+(1 if u2d is not None else 0); cm=(1 if u1m is not None else 0)+(1 if u2m is not None else 0); cy=(1 if u1y is not None else 0)+(1 if u2y is not None else 0); d=(n(u1d)+n(u2d))/cd if cd>0 else 0; m=(n(u1m)+n(u2m))/cm if cm>0 else 0; y=(n(u1y)+n(u2y))/cy if cy>0 else 0
        if field in ['generation_mu','sp_coal_consumption_kg_kwh','aux_power_consumption_mu']: precision=3
        if field in ['heat_rate','avg_gcv_coal_kcal_kg','dm_water_consumption_cu_m','steam_gen_t']: precision=0
        if field in ['running_hour','planned_outage_hour','forced_outage_hour','strategic_outage_hour','ro_plant_running_hrs']: precision=1
        return {"day": format_val(d, precision, "0" if d==0 else "-"), "month": format_val(m, precision, "0" if m==0 else "-"), "year": format_val(y, precision, "0" if y==0 else "-")}
    parameters = [ ("Generation in MU", "generation_mu", 'sum', 3), ("PLF %", "plf_percent", 'avg', 2), ("Running Hour", "running_hour", 'sum', 1), ("Plant availability Factor%", "plant_availability_percent", 'avg', 2), ("Planned Outage in Hour", "planned_outage_hour", 'sum', 1), ("Planned Outage %", "planned_outage_percent", 'avg', 2), ("Forced Outage in Hour", "forced_outage_hour", 'sum', 1), ("Forced Outage %", "forced_outage_percent", 'avg', 2), ("Strategic Outage in Hour", "strategic_outage_hour", 'sum', 1), ("Coal Consumption in T", "coal_consumption_t", 'sum', 2), ("Sp. Coal Consumption in kg/kwh", "sp_coal_consumption_kg_kwh", 'avg', 3), ("Average GCV of Coal in kcal/kg", "avg_gcv_coal_kcal_kg", 'avg', 0), ("Heat Rate in kcal/kwh", "heat_rate", 'avg', 0), ("LDO/HSD Consumption in KL", "ldo_hsd_consumption_kl", 'sum', 2), ("Specific Oil Consumption in ml/kwh", "sp_oil_consumption_ml_kwh", 'avg', 2), ("Aux. Power Consumption in MU", "aux_power_consumption_mu", 'sum', 3), ("% Aux. Power Consumption", "aux_power_percent", 'avg', 2), ("DM Water Consumption in Cu. M", "dm_water_consumption_cu_m", 'sum', 0), ("Specific DM Wtr. Consumption in %", "sp_dm_water_consumption_percent", 'avg', 2), ("Steam Gen (T)", "steam_gen_t", 'sum', 0), ("Sp. Steam Consumption in kg/kwh", "sp_steam_consumption_kg_kwh", 'avg', 2), ("Stack Emission (SPM) in mg/Nm3", "stack_emission_spm_mg_nm3", 'avg', 2), ]
    data = [['Parameter', 'Unit-1', '', '', 'Unit-2', '', '', 'Station', '', ''], ['', 'Day', 'Month', 'Year', 'Day', 'Month', 'Year', 'Day', 'Month', 'Year']]
    for label, field, agg, prec in parameters: 
        station_agg = calc_station_agg(field, agg, prec)
        data.append([label, format_val(unit1_daily.get(field), prec), format_val(unit1_monthly.get(field), prec), format_val(unit1_yearly.get(field), prec), format_val(unit2_daily.get(field), prec), format_val(unit2_monthly.get(field), prec), format_val(unit2_yearly.get(field), prec), station_agg['day'], station_agg['month'], station_agg['year'], ])
    data.append(['STATION-LEVEL PARAMETERS', '', '', '', '', '', '', '', '', ''])
    station_params = [ ("Avg. Raw Water Used, Cu. M / Hr.", "avg_raw_water_used_cu_m_hr", 2), ("Total Raw Water Used, Cu. M", "total_raw_water_used_cu_m", 2), ("Sp. Raw Water Used, Ltr. / Kwh", "sp_raw_water_used_ltr_kwh", 2), ("RO Plant running Hrs", "ro_plant_running_hrs", 1), ("RO Plant I/L", "ro_plant_il", 2), ("RO Plant O/L", "ro_plant_ol", 2), ]
    for label, field, prec in station_params: 
        data.append([ label, "-", "-", "-", "-", "-", "-", format_val(station_daily_data.get(field), prec), format_val(station_monthly_dict.get(field), prec), format_val(station_yearly_dict.get(field), prec) ])

    # --- Generate PDF ---
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=0.25*inch, rightMargin=0.25*inch, topMargin=0.25*inch, bottomMargin=0.25*inch)
    styles = getSampleStyleSheet()
    styles['h1'].alignment = 1
    styles['h1'].fontSize = 14
    
    styles.add(ParagraphStyle(name='SpacerHeader',
                                 fontSize=7,
                                 fontName='Helvetica-Bold',
                                 textColor=colors.white,
                                 backColor=colors.darkorange,
                                 alignment=0,
                                 borderPadding=(2, 2, 2, 2)
                                 ))

    story = []

    # ✅ --- HEADER TABLE (LOGO + TITLE) ---
    if not os.path.exists(LOGO_PATH):
        raise HTTPException(status_code=500, detail=f"Logo file not found at {LOGO_PATH}.")
    
    # 1. The Image (small height, auto-width, aligned left in its cell)
    # Set height to 0.5 inches. Width will scale automatically.
    img = Image(LOGO_PATH, height=0.35*inch, width=1.2*inch, hAlign='LEFT')

    # ✅ --- MODIFIED TITLE SECTION ---
    # 2. The Title Paragraph (centered in its cell)
    # Use inline <font> tags to set colors, calling the hexval() method
    title_text = (
        f"<font color='{colors.dimgrey.hexval()}'>2*125 MW CPP DAILY PERFORMANCE REPORT</font> "
        f"<font color='{colors.orange.hexval()}'>DATED: {report_date.strftime('%d-%m-%Y')}</font>"
    )
    
    # We use the existing h1 style (which has alignment and font size)
    title_para = Paragraph(title_text, styles['h1'])
    # ✅ --- END OF MODIFIED TITLE SECTION ---
    # 3. The Table Data & Column Widths
    # Page width is ~7.77 inches (8.27 - 0.5 margins)
    # Give 1.0 inch for logo, and the rest for the title
    header_data = [[img, title_para]]
    header_col_widths = [1.0*inch, 6.77*inch] 
    
    header_table = Table(header_data, colWidths=header_col_widths)
    
    # 4. The Table Style (no borders, vertical middle alignment)
    header_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'), # Align image and text vertically
        ('LEFTPADDING', (0, 0), (0, 0), 0),      # No padding on left cell
        ('RIGHTPADDING', (0, 0), (0, 0), 0),
    ]))
    
    # 5. Add header table to story INSTEAD of the old title/spacer
    story.append(header_table)
    story.append(Spacer(1, 0.1*inch))
    # ✅ --- END OF HEADER TABLE ---


    # ... (rest of your table generation logic is unchanged) ...
    
    spacer_row_index = len(parameters) + 2
    data[spacer_row_index][0] = Paragraph('STATION-LEVEL PARAMETERS', styles['SpacerHeader'])

    colWidths = [
        1.77*inch,  # Parameter
        0.67*inch, 0.67*inch, 0.67*inch, # Unit 1
        0.67*inch, 0.67*inch, 0.67*inch, # Unit 2
        0.67*inch, 0.67*inch, 0.67*inch, # Station
    ]

    table = Table(data, colWidths=colWidths, repeatRows=2)
    
    style_commands = [
        ('BACKGROUND', (0, 0), (-1, 0), colors.darkorange),
        ('BACKGROUND', (0, 1), (-1, 1), colors.orange),
        ('TEXTCOLOR', (0, 0), (-1, 1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('ALIGN', (0, 2), (0, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 1), 'Helvetica-Bold'),
        ('FONTNAME', (0, 2), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ('TOPPADDING', (0, 0), (-1, -1), 2),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('SPAN', (1, 0), (3, 0)), ('SPAN', (4, 0), (6, 0)), ('SPAN', (7, 0), (9, 0)), ('SPAN', (0, 0), (0, 1)),
        ('SPAN', (0, spacer_row_index), (-1, spacer_row_index)),
        ('BACKGROUND', (0, spacer_row_index), (-1, spacer_row_index), colors.darkorange),
        ('VALIGN', (0, spacer_row_index), (-1, spacer_row_index), 'MIDDLE'),
        ('BOTTOMPADDING', (0, spacer_row_index), (-1, spacer_row_index), 2),
        ('TOPPADDING', (0, spacer_row_index), (-1, spacer_row_index), 2),
    ]

    for i in range(2, len(data)):
        if i == spacer_row_index: continue
        if i % 2 == 0:
            style_commands.append(('BACKGROUND', (0, i), (-1, i), colors.whitesmoke))
            
    table.setStyle(TableStyle(style_commands))
    
    story.append(table)
    
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=report_{report_date}.pdf"})