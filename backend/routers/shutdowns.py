# routers/shutdowns.py

from fastapi import (
    APIRouter, Depends, HTTPException, Form, File, UploadFile, Query
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import Optional, List
from datetime import datetime, date, time
from pathlib import Path
import shutil
import io
import re
import models
from database import get_db
from auth import get_current_user

from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors


UPLOAD_DIR = Path("uploads/rca")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(
    prefix="/api/shutdowns",
    tags=["Shutdown Log"]
)

def duration_to_hours(val: str) -> float:
    """
    Robust parser handling:
    - "2H", "2h"
    - "120M", "120m"
    - "2H 30M"
    - "1d 2h 30m"
    - "02:30"
    - "3 hrs", "2 hr", "4hours"
    - "3.5h"
    - invalid/None → 0
    """
    if not val or not isinstance(val, str):
        return 0.0

    s = val.strip().upper()

    # case: HH:MM
    if ":" in s:
        try:
            hh, mm = s.split(":")
            return int(hh) + int(mm) / 60
        except:
            return 0.0

    # Normalize long words → single letters
    s = (
        s.replace("HRS", "H")
        .replace("HR", "H")
        .replace("HOUR", "H")
        .replace("HOURS", "H")
        .replace("MINS", "M")
        .replace("MINUTE", "M")
        .replace("MINUTES", "M")
        .replace("MIN", "M")
        .replace(" DAYS", "D")
        .replace(" DAY", "D")
    )

    # Match numbers + unit (D/H/M)
    matches = re.findall(r"(\d+\.?\d*)\s*(D|H|M)", s)
    if matches:
        total = 0.0
        for num, unit in matches:
            num = float(num)
            if unit == "D":
                total += num * 24
            elif unit == "H":
                total += num
            elif unit == "M":
                total += num / 60.0
        return total

    # fallback: value is just a number → hours
    try:
        return float(s)
    except:
        return 0.0


# =====================================================================
# 1️⃣  CREATE SHUTDOWN (NO SYNC HERE)
# =====================================================================
@router.post("/", response_model=models.ShutdownRecord, status_code=201)
async def create_shutdown_record(
    unit: str = Form(...),
    shutdown_type: Optional[str] = Form(None),
    datetime_from: datetime = Form(...),

    responsible_agency: Optional[str] = Form(None),
    reason: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    shift_incharge: Optional[str] = Form(None),
    pretrip_status: Optional[str] = Form(None),
    first_cause: Optional[str] = Form(None),
    action_taken: Optional[str] = Form(None),
    restoration_sequence: Optional[str] = Form(None),
    notification_no: Optional[str] = Form(None),

    rca_file: Optional[UploadFile] = File(None),

    db: AsyncSession = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user)
):

    if current_user.role_id == 6:
        raise HTTPException(403, "Viewer cannot create shutdown records.")

    # ---------- FILE UPLOAD ----------
    rca_path = None
    if rca_file:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe = "".join(c if c.isalnum() else "_" for c in rca_file.filename)
        fname = f"{ts}_{safe}"
        dest = UPLOAD_DIR / fname

        with dest.open("wb") as buf:
            shutil.copyfileobj(rca_file.file, buf)

        rca_path = str(dest)
        await rca_file.close()

    record = models.ShutdownRecordDB(
        unit=unit,
        shutdown_type=shutdown_type,
        datetime_from=datetime_from,

        responsible_agency=responsible_agency,
        reason=reason,
        remarks=remarks,
        shift_incharge=shift_incharge,
        pretrip_status=pretrip_status,
        first_cause=first_cause,
        action_taken=action_taken,
        restoration_sequence=restoration_sequence,
        notification_no=notification_no,

        rca_file_path=rca_path,

        # SYNC default values
        datetime_to=None,
        sync_datetime=None,
        sync_shift_incharge=None,
        oil_used_kl=None,
        coal_t=None,
        oil_stabilization_kl=None,
        import_percent=None,
        sync_notes=None,
        duration=None,
    )

    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


