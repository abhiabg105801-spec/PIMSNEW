from fastapi import (
    APIRouter, Depends, HTTPException, Form, File, UploadFile, Query
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, date, time, timedelta
from pathlib import Path
import shutil
import io
import re

import models
from database import get_db
from auth import get_current_user
from fastapi.responses import StreamingResponse

from crud.messages import create_message
from routers.messages import manager   # websocket broadcast

from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors

from database import async_session_maker
UPLOAD_DIR = Path("uploads/rca")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

router = APIRouter(
    prefix="/api/shutdowns",
    tags=["Shutdown Log"]
)

# -----------------------------------------------------------
# UTIL – MORE ROBUST DURATION STRING TO HOURS
# -----------------------------------------------------------
def duration_to_hours(val: str) -> float:
    if not val:
        return 0.0

    s = val.strip().upper()

    # HH:MM format
    if ":" in s:
        try:
            hh, mm = s.split(":")
            return int(hh) + int(mm)/60
        except:
            return 0.0

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

    matches = re.findall(r"(\d+\.?\d*)\s*(D|H|M)", s)
    if matches:
        total = 0
        for num, unit in matches:
            num = float(num)
            if unit == "D":
                total += num * 24
            elif unit == "H":
                total += num
            elif unit == "M":
                total += num / 60
        return total

    try:
        return float(s)
    except:
        return 0.0


# =====================================================================
# 1️⃣  CREATE SHUTDOWN
# =====================================================================
@router.post("/", response_model=models.ShutdownRecord, status_code=201)
async def create_shutdown_record(
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

        why_why_done=why_why_done,
        why_why_done_at=datetime.now() if why_why_done else None,

        rca_file_path=rca_path,

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
# 2️⃣  ADD / UPDATE SYNCHRONISATION
# =====================================================================
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

    if current_user.role_id == 6:
        raise HTTPException(403, "Viewer cannot update sync.")

    res = await db.execute(
        select(models.ShutdownRecordDB).where(models.ShutdownRecordDB.id == shutdown_id)
    )
    record = res.scalars().first()
    if not record:
        raise HTTPException(404, "Shutdown record not found.")

    # UPDATE SYNC FIELDS
    record.sync_datetime = sync_datetime
    record.datetime_to = sync_datetime
    record.sync_shift_incharge = sync_shift_incharge
    record.oil_used_kl = oil_used_kl
    record.coal_t = coal_t
    record.oil_stabilization_kl = oil_stabilization_kl
    record.import_percent = import_percent
    record.sync_notes = sync_notes

    # RECALCULATE DURATION
    if record.datetime_from:
        diff = (record.datetime_to - record.datetime_from).total_seconds()
        total_min = int(diff // 60)
        hours = total_min // 60
        mins = total_min % 60
        days = hours // 24
        hours = hours % 24

        record.duration = (f"{days}d {hours}h {mins}m"
                           if days > 0 else f"{hours}h {mins}m")
    else:
        record.duration = None

    await db.commit()
    await db.refresh(record)
    return record


# =====================================================================
# 3️⃣  EDIT SHUTDOWN (recalculate duration if sync exists)
# =====================================================================
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

    if current_user.role_id == 6:
        raise HTTPException(403, "Viewer cannot update shutdown records.")

    res = await db.execute(
        select(models.ShutdownRecordDB).where(models.ShutdownRecordDB.id == shutdown_id)
    )
    record = res.scalars().first()
    if not record:
        raise HTTPException(404, "Shutdown record not found.")

    # UPDATE BASE FIELDS
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

    # Why-Why checkbox
    if why_why_done:
        record.why_why_done = True
        record.why_why_done_at = datetime.now()

    # ---------- Optional file upload ----------
    if rca_file:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe = "".join(c if c.isalnum() else "_" for c in rca_file.filename)
        fname = f"{ts}_{safe}"
        dest = UPLOAD_DIR / fname
        with dest.open("wb") as buf:
            shutil.copyfileobj(rca_file.file, buf)
        record.rca_file_path = str(dest)

    # ---------- RECALCULATE DURATION IF SYNC EXISTS ----------
    if record.datetime_to:
        diff = (record.datetime_to - record.datetime_from).total_seconds()
        total_min = int(diff // 60)
        hours = total_min // 60
        mins = total_min % 60
        days = hours // 24
        hours = hours % 24

        record.duration = (f"{days}d {hours}h {mins}m"
                           if days > 0 else f"{hours}h {mins}m")

    await db.commit()
    await db.refresh(record)
    return record


# =====================================================================
# 4️⃣  LAST 5 SHUTDOWNS
# =====================================================================
@router.get("/latest", response_model=list[models.ShutdownRecord])
async def latest_shutdowns(db: AsyncSession = Depends(get_db)):
    q = select(models.ShutdownRecordDB).order_by(desc(models.ShutdownRecordDB.id)).limit(5)
    res = await db.execute(q)
    return res.scalars().all()
# =====================================================================
# 5️⃣  LIST SHUTDOWNS (FILTERED)
# =====================================================================
@router.get("/", response_model=list[models.ShutdownRecord])
async def list_shutdowns(
    start_date: date = Query(None),
    end_date: date = Query(None),
    unit: str = Query(None),
    db: AsyncSession = Depends(get_db)
):

    q = select(models.ShutdownRecordDB).order_by(
        desc(models.ShutdownRecordDB.datetime_from)
    )

    if start_date:
        q = q.where(models.ShutdownRecordDB.datetime_from >= datetime.combine(start_date, time.min))

    if end_date:
        q = q.where(models.ShutdownRecordDB.datetime_from <= datetime.combine(end_date, time.max))

    if unit:
        q = q.where(models.ShutdownRecordDB.unit == unit)

    res = await db.execute(q)
    return res.scalars().all()


# =====================================================================
# 6️⃣  GET ONE SHUTDOWN
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
async def export_pdf(
    start_date: date = Query(None),
    end_date: date = Query(None),
    unit: str = Query(None),
    db: AsyncSession = Depends(get_db)
):
    q = select(models.ShutdownRecordDB).order_by(
        models.ShutdownRecordDB.datetime_from.asc()
    )

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

    # ---- PDF ----
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4)
    styles = getSampleStyleSheet()

    story = []
    story.append(Paragraph("<b>Shutdown + Synchronisation Report</b>", styles["h1"]))

    table_data = [[
        "From", "To", "Unit", "Reason", "Duration",
        "Agency", "Sync Time", "Oil KL", "Coal T", "Import%", "Notes"
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

    story.append(table)
    doc.build(story)

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=Shutdown_Report.pdf"}
    )


# =====================================================================
# 8️⃣  KPI CALCULATION (WITH ONGOING SHUTDOWN LOGIC)
# =====================================================================
@router.get("/kpi/{unit}/{report_date}")
async def get_shutdown_kpis(
    unit: str,
    report_date: date,
    db: AsyncSession = Depends(get_db)
):
    start_day = datetime.combine(report_date, time.min)
    end_day = datetime.combine(report_date, time.max)

    # fetch all record of this unit
    q = select(models.ShutdownRecordDB).where(models.ShutdownRecordDB.unit == unit)
    res = await db.execute(q)
    records = res.scalars().all()

    total_shutdown = 0.0
    planned = 0.0
    strategic = 0.0

    def overlap(start, end):
        """shutdown overlapping hours with report date"""
        if not start:
            return 0.0

        # ongoing shutdown (no sync yet)
        if not end:
            end = end_day

        s = max(start, start_day)
        e = min(end, end_day)
        if e <= s:
            return 0.0

        return (e - s).total_seconds() / 3600.0

    for r in records:
        hrs = overlap(r.datetime_from, r.datetime_to)
        if hrs <= 0:
            continue

        total_shutdown += hrs

        if r.shutdown_type == "Planned Outage":
            planned += hrs

        if r.shutdown_type == "Strategic Outage":
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


# =====================================================================
# 9️⃣  AUTO NOTIFICATIONS (FORCED OUTAGE ONLY)
# =====================================================================
async def check_auto_notifications(db: AsyncSession):

    now = datetime.now()
    two_min_ago = now - timedelta(minutes=1)
    five_min_ago = now - timedelta(minutes=3)

    q = select(models.ShutdownRecordDB).where(
        models.ShutdownRecordDB.shutdown_type == "Forced Outage"
    )
    res = await db.execute(q)
    forced = res.scalars().all()

    for r in forced:

        # ---------- Case 1 → Notification missing ----------
        if (r.notification_no is None or r.notification_no.strip() == ""):
            if r.datetime_from <= two_min_ago:

                msg = await create_message(
                    db,
                    "system",
                    f"⚠ Notification No. missing for Forced Outage on {r.datetime_from} ({r.unit})."
                )

                await manager.broadcast({
                    "type": "message:new",
                    "message": {
                        "id": msg.id,
                        "username": msg.username,
                        "content": msg.content,
                        "created_at": msg.created_at.isoformat(),
                        "pinned": False
                    }
                })


        # ---------- Case 2 → Why-Why missing ----------
        if not getattr(r, "why_why_done", False):
            if r.datetime_from <= five_min_ago:

                msg = await create_message(
                    db,
                    "system",
                    f"⚠ Why-Why Analysis NOT completed for Forced Outage on {r.datetime_from} ({r.unit})."
                )

                await manager.broadcast({
                    "type": "message:new",
                    "message": {
                        "id": msg.id,
                        "username": msg.username,
                        "content": msg.content,
                        "created_at": msg.created_at.isoformat(),
                        "pinned": False
                    }
                })
