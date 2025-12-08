// src/pages/PIMSTabs.jsx
import React, { useState } from "react";
import ChemicalMatrixPage from "./ChemicalMatrixPage"; 
import FlueGasPage from "./FlueGasPage"; 
import CombustiblePage from "./CombustiblePage";
import SievePage from "./SievePage";
import ProximatePage from "./ProximatePage";
import DMWaterPage from "./DMWaterPage";
import Chemicalparam from "./ChemicalParamsPage";

export default function PIMSTabs({ auth }) {
  const tabs = [
    { key: "chemical", label: "Chemical Analysis" },
    { key: "fluegas", label: "Flue Gas Analysis" },
    { key: "combustible", label: "Combustible Analysis" },
    { key: "sieve", label: "Sieve Analysis" },
    { key: "proximate", label: "Proximate Analysis" },
    { key: "dmwater", label: "DM Water Data" },
    { key: "chemicalparam", label: "chemical param " },
  ];

  const [active, setActive] = useState("chemical");

  return (
    <div className="p-4">
      {/* TAB BUTTONS */}
      <div className="flex gap-2 mb-4 border-b pb-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`px-4 py-2 rounded-t-md ${
              active === t.key
                ? "bg-orange-600 text-white"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      {active === "chemical" && <ChemicalMatrixPage auth={auth} />}
      {active === "fluegas" && <FlueGasPage auth={auth} />}
      {active === "combustible" && <CombustiblePage auth={auth} />}
      {active === "sieve" && <SievePage auth={auth} />}
      {active === "proximate" && <ProximatePage auth={auth} />}
      {active === "dmwater" && <DMWaterPage auth={auth} />}
      {active === "chemicalparam" && <Chemicalparam auth={auth} />}
    </div>
  );
}
