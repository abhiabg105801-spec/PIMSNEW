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
    <div className="min-h-screen flex items-center justify-center bg-white px-4">

      {/* Card */}
      <div className="w-full max-w-md bg-white border border-gray-300 shadow-lg rounded-xl p-8">

        {/* Logo */}
        <div className="flex justify-center mb-4">
          <img
            src="/jsl-logo.png"
            alt="JSL Logo"
            className="h-14 w-auto"
          />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold text-center text-[#6B6B6B] tracking-wide">
          <span className="text-[#E06A1B] font-extrabold">CPP –</span> PIMS
        </h1>
        <p className="text-center text-gray-500 text-sm mb-6">
          Plant Information Management System
        </p>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm rounded-md border border-red-300 text-center">
            {error}
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleLogin} className="space-y-5">

          {/* Username */}
          <div>
            <label className="text-sm text-gray-700 font-medium mb-1 block">
              Username
            </label>
            <input
              className="
                w-full p-3 rounded-md 
                border border-gray-300 
                bg-white text-gray-800
                focus:ring-2 focus:ring-[#E06A1B]/60 
                focus:border-[#E06A1B]
                transition
              "
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm text-gray-700 font-medium mb-1 block">
              Password
            </label>

            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                className="
                  w-full p-3 rounded-md 
                  border border-gray-300 
                  bg-white text-gray-800 
                  focus:ring-2 focus:ring-[#E06A1B]/60 
                  focus:border-[#E06A1B]
                  transition pr-12
                "
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {/* Eye Icon */}
              <span
                onClick={() => setShowPass(!showPass)}
                className="
                  absolute right-3 top-3 cursor-pointer 
                  text-gray-500 hover:text-[#E06A1B]
                  transition
                "
              >
                {showPass ? (
                  <EyeSlashIcon className="h-6 w-6" />
                ) : (
                  <EyeIcon className="h-6 w-6" />
                )}
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className="
              w-full py-3 
              bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600
              text-white 
              font-semibold 
              rounded-md 
              shadow-sm 
              transition-all
            "
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
