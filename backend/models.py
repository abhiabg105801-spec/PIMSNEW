from pydantic import BaseModel, field_validator
from datetime import date, datetime, time 
from typing import Optional,List
import enum

from sqlalchemy import (
    Column, Integer, String, Float, Date, DateTime, Time,Numeric,
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



# -------------------------------------------------------------
#  CONTINUING UPDATED MODELS
# -------------------------------------------------------------




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



class TotalizerReadingDB(Base):
    __tablename__ = "totalizer_readings"

    id = Column(Integer, primary_key=True, index=True)
    totalizer_id = Column(Integer, nullable=False, index=True)
    date = Column(Date, nullable=False, index=True)
    reading_value = Column(Float, default=0)
    adjust_value = Column(Float, default=0)
    difference_value = Column(Float, default=0)
    
    # ✅ NEW: Track who created/updated and when
    username = Column(String, nullable=True)  # Username of who created/updated
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        UniqueConstraint(
            "totalizer_id", "date",
            name="uq_totalizer_date"
        ),
    )


class KPIRecordDB(Base):
    __tablename__ = "kpi_records"

    id = Column(Integer, primary_key=True, index=True)
    report_date = Column(Date, nullable=False, index=True)
    kpi_type = Column(String, nullable=False, index=True)     
    plant_name = Column(String, nullable=False, index=True)   
    kpi_name = Column(String, nullable=False, index=True)
    kpi_value = Column(Float, nullable=False)
    unit = Column(String, nullable=True)

    # ✅ NEW: Track who created/updated and when
    username = Column(String, nullable=True)  # Username of who created/updated
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    __table_args__ = (
        UniqueConstraint(
            "report_date", "kpi_type", "plant_name", "kpi_name",
            name="uq_kpi_unique"
        ),
    )


class UnitInceptionMetricsDB(Base):
    """
    Stores inception offsets for each generating unit.
    Used to adjust generation and running hours prior to system go-live.
    """

    __tablename__ = "unit_inception_metrics"

    unit = Column(String(20), primary_key=True)  # Unit-1, Unit-2

    inception_mw_offset = Column(
        Float, default=0.0, nullable=False
    )  # MWh offset before system

    inception_hours_offset = Column(
        Float, default=0.0, nullable=False
    )  # Running hours offset

    inception_date = Column(
        DateTime, nullable=True
    )  # Commissioning / inception date

    created_at = Column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    updated_at = Column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    def __repr__(self):
        return (
            f"<UnitInceptionMetrics("
            f"unit={self.unit}, "
            f"mw_offset={self.inception_mw_offset}, "
            f"hours_offset={self.inception_hours_offset})>"
        )