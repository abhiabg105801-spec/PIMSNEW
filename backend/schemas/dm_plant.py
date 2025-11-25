# schemas/dm_plant.py
from pydantic import BaseModel
from datetime import date, time, datetime
from typing import Optional, List


class DMEntryCreate(BaseModel):
    date: date
    time: str
    unit: str
    section: str
    parameter: str
    value: float
    remarks: Optional[str] = None


class DMEntry(BaseModel):
    id: int
    date: date
    time: str
    unit: str
    section: str
    parameter: str
    value: float
    remarks: Optional[str] = None
    uploaded_at: datetime

    class Config:
        from_attributes = True


# -------------------------
# NEW: bulk section schema
# -------------------------

class DMSectionEntry(BaseModel):
    parameter: str
    value: float
    remarks: Optional[str] = None


class DMSectionCreate(BaseModel):
    date: date
    time: str
    unit: str
    section: str
    entries: List[DMSectionEntry]