# =====================================================================
# 2️⃣  ADD / UPDATE SYNCHRONISATION (SEPARATE ENDPOINT)
# =====================================================================
@router.put("/{shutdown_id}/sync", response_model=models.ShutdownRecord)
async def update_sync_details(
    shutdown_id: int,

    sync_datetime: datetime = Form(...),
    sync_shift_incharge: Optional[str] = Form(None),
    oil_used_kl: Optional[float] = Form(None),
    coal_t: Optional[float] = Form(None),
    oil_stabilization_kl: Optional[float] = Form(None),
    import_percent: Optional[float] = Form(None),
    sync_notes: Optional[str] = Form(None),

    db: AsyncSession = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user)
):

    if current_user.role_id == 6:
        raise HTTPException(403, "Viewer cannot update sync.")

    res = await db.execute(
        select(models.ShutdownRecordDB).where(models.ShutdownRecordDB.id == shutdown_id)
    )
    record = res.scalars().first()
    if not record:
        raise HTTPException(404, "Shutdown record not found.")

    # --- Sync fields ---
    record.sync_datetime = sync_datetime
    record.datetime_to = sync_datetime     # used to calculate duration
    record.sync_shift_incharge = sync_shift_incharge
    record.oil_used_kl = oil_used_kl
    record.coal_t = coal_t
    record.oil_stabilization_kl = oil_stabilization_kl
    record.import_percent = import_percent
    record.sync_notes = sync_notes

    # --- Duration Calculation ---
    try:
        diff = (record.datetime_to - record.datetime_from).total_seconds()
        total_min = int(diff // 60)
        hours = total_min // 60
        mins = total_min % 60
        days = hours // 24
        hours = hours % 24

        record.duration = (
            f"{days}d {hours}h {mins}m" if days > 0 else f"{hours}h {mins}m"
        )
    except:
        record.duration = None

    await db.commit()
    await db.refresh(record)
    return record


# =====================================================================
# 3️⃣  EDIT SHUTDOWN (NO SYNC HERE)
# =====================================================================
@router.put("/{shutdown_id}", response_model=models.ShutdownRecord)
async def edit_shutdown(
    shutdown_id: int,

    unit: str = Form(...),
    shutdown_type: Optional[str] = Form(None),
    datetime_from: datetime = Form(...),

    responsible_agency: Optional[str] = Form(None),
    reason: Optional[str] = Form(None),
    remarks: Optional[str] = Form(None),
    shift_incharge: Optional[str] = Form(None),
    pretrip_status: Optional[str] = Form(None),
    first_cause: Optional[str] = Form(None),
    action_taken: Optional[str] = Form(None),
    restoration_sequence: Optional[str] = Form(None),
    notification_no: Optional[str] = Form(None),

    rca_file: Optional[UploadFile] = File(None),

    db: AsyncSession = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):

    if current_user.role_id == 6:
        raise HTTPException(403, "Viewer cannot update shutdown records.")

    res = await db.execute(
        select(models.ShutdownRecordDB).where(models.ShutdownRecordDB.id == shutdown_id)
    )
    record = res.scalars().first()

    if not record:
        raise HTTPException(404, "Shutdown record not found.")

    record.unit = unit
    record.shutdown_type = shutdown_type
    record.datetime_from = datetime_from
    record.responsible_agency = responsible_agency
    record.reason = reason
    record.remarks = remarks
    record.shift_incharge = shift_incharge
    record.pretrip_status = pretrip_status
    record.first_cause = first_cause
    record.action_taken = action_taken
    record.restoration_sequence = restoration_sequence
    record.notification_no = notification_no

    # Optional new file upload
    if rca_file:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe = "".join(c if c.isalnum() else "_" for c in rca_file.filename)
        fname = f"{ts}_{safe}"
        dest = UPLOAD_DIR / fname
        with dest.open("wb") as buf:
            shutil.copyfileobj(rca_file.file, buf)
        record.rca_file_path = str(dest)

    await db.commit()
    await db.refresh(record)
    return record


# =====================================================================
# 4️⃣  GET LAST 5 SHUTDOWNS (TABLE DISPLAY)
# =====================================================================
@router.get("/latest", response_model=List[models.ShutdownRecord])
async def latest_shutdowns(db: AsyncSession = Depends(get_db)):
    q = select(models.ShutdownRecordDB).order_by(desc(models.ShutdownRecordDB.id)).limit(5)
    res = await db.execute(q)
    return res.scalars().all()


# =====================================================================
# 5️⃣  GET SHUTDOWN LIST (WITH FILTERS)
# =====================================================================
@router.get("/", response_model=List[models.ShutdownRecord])
async def list_shutdowns(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    unit: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):

    q = select(models.ShutdownRecordDB).order_by(desc(models.ShutdownRecordDB.datetime_from))

    if start_date:
        q = q.where(models.ShutdownRecordDB.datetime_from >= datetime.combine(start_date, time.min))
    if end_date:
        q = q.where(models.ShutdownRecordDB.datetime_from <= datetime.combine(end_date, time.max))
    if unit:
        q = q.where(models.ShutdownRecordDB.unit == unit)

    res = await db.execute(q)
    return res.scalars().all()


# =====================================================================
# 6️⃣  GET ONE SHUTDOWN (PLACE AFTER /latest)
# =====================================================================
@router.get("/{shutdown_id}", response_model=models.ShutdownRecord)
async def get_one(shutdown_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(models.ShutdownRecordDB).where(models.ShutdownRecordDB.id == shutdown_id)
    )
    rec = res.scalars().first()

    if not rec:
        raise HTTPException(404, "Record not found.")

    return rec


# =====================================================================
# 7️⃣  PDF EXPORT
# =====================================================================
@router.get("/export/pdf")
async def export_shutdown_pdf(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    unit: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):

    q = select(models.ShutdownRecordDB).order_by(models.ShutdownRecordDB.datetime_from.asc())

    if start_date:
        q = q.where(models.ShutdownRecordDB.datetime_from >= datetime.combine(start_date, time.min))
    if end_date:
        q = q.where(models.ShutdownRecordDB.datetime_from <= datetime.combine(end_date, time.max))
    if unit:
        q = q.where(models.ShutdownRecordDB.unit == unit)

    res = await db.execute(q)
    records = res.scalars().all()

    if not records:
        raise HTTPException(404, "No shutdown records found.")

    # ---------- PDF ----------
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    content = []

    content.append(Paragraph("<b>Shutdown + Synchronisation Report</b>", styles["h1"]))

    table_data = [[
        "From", "To", "Unit", "Reason", "Duration",
        "Agency", "Sync Time", "Oil(KL)", "Coal(T)", "Import%", "Notes"
    ]]

    for r in records:
        table_data.append([
            r.datetime_from.strftime("%d-%m-%y %H:%M"),
            r.datetime_to.strftime("%d-%m-%y %H:%M") if r.datetime_to else "",
            r.unit,
            r.reason or "",
            r.duration or "",
            r.responsible_agency or "",
            r.sync_datetime.strftime("%d-%m-%y %H:%M") if r.sync_datetime else "",
            r.oil_used_kl or "",
            r.coal_t or "",
            r.import_percent or "",
            r.sync_notes or "",
        ])

    table = Table(table_data, repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
        ("GRID", (0,0), (-1,-1), 0.6, colors.black),
        ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE", (0,0), (-1,-1), 7),
    ]))

    content.append(table)
    doc.build(content)

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Shutdown_Report.pdf"}
    )

