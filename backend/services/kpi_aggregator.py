# services/kpi_aggregator.py
"""
Smart KPI Aggregation Engine
Handles different aggregation methods based on KPI configuration
"""

from typing import Dict, List, Any
from datetime import date
import logging
from models import KPIOffsetDB

from constants.kpi_config import KPI_REGISTRY, AggregationType

logger = logging.getLogger(__name__)


class KPIAggregator:
    """Aggregates KPIs according to their configuration"""
    
    def __init__(self, db: AsyncSession = None):
        self.db = db
    
    
    async def aggregate_kpis_with_offsets(
        self,
        daily_data: List[Dict[str, Dict[str, float]]],
        period: str,  # "day", "month", or "year"
        period_start: date,
        period_end: date
    ) -> Dict[str, Dict[str, float]]:
        """
        Aggregate daily KPI data with historical offsets
        
        Args:
            daily_data: List of daily KPI dictionaries
            period: Aggregation period ("day", "month", "year")
            period_start: Start date of the period
            period_end: End date of the period (report date)
        
        Returns:
            Aggregated KPIs including offsets
        """
        
        # First, aggregate the daily data normally
        aggregated = self.aggregate_kpis(daily_data, period)
        
        # If this is day period, no offsets needed
        if period == "day":
            return aggregated
        
        # Load offsets from database if available
        if self.db:
            offsets = await self._load_offsets(period, period_start)
            
            # Add offsets to aggregated values
            for plant_name, plant_kpis in offsets.items():
                for kpi_name, offset_value in plant_kpis.items():
                    
                    if plant_name not in aggregated:
                        continue
                    
                    current_value = aggregated[plant_name].get(kpi_name, 0)
                    
                    # Get KPI config to determine how to add offset
                    from constants.kpi_config import KPI_REGISTRY
                    config = KPI_REGISTRY.get(kpi_name)
                    
                    if not config:
                        continue
                    
                    # Determine aggregation type
                    agg_type = config.month_aggregation if period == "month" else config.year_aggregation
                    
                    # Add offset based on aggregation type
                    if agg_type.value in ["sum", "max", "min"]:
                        # For sum/max/min, add offset directly
                        aggregated[plant_name][kpi_name] = current_value + offset_value
                    
                    elif agg_type.value in ["average", "weighted_avg"]:
                        # For averages, we need to recalculate
                        # This is complex - for now, log a warning
                        # In production, you'd need to store the count/weights too
                        logger.warning(
                            f"Average KPI {kpi_name} has offset - may need manual adjustment"
                        )
                        # Still add for now (better than nothing)
                        aggregated[plant_name][kpi_name] = current_value + offset_value
        
        return aggregated
    
    
    async def _load_offsets(
        self,
        period_type: str,
        period_start: date
    ) -> Dict[str, Dict[str, float]]:
        """Load offsets from database for a specific period"""
        
        if not self.db:
            return {}
        
        stmt = select(KPIOffsetDB).where(
            KPIOffsetDB.period_type == period_type,
            KPIOffsetDB.period_start_date == period_start
        )
        
        result = await self.db.execute(stmt)
        offset_records = result.scalars().all()
        
        offsets = {}
        
        for record in offset_records:
            plant = record.plant_name
            kpi = record.kpi_name
            
            if plant not in offsets:
                offsets[plant] = {}
            
            offsets[plant][kpi] = record.offset_value
        
        return offsets