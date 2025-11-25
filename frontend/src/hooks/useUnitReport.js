// src/hooks/useUnitReport.js
import { useEffect, useState } from "react";
import axios from "axios";

export function useUnitReport(unit, reportDate, auth) {
  const [unitData, setUnitData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!unit || !reportDate) {
      setUnitData(null);
      return;
    }
    let cancelled = false;
    const api = axios.create({ baseURL: "/api", headers: { Authorization: auth } });

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/reports/single/${unit}/${reportDate}`);
        if (cancelled) return;
        setUnitData(res.data || null);
      } catch (err) {
        if (!cancelled) {
          if (err.response?.status === 404) setUnitData(null);
          else setError(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => (cancelled = true);
  }, [unit, reportDate, auth]);

  return { unitData, loading, error };
}
