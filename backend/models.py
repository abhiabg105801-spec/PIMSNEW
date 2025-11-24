from pydantic import BaseModel, field_validator
from datetime import date, datetime, time
from typing import Optional

from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Time,
    UniqueConstraint, Index, ForeignKey, Boolean
)
from sqlalchemy.orm import relationship
from database import Base # Import Base from our new database.py

# --- SQLAlchemy Models (Database Tables) ---

class UnitReportDB(Base):
    __tablename__ = "unit_reports"

    id = Column(Integer, primary_key=True, index=True)
    unit = Column(String, index=True, nullable=False)
    report_date = Column(DateTime, index=True, nullable=False)

    # Performance
    totalizer_mu = Column(Float, nullable=True)
    generation_mu = Column(Float, nullable=True)
    plf_percent = Column(Float, nullable=True)
    running_hour = Column(Float, nullable=True)
    plant_availability_percent = Column(Float, nullable=True)
    # Outages
    planned_outage_hour = Column(Float, nullable=True)
    planned_outage_percent = Column(Float, nullable=True)
    forced_outage_hour = Column(Float, nullable=True)
    forced_outage_percent = Column(Float, nullable=True)
    strategic_outage_hour = Column(Float, nullable=True)
    # Fuel (Coal)
    coal_consumption_t = Column(Float, nullable=True)
    sp_coal_consumption_kg_kwh = Column(Float, nullable=True)
    avg_gcv_coal_kcal_kg = Column(Float, nullable=True)
    heat_rate = Column(Float, nullable=True)
    # Fuel (Oil)
    ldo_hsd_consumption_kl = Column(Float, nullable=True)
    sp_oil_consumption_ml_kwh = Column(Float, nullable=True)
    # Power & Water
    aux_power_consumption_mu = Column(Float, nullable=True)
    aux_power_percent = Column(Float, nullable=True)
    dm_water_consumption_cu_m = Column(Float, nullable=True)
    sp_dm_water_consumption_percent = Column(Float, nullable=True)
    # Steam & Emissions
    steam_gen_t = Column(Float, nullable=True)
    sp_steam_consumption_kg_kwh = Column(Float, nullable=True)
    stack_emission_spm_mg_nm3 = Column(Float, nullable=True)

    __table_args__ = (UniqueConstraint('unit', 'report_date', name='uq_unit_report_date'),)


class StationReportDB(Base):
    __tablename__ = "station_reports"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(DateTime, index=True, nullable=False, unique=True)
    avg_raw_water_used_cu_m_hr = Column(Float, nullable=True)
    total_raw_water_used_cu_m = Column(Float, nullable=True)
    sp_raw_water_used_ltr_kwh = Column(Float, nullable=True)
    ro_plant_running_hrs = Column(Float, nullable=True)
    ro_plant_il = Column(Float, nullable=True)
    ro_plant_ol = Column(Float, nullable=True)


class MonthlyAggregateDB(Base):
    __tablename__ = "monthly_aggregates"
    id = Column(Integer, primary_key=True, index=True)
    unit = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)

    # All aggregated fields
    generation_mu = Column(Float, nullable=True)
    plf_percent = Column(Float, nullable=True)
    running_hour = Column(Float, nullable=True)
    plant_availability_percent = Column(Float, nullable=True)
    planned_outage_hour = Column(Float, nullable=True)
    planned_outage_percent = Column(Float, nullable=True)
    forced_outage_hour = Column(Float, nullable=True)
    forced_outage_percent = Column(Float, nullable=True)
    strategic_outage_hour = Column(Float, nullable=True)
    coal_consumption_t = Column(Float, nullable=True)
    sp_coal_consumption_kg_kwh = Column(Float, nullable=True)
    avg_gcv_coal_kcal_kg = Column(Float, nullable=True)
    heat_rate = Column(Float, nullable=True)
    ldo_hsd_consumption_kl = Column(Float, nullable=True)
    sp_oil_consumption_ml_kwh = Column(Float, nullable=True)
    aux_power_consumption_mu = Column(Float, nullable=True)
    aux_power_percent = Column(Float, nullable=True)
    dm_water_consumption_cu_m = Column(Float, nullable=True)
    sp_dm_water_consumption_percent = Column(Float, nullable=True)
    steam_gen_t = Column(Float, nullable=True)
    sp_steam_consumption_kg_kwh = Column(Float, nullable=True)
    stack_emission_spm_mg_nm3 = Column(Float, nullable=True)

    __table_args__ = (UniqueConstraint('unit', 'year', 'month', name='uq_monthly_agg'),
                      Index('ix_monthly_agg_unit_year_month', 'unit', 'year', 'month'))


