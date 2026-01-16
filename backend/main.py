# main.py
from fastapi import FastAPI, HTTPException, Depends, Body, Form, UploadFile, File, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocket



from datetime import datetime, date, timedelta, time
from typing import List, Optional
import io, os, shutil
from pathlib import Path

import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func
from sqlalchemy.dialects.sqlite import insert
from sqlalchemy.exc import IntegrityError

# Local imports (your files)
from database import get_db, create_tables, AsyncSessionLocal
import models
from models import (
    ShutdownRecordDB,
    RoleDB,
    UserDB,
    PermissionDB,Token,
    UserLogin,
    UserCreate,
    UserOut,
)
from dm.dm_models import DMEntryDB
from auth import (
    get_current_user,
    admin_required,
    require_role,
    login_for_access_token,
    hash_password,
    verify_password,
)

# If UPLOAD_DIR not in this module, create it here
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Logo path (same logic you used)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LOGO_PATH = os.path.join(BASE_DIR, "jsl-logo-guide.png")

app = FastAPI(title="PIMS System Backend - JWT + RBAC")




origins = [
    "http://localhost:4940",
    "http://localhost:5173",
    "http://143.143.1.5:4940",
    "https://143.143.1.5:443",
    "https://localhost:443",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4940",
        "http://localhost:5173",
        "http://143.143.1.5:4940",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers import messages
app.include_router(messages.router, prefix="/messages")

from oil.oil_router import router as oil_router
app.include_router(oil_router)

from routers.router_logic import router as logic_router
app.include_router(logic_router)

from routers import totalizers
app.include_router(totalizers.router)
from routers import totalizer_admin
app.include_router(totalizer_admin.router)

from routers import shutdowns
app.include_router(shutdowns.router)

from routers import dpr_router
app.include_router(dpr_router.router)

from routers.dpr_pdf_final import router as dpr_pdf_router
app.include_router(dpr_pdf_router)



from dm.dm_router import router as dm_router
app.include_router(dm_router)

from dm.chemical_routes import router as chemical_router
app.include_router(chemical_router)







@app.get("/")
def read_root():
    return {"message": "FastAPI (JWT) running successfully!"}

@app.on_event("startup")
async def on_startup():
    print("🔄 Initializing database...")
    await create_tables()

    # Open DB session
    async with AsyncSessionLocal() as db:
        
        # -----------------------------
        # 1️⃣ CREATE DEFAULT ROLES
        # -----------------------------
        default_roles = [
            ("OPERATION", "Operation department"),
            ("EMD", "Electrical maintenance"),
            ("MMD", "Mechanical maintenance"),
            ("C&I", "Control & Instrumentation"),
            ("DM_PLANT", "DM Plant"),
            ("VIEWER", "Read-only access"),
            ("HOD", "Head of Department"),
            ("ADMIN", "System Administrator"),
        ]

        # Fetch existing roles
        existing_roles = await db.execute(select(RoleDB))
        existing_roles = {r.name for r in existing_roles.scalars().all()}

        for role_name, desc in default_roles:
            if role_name not in existing_roles:
                db.add(RoleDB(name=role_name, description=desc))
                print(f"✅ Added role: {role_name}")

        await db.commit()

        # -----------------------------
        # 2️⃣ CREATE DEFAULT ADMIN USER
        # -----------------------------
        admin_username = "admin"
        admin_password = "pims@123"  # default password

        stmt = select(UserDB).where(UserDB.username == admin_username)
        result = await db.execute(stmt)
        admin_user = result.scalar_one_or_none()

        if not admin_user:
            # Get ADMIN role_id
            role_stmt = select(RoleDB).where(RoleDB.name == "ADMIN")
            role_res = await db.execute(role_stmt)
            admin_role = role_res.scalar_one()

            new_admin = UserDB(
                username=admin_username,
                password_hash=hash_password(admin_password),
                full_name="System Administrator",
                role_id=admin_role.id,
                is_active=True
            )

            db.add(new_admin)
            await db.commit()
            print("🎉 Default Admin user created!")

        else:
            print("ℹ️ Admin user already exists. Skipping creation.")

    print("🚀 Startup initialization complete.")

# ---------------------------
# AUTH ENDPOINT
# ---------------------------
@app.post("/api/auth/login", response_model=models.Token)
async def login_for_token(form_data: models.UserLogin, db: AsyncSession = Depends(get_db)):
    return await login_for_access_token(form_data, db)

# ---------------------------
# ADMIN: user & permission management
# ---------------------------
@app.post("/api/admin/users", dependencies=[Depends(admin_required)])
async def create_user_api(user: models.UserCreate, db: AsyncSession = Depends(get_db)):
    # check username unique
    stmt = select(models.UserDB).where(models.UserDB.username == user.username)
    res = await db.execute(stmt)
    existing = res.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")

    hashed = hash_password(user.password)
    db_user = models.UserDB(
        username=user.username,
        password_hash=hashed,
        full_name=user.full_name,
        role_id=user.role_id,
        is_active=True
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return {"message": "User created", "user_id": db_user.id}

@app.get("/api/admin/users", dependencies=[Depends(admin_required)])
async def list_users(db: AsyncSession = Depends(get_db)):
    stmt = select(models.UserDB)
    res = await db.execute(stmt)
    users = res.scalars().all()
    return [
        {"id": u.id, "username": u.username, "full_name": u.full_name, "role_id": u.role_id, "is_active": u.is_active}
        for u in users
    ]

@app.get("/api/admin/roles", dependencies=[Depends(admin_required)])
async def list_roles(db: AsyncSession = Depends(get_db)):
    stmt = select(models.RoleDB)
    res = await db.execute(stmt)
    roles = res.scalars().all()
    return [{"id": r.id, "name": r.name, "description": r.description} for r in roles]

@app.post("/api/admin/permissions", dependencies=[Depends(admin_required)])
async def set_permission(role_id: int = Form(...), field_name: str = Form(...), can_edit: bool = Form(...), can_view: bool = Form(...), db: AsyncSession = Depends(get_db)):
    # Upsert permission for role+field
    stmt = select(models.PermissionDB).where(models.PermissionDB.role_id == role_id, models.PermissionDB.field_name == field_name)
    res = await db.execute(stmt)
    perm = res.scalar_one_or_none()
    if perm:
        perm.can_edit = can_edit
        perm.can_view = can_view
        await db.commit()
        return {"message": "Permission updated"}
    else:
        p = models.PermissionDB(role_id=role_id, field_name=field_name, can_edit=can_edit, can_view=can_view)
        db.add(p)
        await db.commit()
        await db.refresh(p)
        return {"message": "Permission created", "id": p.id}

@app.get("/api/admin/permissions/{role_id}", dependencies=[Depends(admin_required)])
async def get_permissions_for_role(role_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(models.PermissionDB).where(models.PermissionDB.role_id == role_id)
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [{"field_name": i.field_name, "can_edit": i.can_edit, "can_view": i.can_view} for i in items]

@app.get("/api/permissions/me", dependencies=[Depends(get_current_user)])
async def get_my_permissions(db: AsyncSession = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    role_id = current_user.role_id
    stmt = select(models.PermissionDB).where(models.PermissionDB.role_id == role_id)
    res = await db.execute(stmt)
    items = res.scalars().all()
    return [{"field_name": i.field_name, "can_edit": i.can_edit, "can_view": i.can_view} for i in items]
@app.put("/api/admin/users/{user_id}/reset-password", dependencies=[Depends(admin_required)])
async def reset_password_api(
    user_id: int,
    new_password: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(UserDB).where(UserDB.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.password_hash = hash_password(new_password)

    await db.commit()
    return {"message": "Password reset successfully"}
@app.delete("/api/admin/users/{user_id}", dependencies=[Depends(admin_required)])
async def delete_user_api(user_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(UserDB).where(UserDB.id == user_id)
    res = await db.execute(stmt)
    user = res.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await db.delete(user)
    await db.commit()
    return {"message": "User deleted successfully"}
@app.post("/api/auth/change-password")
async def change_password(
    old_password: str = Body(...),
    new_password: str = Body(...),
    db: AsyncSession = Depends(get_db),
    current_user: UserDB = Depends(get_current_user)
):
    # Check if old password matches
    if not verify_password(old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Old password incorrect.")

    # Save new password
    current_user.password_hash = hash_password(new_password)
    await db.commit()

    return {"message": "Password updated successfully"}




# ---------------------------
# Helper: permission check
# ---------------------------
async def can_role_edit_field(role_id: int, field_name: str, db: AsyncSession) -> bool:
    """
    Field-level permission check.
    HOD (role_id==7) can edit everything.
    """
    if role_id == 7:
        return True
    stmt = select(models.PermissionDB).where(models.PermissionDB.role_id == role_id, models.PermissionDB.field_name == field_name)
    res = await db.execute(stmt)
    perm = res.scalar_one_or_none()
    if perm:
        return bool(perm.can_edit)
    return False

async def can_role_view_field(role_id: int, field_name: str, db: AsyncSession) -> bool:
    if role_id == 7:
        return True
    stmt = select(models.PermissionDB).where(models.PermissionDB.role_id == role_id, models.PermissionDB.field_name == field_name)
    res = await db.execute(stmt)
    perm = res.scalar_one_or_none()
    if perm:
        return bool(perm.can_view)
    # default: allow view
    return True

# ---------------------------
# REPORT ROUTES (Unit)
# ---------------------------

@app.get("/api/export/pdf/{report_date}", dependencies=[Depends(get_current_user)])
async def export_pdf(report_date: date, db: AsyncSession = Depends(get_db)):
    report_dt_start = datetime.combine(report_date, datetime.min.time())
    report_dt_end = report_dt_start + timedelta(days=1)
    unit_stmt = select(models.UnitReportDB).where(models.UnitReportDB.report_date >= report_dt_start, models.UnitReportDB.report_date < report_dt_end).order_by(models.UnitReportDB.unit)
    unit_result = await db.execute(unit_stmt)
    unit_reports_orm = unit_result.scalars().all()
    station_stmt = select(models.StationReportDB).where(models.StationReportDB.report_date == report_dt_start)
    station_result = await db.execute(station_stmt)
    station_report_orm = station_result.scalar_one_or_none()
    year = report_date.year; month = report_date.month
    monthly_stmt = select(models.MonthlyAggregateDB).where(models.MonthlyAggregateDB.year == year, models.MonthlyAggregateDB.month == month)
    monthly_result = await db.execute(monthly_stmt); monthly_aggs_orm = monthly_result.scalars().all()
    yearly_stmt = select(models.YearlyAggregateDB).where(models.YearlyAggregateDB.year == year)
    yearly_result = await db.execute(yearly_stmt); yearly_aggs_orm = yearly_result.scalars().all()
    station_monthly_stmt = select(models.StationMonthlyAggregateDB).where(models.StationMonthlyAggregateDB.year == year, models.StationMonthlyAggregateDB.month == month)
    station_monthly_result = await db.execute(station_monthly_stmt); station_monthly_data = station_monthly_result.scalar_one_or_none()
    station_yearly_stmt = select(models.StationYearlyAggregateDB).where(models.StationYearlyAggregateDB.year == year)
    station_yearly_result = await db.execute(station_yearly_stmt); station_yearly_data = station_yearly_result.scalar_one_or_none()
    if not unit_reports_orm and not station_report_orm:
        raise HTTPException(status_code=404, detail="No data found for PDF export.")

    unit_reports = [models.UnitReport.from_orm(r).dict() for r in unit_reports_orm]
    station_report = models.StationReport.from_orm(station_report_orm).dict() if station_report_orm else {}
    monthly_aggs_dict = {agg.unit: agg.__dict__ for agg in monthly_aggs_orm}
    yearly_aggs_dict = {agg.unit: agg.__dict__ for agg in yearly_aggs_orm}
    station_monthly_dict = station_monthly_data.__dict__ if station_monthly_data else {}
    station_yearly_dict = station_yearly_data.__dict__ if station_yearly_data else {}

    def get_unit_data_dict(data_list_of_dicts, unit_name):
        for item in data_list_of_dicts:
            if item.get("unit") == unit_name: return item
        return {}
    def format_val(value, precision=2, default="-"):
        if value is None: return default
        try: num = float(value)
        except (ValueError, TypeError): return default
        if precision == 0: return f"{num:.0f}"
        if precision == 1: return f"{num:.1f}"
        if precision == 3: return f"{num:.3f}"
        return f"{num:.2f}"

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

    parameters = [
        ("Generation in MU", "generation_mu", 'sum', 3),
        ("PLF %", "plf_percent", 'avg', 2),
        ("Running Hour", "running_hour", 'sum', 1),
        ("Plant availability Factor%", "plant_availability_percent", 'avg', 2),
        ("Planned Outage in Hour", "planned_outage_hour", 'sum', 1),
        ("Planned Outage %", "planned_outage_percent", 'avg', 2),
        ("Forced Outage in Hour", "forced_outage_hour", 'sum', 1),
        ("Forced Outage %", "forced_outage_percent", 'avg', 2),
        ("Strategic Outage in Hour", "strategic_outage_hour", 'sum', 1),
        ("Coal Consumption in T", "coal_consumption_t", 'sum', 2),
        ("Sp. Coal Consumption in kg/kwh", "sp_coal_consumption_kg_kwh", 'avg', 3),
        ("Average GCV of Coal in kcal/kg", "avg_gcv_coal_kcal_kg", 'avg', 0),
        ("Heat Rate in kcal/kwh", "heat_rate", 'avg', 0),
        ("LDO/HSD Consumption in KL", "ldo_hsd_consumption_kl", 'sum', 2),
        ("Specific Oil Consumption in ml/kwh", "sp_oil_consumption_ml_kwh", 'avg', 2),
        ("Aux. Power Consumption in MU", "aux_power_consumption_mu", 'sum', 3),
        ("% Aux. Power Consumption", "aux_power_percent", 'avg', 2),
        ("DM Water Consumption in Cu. M", "dm_water_consumption_cu_m", 'sum', 0),
        ("Specific DM Wtr. Consumption in %", "sp_dm_water_consumption_percent", 'avg', 2),
        ("Steam Gen (T)", "steam_gen_t", 'sum', 0),
        ("Sp. Steam Consumption in kg/kwh", "sp_steam_consumption_kg_kwh", 'avg', 2),
        ("Stack Emission (SPM) in mg/Nm3", "stack_emission_spm_mg_nm3", 'avg', 2),
    ]

    # Build PDF table and write it out (keeps your original formatting)
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, leftMargin=0.25*inch, rightMargin=0.25*inch, topMargin=0.25*inch, bottomMargin=0.25*inch)
    styles = getSampleStyleSheet()
    styles['h1'].alignment = 1
    styles['h1'].fontSize = 14

    # Header with logo
    if not os.path.exists(LOGO_PATH):
        raise HTTPException(status_code=500, detail=f"Logo file not found at {LOGO_PATH}.")
    img = Image(LOGO_PATH, height=0.35*inch, width=1.2*inch, hAlign='LEFT')
    title_text = f"<font color='{colors.dimgrey.hexval()}'>2*125 MW CPP DAILY PERFORMANCE REPORT</font> <font color='{colors.orange.hexval()}'>DATED: {report_date.strftime('%d-%m-%Y')}</font>"
    title_para = Paragraph(title_text, styles['h1'])
    header_table = Table([[img, title_para]], colWidths=[1.0*inch, 6.77*inch])
    header_table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'MIDDLE'), ('LEFTPADDING',(0,0),(0,0),0)]))
    story = [header_table, Spacer(1, 0.1*inch)]

    # build data rows (exact same logic as you had)
    # ... omitted here for brevity in this file listing, but keep the same logic for table creation as you provided earlier ...
    # For full fidelity, include your original code block that builds `data`, `table`, and doc.build(story).
    data = [
        [
            "Parameter", 
            "Unit-1 (Day)", "Unit-1 (Month)", "Unit-1 (Year)",
            "Unit-2 (Day)", "Unit-2 (Month)", "Unit-2 (Year)",
            "Station (Day)", "Station (Month)", "Station (Year)"
        ]
    ]

    # Generate all parameter rows
    for title, field, agg_type, prec in parameters:
        u1_day = unit1_daily.get(field)
        u1_month = unit1_monthly.get(field)
        u1_year = unit1_yearly.get(field)

        u2_day = unit2_daily.get(field)
        u2_month = unit2_monthly.get(field)
        u2_year = unit2_yearly.get(field)

        station_values = calc_station_agg(field, agg_type, prec)

        data.append([
            title,
            format_val(u1_day, prec),
            format_val(u1_month, prec),
            format_val(u1_year, prec),
            format_val(u2_day, prec),
            format_val(u2_month, prec),
            format_val(u2_year, prec),
            station_values["day"],
            station_values["month"],
            station_values["year"]
        ])

    # Table style + column widths EXACTLY same as original
    col_widths = [
        2.5 * inch,   # Parameter name
        0.75 * inch, 0.75 * inch, 0.75 * inch,  # U1 day/month/year
        0.75 * inch, 0.75 * inch, 0.75 * inch,  # U2 day/month/year
        0.75 * inch, 0.75 * inch, 0.75 * inch   # Station day/month/year
    ]

    table = Table(data, colWidths=col_widths)

    table_style = TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
        ('ALIGN', (1, 1), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 0.25, colors.black),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
        ('RIGHTPADDING', (0,0), (-1,-1), 4),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2)
    ])

    table.setStyle(table_style)

    story.append(table)

    # Final spacing at bottom
    story.append(Spacer(1, 0.2 * inch))
    

    # Finalize PDF
    doc.build(story)
    buffer.seek(0)
    return StreamingResponse(buffer, media_type="application/pdf", headers={"Content-Disposition": f"attachment; filename=report_{report_date}.pdf"})


from apscheduler.schedulers.asyncio import AsyncIOScheduler
from database import AsyncSessionLocal
from routers.shutdowns import check_auto_notifications

scheduler = AsyncIOScheduler()

async def scheduled_check():
    async with AsyncSessionLocal() as session:
        await check_auto_notifications(session)

scheduler.add_job(scheduled_check, "interval", minutes=5)   # 1 min for testing
scheduler.start()

