from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from .chemical_models import ChemicalMasterDB, ChemicalStockTxnDB


# =====================================================
# MASTER
# =====================================================
async def create_chemical(db: AsyncSession, data):
    chem = ChemicalMasterDB(**data)
    db.add(chem)
    await db.commit()
    await db.refresh(chem)
    return chem


async def update_chemical(db: AsyncSession, chem_id: int, data):
    chem = await db.get(ChemicalMasterDB, chem_id)
    if not chem:
        return None

    for k, v in data.items():
        if v is not None:
            setattr(chem, k, v)

    await db.commit()
    await db.refresh(chem)
    return chem


async def list_chemicals(db: AsyncSession):
    stmt = select(ChemicalMasterDB)
    return (await db.execute(stmt)).scalars().all()


# =====================================================
# TRANSACTIONS
# =====================================================
async def add_txn(db: AsyncSession, data):
    txn = ChemicalStockTxnDB(**data)
    db.add(txn)

    # update available qty
    chem = await db.get(ChemicalMasterDB, data["chemical_id"])
    if data["txn_type"] == "IN":
        chem.available_qty += data["quantity"]
    else:
        chem.available_qty -= data["quantity"]

    await db.commit()
    await db.refresh(txn)
    return txn


async def list_txns(db: AsyncSession, start, end):
    stmt = (
        select(ChemicalStockTxnDB)
        .where(ChemicalStockTxnDB.txn_date.between(start, end))
        .order_by(ChemicalStockTxnDB.txn_date.desc())
    )
    return (await db.execute(stmt)).scalars().all()
# =====================================================
# UPDATE TRANSACTION WITH STOCK ROLLBACK
# =====================================================
async def update_txn(db: AsyncSession, txn_id: int, data):
    txn = await db.get(ChemicalStockTxnDB, txn_id)
    if not txn:
        return None

    chem = await db.get(ChemicalMasterDB, txn.chemical_id)

    # ---- ROLLBACK OLD TXN ----
    if txn.txn_type == "IN":
        chem.available_qty -= txn.quantity
    else:
        chem.available_qty += txn.quantity

    # ---- APPLY NEW TXN ----
    txn.txn_type = data["txn_type"]
    txn.txn_date = data["txn_date"]
    txn.txn_time = data["txn_time"]
    txn.quantity = data["quantity"]
    txn.feed_point = data.get("feed_point")
    txn.feeding_rate = data.get("feeding_rate")
    txn.reason = data.get("reason")
    txn.remarks = data.get("remarks")

    if data["txn_type"] == "IN":
        chem.available_qty += data["quantity"]
    else:
        chem.available_qty -= data["quantity"]

    await db.commit()
    await db.refresh(txn)
    return txn


# =====================================================
# DELETE TRANSACTION WITH STOCK ROLLBACK
# =====================================================
async def delete_txn(db: AsyncSession, txn_id: int):
    txn = await db.get(ChemicalStockTxnDB, txn_id)
    if not txn:
        return False

    chem = await db.get(ChemicalMasterDB, txn.chemical_id)

    # rollback
    if txn.txn_type == "IN":
        chem.available_qty -= txn.quantity
    else:
        chem.available_qty += txn.quantity

    await db.delete(txn)
    await db.commit()
    return True
