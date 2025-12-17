from sqlalchemy import Column, Integer, String, Float, Date, Time
from database import Base

class OilUnloading(Base):
    __tablename__ = "oil_unloading"

    id = Column(Integer, primary_key=True, index=True)

    plant = Column(String, nullable=False)
    area = Column(String, nullable=False)

    oil_type = Column(String, nullable=False)  # LDO / HSD

    oil_company = Column(String)
    oil_depot = Column(String)
    vehicle_no = Column(String)
    transporter = Column(String)

    gross_wt = Column(Float)
    tare_wt = Column(Float)
    net_wt = Column(Float)
    net_kl = Column(Float)

    density = Column(Float)
    density_15 = Column(Float)
    temperature = Column(Float)

    dip1 = Column(Float)
    dip2 = Column(Float)
    dip3 = Column(Float)
    dip4 = Column(Float)

    vehicle_capacity = Column(Float)

    tank1_initial = Column(Float)
    tank1_final = Column(Float)
    tank2_initial = Column(Float)
    tank2_final = Column(Float)

    receipt_kl = Column(Float)
    boiler_consumption = Column(Float)

    receiving_date = Column(Date)
    receiving_time = Column(Time)
    releasing_date = Column(Date)
    releasing_time = Column(Time)

    delay_reason = Column(String)
    remarks = Column(String)
