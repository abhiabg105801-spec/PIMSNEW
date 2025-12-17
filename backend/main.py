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
    UnitReportDB,
    StationReportDB,
    MonthlyAggregateDB,
    YearlyAggregateDB,
    StationMonthlyAggregateDB,
    StationYearlyAggregateDB,
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
    allow_origins=["*"],
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

from routers import shutdowns
app.include_router(shutdowns.router)
from routers import dpr
app.include_router(dpr.router)

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

@app.post("/api/reports/", status_code=201, dependencies=[Depends(get_current_user)])
async def add_or_update_report(
    report: models.UnitReport,
    db: AsyncSession = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user)
):
    """
    Create or update unit report.
    Rules:
     - If modifying originally-filled fields -> edit password required (unless HOD)
     - If only filling previously NULL fields -> no password required
     - Field-level edit permission enforced per role
     - VIEWER (role_id==6) is read-only (cannot POST/PUT)
    """

    # Block VIEWER from writes
    if current_user.role_id == 6:
        raise HTTPException(status_code=403, detail="Viewer role cannot modify data.")

    report_datetime = datetime.combine(report.report_date, datetime.min.time())
    edit_password = report.edit_password

    stmt = select(models.UnitReportDB).where(models.UnitReportDB.unit == report.unit, models.UnitReportDB.report_date == report_datetime)
    res = await db.execute(stmt)
    existing_report = res.scalar_one_or_none()

    report_dict = report.dict(exclude_unset=True, exclude_none=True, exclude={"edit_password"})
    report_dict["report_date"] = report_datetime

    # Compare to detect changes
    if existing_report is None:
        # New record: still check field-level permission for new fields (if role doesn't allow editing those fields)
        for k, v in report_dict.items():
            if k in ("unit", "report_date"): continue
            # new value present and not null
            if v is not None:
                allowed = await can_role_edit_field(current_user.role_id, k, db)
                if not allowed:
                    raise HTTPException(status_code=403, detail=f"You do not have permission to set '{k}'.")
        # create
        db_obj = models.UnitReportDB(**report_dict)
        db.add(db_obj)
        try:
            await db.commit()
            await db.refresh(db_obj)
            pyd_report = models.UnitReport.from_orm(db_obj)
            await update_aggregates(pyd_report, db)
            return {"message": "Report added successfully"}
        except IntegrityError:
            await db.rollback()
            raise HTTPException(status_code=400, detail="Report for this unit/date already exists.")
        except Exception as e:
            await db.rollback()
            print("Error creating report:", e)
            raise HTTPException(status_code=500, detail="Could not save report.")
    else:
        changed_fields = []

    for field, new_value in report_dict.items():
        if field in ("unit", "report_date"):
            continue

        old_value = getattr(existing_report, field, None)

        if new_value == old_value:
            continue

        changed_fields.append(field)

        allowed = await can_role_edit_field(current_user.role_id, field, db)
        if not allowed:
            raise HTTPException(
                status_code=403,
                detail=f"You do not have permission to edit '{field}'."
            )

        if current_user.role_id not in (7, 8):
            if old_value not in (None, "", 0):
                raise HTTPException(
                    status_code=403,
                    detail=f"Only admin can edit existing data for field '{field}'."
                )

        # If nothing changed -> refresh aggregates
        if len(changed_fields) == 0:
            pyd = models.UnitReport.from_orm(existing_report)
            await update_aggregates(pyd, db)
            return {"message": "No values changed. Aggregates refreshed."}

        # perform update
        update_payload = {k: v for k, v in report_dict.items() if k not in ("unit", "report_date")}
        stmt = update(models.UnitReportDB).where(models.UnitReportDB.id == existing_report.id).values(**update_payload)
        await db.execute(stmt)
        await db.commit()
        updated = await db.get(models.UnitReportDB, existing_report.id)
        if updated:
            pyd = models.UnitReport.from_orm(updated)
            await update_aggregates(pyd, db)
        return {"message": "Report updated successfully"}


