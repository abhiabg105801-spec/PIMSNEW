# constants/kpi_config.py
"""
KPI Configuration - Defines how each KPI should be aggregated
"""

from enum import Enum
from typing import Dict, Set


class AggregationType(str, Enum):
    """Types of aggregation methods"""
    SUM = "sum"                    # Add all values
    AVERAGE = "average"            # Simple average
    WEIGHTED_AVG = "weighted_avg"  # Weighted by generation
    LAST_VALUE = "last_value"      # Take the last value in period
    MAX = "max"                    # Maximum value
    MIN = "min"                    # Minimum value


class KPIConfig:
    """Configuration for a single KPI"""
    
    def __init__(
        self,
        name: str,
        display_name: str,
        unit: str,
        day_aggregation: AggregationType,
        month_aggregation: AggregationType,
        year_aggregation: AggregationType,
        weight_by: str = None,  # For weighted averages (e.g., "generation")
        decimals: int = 2
    ):
        self.name = name
        self.display_name = display_name
        self.unit = unit
        self.day_aggregation = day_aggregation
        self.month_aggregation = month_aggregation
        self.year_aggregation = year_aggregation
        self.weight_by = weight_by
        self.decimals = decimals


# ============================================================================
#  KPI CONFIGURATION REGISTRY
# ============================================================================

