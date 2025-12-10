import React, { useState } from "react";
import { 
  EyeIcon, 
  EyeSlashIcon, 
  ChartBarIcon, 
  CpuChipIcon, 
  AdjustmentsHorizontalIcon, 
  BeakerIcon, 
  WrenchScrewdriverIcon 
} from "@heroicons/react/24/outline";

// Assuming you've placed the logo image in your public folder
// If it's in the public folder, the path would be like '/jsl-logo.png'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Simulate network request
      const response = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        throw new Error("Invalid credentials");
      }

      const data = await response.json();
      onLogin(`Bearer ${data.access_token}`);
    } catch (err) {
      setError("Login failed. Please check your ID.");
      setLoading(false);
    }
  };

  // Features Data for the Visual Panel
  const features = [
    { title: "KPI Logging & Reports", icon: ChartBarIcon, desc: "Real-time performance tracking" },
    { title: "Logic Diagrams", icon: CpuChipIcon, desc: "System flow visualization" },
    { title: "Design Parameters", icon: AdjustmentsHorizontalIcon, desc: "Operational benchmarks" },
    { title: "LIMS Integration", icon: BeakerIcon, desc: "Laboratory information management" },
    { title: "Outage Data", icon: WrenchScrewdriverIcon, desc: "Downtime analysis & logs" },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-100 relative overflow-hidden font-sans p-4">
      
      {/* 1. BACKGROUND: Technical Dot Grid (Zinc Theme) */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(#a1a1aa 1px, transparent 1px)", // Zinc-400 dots
          backgroundSize: "30px 30px", 
          opacity: 0.4
        }}
      />
      
      {/* Decorative Floating Orbs */}
      <div className="absolute top-[-10%] right-[-5%] w-80 h-80 bg-orange-500 rounded-full mix-blend-multiply filter blur-[80px] opacity-40 animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-80 h-80 bg-zinc-600 rounded-full mix-blend-multiply filter blur-[80px] opacity-40"></div>

      {/* 2. MAIN CARD - Compact Size (max-w-4xl, min-h-[550px]) */}
      <div className="relative z-10 w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-white/40 backdrop-blur-md min-h-[550px]">
        
        {/* PANEL 1: VISUAL PANEL (Now on LEFT) - 50% Width */}
        <div className="hidden md:flex w-1/2 bg-zinc-900 relative items-center justify-center overflow-hidden border-r border-zinc-700/50">
           
           {/* Background Image */}
           <div 
             className="absolute inset-0 bg-cover bg-center"
             style={{ 
               backgroundImage: "url('/power-plant.jpg')",
               filter: "grayscale(100%) contrast(1.1) brightness(0.4)" 
             }} 
           ></div>
           
           {/* Gradients */}
           <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/80 to-zinc-900/40"></div>
           <div className="absolute inset-0 bg-gradient-to-br from-orange-600/20 to-zinc-900/60 mix-blend-overlay"></div>

           {/* Features Content */}
           <div className="relative z-10 w-full px-10">
              <div className="mb-8 border-l-4 border-orange-500 pl-5">
                <h3 className="text-3xl font-black text-white tracking-tight leading-none mb-2">
                  SYSTEM <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">FEATURES</span>
                </h3>
                <p className="text-zinc-300 text-xs font-light tracking-wide mt-2 max-w-xs">
                  Integrated Plant Information Management
                </p>
              </div>

              <div className="space-y-3">
                {features.map((item, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/5 backdrop-blur-sm hover:bg-white/10 hover:border-orange-500/40 transition-all duration-500 group cursor-default shadow-sm hover:shadow-orange-500/10 hover:-translate-y-1"
                    style={{
                      animation: `fadeInLeft 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                      animationDelay: `${index * 0.1}s`,
                      opacity: 0, 
                      transform: 'translateX(-20px)'
                    }}
                  >
                    <div className="p-2 bg-zinc-800/80 rounded-lg text-orange-500 group-hover:bg-orange-600 group-hover:text-white transition-colors duration-300 shadow-inner border border-white/5 group-hover:scale-110">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-zinc-100 font-bold text-xs tracking-wide group-hover:text-orange-300 transition-colors duration-300">{item.title}</h4>
                      <p className="text-zinc-500 text-[10px] font-medium group-hover:text-zinc-400 transition-colors uppercase tracking-wider">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
           </div>
        </div>

        {/* PANEL 2: LOGIN FORM (Now on RIGHT) - 50% Width */}
        <div className="w-full md:w-1/2 p-8 lg:p-10 flex flex-col justify-center bg-gradient-to-bl from-white/95 to-zinc-100/90 backdrop-blur-xl relative">
          
          {/* Subtle top accent */}
          <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-l from-orange-500 to-zinc-500"></div>

          {/* Brand Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
               {/* Use the imported or public path to your image */}
               <img src="/jsl-logo.png" alt="JSL Logo" className="h-10 w-auto" /> 
               <div className="h-6 w-[2px] bg-zinc-300"></div>
               <h1 className="text-2xl font-black text-zinc-800 tracking-tighter">PIMS</h1>
            </div>
            <h2 className="text-3xl font-extrabold text-zinc-900 mb-1 tracking-tight">
              Welcome <span className="text-orange-600">Back</span>
            </h2>
            <p className="text-zinc-500 text-xs font-medium leading-relaxed">
              Secure access for authorized personnel only.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">User ID</label>
              <input
                type="text"
                placeholder="e.g. 849201"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-zinc-300 rounded-xl text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none font-medium text-sm shadow-sm hover:border-zinc-400"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-zinc-300 rounded-xl text-zinc-900 placeholder-zinc-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition-all outline-none font-medium pr-12 text-sm shadow-sm hover:border-zinc-400"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-3 text-zinc-400 hover:text-orange-600 transition"
                >
                  {showPass ? <EyeSlashIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5"/>}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-600"></span>
                {error}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
               <label className="flex items-center text-xs text-zinc-600 cursor-pointer hover:text-zinc-900 transition select-none group">
                  <input type="checkbox" className="mr-2 accent-orange-600 w-3.5 h-3.5 rounded border-gray-300 focus:ring-orange-500 group-hover:border-orange-500 transition-colors" />
                  Remember me
               </label>
               <a href="#" className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline">Forgot Password?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-zinc-800 to-zinc-900 hover:from-orange-600 hover:to-orange-700 text-white font-bold text-sm tracking-wide rounded-xl shadow-lg hover:shadow-orange-500/30 transform active:scale-[0.98] transition-all duration-200 flex justify-center items-center gap-2"
            >
              {loading ? "Verifying..." : "LOGIN TO DASHBOARD"}
            </button>
          </form>
        </div>

      </div>
      
      {/* Footer Text */}
      <div className="absolute bottom-4 text-zinc-400 text-[10px] text-center w-full font-medium tracking-widest uppercase opacity-70">
         &copy; 2025 JSL Industries. Secure Enterprise System.
      </div>

      {/* Animation Styles */}
      <style>{`
        @keyframes fadeInLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

    </div>
  );
}