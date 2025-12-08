# schemas/chemical.py
from pydantic import BaseModel
from datetime import date, time, datetime
from typing import Optional, List

class ChemicalEntryCreate(BaseModel):
    date: date
    time: str      # "HH:MM:SS" or "HH:MM"
    plant: str
    broad_area: Optional[str]
    main_area: Optional[str]
    main_collection_area: Optional[str]
    exact_collection_area: Optional[str]
    parameter: str
    value: Optional[float]
    remarks: Optional[str] = None

class ChemicalSectionEntry(BaseModel):
    parameter: str
    value: Optional[float] = None
    remarks: Optional[str] = None

class ChemicalSectionCreate(BaseModel):
    date: date
    time: str
    plant: str
    broad_area: Optional[str]
    main_area: Optional[str]
    main_collection_area: Optional[str]
    exact_collection_area: Optional[str]
    section: str   # friendly name like "CT Make Up" but we keep exact_collection_area as more specific
    entries: List[ChemicalSectionEntry]

class ChemicalEntry(BaseModel):
    id: int
    date: date
    time: str
    plant: str
    broad_area: Optional[str]
    main_area: Optional[str]
    main_collection_area: Optional[str]
    exact_collection_area: Optional[str]
    parameter: str
    value: Optional[float]
    remarks: Optional[str]
    uploaded_at: datetime

    class Config:
        orm_mode = True
        from_attributes = True
