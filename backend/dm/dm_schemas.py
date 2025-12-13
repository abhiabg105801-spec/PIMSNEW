from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime


class DMParamItem(BaseModel):
    parameter: str
    value: Optional[float] = None
    remarks: Optional[str] = None


class DMEntryCreate(BaseModel):
    sample_no: Optional[str] = None
    date: date
    time: str
    module: str

    plant: Optional[str] = None
    broad_area: Optional[str] = None
    main_area: Optional[str] = None
    main_collection_area: Optional[str] = None
    exact_collection_area: Optional[str] = None

    location: Optional[str] = None

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
