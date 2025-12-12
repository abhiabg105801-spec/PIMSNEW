from sqlalchemy import Column, Integer, String, Date, Time, Float, DateTime, Text
from sqlalchemy.orm import declarative_base
from datetime import datetime

Base = declarative_base()

class DMEntryDB(Base):
    __tablename__ = "dm_entries"

    id = Column(Integer, primary_key=True)
    date = Column(Date, nullable=False, index=True)
    time = Column(Time, nullable=False, index=True)

    module = Column(String(80), nullable=False, index=True)
    category = Column(String(120), nullable=True, index=True)

    plant = Column(String(120), nullable=True)
    broad_area = Column(String(120), nullable=True)
    main_area = Column(String(120), nullable=True)
    main_collection_area = Column(String(140), nullable=True)
    exact_collection_area = Column(String(140), nullable=True)
    location = Column(String(200), nullable=True)

    parameter = Column(String(120), nullable=False, index=True)
    value = Column(Float, nullable=True)
    remarks = Column(Text, nullable=True)

    uploaded_at = Column(DateTime, default=datetime.now)
