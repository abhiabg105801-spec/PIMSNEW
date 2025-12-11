from fastapi import APIRouter, Depends, HTTPException, Form, File, UploadFile, Query, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, and_, or_
from datetime import datetime, date, time, timedelta
from pathlib import Path
import shutil
import io
import asyncio

import models
from database import get_db
from auth import get_current_user
from crud.messages import create_message
from routers.messages import manager

# ReportLab Imports
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

UPLOAD_DIR = Path("uploads/rca")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Configuration
VIEWER_ROLE_ID = 6
FORCED_OUTAGE = "Forced Outage"

router = APIRouter(
    prefix="/api/shutdowns",
    tags=["Shutdown Log"]
)

# -----------------------------------------------------------
# UTIL: Duration Formatting (Centralized)
# -----------------------------------------------------------
def format_duration(start: datetime, end: datetime) -> str:
    if not start or not end:
        return None
    
    diff = (end - start).total_seconds()
    if diff < 0: return "0h 0m"

    total_min = int(diff // 60)
    hours = total_min // 60
    mins = total_min % 60
    days = hours // 24
    hours = hours % 24

    if days > 0:
        return f"{days}d {hours}h {mins}m"
    return f"{hours}h {mins}m"

# -----------------------------------------------------------
# 1️⃣ CREATE SHUTDOWN
# -----------------------------------------------------------
@router.post("/", response_model=models.ShutdownRecord, status_code=201)
async def create_shutdown_record(
    unit: str = Form(...),
    shutdown_type: str = Form(...),
    datetime_from: datetime = Form(...),
    
    # Optional fields
    responsible_agency: str = Form(None),
    reason: str = Form(None),
    remarks: str = Form(None),
    shift_incharge: str = Form(None),
    pretrip_status: str = Form(None),
    first_cause: str = Form(None),
    action_taken: str = Form(None),
    restoration_sequence: str = Form(None),
    notification_no: str = Form(None),
    why_why_done: bool = Form(False),
    
    rca_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user)
):
    if current_user.role_id == VIEWER_ROLE_ID:
        raise HTTPException(403, "Viewer cannot create shutdown records.")

    # Async File Write
    rca_path = None
    if rca_file:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_name = "".join(c if c.isalnum() else "_" for c in rca_file.filename)
        fname = f"{ts}_{safe_name}"
        dest = UPLOAD_DIR / fname
        
        # Non-blocking file write
        content = await rca_file.read()
        await asyncio.to_thread(dest.write_bytes, content)
        rca_path = str(dest)

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
        why_why_done=why_why_done,
        why_why_done_at=datetime.now() if why_why_done else None,
        rca_file_path=rca_path
    )

    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record

# -----------------------------------------------------------
# 2️⃣ UPDATE SYNC DETAILS
# -----------------------------------------------------------
@router.put("/{shutdown_id}/sync", response_model=models.ShutdownRecord)
async def update_sync_details(
    shutdown_id: int,
    sync_datetime: datetime = Form(...),
    sync_shift_incharge: str = Form(None),
    oil_used_kl: float = Form(None),
    coal_t: float = Form(None),
    oil_stabilization_kl: float = Form(None),
    import_percent: float = Form(None),
    sync_notes: str = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user)
):
    if current_user.role_id == VIEWER_ROLE_ID:
        raise HTTPException(403, "Viewer cannot update sync.")

    record = await db.get(models.ShutdownRecordDB, shutdown_id)
    if not record:
        raise HTTPException(404, "Record not found.")

    record.sync_datetime = sync_datetime
    record.datetime_to = sync_datetime
    record.sync_shift_incharge = sync_shift_incharge
    record.oil_used_kl = oil_used_kl
    record.coal_t = coal_t
    record.oil_stabilization_kl = oil_stabilization_kl
    record.import_percent = import_percent
    record.sync_notes = sync_notes
    
    # Use centralized helper
    record.duration = format_duration(record.datetime_from, record.datetime_to)

    await db.commit()
    await db.refresh(record)
    return record

