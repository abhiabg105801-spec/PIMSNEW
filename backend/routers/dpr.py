from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, datetime
from database import get_db
from models import KPIRecordDB

router = APIRouter(prefix="/api/dpr", tags=["DPR"])

# --- Helper Functions ---

def get_fiscal_year_start(report_date: date):
    """Returns April 1st of the relevant fiscal year."""
    if report_date.month < 4:
        return date(report_date.year - 1, 4, 1)
    return date(report_date.year, 4, 1)

def normalize_key(kpi_name: str):
    """
    Standardizes KPI names by removing unit prefixes.
    Handles both 'unit-1_' (from Unit Entry) and 'unit1_' (from Station Entry).
    """
    # List of prefixes to strip. ORDER MATTERS: Specific ones first if needed.
    prefixes = [
        "unit-1_", "unit-2_",  # From Unit Entry Page (lowercase with dash)
        "unit1_", "unit2_",    # From Station Entry Page (often no dash)
        "station_", "14 mw_"   # Other potential prefixes
    ]
    
    clean_name = kpi_name.lower() # Ensure we work with lowercase
    
    for prefix in prefixes:
        if clean_name.startswith(prefix):
            return clean_name.replace(prefix, "")
            
    return clean_name

# --- Main Endpoint ---

@router.get("/page1")
async def get_dpr_page1(date_str: str = Query(..., alias="date"), db: AsyncSession = Depends(get_db)):
    try:
        report_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    # 1. Define Time Ranges
    fiscal_start = get_fiscal_year_start(report_date)
    month_start = date(report_date.year, report_date.month, 1)

    # 2. Fetch Raw Data (Async)
    query = select(KPIRecordDB).filter(
        KPIRecordDB.report_date >= fiscal_start,
        KPIRecordDB.report_date <= report_date,
        KPIRecordDB.plant_name.in_(["Unit-1", "Unit-2"])
    )
    
    result = await db.execute(query)
    raw_records = result.scalars().all()

    # 3. Initialize Data Structure
    # structure: data[unit][kpi][period] = value
    data = {
        "Unit-1": {},
        "Unit-2": {},
        "Station": {}
    }

    # Helper to init kpi if missing
    def init_kpi(unit, kpi):
        if kpi not in data[unit]:
            data[unit][kpi] = {"day": 0.0, "mon": 0.0, "year": 0.0, "mon_count": 0, "year_count": 0}

    # 4. Aggregate Unit Data
    for row in raw_records:
        unit = row.plant_name
        kpi = normalize_key(row.kpi_name) # Uses the fixed normalization
        val = row.kpi_value or 0.0
        r_date = row.report_date

        init_kpi(unit, kpi)

        # Year-to-Date
        data[unit][kpi]["year"] += val
        data[unit][kpi]["year_count"] += 1

        # Month-to-Date
        if r_date >= month_start:
            data[unit][kpi]["mon"] += val
            data[unit][kpi]["mon_count"] += 1
        
        # Day (Specific Report Date)
        if r_date == report_date:
            data[unit][kpi]["day"] = val

    # 5. Post-Process Units (Handle Averages for Rates like PLF)
    # These KPIs should be Averaged, not Summed over time
    RATE_KPIS = [
        "plf_percent", "plant_availability_percent", "aux_power_percent", 
        "specific_coal", "specific_oil", "specific_steam", 
        "sp_dm_water_consumption_percent"
    ]

    for unit in ["Unit-1", "Unit-2"]:
        for kpi, values in data[unit].items():
            if kpi in RATE_KPIS:
                if values["mon_count"] > 0:
                    values["mon"] /= values["mon_count"]
                if values["year_count"] > 0:
                    values["year"] /= values["year_count"]

    # 6. Calculate Station Data
    # Get unique list of KPIs found in either unit
    all_kpis = set(data["Unit-1"].keys()) | set(data["Unit-2"].keys())

    for kpi in all_kpis:
        init_kpi("Station", kpi)
        
        # Get values (default to 0 if missing)
        u1 = data["Unit-1"].get(kpi, {})
        u2 = data["Unit-2"].get(kpi, {})
        
        u1_day, u2_day = u1.get("day", 0), u2.get("day", 0)
        u1_mon, u2_mon = u1.get("mon", 0), u2.get("mon", 0)
        u1_year, u2_year = u1.get("year", 0), u2.get("year", 0)

        if kpi in RATE_KPIS:
            # Station Rate = (U1 + U2) / 2
            data["Station"][kpi]["day"] = (u1_day + u2_day) / 2
            data["Station"][kpi]["mon"] = (u1_mon + u2_mon) / 2
            data["Station"][kpi]["year"] = (u1_year + u2_year) / 2
        else:
            # Station Sum = U1 + U2
            data["Station"][kpi]["day"] = u1_day + u2_day
            data["Station"][kpi]["mon"] = u1_mon + u2_mon
            data["Station"][kpi]["year"] = u1_year + u2_year

    # 7. Final Response
    return {
        "date": str(report_date),
        "data": data
    }