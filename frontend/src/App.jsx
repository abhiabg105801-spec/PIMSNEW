import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
} from "react-router-dom";

import Login from "./pages/Login";

import Reports from "./pages/Reports";
import PlantShutdownPage from "./pages/PlantShutdownPage";
import KpiChartsPage from "./pages/KpiChartsPage";
import KpiRangeViewer from "./pages/KpiRangeViewer";
import AdminPanel from "./pages/AdminPanel";
import UserMenu from "./components/UserMenu";

import DesignDataPage from "./pages/DesignDataPage";
import LogicDiagramPage from "./pages/LogicDiagramPage";
import FloatingMessageBox from "./components/FloatingMessageBox";
import TotalizerEntry from "./pages/TotalizerEntry";
import FuelUnloadingPage from "./pages/FuelUnloadingPage";

// DM Plant Pages
import DMPlantPage from "./pages/UniversalPIMSPage";
import ChemicalStockPage from "./pages/ChemicalStockPage";

/* ================= JWT DECODE ================= */
function decodeJWT(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

export default function App() {
  const [authHeader, setAuthHeader] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("authToken");
    if (saved) setAuthHeader(`Bearer ${saved}`);
  }, []);

  const handleLogin = (token) => {
    const jwt = token.replace("Bearer ", "");
    localStorage.setItem("authToken", jwt);
    setAuthHeader(token);
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setAuthHeader(null);
  };

  if (!authHeader) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <Layout authHeader={authHeader} onLogout={handleLogout} />
    </BrowserRouter>
  );
}

/* ======================================================
   MAIN LAYOUT
====================================================== */

