from typing import Dict

def compute_unit_auto_kpis(diffs: Dict[str, float], generation: float = 0.0) -> Dict[str, float]:
    feederA = diffs.get("feeder_a", 0.0)
    feederB = diffs.get("feeder_b", 0.0)
    feederC = diffs.get("feeder_c", 0.0)
    feederD = diffs.get("feeder_d", 0.0)
    feederE = diffs.get("feeder_e", 0.0)

    coal = feederA + feederB + feederC + feederD + feederE
    oil = diffs.get("ldo_flow", 0.0)
    dm7 = diffs.get("dm7", 0.0)
    dm11 = diffs.get("dm11", 0.0)
    steam = diffs.get("main_steam", 0.0)

    dm_water = dm7 + dm11
    gen = float(generation or 0.0)

    specific_coal = (coal / gen) if gen > 0 else 0.0
    specific_oil = (oil / gen) if gen > 0 else 0.0
    specific_steam = (steam / gen) if gen > 0 else 0.0
    specific_dm_percent = ((dm_water / steam) * 100) if steam > 0 else 0.0

    return {
        "coal_consumption": round(coal, 3),
        "specific_coal": round(specific_coal, 6),
        "oil_consumption": round(oil, 3),
        "specific_oil": round(specific_oil, 6),
        "dm_water": round(dm_water, 3),
        "steam_consumption": round(steam, 3),
        "specific_steam": round(specific_steam, 6),
        "specific_dm_percent": round(specific_dm_percent, 3),
    }

def compute_energy_meter_auto_kpis(
    diffs: Dict[str, float],
    station_gen_cache: Dict[str, float] = None
) -> Dict[str, float]:

    station_gen_cache = station_gen_cache or {}

    def d(k: str) -> float:
        return float(diffs.get(k, 0.0) or 0.0)

    # -------------------------------------------------
    # UNIT AUX (EXACT MATCH WITH FRONTEND)
    # -------------------------------------------------
    unit1_unit_aux_mwh = (
        d("1lsr01_ic1")
        + d("1lsr02_ic1")
        + d("1lsr01_ic2_tie")
        - d("SST_10")
        - d("UST_15")
    )

    unit2_unit_aux_mwh = (
        d("2lsr01_ic1")
        + d("2lsr02_ic1")
        + d("2lsr01_ic2_tie")
        - d("UST_25")
    )

    # -------------------------------------------------
    # STATION AUX (EXACT MATCH WITH FRONTEND)
    # -------------------------------------------------
    total_station_aux_mwh = (
        d("rlsr01")
        + d("rlsr02")
        + d("rlsr03")
        + d("rlsr04")
        - d("1lsr01_ic2_tie")
        - d("1lsr02_ic2_tie")
        - d("2lsr01_ic2_tie")
        - d("2lsr02_ic2_tie")
        + d("SST_10")
        + d("UST_15")
        + d("UST_25")
        + d("SST_10")   # repeated intentionally (as per frontend)
        + d("UST_15")   # repeated intentionally (as per frontend)
    )

    # -------------------------------------------------
    # STATION TIE
    # -------------------------------------------------
    total_station_tie_mwh = (
        d("1lsr01_ic2_tie")
        + d("1lsr02_ic2_tie")
        + d("2lsr01_ic2_tie")
        + d("2lsr02_ic2_tie")
    )

    # -------------------------------------------------
    # GENERATION
    # -------------------------------------------------
    unit1_gen = float(
        station_gen_cache.get("unit1_generation", d("unit1_gen"))
    )

    unit2_gen = float(
        station_gen_cache.get("unit2_generation", d("unit2_gen"))
    )

    # -------------------------------------------------
    # AUX CONSUMPTION (HALF STATION AUX)
    # -------------------------------------------------
    unit1_aux_consumption_mwh = unit1_unit_aux_mwh + (total_station_aux_mwh / 2.0)
    unit2_aux_consumption_mwh = unit2_unit_aux_mwh + (total_station_aux_mwh / 2.0)

    # -------------------------------------------------
    # AUX %
    # -------------------------------------------------
    unit1_aux_percent = (
        (unit1_aux_consumption_mwh / unit1_gen) * 100.0
        if unit1_gen > 0 else 0.0
    )

    unit2_aux_percent = (
        (unit2_aux_consumption_mwh / unit2_gen) * 100.0
        if unit2_gen > 0 else 0.0
    )

    # -------------------------------------------------
    # PLF
    # -------------------------------------------------
    unit1_plf_percent = (unit1_gen / 3000.0) * 100.0 if unit1_gen > 0 else 0.0
    unit2_plf_percent = (unit2_gen / 3000.0) * 100.0 if unit2_gen > 0 else 0.0

    station_plf_percent = (
        ((unit1_gen + unit2_gen) / 3000.0) * 100.0
        if (unit1_gen + unit2_gen) > 0 else 0.0
    )

    # -------------------------------------------------
    # FINAL OUTPUT (ROUNDING SAME AS FRONTEND)
    # -------------------------------------------------
    return {
        "unit1_generation": round(unit1_gen, 3),
        "unit2_generation": round(unit2_gen, 3),

        "unit1_unit_aux_mwh": round(unit1_unit_aux_mwh, 3),
        "unit2_unit_aux_mwh": round(unit2_unit_aux_mwh, 3),

        "total_station_aux_mwh": round(total_station_aux_mwh, 3),
        "total_station_tie_mwh": round(total_station_tie_mwh, 3),

        "unit1_aux_consumption_mwh": round(unit1_aux_consumption_mwh, 3),
        "unit1_aux_percent": round(unit1_aux_percent, 3),

        "unit2_aux_consumption_mwh": round(unit2_aux_consumption_mwh, 3),
        "unit2_aux_percent": round(unit2_aux_percent, 3),

        "unit1_plf_percent": round(unit1_plf_percent, 3),
        "unit2_plf_percent": round(unit2_plf_percent, 3),
        "station_plf_percent": round(station_plf_percent, 3),
    }

def compute_station_auto_kpis(
    diffs: Dict[str, float],
    generation_cache: Dict[str, float]
    ) -> Dict[str, float]:

    raw_water = diffs.get("raw_water", 0.0)

    avg_raw_per_hr = raw_water / 24.0

    dm_total = diffs.get("dm7", 0.0) + diffs.get("dm11", 0.0)

    gen1 = float(generation_cache.get("unit1_generation", 0.0))
    gen2 = float(generation_cache.get("unit2_generation", 0.0))
    sum_gen = gen1 + gen2

    sp_raw_l_per_kwh = (
        (raw_water * 1000.0) / sum_gen if sum_gen > 0 else 0.0
    )

    return {
        "total_raw_water_used_m3": round(raw_water, 3),
        "avg_raw_water_m3_per_hr": round(avg_raw_per_hr, 3),
        "sp_raw_water_l_per_kwh": round(sp_raw_l_per_kwh, 3),
        "total_dm_water_used_m3": round(dm_total, 3),
    }
