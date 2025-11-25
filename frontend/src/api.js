// src/api.js
import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8080",
});

// Add token automatically to all requests
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem("authToken");
  if (stored) {
    config.headers.Authorization = `Bearer ${stored}`;
  }
  return config;
});

export default api;
