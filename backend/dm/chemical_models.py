from sqlalchemy import Column, Integer, String, Float, Date, Time, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


# =====================================================
# CHEMICAL MASTER
# =====================================================
class ChemicalMasterDB(Base):
    __tablename__ = "chemical_master"

    id = Column(Integer, primary_key=True, index=True)
    chemical_name = Column(String, unique=True, nullable=False)

    available_qty = Column(Float, default=0)     # calculated or cached
    minimum_stock = Column(Float, default=0)
    unit_cost = Column(Float, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    transactions = relationship(
        "ChemicalStockTxnDB",
        back_populates="chemical",
        cascade="all, delete"
    )


# =====================================================
# CHEMICAL STOCK TRANSACTIONS (IN / OUT)
# =====================================================
class ChemicalStockTxnDB(Base):
    __tablename__ = "chemical_stock_txn"

    id = Column(Integer, primary_key=True, index=True)

    chemical_id = Column(
        Integer,
        ForeignKey("chemical_master.id", ondelete="CASCADE"),
        nullable=False
    )

    txn_type = Column(String, nullable=False)  # "IN" or "OUT"

    txn_date = Column(Date, nullable=False)
    txn_time = Column(Time, nullable=False)

    quantity = Column(Float, nullable=False)

    # OUT specific
    feed_point = Column(String, nullable=True)
    feeding_rate = Column(Float, nullable=True)
    reason = Column(String, nullable=True)

    remarks = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    chemical = relationship("ChemicalMasterDB", back_populates="transactions")