KPI_REGISTRY: Dict[str, KPIConfig] = {
    
    # ========== GENERATION & CAPACITY ==========
    "generation": KPIConfig(
        name="generation",
        display_name="Generation",
        unit="MU",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    "plf_percent": KPIConfig(
        name="plf_percent",
        display_name="PLF",
        unit="%",
        day_aggregation=AggregationType.AVERAGE,
        month_aggregation=AggregationType.AVERAGE,
        year_aggregation=AggregationType.AVERAGE,
        decimals=2
    ),
    
    # ========== AVAILABILITY & OUTAGES ==========
    "running_hour": KPIConfig(
        name="running_hour",
        display_name="Running Hours",
        unit="Hr",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=2
    ),
    
    "plant_availability_percent": KPIConfig(
        name="plant_availability_percent",
        display_name="Plant Availability Factor",
        unit="%",
        day_aggregation=AggregationType.AVERAGE,
        month_aggregation=AggregationType.AVERAGE,
        year_aggregation=AggregationType.AVERAGE,
        decimals=2
    ),
    
    "planned_outage_hour": KPIConfig(
        name="planned_outage_hour",
        display_name="Planned Outage",
        unit="Hr",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=2
    ),
    
    "planned_outage_percent": KPIConfig(
        name="planned_outage_percent",
        display_name="Planned Outage %",
        unit="%",
        day_aggregation=AggregationType.AVERAGE,
        month_aggregation=AggregationType.AVERAGE,
        year_aggregation=AggregationType.AVERAGE,
        decimals=2
    ),
    
    "strategic_outage_hour": KPIConfig(
        name="strategic_outage_hour",
        display_name="Strategic Outage",
        unit="Hr",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=2
    ),
    
    # ========== COAL CONSUMPTION ==========
    "coal_consumption": KPIConfig(
        name="coal_consumption",
        display_name="Coal Consumption",
        unit="T",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    "specific_coal": KPIConfig(
        name="specific_coal",
        display_name="Specific Coal Consumption",
        unit="kg/kWh",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="generation",
        decimals=3
    ),
    
    "gcv": KPIConfig(
        name="gcv",
        display_name="Average GCV",
        unit="kcal/kg",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="coal_consumption",
        decimals=2
    ),
    
    "heat_rate": KPIConfig(
        name="heat_rate",
        display_name="Heat Rate",
        unit="kcal/kWh",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="generation",
        decimals=2
    ),
    
    # ========== OIL CONSUMPTION ==========
    "oil_consumption": KPIConfig(
        name="oil_consumption",
        display_name="Oil Consumption",
        unit="KL",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    "specific_oil": KPIConfig(
        name="specific_oil",
        display_name="Specific Oil Consumption",
        unit="ml/kWh",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="generation",
        decimals=3
    ),
    
    # ========== AUXILIARY CONSUMPTION ==========
    "aux_power": KPIConfig(
        name="aux_power",
        display_name="Auxiliary Power Consumption",
        unit="MU",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    "aux_power_percent": KPIConfig(
        name="aux_power_percent",
        display_name="Auxiliary Power %",
        unit="%",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="generation",
        decimals=2
    ),
    
    # ========== STEAM ==========
    "steam_generation": KPIConfig(
        name="steam_generation",
        display_name="Steam Generation",
        unit="T",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    "specific_steam": KPIConfig(
        name="specific_steam",
        display_name="Specific Steam Consumption",
        unit="T/MWh",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="generation",
        decimals=3
    ),
    
    # ========== WATER ==========
    "dm_water": KPIConfig(
        name="dm_water",
        display_name="DM Water Consumption",
        unit="Cu.M",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    "specific_dm_percent": KPIConfig(
        name="specific_dm_percent",
        display_name="Specific DM Water Consumption",
        unit="%",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="steam_generation",
        decimals=2
    ),
    
    "total_raw_water_used_m3": KPIConfig(
        name="total_raw_water_used_m3",
        display_name="Total Raw Water Used",
        unit="Cu.M",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    "avg_raw_water_m3_per_hr": KPIConfig(
        name="avg_raw_water_m3_per_hr",
        display_name="Average Raw Water/Hr",
        unit="Cu.M/Hr",
        day_aggregation=AggregationType.AVERAGE,
        month_aggregation=AggregationType.AVERAGE,
        year_aggregation=AggregationType.AVERAGE,
        decimals=3
    ),
    
    "sp_raw_water_l_per_kwh": KPIConfig(
        name="sp_raw_water_l_per_kwh",
        display_name="Specific Raw Water",
        unit="L/kWh",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="generation",
        decimals=3
    ),
    
    "total_dm_water_used_m3": KPIConfig(
        name="total_dm_water_used_m3",
        display_name="Total DM Water Used",
        unit="Cu.M",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    # ========== STATION ==========
    "stn_net_export_mu": KPIConfig(
        name="stn_net_export_mu",
        display_name="Station Net Export",
        unit="MU",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    # ========== ENVIRONMENT ==========
    "stack_emission": KPIConfig(
        name="stack_emission",
        display_name="Stack Emission (SPM)",
        unit="mg/Nm³",
        day_aggregation=AggregationType.AVERAGE,
        month_aggregation=AggregationType.AVERAGE,
        year_aggregation=AggregationType.AVERAGE,
        decimals=2
    ),
    
    # ========== RO PLANT ==========
    "ro_running_hour": KPIConfig(
        name="ro_running_hour",
        display_name="RO Plant Running Hours",
        unit="Hr",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=2
    ),
    
    "ro_production_cum": KPIConfig(
        name="ro_production_cum",
        display_name="RO Plant Production",
        unit="Cu.M",
        day_aggregation=AggregationType.SUM,
        month_aggregation=AggregationType.SUM,
        year_aggregation=AggregationType.SUM,
        decimals=3
    ),
    
    # ========== COAL BLENDING ==========
    "clarifier_level": KPIConfig(
        name="clarifier_level",
        display_name="Clarifier Reservoir Level",
        unit="%",
        day_aggregation=AggregationType.AVERAGE,
        month_aggregation=AggregationType.AVERAGE,
        year_aggregation=AggregationType.AVERAGE,
        decimals=2
    ),
    
    "coal_indonesian_percent": KPIConfig(
        name="coal_indonesian_percent",
        display_name="Indonesian Coal %",
        unit="%",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="coal_consumption",
        decimals=2
    ),
    
    "coal_southafrica_percent": KPIConfig(
        name="coal_southafrica_percent",
        display_name="South African Coal %",
        unit="%",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="coal_consumption",
        decimals=2
    ),
    
    "coal_domestic_percent": KPIConfig(
        name="coal_domestic_percent",
        display_name="Domestic Coal %",
        unit="%",
        day_aggregation=AggregationType.WEIGHTED_AVG,
        month_aggregation=AggregationType.WEIGHTED_AVG,
        year_aggregation=AggregationType.WEIGHTED_AVG,
        weight_by="coal_consumption",
        decimals=2
    ),
}


def get_kpi_config(kpi_name: str) -> KPIConfig:
    """Get configuration for a KPI"""
    return KPI_REGISTRY.get(kpi_name)


def get_all_kpi_names() -> Set[str]:
    """Get all registered KPI names"""
    return set(KPI_REGISTRY.keys())