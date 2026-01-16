# scripts/setup_totalizers.py
"""
Initial setup script for totalizer system
Run this ONCE when system goes live
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import date, datetime
from models import Base, TotalizerConfigDB, TotalizerMetadataDB
from constants.totalizer_master import TOTALIZER_MASTER

# Database connection
DATABASE_URL = "sqlite:///./pims1.db"
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(bind=engine)


def setup_totalizer_metadata():
    """Create metadata for all totalizers"""
    
    session = SessionLocal()
    
    totalizer_metadata = {
        1:  ("feeder_a", "Feeder1A Totalizer", "Unit-1", "Tons"),
        2:  ("feeder_b", "Feeder1B Totalizer", "Unit-1", "Tons"),
        3:  ("feeder_c", "Feeder1C Totalizer", "Unit-1", "Tons"),
        4:  ("feeder_d", "Feeder1D Totalizer", "Unit-1", "Tons"),
        5:  ("feeder_e", "Feeder1E Totalizer", "Unit-1", "Tons"),
        6:  ("ldo_flow", "Unit-1 LDO Flow", "Unit-1", "Liters"),
        7:  ("dm7", "Unit-1 DM7 Water", "Unit-1", "m³"),
        8:  ("dm11", "Unit-1 DM11 Water", "Unit-1", "m³"),
        9:  ("main_steam", "Unit-1 Main Steam", "Unit-1", "kg"),
        10: ("feed_water", "Unit-1 Feed Water", "Unit-1", "m³"),
        
        11: ("feeder_a", "Feeder2A Totalizer", "Unit-2", "Tons"),
        12: ("feeder_b", "Feeder2B Totalizer", "Unit-2", "Tons"),
        13: ("feeder_c", "Feeder2C Totalizer", "Unit-2", "Tons"),
        14: ("feeder_d", "Feeder2D Totalizer", "Unit-2", "Tons"),
        15: ("feeder_e", "Feeder2E Totalizer", "Unit-2", "Tons"),
        16: ("ldo_flow", "Unit-2 LDO Flow", "Unit-2", "Liters"),
        17: ("dm7", "Unit-2 DM7 Water", "Unit-2", "m³"),
        18: ("dm11", "Unit-2 DM11 Water", "Unit-2", "m³"),
        19: ("main_steam", "Unit-2 Main Steam", "Unit-2", "kg"),
        20: ("feed_water", "Unit-2 Feed Water", "Unit-2", "m³"),
        
        21: ("raw_water", "Station Raw Water", "Station", "m³"),
        
        22: ("unit1_gen", "Unit-1 Generation", "Energy-Meter", "MWh"),
        23: ("unit2_gen", "Unit-2 Generation", "Energy-Meter", "MWh"),
        24: ("1lsr01_ic1", "1LSR01 I/C-1", "Energy-Meter", "MWh"),
        25: ("1lsr02_ic1", "1LSR02 I/C-1", "Energy-Meter", "MWh"),
        26: ("2lsr01_ic1", "2LSR01 I/C-1", "Energy-Meter", "MWh"),
        27: ("2lsr02_ic1", "2LSR02 I/C-1", "Energy-Meter", "MWh"),
        28: ("rlsr01", "RLSR01", "Energy-Meter", "MWh"),
        29: ("rlsr02", "RLSR02", "Energy-Meter", "MWh"),
        30: ("rlsr03", "RLSR03", "Energy-Meter", "MWh"),
        31: ("rlsr04", "RLSR04", "Energy-Meter", "MWh"),
        32: ("1lsr01_ic2_tie", "1LSR01 I/C-2 (TIE)", "Energy-Meter", "MWh"),
        33: ("1lsr02_ic2_tie", "1LSR02 I/C-2 (TIE)", "Energy-Meter", "MWh"),
        34: ("2lsr01_ic2_tie", "2LSR01 I/C-2 (TIE)", "Energy-Meter", "MWh"),
        35: ("2lsr02_ic2_tie", "2LSR02 I/C-2 (TIE)", "Energy-Meter", "MWh"),
        36: ("SST_10", "SST_10", "Energy-Meter", "MWh"),
        37: ("UST_15", "UST_15", "Energy-Meter", "MWh"),
        38: ("UST_25", "UST-25", "Energy-Meter", "MWh"),
    }
    
    for tid, (name, display_name, unit, meas_unit) in totalizer_metadata.items():
        metadata = TotalizerMetadataDB(
            totalizer_id=tid,
            name=name,
            display_name=display_name,
            unit_name=unit,
            measurement_unit=meas_unit,
            is_active=True,
        )
        session.merge(metadata)
    
    session.commit()
    print("✅ Totalizer metadata created")
    session.close()


def setup_initial_baselines(go_live_date: date, baseline_readings: dict):
    """
    Set initial baseline values for system go-live
    
    Args:
        go_live_date: Date when system starts (e.g., 2025-01-17)
        baseline_readings: Dict of {totalizer_id: reading_value}
                          These are the "previous day closing" values
    """
    
    session = SessionLocal()
    
    for totalizer_id, baseline_value in baseline_readings.items():
        config = TotalizerConfigDB(
            totalizer_id=totalizer_id,
            config_type="initial",
            effective_date=go_live_date,
            baseline_value=baseline_value,
            reason="System go-live",
            notes="Initial baseline for first day calculation",
            configured_by="system_admin",
            configured_at=datetime.now(),
        )
        session.add(config)
    
    session.commit()
    print(f"✅ Initial baselines configured for {len(baseline_readings)} totalizers")
    session.close()


if __name__ == "__main__":
    # Create tables
    Base.metadata.create_all(engine)
    
    # Setup metadata
    setup_totalizer_metadata()
    
    # Example: Setup initial baselines for go-live date
    GO_LIVE_DATE = date(2026, 1, 14)  # Change to your actual go-live date
    
    # These are the "previous day closing readings"
    # In real scenario, get these from your existing meter readings
    INITIAL_BASELINES = {
    1: 12500.5,
    2: 11800.2,
    3: 13200.0,
    4: 12750.8,
    5: 11980.4,
    6: 13420.6,
    7: 12100.3,
    8: 11650.9,
    9: 12980.7,
    10: 12440.1,
    11: 11790.6,
    12: 13110.2,
    13: 2480.0,
    14: 2310.5,
    15: 185000.0,
    16: 172500.5,
    17: 168200.8,
    18: 165900.3,
    19: 820000.0,
    20: 805500.0,
    21: 156000.0,
    22: 450000.0,
    23: 445000.0,
    24: 895000.0,
    25: 420000.0,
    26: 415500.0,
    27: 835500.0,
    28: 30500.0,
    29: 29500.0,
    30: 60000.0,
    31: 98500.0,
    32: 97200.0,
    33: 18200.0,
    34: 12500.0,
    35: 8600.0,
    36: 5400.0,
    37: 3250.0,
    38: 9100.0,
}


    
    setup_initial_baselines(GO_LIVE_DATE, INITIAL_BASELINES)
    
    print("🎉 Totalizer system setup complete!")