@app.get("/api/reports/single/{unit}/{report_date}", response_model=models.UnitReport, dependencies=[Depends(get_current_user)])
async def get_single_report(unit: str, report_date: date, db: AsyncSession = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    report_datetime = datetime.combine(report_date, datetime.min.time())
    stmt = select(models.UnitReportDB).where(models.UnitReportDB.unit == unit, models.UnitReportDB.report_date == report_datetime)
    res = await db.execute(stmt)
    report = res.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="No record found for this date/unit.")
    # Optionally enforce view permissions per field - skipped to keep response shape same
    return report

@app.get("/api/reports/range", dependencies=[Depends(get_current_user)])
async def get_reports_by_range(
    start_date: str = Query(...),
    end_date: str = Query(...),
    units: str = Query(...),
    kpis: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: models.UserDB = Depends(get_current_user)
):
    try:
        start_dt = datetime.combine(date.fromisoformat(start_date.strip()), datetime.min.time())
        end_dt = datetime.combine(date.fromisoformat(end_date.strip()), datetime.max.time())
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid date format. Use YYYY-MM-DD.")

    unit_list = [u.strip() for u in units.split(',') if u.strip()]
    if not unit_list:
        raise HTTPException(status_code=400, detail="Invalid 'units' format. Must be comma-separated.")

    kpi_list = [k.strip() for k in kpis.split(',') if k.strip()]
    valid_columns = [col.name for col in models.UnitReportDB.__table__.columns]
    selected_columns = [models.UnitReportDB.unit, models.UnitReportDB.report_date]

    for k in kpi_list:
        if k in valid_columns and k not in ("id", "edit_password"):
            selected_columns.append(getattr(models.UnitReportDB, k))

    stmt = (
        select(*selected_columns)
        .where(
            models.UnitReportDB.unit.in_(unit_list),
            models.UnitReportDB.report_date.between(start_dt, end_dt)
        )
        .order_by(models.UnitReportDB.report_date)
    )

    result = await db.execute(stmt)
    rows = result.all()

    data = []
    for row in rows:
        record = dict(zip([col.key for col in selected_columns], row))
        if isinstance(record["report_date"], datetime):
            record["report_date"] = record["report_date"].date().isoformat()
        data.append(record)
    return data


@app.get("/api/reports/{report_date}", response_model=List[models.UnitReport], dependencies=[Depends(get_current_user)])
async def get_reports_by_date(report_date: date, db: AsyncSession = Depends(get_db)):
    report_dt_start = datetime.combine(report_date, datetime.min.time())
    report_dt_end = report_dt_start + timedelta(days=1)
    stmt = select(models.UnitReportDB).where(models.UnitReportDB.report_date >= report_dt_start, models.UnitReportDB.report_date < report_dt_end).order_by(models.UnitReportDB.unit)
    result = await db.execute(stmt)
    reports = result.scalars().all()
    if not reports:
        return []
    return reports

# ---------------------------
# STATION REPORTS
# ---------------------------
@app.get("/api/reports/station/{report_date}", response_model=models.StationReport, dependencies=[Depends(get_current_user)])
async def get_station_report(report_date: date, db: AsyncSession = Depends(get_db)):
    report_datetime = datetime.combine(report_date, datetime.min.time())
    stmt = select(models.StationReportDB).where(models.StationReportDB.report_date == report_datetime)
    res = await db.execute(stmt)
    r = res.scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="No station record found for this date.")
    return r

@app.post("/api/reports/station/", status_code=201, dependencies=[Depends(get_current_user)])
async def add_or_update_station_report(report: models.StationReport, db: AsyncSession = Depends(get_db), current_user: models.UserDB = Depends(get_current_user)):
    
    report_datetime = datetime.combine(report.report_date, datetime.min.time())
    report_dict_for_db = report.dict(exclude_unset=True, exclude_none=True, exclude={'report_date'})
    report_dict_for_db['report_date'] = report_datetime
    
    # -------------------------------------------------------
# ADMIN/HOD-ONLY edit check for existing station data
# -------------------------------------------------------

# Check if a record already exists for this date
    stmt = select(models.StationReportDB).where(models.StationReportDB.report_date == report_datetime)
    res = await db.execute(stmt)
    existing_station = res.scalar_one_or_none()

    if existing_station:
    # Editing existing data
      if current_user.role_id not in (7, 8):  # HOD OR ADMIN
        raise HTTPException(
            status_code=403,
            detail="Only admin can edit existing station data."
        )
