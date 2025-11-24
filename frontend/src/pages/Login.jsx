import React, { useState } from "react";

export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch("http://localhost:8080/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errData = await response.json();
        setError(errData.detail || "Login failed.");
        return;
      }

      const data = await response.json();

      // Send token up
      onLogin(`Bearer ${data.access_token}`);

    } catch (err) {
      console.error("Login error:", err);
      setError("Unable to connect to server.");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 text-white relative overflow-hidden">

      {/* Background orbs */}
      <div className="absolute top-0 left-0 w-72 h-72 bg-orange-500 rounded-full blur-3xl opacity-20 animate-pulse" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-amber-400 rounded-full blur-3xl opacity-10 animate-pulse delay-300" />

      {/* Header */}
      <div className="mb-10 text-center animate-fade-in">
        <h1 className="text-5xl font-extrabold bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-400 bg-clip-text text-transparent drop-shadow-md tracking-tight">
          JSL CPP PIMS
        </h1>
        <p className="text-gray-300 mt-2 text-sm">
          Plant Information Management System
        </p>
      </div>

      {/* Login Card */}
      <div className="relative w-full max-w-md bg-white/10 backdrop-blur-lg p-8 rounded-2xl shadow-2xl border border-white/20 animate-slide-up">
        <h2 className="text-2xl font-semibold text-center text-orange-300 mb-6">
          Login to Continue
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 text-red-200 text-sm rounded-md text-center animate-pulse">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          {/* USERNAME */}
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-gray-200 mb-1"
            >
              Username
            </label>
            <input
              id="username"
              className="border border-gray-500/40 bg-gray-800/60 text-white placeholder-gray-400 p-3 w-full rounded-md focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition duration-150 ease-in-out"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* PASSWORD */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-200 mb-1"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className="border border-gray-500/40 bg-gray-800/60 text-white placeholder-gray-400 p-3 w-full rounded-md focus:ring-2 focus:ring-orange-400 focus:border-orange-400 transition duration-150 ease-in-out"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* LOGIN BUTTON */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500 text-gray-900 font-semibold py-3 px-4 rounded-md shadow-lg hover:shadow-orange-500/30 transition-all duration-300 ease-in-out transform hover:-translate-y-0.5"
          >
            Login
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-gray-400 animate-fade-in">
        © {new Date().getFullYear()} JSL CPP. All rights reserved.
      </p>
    </div>
  );
}
