from pydantic import BaseModel
from typing import List, Optional
from datetime import date, datetime

class DMParamItem(BaseModel):
    parameter: str
    value: Optional[float] = None
    remarks: Optional[str] = None

class DMEntryCreate(BaseModel):
    date: date
    time: str
    module: str

    plant: Optional[str] = None
    broad_area: Optional[str] = None
    main_area: Optional[str] = None
    main_collection_area: Optional[str] = None
    exact_collection_area: Optional[str] = None

    category: Optional[str] = None
    location: Optional[str] = None

    entries: List[DMParamItem]

class DMEntryOut(BaseModel):
    id: int
    date: date
    time: str
    module: str
    parameter: str
    value: Optional[float]
    remarks: Optional[str]
    uploaded_at: datetime

    class Config:
        orm_mode = True
