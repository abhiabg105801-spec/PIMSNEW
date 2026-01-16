# services/kpi_calculator.py
"""
Central KPI calculation engine
All KPI calculations happen here - ONE source of truth
"""

from typing import Dict, Any
from datetime import date, datetime, timedelta, time as dt_time
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from models import TotalizerReadingDB, ShutdownRecordDB
from constants.totalizer_master import TOTALIZER_MASTER  # ✅ Import from constants


class KPICalculator:
    """Centralized KPI calculation engine"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    
    async def calculate_all_kpis_for_date(self, report_date: date) -> Dict[str, Dict[str, float]]:
        """
        Calculate ALL KPIs for a given date
        Returns: {"Unit-1": {...}, "Unit-2": {...}, "Station": {...}}
        """
        
        # Step 1: Get totalizer differences
        diffs = await self._get_totalizer_differences(report_date)
        
        # Step 2: Calculate energy KPIs first (needed for generation values)
        energy_kpis = self._calculate_energy_kpis(diffs["Energy-Meter"])
        
        # Step 3: Calculate unit KPIs
        unit1_kpis = self._calculate_unit_kpis(
            diffs["Unit-1"], 
            energy_kpis["unit1_generation"]
        )
        
        unit2_kpis = self._calculate_unit_kpis(
            diffs["Unit-2"], 
            energy_kpis["unit2_generation"]
        )
        
        # Step 4: Calculate station KPIs
        station_kpis = self._calculate_station_kpis(
            diffs["Station"],
            energy_kpis["unit1_generation"],
            energy_kpis["unit2_generation"]
        )
        
        # Step 5: Add shutdown KPIs
        unit1_shutdown = await self._calculate_shutdown_kpis("Unit-1", report_date)
        unit2_shutdown = await self._calculate_shutdown_kpis("Unit-2", report_date)
        
        # Step 6: Merge everything
        unit1_kpis.update(unit1_shutdown)
        unit1_kpis["generation"] = energy_kpis["unit1_generation"] / 1000.0  # Convert to MU
        unit1_kpis["plf_percent"] = energy_kpis["unit1_plf_percent"]
        unit1_kpis["aux_power"] = energy_kpis["unit1_aux_consumption_mwh"] / 1000.0
        unit1_kpis["aux_power_percent"] = energy_kpis["unit1_aux_percent"]
        
        unit2_kpis.update(unit2_shutdown)
        unit2_kpis["generation"] = energy_kpis["unit2_generation"] / 1000.0
        unit2_kpis["plf_percent"] = energy_kpis["unit2_plf_percent"]
        unit2_kpis["aux_power"] = energy_kpis["unit2_aux_consumption_mwh"] / 1000.0
        unit2_kpis["aux_power_percent"] = energy_kpis["unit2_aux_percent"]
        
        # Step 7: Calculate combined station KPIs
        station_combined = self._calculate_combined_station_kpis(
            unit1_kpis, unit2_kpis, station_kpis
        )
        
        return {
            "Unit-1": unit1_kpis,
            "Unit-2": unit2_kpis,
            "Station": station_combined
        }
    
    
    async def _get_totalizer_differences(self, report_date: date) -> Dict[str, Dict[str, float]]:
        """Get totalizer differences for the date"""
        
        diffs_by_unit = {
            "Unit-1": {},
            "Unit-2": {},
            "Station": {},
            "Energy-Meter": {},
        }
        
        # Get today's readings
        today_stmt = select(TotalizerReadingDB).where(
            TotalizerReadingDB.date == report_date
        )
        today_rows = (await self.db.execute(today_stmt)).scalars().all()
        
        # Get yesterday's readings OR baseline values
        yesterday_map = await self._get_previous_day_values(report_date)
        
        # Calculate differences
        for r in today_rows:
            meta = TOTALIZER_MASTER.get(r.totalizer_id)
            if not meta:
                continue
            
            name, unit = meta
            
            # Get previous value (yesterday reading or baseline)
            prev_val = yesterday_map.get(r.totalizer_id, 0.0)
            
            diff = (
                float(r.reading_value or 0)
                - prev_val
                + float(r.adjust_value or 0)
            )
            
            diffs_by_unit[unit][name] = diff
        
        # Ensure all keys exist
        for _, (name, unit) in TOTALIZER_MASTER.items():
            diffs_by_unit[unit].setdefault(name, 0.0)
        
        return diffs_by_unit
    
    
    async def _get_previous_day_values(self, report_date: date) -> Dict[int, float]:
        """
        Get previous day values for all totalizers
        Handles:
        1. Normal case: Previous day readings
        2. First day: Baseline values from config
        3. Reset case: Baseline values from reset config
        """
        
        from datetime import timedelta
        from constants.totalizer_master import TOTALIZER_MASTER
        
        yesterday = report_date - timedelta(days=1)
        prev_values = {}
        
        # Try to get yesterday's readings first
        yesterday_stmt = select(TotalizerReadingDB).where(
            TotalizerReadingDB.date == yesterday
        )
        yesterday_rows = (await self.db.execute(yesterday_stmt)).scalars().all()
        
        # Build map of yesterday's readings
        yesterday_map = {r.totalizer_id: float(r.reading_value or 0) for r in yesterday_rows}
        
        # For each totalizer, get previous value
        for totalizer_id in TOTALIZER_MASTER.keys():
            
            # Check if we have yesterday's reading
            if totalizer_id in yesterday_map:
                prev_values[totalizer_id] = yesterday_map[totalizer_id]
                continue
            
            # No yesterday reading - check for baseline/reset config
            config_stmt = select(TotalizerConfigDB).where(
                TotalizerConfigDB.totalizer_id == totalizer_id,
                TotalizerConfigDB.effective_date == report_date
            ).order_by(TotalizerConfigDB.configured_at.desc())
            
            config_result = await self.db.execute(config_stmt)
            config = config_result.scalars().first()
            
            if config:
                # Use baseline value from config
                prev_values[totalizer_id] = float(config.baseline_value)
            else:
                # No config found - default to 0
                prev_values[totalizer_id] = 0.0
        
        return prev_values
    
    
    def _calculate_unit_kpis(self, diffs: Dict[str, float], generation: float) -> Dict[str, float]:
        """Calculate unit-level KPIs"""
        
        coal = sum(diffs.get(f"feeder_{x}", 0.0) for x in "abcde")
        oil = diffs.get("ldo_flow", 0.0)
        dm_water = diffs.get("dm7", 0.0) + diffs.get("dm11", 0.0)
        steam = diffs.get("main_steam", 0.0)
        
        gen_mwh = float(generation or 0.0)
        
        return {
            "coal_consumption": round(coal, 3),
            "specific_coal": round((coal / gen_mwh) if gen_mwh > 0 else 0.0, 6),
            "oil_consumption": round(oil, 3),
            "specific_oil": round((oil / gen_mwh) if gen_mwh > 0 else 0.0, 6),
            "dm_water": round(dm_water, 3),
            "steam_generation": round(steam, 3),
            "specific_steam": round((steam / gen_mwh) if gen_mwh > 0 else 0.0, 6),
            "specific_dm_percent": round((dm_water / steam * 100) if steam > 0 else 0.0, 3),
        }
    
    
    def _calculate_energy_kpis(self, diffs: Dict[str, float]) -> Dict[str, float]:
        """Calculate energy meter KPIs"""
        
        def d(k: str) -> float:
            return float(diffs.get(k, 0.0) or 0.0)
        
        unit1_unit_aux = d("1lsr01_ic1") + d("1lsr02_ic1") + d("1lsr01_ic2_tie") - d("SST_10") - d("UST_15")
        unit2_unit_aux = d("2lsr01_ic1") + d("2lsr02_ic1") + d("2lsr01_ic2_tie") - d("UST_25")
        
        station_aux = (
            d("rlsr01") + d("rlsr02") + d("rlsr03") + d("rlsr04")
            - d("1lsr01_ic2_tie") - d("1lsr02_ic2_tie")
            - d("2lsr01_ic2_tie") - d("2lsr02_ic2_tie")
            + d("SST_10") + d("UST_15") + d("UST_25")
            + d("SST_10") + d("UST_15")  # Repeated as per frontend
        )
        
        unit1_gen = d("unit1_gen")
        unit2_gen = d("unit2_gen")
        
        unit1_aux_total = unit1_unit_aux + (station_aux / 2.0)
        unit2_aux_total = unit2_unit_aux + (station_aux / 2.0)
        
        return {
            "unit1_generation": round(unit1_gen, 3),
            "unit2_generation": round(unit2_gen, 3),
            "unit1_aux_consumption_mwh": round(unit1_aux_total, 3),
            "unit2_aux_consumption_mwh": round(unit2_aux_total, 3),
            "unit1_aux_percent": round((unit1_aux_total / unit1_gen * 100) if unit1_gen > 0 else 0.0, 3),
            "unit2_aux_percent": round((unit2_aux_total / unit2_gen * 100) if unit2_gen > 0 else 0.0, 3),
            "unit1_plf_percent": round((unit1_gen / 3000 * 100) if unit1_gen > 0 else 0.0, 3),
            "unit2_plf_percent": round((unit2_gen / 3000 * 100) if unit2_gen > 0 else 0.0, 3),
        }
    
    
    def _calculate_station_kpis(self, diffs: Dict[str, float], gen1: float, gen2: float) -> Dict[str, float]:
        """Calculate station water KPIs"""
        
        raw_water = diffs.get("raw_water", 0.0)
        total_gen = gen1 + gen2
        
        return {
            "total_raw_water_used_m3": round(raw_water, 3),
            "avg_raw_water_m3_per_hr": round(raw_water / 24.0, 3),
            "sp_raw_water_l_per_kwh": round((raw_water * 1000 / total_gen) if total_gen > 0 else 0.0, 3),
        }
    
    
    async def _calculate_shutdown_kpis(self, unit: str, report_date: date) -> Dict[str, float]:
        """Calculate shutdown-related KPIs"""
        
        start_dt = datetime.combine(report_date, dt_time.min)
        end_dt = datetime.combine(report_date, dt_time.max)
        
        stmt = select(ShutdownRecordDB).where(
            ShutdownRecordDB.unit == unit,
            ShutdownRecordDB.datetime_from <= end_dt,
            func.coalesce(ShutdownRecordDB.datetime_to, end_dt) >= start_dt,
        )
        
        rows = (await self.db.execute(stmt)).scalars().all()
        
        planned = 0.0
        strategic = 0.0
        total_shutdown = 0.0
        
        for r in rows:
            shutdown_start = max(r.datetime_from, start_dt)
            shutdown_end = min(r.datetime_to or end_dt, end_dt)
            hrs = (shutdown_end - shutdown_start).total_seconds() / 3600.0
            
            if hrs > 0:
                total_shutdown += hrs
                if r.shutdown_type == "Planned Outage":
                    planned += hrs
                elif r.shutdown_type == "Strategic Outage":
                    strategic += hrs
        
        running = max(0.0, 24.0 - total_shutdown)
        
        return {
            "running_hour": round(running, 2),
            "plant_availability_percent": round((running / 24.0) * 100, 2),
            "planned_outage_hour": round(planned, 2),
            "planned_outage_percent": round((planned / 24.0) * 100, 2),
            "strategic_outage_hour": round(strategic, 2),
        }
    
    
    def _calculate_combined_station_kpis(
        self, 
        unit1: Dict[str, float], 
        unit2: Dict[str, float],
        station_water: Dict[str, float]
    ) -> Dict[str, float]:
        """Calculate combined station KPIs"""
        
        station = {}
        
        # Sum up values
        station["generation"] = unit1["generation"] + unit2["generation"]
        station["coal_consumption"] = unit1["coal_consumption"] + unit2["coal_consumption"]
        station["oil_consumption"] = unit1["oil_consumption"] + unit2["oil_consumption"]
        station["aux_power"] = unit1["aux_power"] + unit2["aux_power"]
        station["steam_generation"] = unit1["steam_generation"] + unit2["steam_generation"]
        station["dm_water"] = unit1["dm_water"] + unit2["dm_water"]
        station["running_hour"] = unit1["running_hour"] + unit2["running_hour"]
        station["planned_outage_hour"] = unit1["planned_outage_hour"] + unit2["planned_outage_hour"]
        station["strategic_outage_hour"] = unit1["strategic_outage_hour"] + unit2["strategic_outage_hour"]
        
        # Weighted averages
        total_gen = station["generation"]
        if total_gen > 0:
            station["specific_coal"] = (
                (unit1["specific_coal"] * unit1["generation"] + 
                 unit2["specific_coal"] * unit2["generation"]) / total_gen
            )
            station["specific_oil"] = (
                (unit1["specific_oil"] * unit1["generation"] + 
                 unit2["specific_oil"] * unit2["generation"]) / total_gen
            )
            station["specific_steam"] = (
                (unit1["specific_steam"] * unit1["generation"] + 
                 unit2["specific_steam"] * unit2["generation"]) / total_gen
            )
            station["aux_power_percent"] = (
                (unit1["aux_power_percent"] * unit1["generation"] + 
                 unit2["aux_power_percent"] * unit2["generation"]) / total_gen
            )
        else:
            station["specific_coal"] = 0.0
            station["specific_oil"] = 0.0
            station["specific_steam"] = 0.0
            station["aux_power_percent"] = 0.0
        
        total_steam = station["steam_generation"]
        if total_steam > 0:
            station["specific_dm_percent"] = (
                (unit1["specific_dm_percent"] * unit1["steam_generation"] + 
                 unit2["specific_dm_percent"] * unit2["steam_generation"]) / total_steam
            )
        else:
            station["specific_dm_percent"] = 0.0
        
        # PLF
        station["plf_percent"] = (station["generation"] / 6.0) * 100.0 if station["generation"] > 0 else 0.0
        
        # Availability
        station["plant_availability_percent"] = (
            (unit1["plant_availability_percent"] + unit2["plant_availability_percent"]) / 2.0
        )
        station["planned_outage_percent"] = (
            (unit1["planned_outage_percent"] + unit2["planned_outage_percent"]) / 2.0
        )
        
        # Add water KPIs
        station.update(station_water)
        
        # Net export
        station["stn_net_export_mu"] = station["generation"] - station["aux_power"]
        
        return station