from pydantic import BaseModel
from datetime import date, time
from typing import Optional, Literal


# -------- MASTER --------
class ChemicalMasterCreate(BaseModel):
    chemical_name: str
    minimum_stock: float
    unit_cost: float


class ChemicalMasterUpdate(BaseModel):
    minimum_stock: Optional[float]
    unit_cost: Optional[float]


# -------- TRANSACTION --------
class ChemicalStockTxnCreate(BaseModel):
    chemical_id: int
    txn_type: Literal["IN", "OUT"]

    txn_date: date
    txn_time: time

    quantity: float

    feed_point: Optional[str] = None
    feeding_rate: Optional[float] = None
    reason: Optional[str] = None
    remarks: Optional[str] = None
