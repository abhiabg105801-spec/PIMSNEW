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

// DM Plant Module
import DMPlantPage from "./pages/UniversalPIMSPage";

// Decode JWT Helper
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
   PREMIUM CORPORATE GREY–ORANGE UI LAYOUT
   ====================================================== */

function Layout({ authHeader, onLogout }) {
  const decoded = decodeJWT(authHeader.replace("Bearer ", ""));
  const username = decoded?.sub || "User";
  const roleId = decoded?.role_id || null;

  const location = useLocation();
  const dmRoles = [1, 2, 3, 5, 7, 8];

  return (
    // UPDATED: Added Premium Gradient Background here
    <div className="min-h-screen flex flex-col bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-white via-gray-100 to-gray-300 text-slate-700">

      {/* ================= HEADER ================= */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] border-b border-gray-200">

        {/* Top Branding Bar */}
        <div className="h-14 flex items-center justify-between px-6 bg-white">

          {/* LOGO */}
          <div className="flex items-center gap-3">
            <img src="/jsl-logo.png" alt="JSL Logo" className="h-12" />
          </div>

          {/* CENTER TITLE */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden xl:block text-center">
            <span className="text-[26px] font-bold tracking-wide text-[#7A7A7A]">
              <span className="text-[#E06A1B] font-extrabold">2×125 MW CPP</span> – PIMS
            </span>
          </div>

          {/* USER MENU */}
          <UserMenu username={username} onLogout={onLogout} />
        </div>

        {/* ORANGE ACCENT BAR */}
        <div className="h-[4px] bg-gradient-to-r from-[#E06A1B] via-[#F6A65A] to-[#E06A1B]" />
        
        {/* ================= NAVIGATION ================= */}
        <nav className="h-10 bg-[#F8F8F8] border-b border-gray-300">
          <div className="max-w-7xl mx-auto flex items-center h-full gap-5 px-6">

            {/* --- Navigation Items --- */}
            {[
              { to: "/TotalizerEntry", label: "125MW" },
              ...(dmRoles.includes(roleId) ? [{ to: "/dm-plant", label: "DM Plant" }] : []),
              { to: "/reports", label: "Reports" },
              { to: "/shutdowns", label: "Shutdown Log" },
              { to: "/charts", label: "KPI Charts" },
              { to: "/DesignDataPage", label: "Design Data" },
              { to: "/LogicDiagramPage", label: "Logic Diagrams" },
              ...(username === "admin" ? [{ to: "/admin", label: "Admin Panel" }] : []),
            ].map((item) => (
              <NavItem key={item.to} to={item.to} label={item.label} />
            ))}

          </div>
        </nav>
      </header>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 pt-[110px] px-4 pb-6">
        {/* Optional: Add a backdrop blur or slight transparency to content wrapper if desired */}
        <div className="max-w-[1920px] mx-auto">

          <Routes>
            <Route path="/" element={<Navigate to="/entry" />} />
            
            <Route path="/reports" element={<Reports auth={authHeader} />} />
            <Route path="/shutdowns" element={<PlantShutdownPage auth={authHeader} />} />
            <Route path="/charts" element={<KpiChartsPage auth={authHeader} />} />
            <Route path="/kpi-data" element={<KpiRangeViewer auth={authHeader} />} />
            <Route path="/admin" element={<AdminPanel auth={authHeader} />} />

            {/* DM Plant */}
            <Route path="/dm-plant" element={<DMPlantPage auth={authHeader} />} />
            

            {/* Technical Pages */}
            <Route path="/DesignDataPage" element={<DesignDataPage auth={authHeader} />} />
            <Route path="/LogicDiagramPage" element={<LogicDiagramPage auth={authHeader} />} />

            {/* Totalizer Entry */}
            <Route path="/TotalizerEntry" element={<TotalizerEntry auth={authHeader} />} />
          </Routes>

        </div>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-white/80 backdrop-blur-sm border-t border-gray-300 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-6 text-sm text-gray-600 flex items-center justify-between">
          <span>© {new Date().getFullYear()} Jindal Stainless Ltd.</span>
          <a href="mailto:cppsupport@jsl.com" className="text-[#E06A1B] font-semibold hover:underline">
            Contact Support
          </a>
        </div>
      </footer>

      <FloatingMessageBox auth={authHeader} />
    </div>
  );
}

/* -----------------------------------------------------
   PREMIUM NAVIGATION LINK COMPONENT
----------------------------------------------------- */
function NavItem({ to, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
        relative flex items-center h-full px-3 text-[13px] font-semibold uppercase tracking-wide
        transition-all duration-300

        ${isActive ? "text-[#E06A1B]" : "text-[#555] hover:text-[#E06A1B]"}

        after:absolute after:bottom-0 after:left-0
        after:h-[3px] after:bg-[#E06A1B]
        after:transition-all after:duration-300
        ${isActive ? "after:w-full" : "after:w-0 group-hover:after:w-full"}
      `
      }
    >
      {label}
    </NavLink>
  );
}