# -----------------------------------------------------------
# 3️⃣ EDIT SHUTDOWN (Generic)
# -----------------------------------------------------------
@router.put("/{shutdown_id}", response_model=models.ShutdownRecord)
async def edit_shutdown(
    shutdown_id: int,
    unit: str = Form(...),
    shutdown_type: str = Form(...),
    datetime_from: datetime = Form(...),
    responsible_agency: str = Form(None),
    reason: str = Form(None),
    remarks: str = Form(None),
    shift_incharge: str = Form(None),
    pretrip_status: str = Form(None),
    first_cause: str = Form(None),
    action_taken: str = Form(None),
    restoration_sequence: str = Form(None),
    notification_no: str = Form(None),
    why_why_done: bool = Form(False),
    rca_file: UploadFile = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user),
):
    if current_user.role_id == VIEWER_ROLE_ID:
        raise HTTPException(403, "Forbidden")

    record = await db.get(models.ShutdownRecordDB, shutdown_id)
    if not record:
        raise HTTPException(404, "Record not found")

    # Update basic fields
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

    if why_why_done and not record.why_why_done:
        record.why_why_done = True
        record.why_why_done_at = datetime.now()
    elif not why_why_done:
        record.why_why_done = False
        record.why_why_done_at = None

    if rca_file:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe = "".join(c if c.isalnum() else "_" for c in rca_file.filename)
        fname = f"{ts}_{safe}"
        dest = UPLOAD_DIR / fname
        content = await rca_file.read()
        await asyncio.to_thread(dest.write_bytes, content)
        record.rca_file_path = str(dest)

    # Recalculate duration if sync exists
    if record.datetime_to:
        record.duration = format_duration(record.datetime_from, record.datetime_to)

    await db.commit()
    await db.refresh(record)
    return record

# -----------------------------------------------------------
# 4️⃣ & 5️⃣ LIST & LATEST
# -----------------------------------------------------------
@router.get("/latest", response_model=list[models.ShutdownRecord])
async def latest_shutdowns(db: AsyncSession = Depends(get_db)):
    q = select(models.ShutdownRecordDB).order_by(desc(models.ShutdownRecordDB.id)).limit(5)
    return (await db.execute(q)).scalars().all()

