import React, { useState, useEffect } from "react";
import { 
  EyeIcon, 
  EyeSlashIcon, 
  ChartBarIcon, 
  CpuChipIcon, 
  AdjustmentsHorizontalIcon, 
  BeakerIcon, 
  WrenchScrewdriverIcon 
} from "@heroicons/react/24/outline";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
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
      setError("Login failed. Please check your credentials.");
      setLoading(false);
    }
  };

  const features = [
    { title: "KPI Logging & Reports", icon: ChartBarIcon, desc: "Real-time performance tracking" },
    { title: "Logic Diagrams", icon: CpuChipIcon, desc: "System flow visualization" },
    { title: "Design Parameters", icon: AdjustmentsHorizontalIcon, desc: "Operational benchmarks" },
    { title: "LIMS Integration", icon: BeakerIcon, desc: "Laboratory information management" },
    { title: "Outage Data", icon: WrenchScrewdriverIcon, desc: "Downtime analysis & logs" },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
      
      {/* Animated Background Patterns */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* Floating Orbs with Animation */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float-delayed"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-gradient-to-br from-orange-400 to-orange-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse-slow"></div>

      {/* Main Card */}
      <div className={`relative z-10 w-full max-w-4xl mx-4 transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="bg-white/10 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          <div className="flex flex-col md:flex-row min-h-[480px]">
            
            {/* Left Panel - Features */}
            <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-gray-900 via-gray-800 to-black relative overflow-hidden border-r border-white/10">
              
              {/* Animated Grid Background */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-transparent"></div>
                <svg className="absolute inset-0 w-full h-full">
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)" />
                </svg>
              </div>

              {/* Glowing Lines */}
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-shimmer"></div>
              <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-orange-500 to-transparent animate-shimmer-delayed"></div>

              {/* Content */}
              <div className="relative z-10 w-full p-8 flex flex-col justify-center">
                
                {/* Header */}
                <div className="mb-6 space-y-3">
                  <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 backdrop-blur-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></div>
                    <span className="text-orange-400 text-[10px] font-bold tracking-wider">SYSTEM ONLINE</span>
                  </div>
                  
                  <h3 className="text-3xl font-black text-white tracking-tight leading-tight">
                    JSL-CPP
                    <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 animate-gradient">
                      PIMS
                    </span>
                  </h3>
                  <p className="text-gray-400 text-xs font-medium max-w-sm leading-relaxed">
                     Plant information management system
                  </p>
                </div>

                {/* Features List */}
                <div className="space-y-2">
                  {features.map((item, index) => (
                    <div 
                      key={index}
                      className={`group flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:border-orange-500/50 transition-all duration-500 hover:shadow-lg hover:shadow-orange-500/10 hover:-translate-x-2 cursor-pointer ${mounted ? 'animate-slide-in-left' : 'opacity-0'}`}
                      style={{ animationDelay: `${index * 100}ms` }}
                    >
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-transform duration-500">
                        <item.icon className="w-5 h-5 text-orange-400 group-hover:text-orange-300" />
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-xs tracking-wide group-hover:text-orange-300 transition-colors">
                          {item.title}
                        </h4>
                        <p className="text-gray-500 text-[10px] font-medium mt-0.5 group-hover:text-gray-400 transition-colors">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Accent */}
                <div className="mt-6 pt-4 border-t border-white/10">
                  <div className="flex items-center gap-2 text-gray-500 text-[10px]">
                    <div className="flex -space-x-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 border-2 border-gray-900"></div>
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-400 to-gray-600 border-2 border-gray-900"></div>
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-300 to-orange-500 border-2 border-gray-900"></div>
                    </div>
                    <span className="font-medium"></span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="w-full md:w-1/2 p-6 md:p-8 flex flex-col justify-center bg-gradient-to-br from-white via-gray-50 to-gray-100 relative">
              
              {/* Top Accent Line */}
              <div className="absolute top-0 right-0 w-full h-1 bg-gradient-to-r from-gray-500 via-orange-500 to-orange-600"></div>

              {/* Decorative Elements */}
              <div className="absolute top-6 right-6 w-20 h-20 bg-gradient-to-br from-orange-500/10 to-transparent rounded-full blur-2xl"></div>
              <div className="absolute bottom-6 left-6 w-24 h-24 bg-gradient-to-tr from-gray-500/10 to-transparent rounded-full blur-2xl"></div>

              {/* Content */}
              <div className={`relative z-10 transition-all duration-1000 delay-300 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                
                {/* Logo & Brand */}
                <div className="mb-6">
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                      <span className="text-white font-black text-lg">J</span>
                    </div>
                    <div>
                      <h1 className="text-xl font-black text-gray-900 tracking-tight">JSL PIMS</h1>
                      <p className="text-[10px] text-gray-500 font-semibold">Plant Information Management</p>
                    </div>
                  </div>
                  
                  <h2 className="text-2xl font-black text-gray-900 mb-1.5 tracking-tight">
                    Welcome <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">Back</span>
                  </h2>
                  <p className="text-gray-600 text-xs font-medium">
                    Sign in to access your dashboard
                  </p>
                </div>

                {/* Login Form */}
                <div className="space-y-4">
                  
                  {/* Username Field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <div className="w-1 h-3 bg-orange-500 rounded-full"></div>
                      User ID
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        placeholder="Enter your ID"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all outline-none font-semibold text-sm shadow-sm group-hover:border-gray-400"
                        required
                      />
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </div>
                  </div>

                  {/* Password Field */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                      <div className="w-1 h-3 bg-orange-500 rounded-full"></div>
                      Password
                    </label>
                    <div className="relative group">
                      <input
                        type={showPass ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2.5 bg-white border-2 border-gray-300 rounded-lg text-gray-900 placeholder-gray-400 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/20 transition-all outline-none font-semibold pr-10 text-sm shadow-sm group-hover:border-gray-400"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-600 transition-colors"
                      >
                        {showPass ? <EyeSlashIcon className="h-4 w-4"/> : <EyeIcon className="h-4 w-4"/>}
                      </button>
                      <div className="absolute inset-0 rounded-lg bg-gradient-to-r from-orange-500/0 via-orange-500/5 to-orange-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <div className="px-3 py-2 rounded-lg bg-red-50 border-2 border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2 animate-shake">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse"></div>
                      {error}
                    </div>
                  )}

                  {/* Remember Me & Forgot Password */}
                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center text-xs text-gray-700 cursor-pointer hover:text-gray-900 transition group">
                      <input type="checkbox" className="mr-1.5 accent-orange-600 w-3.5 h-3.5 rounded border-gray-300 cursor-pointer" />
                      <span className="font-medium group-hover:text-orange-600 transition-colors">Remember me</span>
                    </label>
                    <a href="#" className="text-xs font-bold text-orange-600 hover:text-orange-700 hover:underline transition-colors">
                      Forgot Password?
                    </a>
                  </div>

                  {/* Submit Button */}
                  <button
                    onClick={handleLogin}
                    disabled={loading}
                    className="group relative w-full py-3 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 hover:from-orange-500 hover:via-orange-600 hover:to-orange-500 text-white font-bold text-xs tracking-wider rounded-lg shadow-lg hover:shadow-2xl hover:shadow-orange-500/50 transform active:scale-[0.98] transition-all duration-300 overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    <span className="relative flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                          Verifying...
                        </>
                      ) : (
                        <>
                          LOGIN TO DASHBOARD
                          <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </>
                      )}
                    </span>
                  </button>
                </div>

                {/* Security Badge */}
                <div className="mt-5 pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-center gap-2 text-gray-500 text-[10px]">
                    <svg className="w-3.5 h-3.5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">Secured with 256-bit encryption</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-6 text-gray-400 text-xs text-center w-full font-medium tracking-wider">
        © 2025 JSL Industries. All rights reserved.
      </div>

      {/* Animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(30px, -30px) rotate(5deg); }
          66% { transform: translate(-20px, 20px) rotate(-5deg); }
        }
        
        @keyframes float-delayed {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          33% { transform: translate(-30px, 30px) rotate(-5deg); }
          66% { transform: translate(20px, -20px) rotate(5deg); }
        }
        
        @keyframes pulse-slow {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(1.05); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        @keyframes shimmer-delayed {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        
        @keyframes slide-in-left {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        @keyframes gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        
        .animate-float { animation: float 20s ease-in-out infinite; }
        .animate-float-delayed { animation: float-delayed 25s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 4s ease-in-out infinite; }
        .animate-shimmer { animation: shimmer 3s ease-in-out infinite; }
        .animate-shimmer-delayed { animation: shimmer-delayed 4s ease-in-out infinite; }
        .animate-slide-in-left { animation: slide-in-left 0.6s ease-out forwards; }
        .animate-shake { animation: shake 0.5s ease-in-out; }
        .animate-gradient { background-size: 200% 200%; animation: gradient 3s ease infinite; }
      `}</style>
    </div>
  );
}