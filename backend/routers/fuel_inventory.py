from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date, timedelta

from database import get_db
from models import (
    FuelTransactionDB,
    FuelTransactionCreate,
    FuelTransactionOut,
    FuelType,
    TxType
)

router = APIRouter(prefix="/fuel", tags=["Fuel Inventory"])

# -------------------------------
# Create transaction
# -------------------------------
@router.post("/", response_model=FuelTransactionOut)
async def create_tx(payload: FuelTransactionCreate, db: AsyncSession = Depends(get_db)):
    tx = FuelTransactionDB(
        tx_date = payload.tx_date,
        fuel_type = payload.fuel_type.value,
        tx_type = payload.tx_type.value,
        quantity = payload.quantity,
        remarks = payload.remarks
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)
    return tx

# -------------------------------
# Helper functions
# -------------------------------
async def sum_tx(db, fuel, start_date, end_date, types):
    stmt = select(func.coalesce(func.sum(FuelTransactionDB.quantity), 0)).where(
        FuelTransactionDB.tx_date >= start_date,
        FuelTransactionDB.tx_date <= end_date,
        FuelTransactionDB.fuel_type == fuel.value,
        FuelTransactionDB.tx_type.in_([t.value for t in types])
    )
    res = await db.execute(stmt)
    return float(res.scalar() or 0)

async def closing_on(db, fuel, day):
    stmt = select(func.coalesce(func.sum(
        func.case(
            (FuelTransactionDB.tx_type.in_(["initial","receipt"]), FuelTransactionDB.quantity),
            else_=-FuelTransactionDB.quantity
        )
    ), 0)).where(
        FuelTransactionDB.tx_date <= day,
        FuelTransactionDB.fuel_type == fuel.value
    )
    res = await db.execute(stmt)
    return float(res.scalar() or 0)

# -------------------------------
# Daily Report
# -------------------------------
@router.get("/daily/{fuel}/{day}")
async def daily_report(fuel: FuelType, day: date, db: AsyncSession = Depends(get_db)):
    opening = await closing_on(db, fuel, day - timedelta(days=1))
    initial = await sum_tx(db, fuel, day, day, [TxType.INITIAL])
    receipt = await sum_tx(db, fuel, day, day, [TxType.RECEIPT])
    usage   = await sum_tx(db, fuel, day, day, [TxType.USAGE])

    closing = opening + initial + receipt - usage

    return {
        "date": day,
        "fuel": fuel.value,
        "opening": opening,
        "initial": initial,
        "receipt": receipt,
        "usage": usage,
        "closing": closing
    }

# -------------------------------
# Monthly Report
# -------------------------------
@router.get("/monthly/{fuel}/{year}/{month}")
async def monthly_report(fuel: FuelType, year: int, month: int, db: AsyncSession = Depends(get_db)):
    from calendar import monthrange
    start = date(year, month, 1)
    end   = date(year, month, monthrange(year, month)[1])

    opening = await closing_on(db, fuel, start - timedelta(days=1))
    initial = await sum_tx(db, fuel, start, end, [TxType.INITIAL])
    receipt = await sum_tx(db, fuel, start, end, [TxType.RECEIPT])
    usage   = await sum_tx(db, fuel, start, end, [TxType.USAGE])

    closing = opening + initial + receipt - usage

    return {
        "year": year,
        "month": month,
        "fuel": fuel.value,
        "opening": opening,
        "initial": initial,
        "receipt": receipt,
        "usage": usage,
        "closing": closing
    }

# -------------------------------
# Yearly Report
# -------------------------------
@router.get("/yearly/{fuel}/{year}")
async def yearly_report(fuel: FuelType, year: int, db: AsyncSession = Depends(get_db)):
    start = date(year, 1, 1)
    end   = date(year, 12, 31)

    opening = await closing_on(db, fuel, start - timedelta(days=1))
    initial = await sum_tx(db, fuel, start, end, [TxType.INITIAL])
    receipt = await sum_tx(db, fuel, start, end, [TxType.RECEIPT])
    usage   = await sum_tx(db, fuel, start, end, [TxType.USAGE])

    closing = opening + initial + receipt - usage

    return {
        "year": year,
        "fuel": fuel.value,
        "opening": opening,
        "initial": initial,
        "receipt": receipt,
        "usage": usage,
        "closing": closing
    }
