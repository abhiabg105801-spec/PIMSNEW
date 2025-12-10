import React, { useState } from "react";
import { EyeIcon, EyeSlashIcon, ChartBarIcon, ServerIcon } from "@heroicons/react/24/outline";
// Assuming you've placed the logo image in your public folder or imported it
// If it's in the public folder, the path would be like '/jsl-logo.png'
// If you import it, use: import jslLogo from './path/to/your/logo.png';

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

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 relative overflow-hidden font-sans">
      
      {/* 1. BACKGROUND: Technical Dot Grid */}
      <div 
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
          backgroundSize: "30px 30px", // Creates the engineering paper look
          opacity: 0.5
        }}
      />
      
      {/* Decorative Orange Circle (Blurry Blob) behind card */}
      <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-gray-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

      {/* 2. MAIN CARD */}
      <div className="relative z-10 bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row border border-gray-100">
        
        {/* LEFT SIDE: Login Form (White) */}
        <div className="w-full md:w-1/2 p-10 lg:p-14 flex flex-col justify-center">
          
          {/* Brand Header */}
          <div className="mb-10">
            <div className="flex items-center gap-2 mb-3">
               {/* Use the imported or public path to your image */}
               <img src="/jsl-logo.png" alt="JSL Logo" className="h-12 w-auto" /> 
               <h1 className="text-2xl font-bold text-gray-800 tracking-tight ml-2">PIMS</h1>
            </div>
            <h2 className="text-4xl font-extrabold text-gray-900 mb-2">Welcome back</h2>
            <p className="text-gray-500 text-sm">Enter your credentials to access the plant dashboard.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">User ID</label>
              <input
                type="text"
                placeholder="e.g. 849201"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full p-4 bg-gray-50 border-l-4 border-transparent focus:border-[#E06A1B] focus:bg-white focus:ring-0 transition-all outline-none font-medium text-gray-700 placeholder-gray-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full p-4 bg-gray-50 border-l-4 border-transparent focus:border-[#E06A1B] focus:bg-white focus:ring-0 transition-all outline-none font-medium text-gray-700 placeholder-gray-400 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-4 text-gray-400 hover:text-[#E06A1B] transition"
                >
                  {showPass ? <EyeSlashIcon className="h-6 w-6"/> : <EyeIcon className="h-6 w-6"/>}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

            <div className="flex items-center justify-between pt-2">
               <label className="flex items-center text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  <input type="checkbox" className="mr-2 accent-[#E06A1B] w-4 h-4" />
                  Remember me
               </label>
               <a href="#" className="text-sm font-bold text-[#E06A1B] hover:text-orange-700">Help?</a>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-[#E06A1B]  text-white font-bold text-lg rounded hover:bg-gray-900 transition-colors duration-300 shadow-lg flex justify-center items-center gap-2"
            >
              {loading ? "Connecting..." : "ACCESS SYSTEM"}
            </button>
          </form>
        </div>

        {/* RIGHT SIDE: Visual Panel (Grey/Orange) */}
        <div className="hidden md:flex w-1/2 bg-gray-100 relative items-center justify-center overflow-hidden">
           
           {/* Background Image with Grayscale Filter */}
           <div 
             className="absolute inset-0 bg-cover bg-center grayscale contrast-125"
             // Replaced with a local image path
             style={{ backgroundImage: "url('/power-plant.jpg')" }} 
           ></div>
           
           {/* Orange Gradient Fade from bottom */}
           <div className="absolute inset-0 bg-gradient-to-t from-[#E06A1B]/90 via-[#E06A1B]/40 to-transparent mix-blend-multiply"></div>

           {/* Floating Info Stats */}
           <div className="relative z-10 w-64">
              
              {/* Stat Card 1 */}
              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-xl mb-4 border-l-4 border-[#E06A1B] transform translate-x-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-orange-100 rounded text-[#E06A1B]">
                          <ChartBarIcon className="h-6 w-6" />
                      </div>
                      <div>
                          
                          <p className="text-xl font-bold text-gray-800">2x125MW CPP</p>
                      </div>
                  </div>
              </div>

              {/* Stat Card 2 */}
              <div className="bg-white/90 backdrop-blur-sm p-4 rounded-lg shadow-xl border-l-4 border-gray-800 transform -translate-x-4">
                  <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-200 rounded text-gray-800">
                          <ServerIcon className="h-6 w-6" />
                      </div>
                      <div>
                          
                          <p className="text-xl font-bold text-gray-800">14MW CPP</p>
                      </div>
                  </div>
              </div>
              
              <div className="mt-8 text-white text-center">
                  <p className="text-sm font-medium tracking-widest uppercase opacity-80">JSL CPP</p>
                  <p className="text-xs opacity-60">----</p>
              </div>

           </div>
        </div>
        
      </div>
      
      {/* Footer Text */}
      <div className="absolute bottom-6 text-gray-400 text-xs text-center w-full">
         &copy; 2025 JSL. All rights reserved.
      </div>

    </div>
  );
}