class YearlyAggregateDB(Base):
    __tablename__ = "yearly_aggregates"
    id = Column(Integer, primary_key=True, index=True)
    unit = Column(String, nullable=False)
    year = Column(Integer, nullable=False)

    # All aggregated fields
    generation_mu = Column(Float, nullable=True)
    plf_percent = Column(Float, nullable=True)
    running_hour = Column(Float, nullable=True)
    plant_availability_percent = Column(Float, nullable=True)
    planned_outage_hour = Column(Float, nullable=True)
    planned_outage_percent = Column(Float, nullable=True)
    forced_outage_hour = Column(Float, nullable=True)
    forced_outage_percent = Column(Float, nullable=True)
    strategic_outage_hour = Column(Float, nullable=True)
    coal_consumption_t = Column(Float, nullable=True)
    sp_coal_consumption_kg_kwh = Column(Float, nullable=True)
    avg_gcv_coal_kcal_kg = Column(Float, nullable=True)
    heat_rate = Column(Float, nullable=True)
    ldo_hsd_consumption_kl = Column(Float, nullable=True)
    sp_oil_consumption_ml_kwh = Column(Float, nullable=True)
    aux_power_consumption_mu = Column(Float, nullable=True)
    aux_power_percent = Column(Float, nullable=True)
    dm_water_consumption_cu_m = Column(Float, nullable=True)
    sp_dm_water_consumption_percent = Column(Float, nullable=True)
    steam_gen_t = Column(Float, nullable=True)
    sp_steam_consumption_kg_kwh = Column(Float, nullable=True)
    stack_emission_spm_mg_nm3 = Column(Float, nullable=True)

    __table_args__ = (UniqueConstraint('unit', 'year', name='uq_yearly_agg'),
                      Index('ix_yearly_agg_unit_year', 'unit', 'year'))


class StationMonthlyAggregateDB(Base):
    __tablename__ = "station_monthly_aggregates"
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    avg_raw_water_used_cu_m_hr = Column(Float, nullable=True)
    total_raw_water_used_cu_m = Column(Float, nullable=True)
    sp_raw_water_used_ltr_kwh = Column(Float, nullable=True)
    ro_plant_running_hrs = Column(Float, nullable=True)
    ro_plant_il = Column(Float, nullable=True)
    ro_plant_ol = Column(Float, nullable=True)
    __table_args__ = (UniqueConstraint('year', 'month', name='uq_station_monthly_agg'),)


class StationYearlyAggregateDB(Base):
    __tablename__ = "station_yearly_aggregates"
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    avg_raw_water_used_cu_m_hr = Column(Float, nullable=True)
    total_raw_water_used_cu_m = Column(Float, nullable=True)
    sp_raw_water_used_ltr_kwh = Column(Float, nullable=True)
    ro_plant_running_hrs = Column(Float, nullable=True)
    ro_plant_il = Column(Float, nullable=True)
    ro_plant_ol = Column(Float, nullable=True)
    __table_args__ = (UniqueConstraint('year', name='uq_station_yearly_agg'),)


class ShutdownRecordDB(Base):
    __tablename__ = "shutdown_log"
    id = Column(Integer, primary_key=True, index=True)
    unit = Column(String, index=True, nullable=False)
    datetime_from = Column(DateTime, index=True, nullable=False)
    datetime_to = Column(DateTime, index=True, nullable=True)
    duration = Column(String, nullable=True) # To store "1h 30m", etc.
    reason = Column(String, nullable=True)
    responsible_agency = Column(String, nullable=True)
    notification_no = Column(String, nullable=True, index=True)
    rca_file_path = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


# --- Pydantic Models (API Request/Response) ---

class UnitReport(BaseModel):
    unit: str
    report_date: datetime # Keep as date for API input
    edit_password: Optional[str] = None
    totalizer_mu: Optional[float] = None
    generation_mu: Optional[float] = None
    plf_percent: Optional[float] = None
    running_hour: Optional[float] = None
    plant_availability_percent: Optional[float] = None
    planned_outage_hour: Optional[float] = None
    planned_outage_percent: Optional[float] = None
    forced_outage_hour: Optional[float] = None
    forced_outage_percent: Optional[float] = None
    strategic_outage_hour: Optional[float] = None
    coal_consumption_t: Optional[float] = None
    sp_coal_consumption_kg_kwh: Optional[float] = None
    avg_gcv_coal_kcal_kg: Optional[float] = None
    heat_rate: Optional[float] = None
    ldo_hsd_consumption_kl: Optional[float] = None
    sp_oil_consumption_ml_kwh: Optional[float] = None
    aux_power_consumption_mu: Optional[float] = None
    aux_power_percent: Optional[float] = None
    dm_water_consumption_cu_m: Optional[float] = None
    sp_dm_water_consumption_percent: Optional[float] = None
    steam_gen_t: Optional[float] = None
    sp_steam_consumption_kg_kwh: Optional[float] = None
    stack_emission_spm_mg_nm3: Optional[float] = None

    

    class Config:
        from_attributes = True
        str_strip_whitespace = True

