from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime


class DMParamItem(BaseModel):
    parameter: str
    value: Optional[float] = None
    remarks: Optional[str] = None


class DMEntryCreate(BaseModel):
    # Core
    date: date
    time: str
    module: str

    # NEW — sample number (auto or manual)
    sample_no: Optional[str] = None

    # Location / hierarchy
    plant: Optional[str] = None
    broad_area: Optional[str] = None
    main_area: Optional[str] = None
    main_collection_area: Optional[str] = None
    exact_collection_area: Optional[str] = None
    location: Optional[str] = None

    # Optional grouping
    category: Optional[str] = None

    # Actual data
    entries: List[DMParamItem]


class DMEntryUpdate(BaseModel):
    plant: Optional[str]
    broad_area: Optional[str]
    main_area: Optional[str]
    main_collection_area: Optional[str]
    exact_collection_area: Optional[str]
    location: Optional[str]

    entries: List[DMParamItem]


class DMEntryOut(BaseModel):
    id: int
    sample_no: str
    date: date
    time: str
    module: str
    parameter: str
    value: Optional[float]
    remarks: Optional[str]

    class Config:
        orm_mode = True