@router.get("/", response_model=list[models.ShutdownRecord])
async def list_shutdowns(
    start_date: date = Query(None),
    end_date: date = Query(None),
    unit: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    q = select(models.ShutdownRecordDB).order_by(desc(models.ShutdownRecordDB.datetime_from))
    
    if start_date:
        q = q.where(models.ShutdownRecordDB.datetime_from >= datetime.combine(start_date, time.min))
    if end_date:
        q = q.where(models.ShutdownRecordDB.datetime_from <= datetime.combine(end_date, time.max))
    if unit:
        q = q.where(models.ShutdownRecordDB.unit == unit)

    return (await db.execute(q)).scalars().all()

# -----------------------------------------------------------
# 6️⃣ GET ONE
# -----------------------------------------------------------
@router.get("/{shutdown_id}", response_model=models.ShutdownRecord)
async def get_one(shutdown_id: int, db: AsyncSession = Depends(get_db)):
    record = await db.get(models.ShutdownRecordDB, shutdown_id)
    if not record:
        raise HTTPException(404, "Not found")
    return record

# -----------------------------------------------------------
# 7️⃣ PDF EXPORT (Blocking code moved to thread)
# -----------------------------------------------------------
def generate_pdf_sync(records):
    """Synchronous reportlab generation."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()
    story = [Paragraph("<b>Shutdown + Synchronisation Report</b>", styles["h1"])]

    table_data = [[
        "From", "To", "Unit", "Reason", "Dur.",
        "Agency", "Sync", "Oil", "Coal"
    ]]

    for r in records:
        table_data.append([
            r.datetime_from.strftime("%d-%m %H:%M"),
            r.datetime_to.strftime("%d-%m %H:%M") if r.datetime_to else "-",
            r.unit,
            (r.reason or "")[:20], # Truncate for table
            r.duration or "",
            r.responsible_agency or "",
            r.sync_datetime.strftime("%d-%m %H:%M") if r.sync_datetime else "-",
            str(r.oil_used_kl or ""),
            str(r.coal_t or ""),
        ])

    t = Table(table_data, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,0), colors.lightgrey),
        ("GRID", (0,0), (-1,-1), 0.5, colors.black),
        ("FONTSIZE", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2),
    ]))
    story.append(t)
    doc.build(story)
    buffer.seek(0)
    return buffer

@router.get("/export/pdf")
async def export_pdf(
    start_date: date = Query(None),
    end_date: date = Query(None),
    unit: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    q = select(models.ShutdownRecordDB).order_by(models.ShutdownRecordDB.datetime_from.asc())
    if start_date: q = q.where(models.ShutdownRecordDB.datetime_from >= datetime.combine(start_date, time.min))
    if end_date: q = q.where(models.ShutdownRecordDB.datetime_from <= datetime.combine(end_date, time.max))
    if unit: q = q.where(models.ShutdownRecordDB.unit == unit)

    records = (await db.execute(q)).scalars().all()
    if not records:
        raise HTTPException(404, "No records")

    # Run blocking PDF generation in thread pool
    buffer = await asyncio.to_thread(generate_pdf_sync, records)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Shutdown_Report.pdf"}
    )

# -----------------------------------------------------------
# 8️⃣ KPI CALCULATION (Optimized)
# -----------------------------------------------------------
@router.get("/kpi/{unit}/{report_date}")
async def get_shutdown_kpis(
    unit: str,
    report_date: date,
    db: AsyncSession = Depends(get_db)
):
    start_day = datetime.combine(report_date, time.min)
    end_day = datetime.combine(report_date, time.max)

    # OPTIMIZATION: Only fetch records that overlap with this specific day
    # Logic: Start <= EndOfDay AND (End >= StartOfDay OR End is NULL)
    q = select(models.ShutdownRecordDB).where(
        models.ShutdownRecordDB.unit == unit,
        models.ShutdownRecordDB.datetime_from <= end_day,
        or_(
            models.ShutdownRecordDB.datetime_to >= start_day,
            models.ShutdownRecordDB.datetime_to.is_(None)
        )
    )
    
    res = await db.execute(q)
    records = res.scalars().all()

    total_shutdown = 0.0
    planned = 0.0
    strategic = 0.0

    for r in records:
        # Calculate overlap hours
        # Use existing start_day/end_day bounds
        s = max(r.datetime_from, start_day)
        e = min(r.datetime_to or end_day, end_day) # if ongoing, use end_day
        
        if e > s:
            hrs = (e - s).total_seconds() / 3600.0
            total_shutdown += hrs
            
            if r.shutdown_type == "Planned Outage":
                planned += hrs
            elif r.shutdown_type == "Strategic Outage":
                strategic += hrs

    running = max(0.0, 24.0 - total_shutdown)

    return {
        "running_hour": round(running, 2),
        "plant_availability_percent": round((running / 24) * 100, 2),
        "planned_outage_hour": round(planned, 2),
        "planned_outage_percent": round((planned / 24) * 100, 2),
        "strategic_outage_hour": round(strategic, 2),
        "strategic_outage_percent": round((strategic / 24) * 100, 2),
    }

# -----------------------------------------------------------
# 9️⃣ AUTO NOTIFICATIONS (Fixing Infinite Loop)
# -----------------------------------------------------------
# Note: This function should ideally be called by a scheduler (like Celery/APScheduler)
# For now, if we assume it's called periodically, we must filter strictly.

async def check_auto_notifications(db: AsyncSession):
    now = datetime.now()
    
    # We define a "Check Window" (e.g., outages created between 2 and 5 minutes ago)
    # This ensures we don't alert for hours-old outages repeatedly,
    # and we don't need a DB flag if the scheduler frequency matches the window.
    # Ideally, add 'notification_sent' bool column to DB for robustness.
    
    window_start = now - timedelta(minutes=5)
    window_end = now - timedelta(minutes=1)

    # Fetch Forced Outages in this specific time window
    q = select(models.ShutdownRecordDB).where(
        models.ShutdownRecordDB.shutdown_type == FORCED_OUTAGE,
        models.ShutdownRecordDB.datetime_from >= window_start,
        models.ShutdownRecordDB.datetime_from <= window_end
    )
    
    res = await db.execute(q)
    forced_records = res.scalars().all()

    for r in forced_records:
        # 1. Check Notification No
        if not r.notification_no:
            # Send Alert
            await send_broadcast_alert(db, f"⚠ Notification No. missing for Forced Outage: {r.unit} ({r.datetime_from})")

        # 2. Check Why-Why Analysis
        if not getattr(r, "why_why_done", False):
             # You might want a wider window for Why-Why (e.g., 24 hours), 
             # so a simple time window check might not be enough here.
             # Recommended: Add `why_why_alert_sent` column to DB.
             pass

async def send_broadcast_alert(db, content: str):
    """Helper to create DB message and broadcast via WS"""
    msg = await create_message(db, "system", content)
    await manager.broadcast({
        "type": "message:new",
        "message": {
            "id": msg.id,
            "username": "system",
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
            "pinned": False
        }
    })