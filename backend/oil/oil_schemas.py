from pydantic import BaseModel
from datetime import date, time
from typing import Optional

class OilUnloadingBase(BaseModel):
    plant: str
    area: str
    oil_type: str

    oil_company: Optional[str]
    oil_depot: Optional[str]
    vehicle_no: Optional[str]
    transporter: Optional[str]

    gross_wt: Optional[float]
    tare_wt: Optional[float]
    net_wt: Optional[float]
    net_kl: Optional[float]

    density: Optional[float]
    density_15: Optional[float]
    temperature: Optional[float]

    dip1: Optional[float]
    dip2: Optional[float]
    dip3: Optional[float]
    dip4: Optional[float]

    vehicle_capacity: Optional[float]

    tank1_initial: Optional[float]
    tank1_final: Optional[float]
    tank2_initial: Optional[float]
    tank2_final: Optional[float]

    receipt_kl: Optional[float]
    boiler_consumption: Optional[float]

    receiving_date: Optional[date]
    receiving_time: Optional[time]
    releasing_date: Optional[date]
    releasing_time: Optional[time]

    delay_reason: Optional[str]
    remarks: Optional[str]


class OilUnloadingCreate(OilUnloadingBase):
    pass


class OilUnloadingRead(OilUnloadingBase):
    id: int

    class Config:
        from_attributes = True
