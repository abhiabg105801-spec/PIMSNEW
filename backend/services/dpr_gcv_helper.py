# backend/services/dpr_gcv_helper.py
"""
Helper functions to fetch GCV from dm_entries (DMEntryDB) and calculate heat rate for DPR
UPDATED: Uses DMEntryDB table with broad_area column for Unit-1/Unit-2 filtering
"""

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import date
from dm.dm_models import DMEntryDB  # ✅ Correct model name
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)


async def fetch_gcv_for_unit(db: AsyncSession, target_date: date, unit: str) -> Optional[float]:
    """
    Fetch average GCV for a specific unit and date from dm_entries.
    
    Args:
        db: Database session
        target_date: Date to fetch GCV for
        unit: Unit name ("Unit-1" or "Unit-2")
    
    Returns:
        Average GCV value or None if no data found
    """
    try:
        # Query dm_entries for GCV parameter
        # ✅ Filter by: date, broad_area (Unit-1/Unit-2), and parameter = 'gcv'
        stmt = select(func.avg(DMEntryDB.value)).where(
            DMEntryDB.date == target_date,
            DMEntryDB.broad_area == unit,  # ✅ Changed from 'unit' to 'broad_area'
            DMEntryDB.parameter == 'gcv'
        )
        
        result = await db.execute(stmt)
        avg_gcv = result.scalar()
        
        if avg_gcv is not None:
            logger.info(f"✓ GCV for {unit} on {target_date}: {avg_gcv:.2f} kcal/kg")
            return float(avg_gcv)
        else:
            logger.warning(f"⚠ No GCV data found for {unit} on {target_date}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error fetching GCV for {unit} on {target_date}: {e}")
        return None


async def fetch_gcv_for_all_units(db: AsyncSession, target_date: date) -> Dict[str, Optional[float]]:
    """
    Fetch average GCV for all units (Unit-1, Unit-2, Station) for a given date.
    
    Args:
        db: Database session
        target_date: Date to fetch GCV for
    
    Returns:
        Dictionary with unit names as keys and GCV values
    """
    result = {}
    
    # Fetch GCV for Unit-1
    result["Unit-1"] = await fetch_gcv_for_unit(db, target_date, "Unit-1")
    
    # Fetch GCV for Unit-2
    result["Unit-2"] = await fetch_gcv_for_unit(db, target_date, "Unit-2")
    
    # Calculate Station GCV as average of both units
    gcv_unit1 = result["Unit-1"]
    gcv_unit2 = result["Unit-2"]
    
    if gcv_unit1 is not None and gcv_unit2 is not None:
        result["Station"] = (gcv_unit1 + gcv_unit2) / 2.0
        logger.info(f"✓ Station GCV: {result['Station']:.2f} kcal/kg (average of both units)")
    elif gcv_unit1 is not None:
        result["Station"] = gcv_unit1
        logger.info(f"✓ Station GCV: {result['Station']:.2f} kcal/kg (Unit-1 only)")
    elif gcv_unit2 is not None:
        result["Station"] = gcv_unit2
        logger.info(f"✓ Station GCV: {result['Station']:.2f} kcal/kg (Unit-2 only)")
    else:
        result["Station"] = None
        logger.warning("⚠ No GCV data for Station (no unit data available)")
    
    return result


def calculate_heat_rate(gcv: Optional[float], specific_coal: Optional[float]) -> Optional[float]:
    """
    Calculate heat rate from GCV and specific coal consumption.
    
    Formula: Heat Rate (kcal/kWh) = GCV (kcal/kg) × Specific Coal (kg/kWh)
    
    Args:
        gcv: Gross Calorific Value in kcal/kg
        specific_coal: Specific coal consumption in kg/kWh
    
    Returns:
        Heat rate in kcal/kWh or None if inputs are invalid
    """
    if gcv is None or specific_coal is None:
        return None
    
    if gcv <= 0 or specific_coal <= 0:
        return None
    
    heat_rate = gcv * specific_coal
    logger.debug(f"Heat Rate = {gcv:.2f} × {specific_coal:.3f} = {heat_rate:.2f} kcal/kWh")
    
    return heat_rate


