from pydantic import BaseModel
from datetime import date, time
from typing import Optional

class OilUnloadingCreate(BaseModel):
    plant: str
    area: str
    oil_type: str

    oil_company: Optional[str] = None
    oil_depot: Optional[str] = None
    vehicle_no: Optional[str] = None
    transporter: Optional[str] = None

    gross_wt: Optional[float] = None
    tare_wt: Optional[float] = None
    net_wt: Optional[float] = None
    net_kl: Optional[float] = None

    density: Optional[float] = None
    density_15: Optional[float] = None
    temperature: Optional[float] = None

    dip1: Optional[float] = None
    dip2: Optional[float] = None
    dip3: Optional[float] = None
    dip4: Optional[float] = None

    vehicle_capacity: Optional[float] = None

    tank1_initial: Optional[float] = None
    tank1_final: Optional[float] = None
    tank2_initial: Optional[float] = None
    tank2_final: Optional[float] = None

    receipt_kl: Optional[float] = None
    boiler_consumption: Optional[float] = None

    receiving_date: Optional[date] = None
    receiving_time: Optional[time] = None
    releasing_date: Optional[date] = None
    releasing_time: Optional[time] = None

    delay_reason: Optional[str] = None
    remarks: Optional[str] = None


class OilUnloadingRead(OilUnloadingCreate):
    id: int

    class Config:
        from_attributes = True


class FuelTankRead(BaseModel):
    tank_name: str
    current_kl: float

    class Config:
        from_attributes = True