@router.get("/kpi/{unit}/{report_date}")
async def get_shutdown_kpis(
    unit: str,
    report_date: date,
    db: AsyncSession = Depends(get_db)
):
    start_of_day = datetime.combine(report_date, time.min)   # 00:00
    end_of_day = datetime.combine(report_date, time.max)     # 23:59:59

    q = select(models.ShutdownRecordDB).where(models.ShutdownRecordDB.unit == unit)
    res = await db.execute(q)
    records = res.scalars().all()

    total_shutdown_hr = 0.0
    planned_outage_hr = 0.0
    strategic_outage_hr = 0.0

    def overlap_hours(start, end):
        """Return number of hours between shutdown and report_date window."""
        if not start:
            return 0.0

        # If no end time → treat as ongoing → consider till end_of_day
        if not end:
            end = end_of_day

        # Compute overlapping interval
        s = max(start, start_of_day)
        e = min(end, end_of_day)

        if e <= s:
            return 0.0

        return (e - s).total_seconds() / 3600.0

    for r in records:

        hrs = overlap_hours(r.datetime_from, r.datetime_to)
        if hrs <= 0:
            continue

        total_shutdown_hr += hrs

        if r.shutdown_type and r.shutdown_type.lower() == "planned outage":
            planned_outage_hr += hrs

        if r.shutdown_type and r.shutdown_type.lower() == "strategic outage":
            strategic_outage_hr += hrs

    # Running hour = 24 minus shutdown hours
    running_hour = max(0.0, 24.0 - total_shutdown_hr)

    return {
        "running_hour": round(running_hour, 2),
        "plant_availability_percent": round((running_hour / 24.0) * 100, 2),
        "planned_outage_hour": round(planned_outage_hr, 2),
        "planned_outage_percent": round((planned_outage_hr / 24.0) * 100, 2),
        "strategic_outage_hour": round(strategic_outage_hr, 2),
        "strategic_outage_percent": round((strategic_outage_hr / 24.0) * 100, 2),
    }