async def enrich_kpis_with_gcv_and_heat_rate(
    db: AsyncSession,
    target_date: date,
    kpi_data: Dict[str, Dict[str, Dict[str, Optional[float]]]]
) -> Dict[str, Dict[str, Dict[str, Optional[float]]]]:
    """
    Enrich KPI data with GCV from dm_entries and calculated heat rate.
    
    Args:
        db: Database session
        target_date: Date to fetch GCV for (day period)
        kpi_data: Existing KPI data structure:
                  {
                      "Unit-1": {
                          "specific_coal": {"day": 0.85, "month": 0.82, "year": 0.83},
                          "gcv": {"day": None, "month": None, "year": None},
                          ...
                      },
                      ...
                  }
    
    Returns:
        Updated KPI data with GCV and heat rate populated
    """
    
    logger.info(f"🔬 Enriching KPIs with GCV from dm_entries (DMEntryDB) for {target_date}")
    
    # Fetch GCV for all units
    gcv_values = await fetch_gcv_for_all_units(db, target_date)
    
    # Update KPI data for each unit
    for unit in ["Unit-1", "Unit-2", "Station"]:
        if unit not in kpi_data:
            continue
        
        gcv = gcv_values.get(unit)
        
        # Set GCV for day period (same for all periods since it's a daily measurement)
        if "gcv" in kpi_data[unit]:
            kpi_data[unit]["gcv"]["day"] = gcv
            # Note: Month and year will be calculated separately in enrich_kpis_with_period_gcv
            kpi_data[unit]["gcv"]["month"] = gcv
            kpi_data[unit]["gcv"]["year"] = gcv
        
        # Calculate heat rate for each period
        if "heat_rate" in kpi_data[unit] and "specific_coal" in kpi_data[unit]:
            for period in ["day", "month", "year"]:
                specific_coal = kpi_data[unit]["specific_coal"].get(period)
                heat_rate = calculate_heat_rate(gcv, specific_coal)
                kpi_data[unit]["heat_rate"][period] = heat_rate
                
                if heat_rate:
                    logger.info(f"✓ {unit} {period} Heat Rate: {heat_rate:.2f} kcal/kWh")
    
    return kpi_data


async def fetch_avg_gcv_for_date_range(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    unit: str
) -> Optional[float]:
    """
    Fetch average GCV for a date range (for month/year calculations).
    
    Args:
        db: Database session
        start_date: Start date of range
        end_date: End date of range
        unit: Unit name ("Unit-1" or "Unit-2")
    
    Returns:
        Average GCV across the date range or None
    """
    try:
        # ✅ Use DMEntryDB with broad_area filter
        stmt = select(func.avg(DMEntryDB.value)).where(
            DMEntryDB.date >= start_date,
            DMEntryDB.date <= end_date,
            DMEntryDB.broad_area == unit,  # ✅ Changed from 'unit' to 'broad_area'
            DMEntryDB.parameter == 'gcv'
        )
        
        result = await db.execute(stmt)
        avg_gcv = result.scalar()
        
        if avg_gcv is not None:
            logger.info(f"✓ Average GCV for {unit} ({start_date} to {end_date}): {avg_gcv:.2f} kcal/kg")
            return float(avg_gcv)
        else:
            logger.warning(f"⚠ No GCV data for {unit} in range {start_date} to {end_date}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error fetching GCV range for {unit}: {e}")
        return None


async def enrich_kpis_with_period_gcv(
    db: AsyncSession,
    report_date: date,
    kpi_data: Dict[str, Dict[str, Dict[str, Optional[float]]]],
    date_ranges: Dict[str, tuple]
) -> Dict[str, Dict[str, Dict[str, Optional[float]]]]:
    """
    Enhanced version that fetches GCV for each period (day/month/year) from dm_entries.
    
    Args:
        db: Database session
        report_date: The report date (for "day" period)
        kpi_data: Existing KPI data
        date_ranges: Dictionary with period names and (start_date, end_date) tuples
                     e.g., {"day": (date, date), "month": (start, end), "year": (start, end)}
    
    Returns:
        Updated KPI data with GCV and heat rate for all periods
    """
    
    logger.info("=" * 70)
    logger.info("🔬 FETCHING GCV FROM dm_entries (DMEntryDB)")
    logger.info(f"   Table: DMEntryDB | Filter Column: broad_area | Parameter: gcv")
    logger.info("=" * 70)
    
    for unit in ["Unit-1", "Unit-2", "Station"]:
        if unit not in kpi_data:
            continue
        
        logger.info(f"\n📊 Processing {unit}:")
        
        # Fetch GCV for each period
        for period, (start_date, end_date) in date_ranges.items():
            if unit == "Station":
                # Station GCV is average of units
                gcv_unit1 = await fetch_avg_gcv_for_date_range(db, start_date, end_date, "Unit-1")
                gcv_unit2 = await fetch_avg_gcv_for_date_range(db, start_date, end_date, "Unit-2")
                
                if gcv_unit1 is not None and gcv_unit2 is not None:
                    gcv = (gcv_unit1 + gcv_unit2) / 2.0
                    logger.info(f"   {period.upper()}: {gcv:.2f} kcal/kg (avg of both units)")
                elif gcv_unit1 is not None:
                    gcv = gcv_unit1
                    logger.info(f"   {period.upper()}: {gcv:.2f} kcal/kg (Unit-1 only)")
                elif gcv_unit2 is not None:
                    gcv = gcv_unit2
                    logger.info(f"   {period.upper()}: {gcv:.2f} kcal/kg (Unit-2 only)")
                else:
                    gcv = None
                    logger.warning(f"   {period.upper()}: No GCV data")
            else:
                gcv = await fetch_avg_gcv_for_date_range(db, start_date, end_date, unit)
                if gcv:
                    logger.info(f"   {period.upper()}: {gcv:.2f} kcal/kg")
                else:
                    logger.warning(f"   {period.upper()}: No GCV data")
            
            # Set GCV
            if "gcv" in kpi_data[unit]:
                kpi_data[unit]["gcv"][period] = gcv
            
            # Calculate heat rate
            if "heat_rate" in kpi_data[unit] and "specific_coal" in kpi_data[unit]:
                specific_coal = kpi_data[unit]["specific_coal"].get(period)
                heat_rate = calculate_heat_rate(gcv, specific_coal)
                kpi_data[unit]["heat_rate"][period] = heat_rate
                
                if heat_rate:
                    logger.info(f"   {period.upper()} Heat Rate: {heat_rate:.2f} kcal/kWh (GCV × Specific Coal)")
    
    logger.info("=" * 70)
    logger.info("✅ GCV & Heat Rate enrichment complete")
    logger.info("=" * 70)
    
    return kpi_data


