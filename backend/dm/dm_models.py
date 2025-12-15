from sqlalchemy import Column, Integer, String, Date, Time, Float, DateTime, Text

from datetime import datetime
from database import Base

class DMEntryDB(Base):
    __tablename__ = "dm_entries"

    id = Column(Integer, primary_key=True)

    sample_no = Column(String(40), index=True)   # NEW FIELD

    date = Column(Date, nullable=False, index=True)
    time = Column(Time, nullable=False)

    module = Column(String(80), nullable=False, index=True)
    category = Column(String(120), nullable=True)

    plant = Column(String(120))
    broad_area = Column(String(120))
    main_area = Column(String(120))
    main_collection_area = Column(String(140))
    exact_collection_area = Column(String(140))
    location = Column(String(200))

    parameter = Column(String(120), nullable=False, index=True)
    value = Column(Float)
    remarks = Column(Text)

    uploaded_at = Column(DateTime, default=datetime.now)
