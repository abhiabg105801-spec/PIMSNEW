# services/kpi_persistence.py
"""
Smart KPI persistence - only updates changed KPIs
"""

from datetime import datetime, timezone, date
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Dict, Any, Set
import logging

from models import KPIRecordDB

logger = logging.getLogger(__name__)


async def smart_save_kpis_to_db(
    db: AsyncSession,
    report_date: date,
    new_kpis: Dict[str, Dict[str, float]],
    changed_totalizers: Set[int],  # ✅ Which totalizers changed
    username: str = "system"
):
    """
    Smart save: Only update KPIs that depend on changed totalizers
    
    Args:
        report_date: Date to save KPIs for
        new_kpis: Newly calculated KPIs
        changed_totalizers: Set of totalizer IDs that were modified
        username: Who made the change
    """
    
    logger.info(f"💾 Smart KPI save for {report_date}")
    logger.info(f"   Changed totalizers: {changed_totalizers}")
    
    # Map totalizers to their dependent KPIs
    affected_kpis = get_affected_kpis(changed_totalizers)
    
    logger.info(f"   Affected KPIs: {affected_kpis}")
    
    # Load existing KPIs from database
    existing_kpis = await load_kpis_from_db(db, report_date)
    
    updated_count = 0
    unchanged_count = 0
    
    for unit_name, unit_kpis in new_kpis.items():
        for kpi_name, kpi_value in unit_kpis.items():
            
            if kpi_value is None or kpi_value == "" or (isinstance(kpi_value, float) and kpi_value != kpi_value):
                continue
            
            # ✅ Skip if this KPI is not affected by the changed totalizers
            kpi_full_name = f"{unit_name}.{kpi_name}"
            if kpi_full_name not in affected_kpis:
                unchanged_count += 1
                continue
            
            # ✅ Check if value actually changed
            old_value = existing_kpis.get(unit_name, {}).get(kpi_name)
            
            try:
                kpi_value_float = float(kpi_value)
            except (TypeError, ValueError):
                continue
            
            # If value unchanged, skip update
            if old_value is not None and abs(old_value - kpi_value_float) < 0.0001:
                unchanged_count += 1
                continue
            
            # ✅ Update only this specific KPI
            stmt = select(KPIRecordDB).where(
                KPIRecordDB.report_date == report_date,
                KPIRecordDB.kpi_type == "auto",
                KPIRecordDB.plant_name == unit_name,
                KPIRecordDB.kpi_name == kpi_name,
            )
            
            result = await db.execute(stmt)
            existing = result.scalars().first()
            
            if existing:
                existing.kpi_value = kpi_value_float
                existing.username = username
                existing.updated_at = datetime.now(timezone.utc)
                logger.info(f"   ✏️  Updated: {kpi_full_name} = {kpi_value_float:.3f}")
            else:
                record = KPIRecordDB(
                    report_date=report_date,
                    kpi_type="auto",
                    plant_name=unit_name,
                    kpi_name=kpi_name,
                    kpi_value=kpi_value_float,
                    username=username,
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                db.add(record)
                logger.info(f"   ➕ Created: {kpi_full_name} = {kpi_value_float:.3f}")
            
            updated_count += 1
    
    await db.commit()
    
    logger.info(f"✅ Updated {updated_count} KPIs, skipped {unchanged_count} unchanged KPIs")
    
    return updated_count


def get_affected_kpis(changed_totalizer_ids: Set[int]) -> Set[str]:
    """
    Map changed totalizers to their dependent KPIs
    Returns set of affected KPI names in format "Unit.kpi_name"
    """
    
    # Define dependencies: totalizer_id -> affected KPIs
    DEPENDENCIES = {
        # Unit-1 feeders (1-5) affect coal KPIs
        1: {"Unit-1.coal_consumption", "Unit-1.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        2: {"Unit-1.coal_consumption", "Unit-1.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        3: {"Unit-1.coal_consumption", "Unit-1.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        4: {"Unit-1.coal_consumption", "Unit-1.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        5: {"Unit-1.coal_consumption", "Unit-1.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        
        # Unit-1 LDO (6)
        6: {"Unit-1.oil_consumption", "Unit-1.specific_oil", "Station.oil_consumption", "Station.specific_oil"},
        
        # Unit-1 DM water (7-8)
        7: {"Unit-1.dm_water", "Unit-1.specific_dm_percent", "Station.dm_water", "Station.specific_dm_percent"},
        8: {"Unit-1.dm_water", "Unit-1.specific_dm_percent", "Station.dm_water", "Station.specific_dm_percent"},
        
        # Unit-1 steam (9)
        9: {"Unit-1.steam_generation", "Unit-1.specific_steam", "Unit-1.specific_dm_percent", "Station.steam_generation", "Station.specific_steam", "Station.specific_dm_percent"},
        
        # Unit-2 feeders (11-15)
        11: {"Unit-2.coal_consumption", "Unit-2.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        12: {"Unit-2.coal_consumption", "Unit-2.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        13: {"Unit-2.coal_consumption", "Unit-2.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        14: {"Unit-2.coal_consumption", "Unit-2.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        15: {"Unit-2.coal_consumption", "Unit-2.specific_coal", "Station.coal_consumption", "Station.specific_coal"},
        
        # Unit-2 LDO (16)
        16: {"Unit-2.oil_consumption", "Unit-2.specific_oil", "Station.oil_consumption", "Station.specific_oil"},
        
        # Unit-2 DM water (17-18)
        17: {"Unit-2.dm_water", "Unit-2.specific_dm_percent", "Station.dm_water", "Station.specific_dm_percent"},
        18: {"Unit-2.dm_water", "Unit-2.specific_dm_percent", "Station.dm_water", "Station.specific_dm_percent"},
        
        # Unit-2 steam (19)
        19: {"Unit-2.steam_generation", "Unit-2.specific_steam", "Unit-2.specific_dm_percent", "Station.steam_generation", "Station.specific_steam", "Station.specific_dm_percent"},
        
        # Station raw water (21)
        21: {"Station.total_raw_water_used_m3", "Station.avg_raw_water_m3_per_hr", "Station.sp_raw_water_l_per_kwh"},
        
        # Energy meters (22-38) - affect ALL energy and generation KPIs
        22: {"Unit-1.generation", "Unit-1.plf_percent", "Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-1.specific_coal", "Unit-1.specific_oil", "Unit-1.specific_steam", "Station.generation", "Station.plf_percent", "Station.aux_power", "Station.aux_power_percent", "Station.specific_coal", "Station.specific_oil", "Station.specific_steam", "Station.stn_net_export_mu", "Station.sp_raw_water_l_per_kwh"},
        23: {"Unit-2.generation", "Unit-2.plf_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Unit-2.specific_coal", "Unit-2.specific_oil", "Unit-2.specific_steam", "Station.generation", "Station.plf_percent", "Station.aux_power", "Station.aux_power_percent", "Station.specific_coal", "Station.specific_oil", "Station.specific_steam", "Station.stn_net_export_mu", "Station.sp_raw_water_l_per_kwh"},
        24: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        25: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        26: {"Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        27: {"Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        28: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        29: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        30: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        31: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        32: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        33: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        34: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        35: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        36: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        37: {"Unit-1.aux_power", "Unit-1.aux_power_percent", "Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
        38: {"Unit-2.aux_power", "Unit-2.aux_power_percent", "Station.aux_power", "Station.aux_power_percent", "Station.stn_net_export_mu"},
    }
    
    affected = set()
    
    for tid in changed_totalizer_ids:
        if tid in DEPENDENCIES:
            affected.update(DEPENDENCIES[tid])
    
    return affected


async def load_kpis_from_db(
    db: AsyncSession,
    report_date: date
) -> Dict[str, Dict[str, float]]:
    """
    Load ALL KPIs from database (both auto and manual)
    Returns: {"Unit-1": {...}, "Unit-2": {...}, "Station": {...}}
    """
    
    stmt = select(KPIRecordDB).where(
        KPIRecordDB.report_date == report_date
    )
    
    result = await db.execute(stmt)
    records = result.scalars().all()
    
    kpis = {
        "Unit-1": {},
        "Unit-2": {},
        "Station": {}
    }
    
    for record in records:
        plant = record.plant_name
        kpi_name = record.kpi_name
        kpi_value = float(record.kpi_value) if record.kpi_value is not None else None
        
        if plant in kpis:
            kpis[plant][kpi_name] = kpi_value
    
    return kpis