import React, { useState, useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  NavLink,
  useLocation,
} from "react-router-dom";

// --- Page Imports ---
import Login from "./pages/Login";
import DataEntryPage from "./pages/DataEntryPage";
import PlantShutdownPage from "./pages/PlantShutdownPage";
import KpiChartsPage from "./pages/KpiChartsPage";
import KpiRangeViewer from "./pages/KpiRangeViewer";
import AdminPanel from "./pages/AdminPanel";
import UserMenu from "./components/UserMenu";
import DMPlantReportPage from "./pages/DMPlantReportPage";
import DesignDataPage from "./pages/DesignDataPage";
import Reports from "./pages/Reports";
import LogicDiagramPage from "./pages/LogicDiagramPage";
import FloatingMessageBox from "./components/FloatingMessageBox";
import TotalizerEntry from "./pages/TotalizerEntry";
import DMPlantPage from "./pages/dmplanttabs";

// --- Helper Functions ---
function decodeJWT(token) {
  try {
    const base64 = token.split(".")[1];
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

// --- Main App Component ---
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

// --- Layout Component ---
function Layout({ authHeader, onLogout }) {
  const decoded = decodeJWT(authHeader.replace("Bearer ", ""));
  const username = decoded?.sub || "User";
  const roleId = decoded?.role_id || null;
  
  // Define authorized roles for specific tabs
  const dmPlantRoles = [1, 2, 3, 5, 7, 8];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] font-sans text-slate-800">
      
      {/* ================= HEADER SECTION ================= */}
      <div className="fixed top-0 left-0 right-0 z-50 shadow-md">
        
       

        {/* 2. BRANDING BAR (White) */}
        <header className="bg-white h-12 flex items-center justify-between px-6 border-b border-gray-100 relative">
          
          {/* Logo Area */}
          <div className="flex items-center gap-3">
             {/* Replace src with your actual logo path */}
            <img src="/jsl-logo.png" className="h-10 w-auto object-contain" alt="JSL Logo" />
            <div className="hidden md:flex h-8 w-[1px] bg-gray-300 mx-2"></div>
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold text-slate-800 tracking-tight">PIMS</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Plant Information Management System</span>
            </div>
          </div>

          {/* Center Title (Absolute Centered) */}
          <div className="absolute left-1/2 -translate-x-1/2 hidden lg:block">
            <span className="text-2xl font-bold tracking-wide text-slate-700">
              <span className="text-[#E06A1B]">2×125 MW</span> CAPTIVE POWER PLANT
            </span>
          </div>

          {/* User Profile Area */}
          <div>
            <UserMenu username={username} onLogout={onLogout} />
          </div>
        </header>

        {/* 3. NAVIGATION BAR (Gray) */}
        <nav className="bg-[#EFEFEF] border-b border-[#D0D0D0] h-8 shadow-inner">
          <div className="max-w-screen-2xl mx-auto px-4 h-full flex items-center gap-1 overflow-x-auto no-scrollbar">
            
            <NavItem to="/TotalizerEntry" label="125MW Ops" />
            
            {dmPlantRoles.includes(roleId) && (
              <NavItem to="/dm-plant" label="DM Plant" />
            )}
            
            <NavItem to="/reports" label="Reports" />
            <NavItem to="/shutdowns" label="Shutdown Log" />
            <NavItem to="/charts" label="KPI Analysis" />
            
            <div className="h-5 w-[1px] bg-gray-300 mx-2 hidden sm:block"></div>
            
            <NavItem to="/DesignDataPage" label="Design Data" />
            <NavItem to="/LogicDiagramPage" label="Logic Diagrams" />

            {roleId === 8 /* Admin */ && (
              <>
                <div className="flex-1"></div> {/* Spacer */}
                <NavItem to="/admin" label="Admin Panel" isAdmin />
              </>
            )}

          </div>
        </nav>
        
        {/* Orange Accent Line */}
        <div className="h-[3px] bg-gradient-to-r from-[#E06A1B] to-[#FF8C42] w-full"></div>
      </div>

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 pt-[100px] pb-10 px-4 sm:px-6">
        <div className="max-w-screen-2xl mx-auto bg-white min-h-[calc(100vh-180px)] rounded-lg shadow-sm border border-gray-200 overflow-hidden relative">
          
          {/* Page Routing */}
          <div className="h-full">
            <Routes>
              <Route path="/" element={<Navigate to="/entry" />} />
              <Route path="/entry" element={<DataEntryPage auth={authHeader} />} />
              <Route path="/reports" element={<Reports auth={authHeader} />} />
              <Route path="/shutdowns" element={<PlantShutdownPage auth={authHeader} />} />
              <Route path="/charts" element={<KpiChartsPage auth={authHeader} />} />
              <Route path="/kpi-data" element={<KpiRangeViewer auth={authHeader} />} />
              <Route path="/admin" element={<AdminPanel auth={authHeader} />} />
              
              {/* DM Plant Routes */}
              <Route path="/dm-plant" element={<DMPlantPage auth={authHeader} />} />
              <Route path="/dm-plant-report" element={<DMPlantReportPage />} />
              
              {/* Technical Routes */}
              <Route path="/DesignDataPage" element={<DesignDataPage auth={authHeader} />} />
              <Route path="/LogicDiagramPage" element={<LogicDiagramPage auth={authHeader} />} />
              <Route path="/TotalizerEntry" element={<TotalizerEntry auth={authHeader} />} />
            </Routes>
          </div>

        </div>
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-white border-t border-gray-200 py-4 mt-auto">
        <div className="max-w-screen-2xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">Jindal Stainless Limited</span>
            <span>&copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-4 mt-2 md:mt-0">
             <span>Version 1.0.0</span>
             <span>|</span>
             <a href="mailto:cppsupport@jsl.com" className="hover:text-[#E06A1B] transition-colors">Contact</a>
          </div>
        </div>
      </footer>

      {/* Global Utilities */}
      <FloatingMessageBox auth={authHeader} />
    </div>
  );
}

// --- Sub-Component: Navigation Item ---
// 


function NavItem({ to, label, isAdmin = false }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `
          relative h-full px-4 flex items-center justify-center
          text-xs font-bold uppercase tracking-wide transition-all duration-200 ease-in-out
          whitespace-nowrap rounded-t-sm
          
          ${isAdmin 
            ? "text-red-700 hover:bg-red-50 hover:text-red-800" 
            : isActive
              ? "text-[#E06A1B] bg-white border-t-2 border-t-[#E06A1B] shadow-sm"
              : "text-slate-600 hover:text-[#E06A1B] hover:bg-white/60"
          }
        `
      }
    >
      {label}
    </NavLink>
  );
}