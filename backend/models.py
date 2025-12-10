from pydantic import BaseModel, field_validator
from datetime import date, datetime, time 
from typing import Optional
import enum

from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Time,
    UniqueConstraint, Index, ForeignKey, Boolean, Text
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base 

# ==========================================================
#  SQLALCHEMY MODELS (Database Tables)
# ==========================================================

# ... [UnitReportDB, StationReportDB, MonthlyAggregateDB, YearlyAggregateDB, 
#      StationMonthlyAggregateDB, StationYearlyAggregateDB classes remain unchanged] ...

class UnitReportDB(Base):
    __tablename__ = "unit_reports"
    id = Column(Integer, primary_key=True, index=True)
    unit = Column(String, index=True, nullable=False)
    report_date = Column(DateTime, index=True, nullable=False)
    # ... (rest of columns remain exactly the same) ...
    totalizer_mu = Column(Float, nullable=True)     
    totalizer_coal = Column(Float, nullable=True)   
    totalizer_aux = Column(Float, nullable=True)    
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
    # ... (fields omitted for brevity, they remain unchanged) ...
    generation_mu = Column(Float, nullable=True)
    plf_percent = Column(Float, nullable=True)
    # ... 
    __table_args__ = (UniqueConstraint('unit', 'year', 'month', name='uq_monthly_agg'),
                      Index('ix_monthly_agg_unit_year_month', 'unit', 'year', 'month'))

class YearlyAggregateDB(Base):
    __tablename__ = "yearly_aggregates"
    id = Column(Integer, primary_key=True, index=True)
    unit = Column(String, nullable=False)
    year = Column(Integer, nullable=False)
    # ... (fields omitted for brevity, they remain unchanged) ...
    generation_mu = Column(Float, nullable=True)
    # ...
    __table_args__ = (UniqueConstraint('unit', 'year', name='uq_yearly_agg'),
                      Index('ix_yearly_agg_unit_year', 'unit', 'year'))

class StationMonthlyAggregateDB(Base):
    __tablename__ = "station_monthly_aggregates"
    id = Column(Integer, primary_key=True, index=True)
    year = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    # ...
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
    # ...
    avg_raw_water_used_cu_m_hr = Column(Float, nullable=True)
    total_raw_water_used_cu_m = Column(Float, nullable=True)
    sp_raw_water_used_ltr_kwh = Column(Float, nullable=True)
    ro_plant_running_hrs = Column(Float, nullable=True)
    ro_plant_il = Column(Float, nullable=True)
    ro_plant_ol = Column(Float, nullable=True)
    __table_args__ = (UniqueConstraint('year', name='uq_station_yearly_agg'),)


# -------------------------------------------------------------
#  UPDATED MODELS WITH LOCAL SERVER TIME (datetime.now)
# -------------------------------------------------------------

class ShutdownRecordDB(Base):
    __tablename__ = "shutdown_log"

    id = Column(Integer, primary_key=True, index=True)

    # ---------------- SHUTDOWN DETAILS ----------------
    unit = Column(String, index=True, nullable=False)
    shutdown_type = Column(String, nullable=True)

    datetime_from = Column(DateTime, index=True, nullable=False)
    datetime_to = Column(DateTime, nullable=True)
    duration = Column(String, nullable=True)

    responsible_agency = Column(String, nullable=True)
    reason = Column(Text, nullable=True)
    remarks = Column(Text, nullable=True)
    shift_incharge = Column(String, nullable=True)
    pretrip_status = Column(String, nullable=True)
    first_cause = Column(String, nullable=True)
    action_taken = Column(Text, nullable=True)
    restoration_sequence = Column(Text, nullable=True)
    notification_no = Column(String, nullable=True)

    # NEW FIELD 1: WHY-WHY CHECKBOX
    why_why_done = Column(Boolean, default=False)

    # NEW FIELD 2: WHEN WHY-WHY WAS DONE
    why_why_done_at = Column(DateTime, nullable=True)

    rca_file_path = Column(String, nullable=True)
    
    # ✅ CHANGED: Uses server PC time
    uploaded_at = Column(DateTime, default=datetime.now)

    # ---------------- SYNCHRONISATION DETAILS ----------------
    sync_datetime = Column(DateTime, nullable=True)
    sync_shift_incharge = Column(String, nullable=True)
    oil_used_kl = Column(Float, nullable=True)
    coal_t = Column(Float, nullable=True)
    oil_stabilization_kl = Column(Float, nullable=True)
    import_percent = Column(Float, nullable=True)
    sync_notes = Column(Text, nullable=True)


# ==========================================================
#  PYDANTIC SCHEMAS (API RESPONSE & VALIDATION)
# ==========================================================

# ... [ShutdownRecordBase, ShutdownRecordCreate, ShutdownRecord, 
#      UnitReport, StationReport, AggregateResponse, StationAggregateResponse 
#      classes remain unchanged from previous versions] ...

class ShutdownRecordBase(BaseModel):
    unit: str
    shutdown_type: Optional[str] = None
    datetime_from: datetime
    datetime_to: Optional[datetime] = None
    duration: Optional[str] = None
    responsible_agency: Optional[str] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None
    shift_incharge: Optional[str] = None
    pretrip_status: Optional[str] = None
    first_cause: Optional[str] = None
    action_taken: Optional[str] = None
    restoration_sequence: Optional[str] = None
    notification_no: Optional[str] = None
    why_why_done: Optional[bool] = False
    why_why_done_at: Optional[datetime] = None
    sync_datetime: Optional[datetime] = None
    sync_shift_incharge: Optional[str] = None
    oil_used_kl: Optional[float] = None
    coal_t: Optional[float] = None
    oil_stabilization_kl: Optional[float] = None
    import_percent: Optional[float] = None
    sync_notes: Optional[str] = None
    class Config:
        orm_mode = True
        from_attributes = True

