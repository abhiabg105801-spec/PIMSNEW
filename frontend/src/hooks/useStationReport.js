// src/hooks/useStationReport.js
import { useEffect, useState } from "react";
import axios from "axios";

export function useStationReport(reportDate, auth) {
  const [stationData, setStationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reportDate) {
      setStationData(null);
      return;
    }
    let cancelled = false;
    const api = axios.create({ baseURL: "/api", headers: { Authorization: auth } });

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/reports/station/${reportDate}`);
        if (cancelled) return;
        setStationData(res.data || null);
      } catch (err) {
        if (!cancelled) {
          if (err.response?.status === 404) setStationData(null);
          else setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => (cancelled = true);
  }, [reportDate, auth]);

  return { stationData, loading, error };
}