async def fetch_gcv_with_module_filter(
    db: AsyncSession,
    start_date: date,
    end_date: date,
    unit: str,
    module: str = "proximate"
) -> Optional[float]:
    """
    Fetch GCV with additional module filter (optional - for future use).
    
    This is useful if you have multiple modules storing GCV data
    and want to specifically get it from proximate analysis module.
    
    Args:
        db: Database session
        start_date: Start date
        end_date: End date
        unit: Unit name ("Unit-1" or "Unit-2")
        module: Module name (default: "proximate")
    
    Returns:
        Average GCV or None
    """
    try:
        stmt = select(func.avg(DMEntryDB.value)).where(
            DMEntryDB.date >= start_date,
            DMEntryDB.date <= end_date,
            DMEntryDB.broad_area == unit,
            DMEntryDB.parameter == 'gcv',
            DMEntryDB.module == module  # Additional filter
        )
        
        result = await db.execute(stmt)
        avg_gcv = result.scalar()
        
        if avg_gcv is not None:
            logger.info(f"✓ GCV from {module} module for {unit}: {avg_gcv:.2f} kcal/kg")
            return float(avg_gcv)
        else:
            logger.warning(f"⚠ No GCV in {module} module for {unit}")
            return None
            
    except Exception as e:
        logger.error(f"❌ Error fetching GCV from {module}: {e}")
        return None


# ============================================================================
#  DEBUG HELPERS
# ============================================================================

async def debug_gcv_data(db: AsyncSession, target_date: date):
    """
    Debug function to check what GCV data exists in the database.
    Useful for troubleshooting.
    """
    logger.info("\n" + "=" * 70)
    logger.info("🔍 DEBUG: Checking GCV data in dm_entries")
    logger.info("=" * 70)
    
    # Query all GCV entries for the date
    stmt = select(
        DMEntryDB.date,
        DMEntryDB.time,
        DMEntryDB.module,
        DMEntryDB.broad_area,
        DMEntryDB.parameter,
        DMEntryDB.value,
        DMEntryDB.sample_no
    ).where(
        DMEntryDB.date == target_date,
        DMEntryDB.parameter == 'gcv'
    ).order_by(DMEntryDB.broad_area, DMEntryDB.time)
    
    result = await db.execute(stmt)
    rows = result.all()
    
    if not rows:
        logger.warning(f"⚠ No GCV data found for {target_date}")
        logger.info("\nTip: Check if PIMS proximate analysis entries exist for this date")
        return
    
    logger.info(f"\n✓ Found {len(rows)} GCV entries:\n")
    logger.info(f"{'Date':<12} {'Time':<8} {'Module':<12} {'Unit':<10} {'GCV':<10} {'Sample No'}")
    logger.info("-" * 70)
    
    for row in rows:
        logger.info(
            f"{str(row[0]):<12} {str(row[1]):<8} {row[2]:<12} {row[3]:<10} "
            f"{row[5]:<10.2f} {row[6]}"
        )
    
    # Calculate averages
    unit1_vals = [r[5] for r in rows if r[3] == "Unit-1"]
    unit2_vals = [r[5] for r in rows if r[3] == "Unit-2"]
    
    logger.info("\n📊 Calculated Averages:")
    if unit1_vals:
        logger.info(f"   Unit-1: {sum(unit1_vals)/len(unit1_vals):.2f} kcal/kg (from {len(unit1_vals)} entries)")
    if unit2_vals:
        logger.info(f"   Unit-2: {sum(unit2_vals)/len(unit2_vals):.2f} kcal/kg (from {len(unit2_vals)} entries)")
    
    logger.info("=" * 70 + "\n")