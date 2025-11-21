import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import Login from "./pages/Login";
import DataEntryPage from "./pages/DataEntryPage";
import ReportViewer from "./pages/ReportViewer";
import PlantShutdownPage from "./pages/PlantShutdownPage";
import KpiChartsPage from "./pages/KpiChartsPage";
import KpiRangeViewer from "./pages/KpiRangeViewer";


export default function App() {
  const [authHeader, setAuthHeader] = useState(null);
  
  if (!authHeader) return <Login onLogin={setAuthHeader} />;

  return (
    <BrowserRouter>
      <Layout authHeader={authHeader} setAuthHeader={setAuthHeader} />
    </BrowserRouter>
  );
}

function Layout({ authHeader, setAuthHeader }) {
  const username = authHeader ? atob(authHeader.split(" ")[1]).split(":")[0] : null;

  const [isReportDropdownOpen, setIsReportDropdownOpen] = useState(false);
  const location = useLocation();

  const isReportActive = location.pathname === "/report" || location.pathname === "/kpi-data";

  const commonNavLinkClass =
    "flex items-center h-full px-4 text-sm font-medium text-gray-700 hover:text-orange-600 transition duration-150 ease-in-out border-b-2 border-transparent";
  const activeNavLinkClass =
    "text-orange-600 font-semibold border-b-2 border-orange-600";
  
  const dropdownLinkClass = "block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600";
  const activeDropdownLinkClass = "bg-orange-50 text-orange-600 font-semibold";


  return (
    <div className="flex flex-col min-h-screen">
      
      {/* 🌟 Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-gray-800 shadow-lg border-b border-gray-700">
        
        {/* ✅ 1. Header height back to h-16 (4rem) */}
        <header className="relative flex items-center justify-center px-10 h-16 bg-grey-900">
          
          {/* Center: Logo + Title */}
          <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3">
            {/* ✅ 2. Logo size adjusted to w-24 h-14 (will fit in h-16 bar) */}
            <img
             
              alt="JSL Logo"
              className="w-30 h-10 object-contain" 
            />
            <div className="flex flex-col items-start">
              <h1 className="text-2xl font-extrabold tracking-wide">
                <span className="text-orange-500">2×125 MW CPP – </span>
                <span className="text-white">PIMS</span>
              </h1>
              <div className="h-0.5 w-full bg-orange-500 rounded-full mt-1"></div>
            </div>
          </div>

          {/* Right: User Info */}
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm font-medium text-gray-300">
              Welcome,&nbsp;
              <span className="font-semibold text-orange-500">
                {username || "User"}
              </span>
            </span>
            <button
              onClick={() => setAuthHeader(null)}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md text-xs font-semibold border border-orange-700 transition"
            >
              Logout
            </button>
          </div>
        </header>

        {/* 🔸 Navigation Bar (height is h-12) */}
        <nav className="h-12 bg-white border-t border-gray-700">
          <div className="max-w-7xl mx-auto h-full flex justify-center items-center gap-8 px-6">
            <NavLink
              to="/entry"
              className={({ isActive }) =>
                `${commonNavLinkClass} ${isActive ? activeNavLinkClass : ""}`
              }
            >
              Data Entry
            </NavLink>
            
            <div 
              className="relative h-full"
              onMouseEnter={() => setIsReportDropdownOpen(true)}
              onMouseLeave={() => setIsReportDropdownOpen(false)}
            >
              <div 
                className={`${commonNavLinkClass} ${isReportActive ? activeNavLinkClass : ""} cursor-pointer`}
              >
                Reports ▾
              </div>
              {isReportDropdownOpen && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-0 w-48 bg-white shadow-lg rounded-b-md border border-t-0 border-orange-200 z-30">
                  <NavLink
                    to="/report"
                    className={({ isActive }) => 
                      `${dropdownLinkClass} ${isActive ? activeDropdownLinkClass : ""}`
                    }
                  >
                    Daily Report
                  </NavLink>
                  <NavLink
                    to="/kpi-data"
                    className={({ isActive }) => 
                      `${dropdownLinkClass} ${isActive ? activeDropdownLinkClass : ""}`
                    }
                  >
                    KPI Data Viewer
                  </NavLink>
                </div>
              )}
            </div>
            
            <NavLink
              to="/shutdowns"
              className={({ isActive }) =>
                `${commonNavLinkClass} ${isActive ? activeNavLinkClass : ""}`
              }
            >
              Shutdown Log
            </NavLink>
            <NavLink
              to="/charts"
              className={({ isActive }) =>
                `${commonNavLinkClass} ${isActive ? activeNavLinkClass : ""}`
              }
            >
              KPI Charts
            </NavLink>
          </div>
        </nav>
      </div>

      {/* 🌿 Main Section */}
      {/* ✅ 3. Adjusted top-padding back to pt-28 (h-16 + h-12 = 4rem + 3rem = 7rem = 28) */}
      <main className="flex-1 overflow-y-auto bg-gray-100 pt-28">
        <div className="p-6">
          <Routes>
            <Route path="/" element={<Navigate to="/entry" />} />
            <Route path="/entry" element={<DataEntryPage auth={authHeader} />} />
            <Route path="/report" element={<ReportViewer auth={authHeader} />} />
            <Route path="/shutdowns" element={<PlantShutdownPage auth={authHeader} />} />
            <Route path="/charts" element={<KpiChartsPage auth={authHeader} />} />
            <Route path="/kpi-data" element={<KpiRangeViewer auth={authHeader} />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}