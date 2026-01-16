# scripts/setup_kpi_offsets.py
"""
Setup historical KPI offsets for system go-live
Run this ONCE when system goes live mid-month or mid-year
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, datetime
from models import Base, KPIOffsetDB

DATABASE_URL = "sqlite:///./pims.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def setup_month_offsets(
    go_live_date: date,
    month_start: date,
    offsets: dict,
    configured_by: str = "system_admin"
):
    """
    Setup monthly offsets for partial month before go-live
    
    Args:
        go_live_date: Date when system starts (e.g., 2025-06-15)
        month_start: Start of that month (e.g., 2025-06-01)
        offsets: Dict of {"Unit-1": {"generation": 75.5, "coal_consumption": 9500, ...}, ...}
        configured_by: Username
    
    Example:
        If go-live is June 15, 2025:
        - month_start = 2025-06-01
        - period_end = 2025-06-14
        - offsets = accumulated values from June 1-14
    """
    
    session = SessionLocal()
    period_end = date(go_live_date.year, go_live_date.month, go_live_date.day - 1)
    
    for plant_name, plant_kpis in offsets.items():
        for kpi_name, offset_value in plant_kpis.items():
            
            offset_record = KPIOffsetDB(
                period_type="month",
                period_start_date=month_start,
                period_end_date=period_end,
                plant_name=plant_name,
                kpi_name=kpi_name,
                offset_value=offset_value,
                reason="System go-live mid-month",
                source="Manual records from previous system",
                notes=f"Accumulated {kpi_name} from {month_start} to {period_end}",
                configured_by=configured_by,
                configured_at=datetime.now(),
            )
            
            session.add(offset_record)
    
    session.commit()
    print(f"✅ Month offsets configured for {len(offsets)} plants")
    session.close()


def setup_year_offsets(
    go_live_date: date,
    year_start: date,
    offsets: dict,
    configured_by: str = "system_admin"
):
    """
    Setup yearly offsets for partial year before go-live
    
    Args:
        go_live_date: Date when system starts (e.g., 2025-06-15)
        year_start: Start of financial year (e.g., 2025-04-01)
        offsets: Dict of accumulated values from year start to day before go-live
    
    Example:
        If go-live is June 15, 2025 (FY starts April 1):
        - year_start = 2025-04-01
        - period_end = 2025-06-14
        - offsets = accumulated values from April 1 to June 14
    """
    
    session = SessionLocal()
    period_end = date(go_live_date.year, go_live_date.month, go_live_date.day - 1)
    
    for plant_name, plant_kpis in offsets.items():
        for kpi_name, offset_value in plant_kpis.items():
            
            offset_record = KPIOffsetDB(
                period_type="year",
                period_start_date=year_start,
                period_end_date=period_end,
                plant_name=plant_name,
                kpi_name=kpi_name,
                offset_value=offset_value,
                reason="System go-live mid-year",
                source="Manual records from previous system",
                notes=f"Accumulated {kpi_name} from {year_start} to {period_end}",
                configured_by=configured_by,
                configured_at=datetime.now(),
            )
            
            session.add(offset_record)
    
    session.commit()
    print(f"✅ Year offsets configured for {len(offsets)} plants")
    session.close()


if __name__ == "__main__":
    # Create tables
    Base.metadata.create_all(engine)
    
    # Example: System goes live on June 15, 2025
    GO_LIVE_DATE = date(2025, 6, 15)
    MONTH_START = date(2025, 6, 1)
    YEAR_START = date(2025, 4, 1)  # Financial year starts April 1
    
    # ========== MONTH OFFSETS (June 1-14, 2025) ==========
    # These are ACCUMULATED values from June 1-14
    MONTH_OFFSETS = {
        "Unit-1": {
            "generation": 75.5,              # MU accumulated in 14 days
            "coal_consumption": 9500.0,      # Tons
            "oil_consumption": 125.5,        # KL
            "steam_generation": 95000.0,     # Tons
            "dm_water": 1200.0,              # Cu.M
            "aux_power": 4.2,                # MU
            "running_hour": 320.0,           # Hours
            "planned_outage_hour": 16.0,     # Hours
            "strategic_outage_hour": 0.0,
        },
        "Unit-2": {
            "generation": 73.2,
            "coal_consumption": 9200.0,
            "oil_consumption": 120.0,
            "steam_generation": 92000.0,
            "dm_water": 1150.0,
            "aux_power": 4.1,
            "running_hour": 310.0,
            "planned_outage_hour": 26.0,
            "strategic_outage_hour": 0.0,
        },
        "Station": {
            "generation": 148.7,             # Unit-1 + Unit-2
            "coal_consumption": 18700.0,
            "oil_consumption": 245.5,
            "steam_generation": 187000.0,
            "dm_water": 2350.0,
            "aux_power": 8.3,
            "running_hour": 630.0,
            "planned_outage_hour": 42.0,
            "strategic_outage_hour": 0.0,
            "total_raw_water_used_m3": 12500.0,
            "total_dm_water_used_m3": 2350.0,
            "stn_net_export_mu": 140.4,
            "ro_running_hour": 320.0,
            "ro_production_cum": 850.0,
        },
    }
    
    # ========== YEAR OFFSETS (April 1 - June 14, 2025) ==========
    # These are ACCUMULATED values from April 1 to June 14
    YEAR_OFFSETS = {
        "Unit-1": {
            "generation": 385.2,             # MU accumulated in 75 days
            "coal_consumption": 48500.0,     # Tons
            "oil_consumption": 640.0,        # KL
            "steam_generation": 485000.0,    # Tons
            "dm_water": 6200.0,              # Cu.M
            "aux_power": 21.5,               # MU
            "running_hour": 1680.0,          # Hours
            "planned_outage_hour": 85.0,     # Hours
            "strategic_outage_hour": 35.0,
        },
        "Unit-2": {
            "generation": 372.8,
            "coal_consumption": 46900.0,
            "oil_consumption": 615.0,
            "steam_generation": 469000.0,
            "dm_water": 6000.0,
            "aux_power": 20.8,
            "running_hour": 1620.0,
            "planned_outage_hour": 120.0,
            "strategic_outage_hour": 60.0,
        },
        "Station": {
            "generation": 758.0,
            "coal_consumption": 95400.0,
            "oil_consumption": 1255.0,
            "steam_generation": 954000.0,
            "dm_water": 12200.0,
            "aux_power": 42.3,
            "running_hour": 3300.0,
            "planned_outage_hour": 205.0,
            "strategic_outage_hour": 95.0,
            "total_raw_water_used_m3": 65000.0,
            "total_dm_water_used_m3": 12200.0,
            "stn_net_export_mu": 715.7,
            "ro_running_hour": 1680.0,
            "ro_production_cum": 4500.0,
        },
    }
    
    # Setup offsets
    setup_month_offsets(GO_LIVE_DATE, MONTH_START, MONTH_OFFSETS)
    setup_year_offsets(GO_LIVE_DATE, YEAR_START, YEAR_OFFSETS)
    
    print("🎉 KPI offsets setup complete!")