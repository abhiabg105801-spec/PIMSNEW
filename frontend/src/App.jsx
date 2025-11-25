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
import DataEntryPage from "./pages/DataEntryPage";
import ReportViewer from "./pages/ReportViewer";
import PlantShutdownPage from "./pages/PlantShutdownPage";
import KpiChartsPage from "./pages/KpiChartsPage";
import KpiRangeViewer from "./pages/KpiRangeViewer";
import AdminPanel from "./pages/AdminPanel";

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

function Layout({ authHeader, onLogout }) {
  const decoded = decodeJWT(authHeader.replace("Bearer ", ""));
  const username = decoded?.sub || "User";

  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const highlightReports =
    location.pathname === "/report" || location.pathname === "/kpi-data";

  const navLinkStyle = (isActive) =>
    `px-4 h-full flex items-center text-sm font-medium transition-all duration-200
     ${isActive ? "text-orange-600 border-b-2 border-orange-600" : "text-gray-700 hover:text-orange-500 hover:scale-[1.03]"}
    `;

  const dropdownItem = (isActive) =>
    `block px-4 py-2 text-sm rounded transition-all duration-200
     ${isActive ? "bg-orange-50 text-orange-600 font-semibold" : "text-gray-700 hover:bg-orange-50 hover:text-orange-600"}
    `;

  return (
    <div className="min-h-screen flex flex-col">

      {/* TOP ORANGE LINE */}
      

      {/* HEADER (GLASSMORPHISM) */}
      <div className="fixed top-1.5 left-0 right-0 z-30 bg-white/80 backdrop-blur-md shadow-md border-b border-gray-300">
        <header className="flex items-center justify-between px-10 h-16">

          {/* Logo + title */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3">
  <img src="/jsl-logo.png" className="h-10 w-auto" alt="logo" />
  
  <div className="flex flex-col leading-tight text-center">
    <span className="text-xl font-extrabold tracking-wide text-gray-800">
      <span className="text-orange-600">2×125 MW CPP – </span>PIMS
    </span>
    <div className="h-0.5 w-full bg-orange-500 mt-1"></div>
  </div>
</div>
          
          {/* Right side user info */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-700">
              Welcome,&nbsp;
              <span className="font-semibold text-orange-600">{username}</span>
            </span>
            <button
              onClick={onLogout}
              className="px-4 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded shadow transition-all"
            >
              Logout
            </button>
          </div>
        </header>

        {/* NAVIGATION */}
        <nav className="h-12 bg-gray-100 border-t border-gray-300 shadow-inner">
          <div className="max-w-7xl mx-auto flex items-center h-full gap-8 px-8">

            <NavLink to="/entry" className={({ isActive }) => navLinkStyle(isActive)}>
              Data Entry
            </NavLink>

            {/* Reports Dropdown */}
            <div
              className="relative h-full"
              onMouseEnter={() => setIsOpen(true)}
              onMouseLeave={() => setIsOpen(false)}
            >
              <div
                className={`${navLinkStyle(highlightReports)} cursor-pointer flex items-center gap-1`}
              >
                Reports ▾
              </div>

              {isOpen && (
                <div className="absolute top-full mt-0 left-0 bg-white shadow-xl border border-gray-200 rounded-b w-48 z-50 animate-dropdown">
                  <NavLink
                    to="/report"
                    className={({ isActive }) => dropdownItem(isActive)}
                  >
                    Daily Report
                  </NavLink>
                  <NavLink
                    to="/kpi-data"
                    className={({ isActive }) => dropdownItem(isActive)}
                  >
                    KPI Data Viewer
                  </NavLink>
                </div>
              )}
            </div>

            {/* Other Menus */}
            <NavLink to="/shutdowns" className={({ isActive }) => navLinkStyle(isActive)}>
              Shutdown Log
            </NavLink>

            <NavLink to="/charts" className={({ isActive }) => navLinkStyle(isActive)}>
              KPI Charts
            </NavLink>

            {username === "admin" && (
              <NavLink to="/admin" className={({ isActive }) => navLinkStyle(isActive)}>
                Admin Panel
              </NavLink>
            )}
          </div>
        </nav>
      </div>

      {/* PAGE CONTENT */}
      <main className="flex-1 bg-gray-100 pt-32 px-6 pb-6">
        <Routes>
          <Route path="/" element={<Navigate to="/entry" />} />
          <Route path="/entry" element={<DataEntryPage auth={authHeader} />} />
          <Route path="/report" element={<ReportViewer auth={authHeader} />} />
          <Route path="/shutdowns" element={<PlantShutdownPage auth={authHeader} />} />
          <Route path="/charts" element={<KpiChartsPage auth={authHeader} />} />
          <Route path="/kpi-data" element={<KpiRangeViewer auth={authHeader} />} />
          <Route path="/admin" element={<AdminPanel auth={authHeader} />} />
        </Routes>
      </main>

      {/* CSS Animations */}
      <style>{`
        @keyframes dropdown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-dropdown {
          animation: dropdown 0.18s ease-out;
        }
      `}</style>
    </div>
  );
}