# If no existing data → any role can add new data

    insert_stmt = insert(models.StationReportDB).values(**report_dict_for_db)
    update_dict = {col.name: getattr(insert_stmt.excluded, col.name) for col in models.StationReportDB.__table__.columns if not col.primary_key and not col.unique}
    upsert_stmt = insert_stmt.on_conflict_do_update(index_elements=['report_date'], set_=update_dict)

    try:
        await db.execute(upsert_stmt)
        await db.commit()
        await update_station_aggregates(report, db)
        return {"message": "Station report added or updated successfully"}
    except Exception as e:
        await db.rollback()
        print(f"Error upserting station report: {e}")
        raise HTTPException(status_code=500, detail="Could not save station report.")

# ---------------------------
# SHUTDOWN LOGS
# ---------------------------


# ---------------------------
# AGGREGATION & EXPORT (Unit-level)
# ---------------------------
async def update_aggregates(report: models.UnitReport, db: AsyncSession):
    if not isinstance(report.report_date, date):
        print("CRITICAL: report_date is not date")
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
        monthly_stmt = select(*aggregation_cols).select_from(models.UnitReportDB).where(models.UnitReportDB.unit == unit, models.UnitReportDB.report_date >= month_start_dt, models.UnitReportDB.report_date <= report_datetime_end).group_by(models.UnitReportDB.unit)
        monthly_result = await db.execute(monthly_stmt)
        monthly_data = monthly_result.mappings().first()
        if monthly_data:
            monthly_values = {**monthly_data, "unit": unit, "year": year, "month": month}
            monthly_insert_stmt = insert(models.MonthlyAggregateDB).values(**monthly_values)
            monthly_update_dict = {k: getattr(monthly_insert_stmt.excluded, k) for k in monthly_data.keys()}
            monthly_upsert_stmt = monthly_insert_stmt.on_conflict_do_update(index_elements=['unit', 'year', 'month'], set_=monthly_update_dict)
            await db.execute(monthly_upsert_stmt)

        yearly_stmt = select(*aggregation_cols).select_from(models.UnitReportDB).where(models.UnitReportDB.unit == unit, models.UnitReportDB.report_date >= year_start_dt, models.UnitReportDB.report_date <= report_datetime_end).group_by(models.UnitReportDB.unit)
        yearly_result = await db.execute(yearly_stmt)
        yearly_data = yearly_result.mappings().first()
        if yearly_data:
            yearly_values = {**yearly_data, "unit": unit, "year": year}
            yearly_insert_stmt = insert(models.YearlyAggregateDB).values(**yearly_values)
            yearly_update_dict = {k: getattr(yearly_insert_stmt.excluded, k) for k in yearly_data.keys()}
            yearly_upsert_stmt = yearly_insert_stmt.on_conflict_do_update(index_elements=['unit', 'year'], set_=yearly_update_dict)
            await db.execute(yearly_upsert_stmt)

        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"Error updating unit aggregates: {e}")

async def update_station_aggregates(report: models.StationReport, db: AsyncSession):
    if not isinstance(report.report_date, date):
        print("CRITICAL: update_station_aggregates non-date")
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
        monthly_stmt = select(*aggregation_cols).select_from(models.StationReportDB).where(models.StationReportDB.report_date >= month_start_dt, models.StationReportDB.report_date <= report_datetime_end)
        monthly_result = await db.execute(monthly_stmt)
        monthly_data = monthly_result.mappings().first()
        if monthly_data:
            monthly_values = {**monthly_data, "year": year, "month": month}
            monthly_insert_stmt = insert(models.StationMonthlyAggregateDB).values(**monthly_values)
            monthly_update_dict = {k: getattr(monthly_insert_stmt.excluded, k) for k in monthly_data.keys()}
            monthly_upsert_stmt = monthly_insert_stmt.on_conflict_do_update(index_elements=['year', 'month'], set_=monthly_update_dict)
            await db.execute(monthly_upsert_stmt)

        yearly_stmt = select(*aggregation_cols).select_from(models.StationReportDB).where(models.StationReportDB.report_date >= year_start_dt, models.StationReportDB.report_date <= report_datetime_end)
        yearly_result = await db.execute(yearly_stmt)
        yearly_data = yearly_result.mappings().first()
        if yearly_data:
            yearly_values = {**yearly_data, "year": year}
            yearly_insert_stmt = insert(models.StationYearlyAggregateDB).values(**yearly_values)
            yearly_update_dict = {k: getattr(yearly_insert_stmt.excluded, k) for k in yearly_data.keys()}
            yearly_upsert_stmt = yearly_insert_stmt.on_conflict_do_update(index_elements=['year'], set_=yearly_update_dict)
            await db.execute(yearly_upsert_stmt)

        await db.commit()
    except Exception as e:
        await db.rollback()
        print(f"Error updating station aggregates: {e}")


