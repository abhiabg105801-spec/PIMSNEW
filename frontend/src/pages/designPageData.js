
/* -------------------------------------------------------------------------- */
/*                                FLOW DATA                                   */
/* -------------------------------------------------------------------------- */
export const flowData = {
  title: "I. Flow",
  headers: ["Description", "Unit", "100% BMCR", "125 MW", "75 MW", "HP Heaters Out"],
  rows: [
    { category: "Steam" },
    ["Superheater outlet", "t/h", "395.0", "372.8", "227.3", "340.1"],
    ["Reheater outlet", "t/h", "330.6", "315.6", "186.8", "320.8"],

    { category: "Water" },
    ["Feed water", "t/h", "406.8", "362.6", "220", "350.3"],
    ["SH spray", "t/h", "2.3", "10.2", "7.3", "19.8"],
    ["RH spray", "t/h", "0", "0", "0", "0.5"],

    { category: "Air" },
    ["Primary AH Outlet", "t/h", "143", "144", "88", "137"],
    ["Second. AH Outlet", "t/h", "289", "266", "151", "285"],
    ["Total Combustion Air", "t/h", "496", "470", "298", "491"],

    { category: "Flue Gas" },
    ["RAPH inlet", "t/h", "550", "521", "331", "545"],
    ["RAPH outlet", "t/h", "608", "579", "383", "601"],

    { category: "Fuel" },
    ["Coal (HHV 3200 kcal/kg)", "t/h", "94.4", "89.4", "56.7", "93.4"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                            TEMPERATURE DATA                                */
/* -------------------------------------------------------------------------- */
export const temperatureData = {
  title: "II. Temperature",
  headers: ["Description", "Unit", "100% BMCR", "125 MW", "75 MW", "HP Heaters Out"],
  rows: [
    { category: "Steam" },
    ["Sat. temp. in Drum", "°C", "341", "340", "334", "338"],
    ["Final SH outlet", "°C", "540", "540", "540", "540"],
    ["RH outlet", "°C", "540", "540", "540", "540"],

    { category: "Water" },
    ["Economiser inlet", "°C", "242", "241", "216", "155"],
    ["Economiser outlet", "°C", "297", "298", "276", "254"],

    { category: "Air" },
    ["Ambient", "°C", "35", "35", "35", "35"],
    ["AH Outlet (Primary)", "°C", "264", "262", "241", "216"],
    ["AH Outlet (Secondary)", "°C", "269", "267", "243", "219"],

    { category: "Gas" },
    ["Economiser inlet", "°C", "472", "469", "426", "476"],
    ["Airheater inlet", "°C", "301", "298", "260", "243"],
    ["Airheater outlet (Corr.)", "°C", "127", "126", "115", "110"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                            PRESSURE DATA                                   */
/* -------------------------------------------------------------------------- */
export const pressureData = {
  title: "III. Pressures (Steam & Water)",
  headers: ["Description", "Unit", "100% BMCR", "125 MW", "75 MW", "HP Heaters Out"],
  rows: [
    { category: "Pressure" },
    ["Super Heater outlet", "kg/cm²(g)", "138.0", "137.4", "134.1", "136.5"],
    ["Drum", "kg/cm²(g)", "149.4", "147.3", "137.8", "144.8"],
    ["Economiser inlet", "kg/cm²(g)", "152.3", "150.0", "140.1", "147.4"],
    ["Reheater outlet", "kg/cm²(g)", "34.23", "32.20", "19.12", "33.60"],

    { category: "Pressure Drop" },
    ["Superheater system", "kg/cm²", "11.4", "9.9", "3.7", "8.3"],
    ["Reheater system", "kg/cm²", "1.97", "1.87", "1.10", "1.88"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                        GAS VELOCITIES DATA                                 */
/* -------------------------------------------------------------------------- */
export const gasVelocitiesData = {
  title: "IV. Gas Velocities (at 100% BMCR)",
  headers: ["Description", "Unit", "Value"],
  rows: [
    ["Platen SH", "m/s", "6.6"],
    ["RH Front", "m/s", "8.1"],
    ["RH Rear", "m/s", "9.1"],
    ["Final SH", "m/s", "9.7"],
    ["LTSH", "m/s", "9.5"],
    ["Economiser", "m/s", "9.1"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                              DRAFTS DATA                                   */
/* -------------------------------------------------------------------------- */
export const draftsData = {
  title: "V. Pressures and Drafts (Air & Gas)",
  headers: ["Description", "Unit", "100% BMCR", "125 MW", "75 MW", "HP Heaters Out"],
  rows: [
    { category: "Primary Air" },
    ["PA Fan outlet", "mmwc", "854", "834", "790", "831"],
    ["Mill outlet", "mmwc", "277", "267", "272", "263"],

    { category: "Secondary Air" },
    ["FD fan outlet", "mmwc", "230", "213", "141", "223"],
    ["Windbox pressure", "mmwc", "100", "100", "100", "100"],

    { category: "Gas" },
    ["Furnace", "mmwc", "-5", "-5", "-5", "-5"],
    ["Airheater outlet", "mmwc", "-151", "-140", "-72", "-143"],
    ["ID fan inlet", "mmwc", "-220", "-204", "-104", "-210"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                                  FUEL                                      */
/* -------------------------------------------------------------------------- */
export const fuelData = {
  title: "VI. Fuel (Design Coal)",
  rows: [
    { category: "Proximate Analysis" },
    ["Fixed carbon", "23.7%"],
    ["Volatile matter", "21.8%"],
    ["Moisture", "12%"],
    ["Ash", "42.5%"],

    { category: "Ultimate Analysis" },
    ["Carbon", "32.99%"],
    ["Hydrogen", "2.51%"],
    ["Sulphur", "0.60%"],
    ["Nitrogen", "0.68%"],
    ["Oxygen", "8.72%"],

    { category: "Properties" },
    ["Higher Heating Value (HHV)", "3200 Kcal/kg"],
    ["Grindability Index", "50 HGI"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                         MILL PERFORMANCE                                   */
/* -------------------------------------------------------------------------- */
export const millPerformanceData = {
  title: "VII. Mill and Burner Performance",
  headers: ["Description", "Unit", "100% BMCR", "125 MW", "75 MW", "HP Heaters Out"],
  rows: [
    ["No. of mills in Operation", "-", "3", "3", "2", "3"],
    ["Mill loading", "%", "85.7", "81.2", "77.2", "84.8"],
    ["Coal flow per mill", "t/h", "31.5", "29.8", "28.4", "31.1"],
    ["Air temp. at mill inlet", "°C", "233", "236", "207", "185"],
    ["Fineness (thru '200 mesh)", "%", "70", "70", "70", "70"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                         GAS ANALYSIS                                       */
/* -------------------------------------------------------------------------- */
export const gasAnalysisData = {
  title: "VIII. O₂, CO₂ & Excess Air",
  headers: ["Description", "Unit", "Value"],
  rows: [
    ["O₂ in flue gas at Economiser outlet", "%", "3.56"],
    ["CO₂ in flue gas at Economiser outlet", "%", "15.50"],
    ["Excess air in gas at Economiser outlet", "%", "20"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                         AMBIENT CONDITIONS                                 */
/* -------------------------------------------------------------------------- */
export const ambientData = {
  title: "IX. Ambient Conditions",
  rows: [
    ["Ambient temperature", "35 °C"],
    ["Relative Humidity", "70%"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                         HEAT BALANCE DATA                                  */
/* -------------------------------------------------------------------------- */
export const heatBalanceData = {
  title: "X. Heat Balance & Boiler Efficiency",
  headers: ["Description", "Unit", "100% BMCR", "125 MW", "75 MW", "HP Heaters Out"],
  rows: [
    { category: "Losses (As per PTC 4.0)" },
    ["Dry gas", "%", "4.40", "4.40", "4.02", "3.64"],
    ["H₂O in fuel", "%", "2.38", "2.38", "2.36", "2.34"],
    ["H₂O from H₂ combustion", "%", "4.44", "4.44", "4.41", "4.38"],
    ["Radiation", "%", "0.18", "0.19", "0.30", "0.18"],
    ["Unburnt Carbon", "%", "1.40", "1.40", "1.40", "1.40"],
    ["Total losses", "%", "14.37", "14.39", "14.10", "13.45"],

    { category: "Efficiency" },
    ["Boiler Efficiency", "%", "86.56", "86.52", "86.83", "87.44"],
  ],
};

/* -------------------------------------------------------------------------- */
/*                         HEAT RATE CHARTS                                   */
/* -------------------------------------------------------------------------- */
export const heatRateCharts = [
  {
    title: "Heat Rate Correction",
    subtitle: "Main Steam Temp",
    xAxisName: "Temp (°C)",
    yAxisName: "Correction Factor",
    data: [[517,1.005],[537,1.000],[557,0.995]],
    guaranteedValue: 537
  },
  {
    title: "Heat Rate Correction",
    subtitle: "Reheat Steam Temp",
    xAxisName: "Temp (°C)",
    yAxisName: "Correction Factor",
    data: [[518,1.005],[538,1.000],[558,0.995]],
    guaranteedValue: 538
  },
  {
    title: "Heat Rate Correction",
    subtitle: "Throttle Steam Pressure",
    xAxisName: "Pressure (ATA)",
    yAxisName: "Correction Factor",
    data: [[122,1.010],[133,1.000],[142,0.990]],
    guaranteedValue: 133
  },
  {
    title: "Heat Rate Correction",
    subtitle: "RH Pressure Drop",
    xAxisName: "Drop (%)",
    yAxisName: "Correction Factor",
    data: [[5,0.995],[10,1.000],[15,1.005]],
    guaranteedValue: 10
  },
  {
    title: "Heat Rate Correction",
    subtitle: "Condenser Pressure",
    xAxisName: "Pressure (ATA)",
    yAxisName: "Correction Factor",
    data: [[0.050,0.985],[0.075,0.992],[0.1033,1.000],[0.125,1.012]],
    guaranteedValue: 0.1033,
    isCurve: true
  }
];

/* -------------------------------------------------------------------------- */
/*                         OUTPUT CHARTS                                      */
/* -------------------------------------------------------------------------- */
export const outputCharts = [
  {
    title: "Output Correction",
    subtitle: "Main Steam Temp",
    xAxisName: "Temp (°C)",
    yAxisName: "Correction Factor",
    data: [[517,0.995],[537,1.000],[557,1.005]],
    guaranteedValue: 537
  },
  {
    title: "Output Correction",
    subtitle: "Reheat Steam Temp",
    xAxisName: "Temp (°C)",
    yAxisName: "Correction Factor",
    data: [[518,1.015],[538,1.000],[558,0.985]],
    guaranteedValue: 538
  },
  {
    title: "Output Correction",
    subtitle: "Throttle Steam Pressure",
    xAxisName: "Pressure (ATA)",
    yAxisName: "Correction Factor",
    data: [[122,0.95],[133,1.00],[142,1.05]],
    guaranteedValue: 133
  },
  {
    title: "Output Correction",
    subtitle: "RH Pressure Drop",
    xAxisName: "Drop (%)",
    yAxisName: "Correction Factor",
    data: [[5,1.004],[10,1.000],[15,0.996]],
    guaranteedValue: 10
  },
  {
    title: "Output Correction",
    subtitle: "Condenser Pressure",
    xAxisName: "Pressure (ATA)",
    yAxisName: "Correction Factor",
    data: [[0.050,1.025],[0.075,1.012],[0.1033,1.000],[0.125,0.988]],
    guaranteedValue: 0.1033,
    isCurve: true
  }
];
