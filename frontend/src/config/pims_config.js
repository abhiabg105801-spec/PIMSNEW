// -------------------------------------------------------------
// UNIVERSAL PIMS CONFIG FILE
// -------------------------------------------------------------
const PIMS_CONFIG = {
  // ============================================================
  // 1) PROXIMATE ANALYSIS
  // ============================================================
  proximate: {
    label: "Proximate Analysis",

    topPanel: [
      { key: "sampling_date", label: "Date of Sampling", type: "date" },
      { key: "sampling_time", label: "Time of Sampling", type: "time" },
      { key: "shift", label: "Shift", type: "select", options: ["A", "B", "C"] },
      { key: "analysis_date", label: "Date of Analysis", type: "date" }
    ],

    locationPanel: [
      { key: "plant", label: "Plant", type: "select",
    options: ["2x125MW", "14MW"] },
      { key: "broad_area", label: "Broad Area",type: "select",
    options: ["Unit-1", "Unit-2", "14MW"]},
      { key: "main_area", label: "Main Area", type: "text" },
      { key: "main_collection_area", label: "Main Collection Area", type: "text" },
      { key: "exact_area", label: "Exact Collection Area", type: "text" }
    ],

    parameterPanels: [
      {
        title: "Analysis Data",
        fields: [
          { key: "moisture", label: "Total Moisture %", type: "number" },
          { key: "ash", label: "Ash %", type: "number" },
          { key: "vm", label: "Volatile Matter %", type: "number" },
          { key: "fc", label: "Fixed Carbon %", type: "number" },
          { key: "plus_25mm", label: "+25mm Size", type: "number" },
          { key: "gcv", label: "GCV (Kcal/kg)", type: "number" },
          { key: "uhv", label: "UHV (Kcal/kg)", type: "number" },
          { key: "remarks", label: "Remarks", type: "textarea" }
        ]
      }
    ],

    bottomPanel: {
      title: "Unit & Mill Parameters",
      fields: [
        { key: "mill_a", label: "Mill A GCV", type: "number" },
        { key: "mill_b", label: "Mill B GCV", type: "number" },
        { key: "mill_c", label: "Mill C GCV", type: "number" },
        { key: "mill_d", label: "Mill D GCV", type: "number" },
        { key: "mill_e", label: "Mill E GCV", type: "number" },

        { key: "coal_tons", label: "Coal Consumption (Tons)", type: "number" },
        { key: "weighted_avg_unit1", label: "Weighted Avg GCV - Unit 1", type: "number" },
        { key: "weighted_avg_unit2", label: "Weighted Avg GCV - Unit 2", type: "number" },

        { key: "generation_mwh", label: "Generation (MWH)", type: "number" },
        { key: "heat_rate", label: "Heat Rate (Kcal/kWh)", type: "number" }
      ]
    },

    tableColumns: [
      "Plant",
      "Broad Area",
      "Main Area",
      "Exact Area",
      "Sampling Date",
      "Shift",
      "Moisture",
      "Ash",
      "VM",
      "FC",
      "GCV"
    ]
  },

  // ============================================================
  // 2) SIEVE ANALYSIS
  // ============================================================
  sieve: {
    label: "Sieve Analysis",

    topPanel: [
      { key: "sampling_date", label: "Date of Sampling", type: "date" },
      { key: "sampling_time", label: "Time of Sampling", type: "time" },
      { key: "shift", label: "Shift", type: "select", options: ["A", "B", "C"] },
      { key: "analysis_date", label: "Date of Analysis", type: "date" }
    ],

    locationPanel: [
      { key: "plant", label: "Plant", type: "text" },
      { key: "broad_area", label: "Broad Area", type: "text" },
      { key: "main_area", label: "Main Area", type: "text" },
      { key: "main_collection_area", label: "Main Collection Area", type: "text" },
      { key: "exact_area", label: "Sample Point", type: "text" }
    ],

    parameterPanels: [
      {
        title: "Sieve Size Distribution",
        fields: [
          { key: "size_25", label: "+25mm %", type: "number" },
          { key: "size_20", label: "+20mm %", type: "number" },
          { key: "size_10", label: "+10mm %", type: "number" },
          { key: "size_6", label: "+6mm %", type: "number" },
          { key: "size_3", label: "+3mm %", type: "number" },
          { key: "size_0", label: "-3mm %", type: "number" },
          { key: "remarks", label: "Remarks", type: "textarea" }
        ]
      }
    ],

    tableColumns: [
      "Plant",
      "Broad Area",
      "Main Area",
      "Sample Point",
      "Size +25",
      "Size +20",
      "Size +10",
      "Size +6",
      "Size +3",
      "Size -3"
    ]
  },

  // ============================================================
  // 3) COMBUSTIBLE ANALYSIS
  // ============================================================
  combustible: {
    label: "Combustible Analysis",

    topPanel: [
      { key: "sampling_date", label: "Date", type: "date" },
      { key: "sampling_time", label: "Time", type: "time" },
      { key: "shift", label: "Shift", type: "select", options: ["A", "B", "C"] }
    ],

    locationPanel: [
      { key: "plant", label: "Plant", type: "text" },
      { key: "main_area", label: "Equipment", type: "text" },
      { key: "exact_area", label: "Hopper / ESP", type: "text" }
    ],

    parameterPanels: [
      {
        title: "Combustible Parameters",
        fields: [
          { key: "bah", label: "Bottom Ash (BAH %)", type: "number" },
          { key: "ah", label: "Ash Handling (AH %)", type: "number" },
          { key: "esp", label: "ESP %", type: "number" },
          { key: "remarks", label: "Remarks", type: "textarea" }
        ]
      }
    ],

    tableColumns: ["Plant", "Equipment", "BAH%", "AH%", "ESP%"]
  },

  // ============================================================
  // 4) FLUE GAS ANALYSIS
  // ============================================================
  fluegas: {
    label: "Flue Gas Analysis",

    topPanel: [
      { key: "sampling_date", label: "Date", type: "date" },
      { key: "sampling_time", label: "Time", type: "time" },
      { key: "shift", label: "Shift", type: "select", options: ["A", "B", "C"] }
    ],

    locationPanel: [
      { key: "plant", label: "Plant", type: "text" },
      { key: "boiler", label: "Boiler No", type: "text" },
      { key: "sampling_point", label: "Sampling Location", type: "text" }
    ],

    parameterPanels: [
      {
        title: "Flue Gas Parameters",
        fields: [
          { key: "fg_temp", label: "Flue Gas Temp (°C)", type: "number" },
          { key: "o2", label: "O₂ %", type: "number" },
          { key: "co2", label: "CO₂ %", type: "number" },
          { key: "co", label: "CO (ppm)", type: "number" },
          { key: "so2", label: "SO₂ (ppm)", type: "number" },
          { key: "nox", label: "NOx (ppm)", type: "number" },
          { key: "remarks", label: "Remarks", type: "textarea" }
        ]
      }
    ],

    tableColumns: [
      "Plant",
      "Boiler",
      "Location",
      "FG Temp",
      "O2",
      "CO2",
      "CO",
      "SO2",
      "NOx"
    ]
  },

  // ============================================================
  // 5) DM WATER DATA
  // ============================================================
  dm_water: {
    label: "DM Water Production",

    topPanel: [
      { key: "entry_date", label: "Date", type: "date" },
      { key: "entry_time", label: "Time", type: "time" },
      { key: "shift", label: "Shift", type: "select", options: ["A", "B", "C"] }
    ],

    locationPanel: [
      { key: "plant", label: "Plant", type: "text" }
    ],

    parameterPanels: [
      {
        title: "DM Water Production & Storage",
        fields: [
          { key: "raw_water_inlet", label: "Raw Water Inlet (m³)", type: "number" },
          { key: "dm_production", label: "DM Water Production (m³)", type: "number" },
          { key: "storage_tank_level", label: "Storage Tank Level (m)", type: "number" },
          { key: "transfer_to_cpp", label: "Transfer to CPP (m³)", type: "number" },
          { key: "transfer_to_smr", label: "Transfer to SMR (m³)", type: "number" },
          { key: "remarks", label: "Remarks", type: "textarea" }
        ]
      }
    ],

    tableColumns: [
      "Plant",
      "Production",
      "Storage Level",
      "Transfer to CPP",
      "Transfer to SMR"
    ]
  },

  // ============================================================
  // 6) CHEMICAL BOILER PARAMETERS
  // ============================================================
  chemical_boiler: {
    label: "Boiler Chemical Parameters",

    topPanel: [
      { key: "entry_date", label: "Date", type: "date" },
      { key: "entry_time", label: "Time", type: "time" }
    ],

    locationPanel: [
      { key: "plant", label: "Plant", type: "text" },
      { key: "boiler", label: "Boiler No", type: "text" },
      { key: "collection", label: "Sample Collection Area", type: "text" }
    ],

    parameterPanels: [
      {
        title: "Test Results",
        fields: [
          { key: "ph", label: "pH", type: "number" },
          { key: "conductivity", label: "Conductivity (µS/cm)", type: "number" },
          { key: "silica", label: "Silica (ppm)", type: "number" },
          { key: "phosphate", label: "Phosphate (ppm)", type: "number" },
          { key: "iron", label: "Iron (ppm)", type: "number" },
          { key: "remarks", label: "Remarks", type: "textarea" }
        ]
      }
    ],

    tableColumns: [
      "Plant",
      "Boiler",
      "pH",
      "Conductivity",
      "Silica",
      "Phosphate",
      "Iron"
    ]
  },

  // ============================================================
  // 7) CHEMICAL MATRIX (Condensate / Drum / Feed Water)
  // ============================================================
  chemical_matrix: {
    label: "Chemical Matrix",

    topPanel: [
      { key: "entry_date", label: "Date", type: "date" },
      { key: "entry_time", label: "Time", type: "time" }
    ],

    locationPanel: [
      { key: "plant", label: "Plant", type: "text" },
      { key: "broad_area", label: "Area", type: "text" }
    ],

    matrix: {
      locations: ["Condensate", "Feed Water", "Drum Water", "Boiler Water"],
      params: [
        { key: "ph", label: "pH" },
        { key: "conductivity", label: "Conductivity" },
        { key: "chloride", label: "Chloride" },
        { key: "silica", label: "Silica" }
      ]
    },

    parameterPanels: [],  // matrix replaces panel

    tableColumns: ["Plant", "Area", "Parameter", "Condensate", "Feed Water", "Drum", "Boiler"]
  },

  chemical_coolingtower: {
    label: "Chemical Parameters - Cooling Tower",

    topPanel: [
      { key: "entry_date", label: "Date", type: "date" },
      { key: "entry_time", label: "Time", type: "time" }
    ],

    locationPanel: [
      { key: "plant", label: "Plant", type: "text" },
      { key: "boiler", label: "Boiler No", type: "text" },
      { key: "collection", label: "Sample Collection Area", type: "text" }
    ],

    parameterPanels: [
      {
        title: "Test Results",
        fields: [
          { key: "ph", label: "pH", type: "number" },
          { key: "conductivity", label: "Conductivity (µS/cm)", type: "number" },
          { key: "silica", label: "Silica (ppm)", type: "number" },
          { key: "phosphate", label: "Phosphate (ppm)", type: "number" },
          { key: "iron", label: "Iron (ppm)", type: "number" },
          { key: "remarks", label: "Remarks", type: "textarea" }
        ]
      }
    ],

    tableColumns: [
      "Plant",
      "Boiler",
      "pH",
      "Conductivity",
      "Silica",
      "Phosphate",
      "Iron"
    ]
  }

};




export default PIMS_CONFIG;