class StationReport(BaseModel):
    report_date: datetime # Keep as date for API input
    avg_raw_water_used_cu_m_hr: Optional[float] = None
    total_raw_water_used_cu_m: Optional[float] = None
    sp_raw_water_used_ltr_kwh: Optional[float] = None
    ro_plant_running_hrs: Optional[float] = None
    ro_plant_il: Optional[float] = None
    ro_plant_ol: Optional[float] = None

    

    class Config:
        from_attributes = True
        str_strip_whitespace = True


class ShutdownRecordCreate(BaseModel):
    unit: str
    datetime_from: datetime
    datetime_to: Optional[datetime] = None
    duration: Optional[str] = None
    reason: Optional[str] = None
    responsible_agency: Optional[str] = None
    notification_no: Optional[str] = None

    class Config:
        from_attributes = True
        str_strip_whitespace = True

class ShutdownRecord(ShutdownRecordCreate):
    id: int
    rca_file_path: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# ✅ ADDED: Pydantic Response Model for Unit Aggregates
class AggregateResponse(BaseModel):
    unit: str
    generation_mu: Optional[float] = None
    plf_percent: Optional[float] = None
    running_hour: Optional[float] = None
    plant_availability_percent: Optional[float] = None
    planned_outage_hour: Optional[float] = None
    planned_outage_percent: Optional[float] = None
    forced_outage_hour: Optional[float] = None
    forced_outage_percent: Optional[float] = None
    strategic_outage_hour: Optional[float] = None
    coal_consumption_t: Optional[float] = None
    sp_coal_consumption_kg_kwh: Optional[float] = None
    avg_gcv_coal_kcal_kg: Optional[float] = None
    heat_rate: Optional[float] = None
    ldo_hsd_consumption_kl: Optional[float] = None
    sp_oil_consumption_ml_kwh: Optional[float] = None
    aux_power_consumption_mu: Optional[float] = None
    aux_power_percent: Optional[float] = None
    dm_water_consumption_cu_m: Optional[float] = None
    sp_dm_water_consumption_percent: Optional[float] = None
    steam_gen_t: Optional[float] = None
    sp_steam_consumption_kg_kwh: Optional[float] = None
    stack_emission_spm_mg_nm3: Optional[float] = None

    class Config:
        from_attributes = True

# ✅ MOVED: Pydantic Response Model for Station Aggregates
class StationAggregateResponse(BaseModel):
    year: int
    month: Optional[int] = None
    avg_raw_water_used_cu_m_hr: Optional[float] = None
    total_raw_water_used_cu_m: Optional[float] = None
    sp_raw_water_used_ltr_kwh: Optional[float] = None
    ro_plant_running_hrs: Optional[float] = None
    ro_plant_il: Optional[float] = None
    ro_plant_ol: Optional[float] = None

    class Config:
        from_attributes = True

# ============================================================
# ADDING USER / ROLE / PERMISSION MODELS
# ============================================================

# --- SQLAlchemy Models ---

class RoleDB(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, nullable=True)

    users = relationship("UserDB", back_populates="role")
    permissions = relationship("PermissionDB", back_populates="role")


class UserDB(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=True)
    role_id = Column(Integer, ForeignKey("roles.id"))
    is_active = Column(Boolean, default=True)

    role = relationship("RoleDB", back_populates="users")


class PermissionDB(Base):
    __tablename__ = "permissions"

    id = Column(Integer, primary_key=True)
    role_id = Column(Integer, ForeignKey("roles.id"))
    field_name = Column(String)     # e.g. "coal_consumption_t"
    can_edit = Column(Boolean, default=False)
    can_view = Column(Boolean, default=True)

    role = relationship("RoleDB", back_populates="permissions")


# ============================================================
# PYDANTIC MODELS FOR AUTH SYSTEM
# ============================================================

class UserCreate(BaseModel):
    username: str
    password: str
    full_name: str
    role_id: int


class UserLogin(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    full_name: Optional[str]
    role_id: int

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class PermissionOut(BaseModel):
    field_name: str
    can_edit: bool
    can_view: bool

    class Config:
        from_attributes = True