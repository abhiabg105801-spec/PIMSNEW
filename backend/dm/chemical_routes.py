from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from database import get_db
from .chemical_crud import *
from .chemical_schemas import *

router = APIRouter(prefix="/api/chemical", tags=["Chemical Stock"])


# ================= MASTER =================
@router.post("/master")
async def add_master(data: ChemicalMasterCreate, db: AsyncSession = Depends(get_db)):
    return await create_chemical(db, data.dict())


@router.put("/master/{chem_id}")
async def edit_master(
    chem_id: int,
    data: ChemicalMasterUpdate,
    db: AsyncSession = Depends(get_db)
):
    chem = await update_chemical(db, chem_id, data.dict())
    if not chem:
        raise HTTPException(404, "Chemical not found")
    return chem


@router.get("/master")
async def get_master(db: AsyncSession = Depends(get_db)):
    return await list_chemicals(db)


# ================= TRANSACTIONS =================
@router.post("/txn")
async def add_transaction(
    data: ChemicalStockTxnCreate,
    db: AsyncSession = Depends(get_db)
):
    return await add_txn(db, data.dict())


@router.get("/txn")
async def list_transactions(
    start: str,
    end: str,
    db: AsyncSession = Depends(get_db)
):
    s = datetime.strptime(start, "%Y-%m-%d").date()
    e = datetime.strptime(end, "%Y-%m-%d").date()
    return await list_txns(db, s, e)

# ================= UPDATE TXN =================
@router.put("/txn/{txn_id}")
async def update_transaction(
    txn_id: int,
    data: ChemicalStockTxnCreate,
    db: AsyncSession = Depends(get_db),
):
    txn = await update_txn(db, txn_id, data.dict())
    if not txn:
        raise HTTPException(404, "Transaction not found")
    return txn


# ================= DELETE TXN =================
@router.delete("/txn/{txn_id}")
async def delete_transaction(
    txn_id: int,
    db: AsyncSession = Depends(get_db),
):
    ok = await delete_txn(db, txn_id)
    if not ok:
        raise HTTPException(404, "Transaction not found")
    return {"deleted": txn_id}