class ShutdownRecordCreate(ShutdownRecordBase):
    pass

class ShutdownRecord(ShutdownRecordBase):
    id: int
    rca_file_path: Optional[str] = None
    uploaded_at: datetime
    class Config:
        orm_mode = True
        from_attributes = True

class UnitReport(BaseModel):
    unit: str
    report_date: datetime 
    edit_password: Optional[str] = None
    totalizer_mu: Optional[float] = None
    totalizer_coal: Optional[float] = None   
    totalizer_aux :Optional[float] = None    
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
    report_date: datetime 
    avg_raw_water_used_cu_m_hr: Optional[float] = None
    total_raw_water_used_cu_m: Optional[float] = None
    sp_raw_water_used_ltr_kwh: Optional[float] = None
    ro_plant_running_hrs: Optional[float] = None
    ro_plant_il: Optional[float] = None
    ro_plant_ol: Optional[float] = None
    class Config:
        from_attributes = True
        str_strip_whitespace = True

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

# -------------------------------------------------------------
#  CONTINUING UPDATED MODELS
# -------------------------------------------------------------

class DMPlantEntryDB(Base):
    __tablename__ = "dm_plant_entries"
    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    time = Column(Time, nullable=False)
    unit = Column(String, nullable=False)
    section = Column(String, nullable=False)
    parameter = Column(String, nullable=False)
    value = Column(Float, nullable=False)
    remarks = Column(String, nullable=True)
    
    # ✅ CHANGED: Uses server PC time
    uploaded_at = Column(DateTime, default=datetime.now)

class ChemicalParamEntryDB(Base):
    __tablename__ = "chemical_param_entries"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False, index=True)
    time = Column(Time, nullable=False)
    plant = Column(String, nullable=False)
    broad_area = Column(String, nullable=True)
    main_area = Column(String, nullable=True)               
    main_collection_area = Column(String, nullable=True)    
    exact_collection_area = Column(String, nullable=True)   

    parameter = Column(String, nullable=False)
    value = Column(Float, nullable=True)
    remarks = Column(String, nullable=True)

    # ✅ CHANGED: Uses server PC time
    uploaded_at = Column(DateTime, default=datetime.now)

# ... [RoleDB, UserDB, PermissionDB classes remain unchanged] ...
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
    field_name = Column(String)    
    can_edit = Column(Boolean, default=False)
    can_view = Column(Boolean, default=True)
    role = relationship("RoleDB", back_populates="permissions")


class MessageDB(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50))
    content = Column(Text)
    pinned = Column(Boolean, default=False)
    pinned_at = Column(DateTime, nullable=True)
    
    # ✅ CHANGED: Uses server PC time
    created_at = Column(DateTime, default=datetime.now)


# ... [UserCreate, UserLogin, UserOut, Token, PermissionOut classes remain unchanged] ...
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

class FuelType(str, enum.Enum):
    LDO = "LDO"
    HSD = "HSD"

class TxType(str, enum.Enum):
    INITIAL = "initial"
    RECEIPT = "receipt"
    USAGE = "usage"

class FuelTransactionDB(Base):
    __tablename__ = "fuel_transactions"

    id = Column(Integer, primary_key=True, index=True)
    tx_date = Column(Date, nullable=False, index=True)
    fuel_type = Column(String, nullable=False)            
    tx_type = Column(String, nullable=False)              
    quantity = Column(Float, nullable=False)              
    remarks = Column(String, nullable=True)
    
    # ✅ CHANGED: Uses server PC time
    created_at = Column(DateTime, default=datetime.now)

class FuelTransactionCreate(BaseModel):
    tx_date: date
    fuel_type: FuelType
    tx_type: TxType
    quantity: float
    remarks: Optional[str] = None

class FuelTransactionOut(FuelTransactionCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

class TotalizerMasterDB(Base):
    __tablename__ = "totalizers_master"

    id = Column(Integer, primary_key=True, index=True)
    unit = Column(String)
    name = Column(String)
    display_name = Column(String)
    sequence = Column(Integer)

class TotalizerReadingDB(Base):
    __tablename__ = "totalizer_readings"

    id = Column(Integer, primary_key=True, index=True)
    totalizer_id = Column(Integer)
    date = Column(Date)
    reading_value = Column(Float, default=0)
    adjust_value = Column(Float, default=0)
    difference_value = Column(Float, default=0)
    
    # ✅ CHANGED: Uses server PC time
    # (Note: since this is a Date column, datetime.now will be cast to date by SQLAlchemy)
    created_at = Column(Date, default=datetime.now)

class KPIRecordDB(Base):
    __tablename__ = "kpi_records"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(Date, nullable=False, index=True)
    kpi_type = Column(String, nullable=False, index=True)     
    plant_name = Column(String, nullable=False, index=True)   
    kpi_name = Column(String, nullable=False, index=True)
    kpi_value = Column(Float, nullable=False)
    unit = Column(String, nullable=True)

    # ✅ CHANGED: Uses server PC time for creation and update
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        UniqueConstraint(
            "report_date", "kpi_type", "plant_name", "kpi_name",
            name="uq_kpi_unique"
        ),
    )