function Layout({ authHeader, onLogout }) {
  const decoded = decodeJWT(authHeader.replace("Bearer ", ""));
  const username = decoded?.sub || "User";
  const roleId = decoded?.role_id || null;

  const dmRoles = [1, 2, 3, 5, 7, 8];

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 text-zinc-800">

      {/* ================= HEADER ================= */}
      <header
  className="
    fixed top-0 left-0 right-0 z-50
    bg-gradient-to-r
    from-white
    via-zinc-100
    to-orange-100
    border-b border-zinc-300
    shadow-[0_2px_8px_rgba(0,0,0,0.12)]
  "
>




        {/* TOP BAR */}
        <div className="h-14 flex items-center justify-between px-6 text-zinc-100">
          <div className="flex items-center gap-3">
            <img src="/jsl-logo.JPG" alt="JSL Logo" className="h-12 brightness-110" />
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 hidden xl:block">
            <span className="text-[26px] font-extrabold tracking-wide">
  <span className="text-orange-600">2×125 MW CPP</span>
  <span className="mx-2 text-zinc-400">|</span>
  <span className="text-zinc-900">PIMS</span>
</span>
          </div>

          <UserMenu username={username} onLogout={onLogout} />
        </div>

        <div className="h-[4px] bg-gradient-to-r from-[#b34700] via-[#ff8c1a] to-[#b34700]" />


        {/* ================= NAV BAR ================= */}
        <nav className="h-8 bg-zinc-100 border-b border-orange-300">

          <div className="max-w-7xl mx-auto flex items-center h-full gap-5 px-6">

            {/* ===== 125 MW DROPDOWN ===== */}
<div className="relative group h-full flex items-center">

  <div
    className="relative flex items-center h-full px-3 text-[13px] font-bold uppercase tracking-wide
               text-zinc-600 hover:text-[#E06A1B] cursor-pointer"
  >
    125MW
    <span className="ml-1 text-[10px]">▼</span>

    <span
      className="absolute bottom-0 left-0 h-[3px] bg-[#E06A1B]
                 w-0 group-hover:w-full transition-all"
    />
  </div>

  <div
    className="absolute top-full left-0 mt-[2px] w-56
               bg-white border border-zinc-300 shadow-lg rounded
               opacity-0 invisible group-hover:opacity-100 group-hover:visible
               transition-all z-50"
  >
    <NavLink
      to="/TotalizerEntry"
      className={({ isActive }) =>
        `block px-4 py-2 text-xs font-semibold uppercase
         ${isActive
           ? "bg-orange-50 text-orange-700"
           : "text-zinc-700 hover:bg-zinc-100"}`
      }
    >
      Totalizer Entry
    </NavLink>

    <NavLink
      to="/fuel-unloading"
      className={({ isActive }) =>
        `block px-4 py-2 text-xs font-semibold uppercase
         ${isActive
           ? "bg-orange-50 text-orange-700"
           : "text-zinc-700 hover:bg-zinc-100"}`
      }
    >
      Fuel Unloading
    </NavLink>
  </div>
</div>

            {/* ===== DM PLANT DROPDOWN ===== */}
            {dmRoles.includes(roleId) && (
              <div className="relative group h-full flex items-center">

                <div className="relative flex items-center h-full px-3 text-[13px] font-bold uppercase tracking-wide
                                text-zinc-600 hover:text-[#E06A1B] cursor-pointer">
                  DM Plant
                  <span className="ml-1 text-[10px]">▼</span>
                  <span className="absolute bottom-0 left-0 h-[3px] bg-[#E06A1B]
                                   w-0 group-hover:w-full transition-all" />
                </div>

                <div className="absolute top-full left-0 mt-[2px] w-52
                                bg-white border border-zinc-300 shadow-lg rounded
                                opacity-0 invisible group-hover:opacity-100 group-hover:visible
                                transition-all z-50">

                  <NavLink
                    to="/dm-plant"
                    className={({ isActive }) =>
                      `block px-4 py-2 text-xs font-semibold uppercase
                      ${isActive ? "bg-orange-50 text-orange-700" : "text-zinc-700 hover:bg-zinc-100"}`
                    }
                  >
                    DM Data Entry
                  </NavLink>

                  <NavLink
                    to="/dm-chemical-stock"
                    className={({ isActive }) =>
                      `block px-4 py-2 text-xs font-semibold uppercase
                      ${isActive ? "bg-orange-50 text-orange-700" : "text-zinc-700 hover:bg-zinc-100"}`
                    }
                  >
                    Chemical Stock
                  </NavLink>

                </div>
              </div>
            )}

            <NavItem to="/reports" label="Reports" />
            <NavItem to="/shutdowns" label="Shutdown Log" />
            <NavItem to="/charts" label="KPI Charts" />
            <NavItem to="/DesignDataPage" label="Design Data" />
            <NavItem to="/LogicDiagramPage" label="Logic Diagrams" />

            {username === "admin" && <NavItem to="/admin" label="Admin Panel" />}

          </div>
        </nav>
      </header>

      {/* ================= CONTENT ================= */}
      <main className="flex-1 pt-[90px]  pb-1">
        <Routes>
          <Route path="/" element={<Navigate to="/TotalizerEntry" />} />

          <Route path="/TotalizerEntry" element={<TotalizerEntry auth={authHeader} />} />
          <Route path="/fuel-unloading" element={<FuelUnloadingPage auth={authHeader} />} />


          <Route path="/dm-plant" element={<DMPlantPage auth={authHeader} />} />
          <Route path="/dm-chemical-stock" element={<ChemicalStockPage auth={authHeader} />} />

          <Route path="/reports" element={<Reports auth={authHeader} />} />
          <Route path="/shutdowns" element={<PlantShutdownPage auth={authHeader} />} />
          <Route path="/charts" element={<KpiChartsPage auth={authHeader} />} />
          <Route path="/kpi-data" element={<KpiRangeViewer auth={authHeader} />} />
          <Route path="/DesignDataPage" element={<DesignDataPage auth={authHeader} />} />
          <Route path="/LogicDiagramPage" element={<LogicDiagramPage auth={authHeader} />} />
          <Route path="/admin" element={<AdminPanel auth={authHeader} />} />
        </Routes>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-zinc-300 border-t border-zinc-400 py-4">
        <div className="max-w-7xl mx-auto px-6 text-sm text-zinc-600 flex justify-between">
          <span>© {new Date().getFullYear()} Jindal Stainless Ltd.</span>
          <a href="mailto:cppsupport@jsl.com" className="text-[#E06A1B] font-bold hover:underline">
            Contact Support
          </a>
        </div>
      </footer>

      <FloatingMessageBox auth={authHeader} />
    </div>
  );
}

/* ================= NAV ITEM ================= */
function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        relative flex items-center h-full px-3 text-[13px] font-bold uppercase tracking-wide
        ${isActive ? "text-black" : "text-zinc-600 hover:text-[#E06A1B]"}
        after:absolute after:bottom-0 after:left-0 after:h-[3px] after:bg-[#E06A1B]
        after:transition-all after:duration-300
        ${isActive ? "after:w-full" : "after:w-0 hover:after:w-full"}
        `
      }
    >
      {label}
    </NavLink>
  );
}