# ============================================
# UNIT MONTHLY AGGREGATE API
# ============================================
@app.get("/api/aggregate/month/{year}/{month}/{upto_date}", dependencies=[Depends(get_current_user)])
async def get_unit_monthly_aggregate(year: int, month: int, upto_date: date, db: AsyncSession = Depends(get_db)):

    month_start = datetime(year, month, 1)
    upto_date_end = datetime.combine(upto_date, datetime.max.time())

    stmt = (
        select(models.MonthlyAggregateDB)
        .where(
            models.MonthlyAggregateDB.year == year,
            models.MonthlyAggregateDB.month == month
        )
    )

    res = await db.execute(stmt)
    rows = res.scalars().all()
    return rows

# ============================================
# UNIT YEARLY AGGREGATE API
# ============================================
@app.get("/api/aggregate/year/{year}/{upto_date}", dependencies=[Depends(get_current_user)])
async def get_unit_yearly_aggregate(year: int, upto_date: date, db: AsyncSession = Depends(get_db)):

    stmt = (
        select(models.YearlyAggregateDB)
        .where(models.YearlyAggregateDB.year == year)
    )

    res = await db.execute(stmt)
    rows = res.scalars().all()
    return rows
# ============================================
# STATION MONTHLY AGGREGATE API
# ============================================
@app.get("/api/aggregate/station/month/{year}/{month}/{upto_date}", dependencies=[Depends(get_current_user)])
async def get_station_monthly_aggregate(year: int, month: int, upto_date: date, db: AsyncSession = Depends(get_db)):

    stmt = (
        select(models.StationMonthlyAggregateDB)
        .where(
            models.StationMonthlyAggregateDB.year == year,
            models.StationMonthlyAggregateDB.month == month
        )
    )

    res = await db.execute(stmt)
    row = res.scalar_one_or_none()
    return row or {}
# ============================================
# STATION YEARLY AGGREGATE API
# ============================================
@app.get("/api/aggregate/station/year/{year}/{upto_date}", dependencies=[Depends(get_current_user)])
async def get_station_yearly_aggregate(year: int, upto_date: date, db: AsyncSession = Depends(get_db)):

    stmt = (
        select(models.StationYearlyAggregateDB)
        .where(models.StationYearlyAggregateDB.year == year)
    )

    res = await db.execute(stmt)
    row = res.scalar_one_or_none()
    return row or {}


# ---------------------------
# EXPORTS (Excel / PDF) - keep existing logic
# ---------------------------
@app.get("/api/export/excel/{report_date}", dependencies=[Depends(get_current_user)])
async def export_excel(report_date: date, db: AsyncSession = Depends(get_db)):
    report_dt_start = datetime.combine(report_date, datetime.min.time())
    report_dt_end = report_dt_start + timedelta(days=1)
    stmt = select(models.UnitReportDB).where(models.UnitReportDB.report_date >= report_dt_start, models.UnitReportDB.report_date < report_dt_end).order_by(models.UnitReportDB.unit)
    result = await db.execute(stmt)
    reports_orm = result.scalars().all()
    if not reports_orm:
        raise HTTPException(status_code=404, detail="No data found for Excel export.")
    reports_dict = [models.UnitReport.from_orm(r).dict() for r in reports_orm]
    df = pd.DataFrame(reports_dict)
    if 'report_date' in df.columns:
        df['report_date'] = pd.to_datetime(df['report_date']).dt.date
    output = io.BytesIO()
    df.to_excel(output, index=False)
    output.seek(0)
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename=report_{report_date}.xlsx"})

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

