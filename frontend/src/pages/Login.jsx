import React, { useState } from "react";
import { EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";


export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const err = await response.json();
        setError(err.detail || "Login failed.");
        return;
      }

      const data = await response.json();
      onLogin(`Bearer ${data.access_token}`);
    } catch {
      setError("Unable to connect to server.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-white via-gray-100 to-gray-200 px-4">

      {/* Glass Card */}
      <div className="w-full max-w-md bg-white/30 backdrop-blur-xl border border-white/40 shadow-2xl rounded-2xl p-8">
        
        {/* Company Logo */}
        <div className="flex justify-center mb-4">
          <img
            src="/JSL.png"
            alt="Company Logo"
            className="h-16 w-auto drop-shadow-md"
          />
        </div>

        {/* Header */}
        <h1 className="text-3xl font-extrabold text-center text-orange-400 tracking-tight">
          CPP – PIMS
        </h1>
        <p className="text-center text-gray-600 mb-6 text-sm">
          Plant Information Management System
        </p>

        {/* Error message */}
        {error && (
          <div className="mb-4 p-3 bg-red-100/70 text-red-700 text-sm rounded-md border border-red-200 text-center">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          
          {/* USERNAME */}
          <div>
            <label className="text-sm text-gray-700 font-medium mb-1 block">
              Username
            </label>
            <input
              className="w-full p-3 rounded-lg bg-white/80 border border-gray-300 shadow-sm text-gray-800
                         focus:ring-2 focus:ring-orange-400 focus:border-orange-500 transition"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label className="text-sm text-gray-700 font-medium mb-1 block">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                className="w-full p-3 rounded-lg bg-white/80 border border-gray-300 shadow-sm text-gray-800
                           focus:ring-2 focus:ring-orange-400 focus:border-orange-500 transition pr-12"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {/* EYE ICON */}
              <span
                className="absolute right-3 top-3 cursor-pointer text-gray-500 hover:text-orange-600 transition"
                onClick={() => setShowPass(!showPass)}
              >
                {showPass ? (
                  <EyeSlashIcon className="h-6 w-6" />
                ) : (
                  <EyeIcon className="h-6 w-6" />
                )}
              </span>
            </div>
          </div>

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            className="w-full py-3 bg-orange-400 hover:bg-orange-600 text-white font-semibold rounded-lg 
                       shadow-md hover:shadow-orange-400/40 transition-all hover:-translate-y-0.5"
          >
            Login
          </button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} JSL CPP. All rights reserved.
        </p>
      </div>
    </div>
  );
}
