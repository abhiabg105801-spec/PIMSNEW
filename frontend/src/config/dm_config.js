// src/config/dm_config.js
export const FORMS = {
  chemical_matrix: {
    label: "Boiler / Steam Chemistry (Matrix)",
    plant: "JSLO",
    broad_area: "2x125 MW CPP",
    main_area_options: ["Unit #1", "Unit #2"],
    main_collection_area: "Boiler",
    locations: ["Condensate Water", "Feed Water", "Drum Water", "Saturated Steam", "Super Heated Steam", "Hot Reheated Steam"],
    params: [
      { key: "conductivity", label: "Conductivity (µS/cm)" },
      { key: "ph", label: "pH" },
      { key: "breading", label: "B Reading (ml)" },
      { key: "phosphate", label: "Phosphate (ppm)" },
      { key: "sio2", label: "SiO₂ (ppm)" },
      { key: "cl_ppm", label: "Cl (ppm)" },
      { key: "nh3", label: "NH₃ (ppm)" },
      { key: "n2h4", label: "N₂H₄ (ppm)" },
      { key: "fe_ppm", label: "Fe (ppm)" },
      { key: "hardness", label: "Hardness (ppm)" },
      { key: "turbidity", label: "Turbidity (NTU)" },
      { key: "o2", label: "O₂ (ppm)" },
    ]
  },

  chemical_param: {
    label: "CW / CT / MU / Raw Water",
    plant: "JSLO",
    broad_area: "2x125 MW CPP",
    main_area_options: ["Unit #1", "Unit #2", "14 MW"],
    main_collection_options: ["1A+1B+1D+1E", "1A+1B+1C", "Hoppers", "Boiler"],
    exact_options: ["CT Make Up", "Circulating Water", "Clarified Water", "Intake Water", "Coal Feeder"],
    params: [
      { key: "temp_c", label: "Temp (°C)" },
      { key: "turbidity", label: "Turbidity (NTU)" },
      { key: "ph", label: "pH" },
      { key: "p_alkalinity", label: "P-Alk (ppm)" },
      { key: "m_alkalinity", label: "M-Alk (ppm)" },
      { key: "ca_h", label: "Ca-H (ppm)" },
      { key: "mg_h", label: "Mg-H (ppm)" },
      { key: "th", label: "T.H. (ppm)" },
      { key: "cl_ppm", label: "Cl (ppm)" },
      { key: "conductivity", label: "Cond (µS/cm)" },
      { key: "tds", label: "TDS (ppm)" },
      { key: "sio2", label: "SiO2 (ppm)" },
      { key: "po4", label: "PO4" },
      { key: "coc_th", label: "COC TH" },
    ]
  },

  combustible: {
    label: "Combustible Analysis",
    locations: ["Unit-1", "Unit-2", "Coal"],
    params: [
      { key: "total_coal_flow_tph", label: "Total Coal Flow (TPH)" },
      { key: "total_air_flow_tph", label: "Total Air Flow (TPH)" },
      { key: "sa_flow_tph", label: "SA Flow (TPH)" },
      { key: "o2_pct", label: "O₂ (%)" },
      { key: "burner_tilt_deg", label: "Burner Tilt (°)" },
      { key: "mw", label: "MW" },
      { key: "ba_pct", label: "BA (%)" },
      { key: "eco_pct", label: "ECO (%)" },
      { key: "esp_pct", label: "ESP (%)" },
    ]
  },

  dmwater: {
    label: "DM Water Data",
    locations: ["DM", "Unit-1", "Unit-2"],
    params: [
      { key: "tank1_level_m", label: "Tank1 Level (m)" },
      { key: "tank2_level_m", label: "Tank2 Level (m)" },
      { key: "dm_produced_t", label: "Produced (T)" },
      { key: "dm_used_t", label: "Used (T)" },
      { key: "dm_production_m3h", label: "DM Production (m3/h)" },
      { key: "dm_consumption_m3h", label: "DM Consumption (m3/h)" },
      { key: "transfer_to_unit1_t", label: "Transferred to Unit-1 (T)" },
      { key: "transfer_to_unit2_t", label: "Transferred to Unit-2 (T)" },
    ]
  },

  fluegas: {
    label: "Flue Gas Analysis",
    locations: ["Stack 1", "Stack 2"],
    params: [
      { key: "co2", label: "CO₂ (%)" },
      { key: "o2", label: "O₂ (%)" },
      { key: "so2", label: "SO₂ (ppm)" },
      { key: "no", label: "NO (ppm)" },
      { key: "no2", label: "NO₂ (ppm)" },
      { key: "co", label: "CO (ppm)" },
    ]
  },

  sieve: {
    label: "Sieve Analysis",
    locations: ["Coal Sample"],
    params: [
      { key: "sieve_6mm", label: "Retained 6mm (%)" },
      { key: "sieve_3mm", label: "Retained 3mm (%)" },
      { key: "sieve_1mm", label: "Retained 1mm (%)" },
      { key: "fines", label: "Fines (%)" },
    ]
  },

  proximate: {
    label: "Proximate Analysis",
    locations: ["Coal Sample"],
    params: [
      { key: "moisture", label: "Moisture (%)" },
      { key: "ash", label: "Ash (%)" },
      { key: "volatile_matter", label: "Volatile Matter (%)" },
      { key: "fixed_carbon", label: "Fixed Carbon (%)" },
      { key: "gcv", label: "GVC (Kcal/Kg)" },
      { key: "uhv", label: "UHV (Kcal/Kg)" },
    ]
  }
};

export const MODULE_KEYS = Object.keys(FORMS);
export default FORMS;
