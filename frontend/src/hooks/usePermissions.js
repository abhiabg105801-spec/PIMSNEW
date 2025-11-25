// src/hooks/usePermissions.js
import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:8080/api";

/**
 * usePermissions(roleId, auth)
 * Correctly loads permissions for the given role.
 */
export default function usePermissions(roleId, authToken) {
  const [permissions, setPermissions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const authHeader = authToken.startsWith("Bearer ")
    ? authToken
    : `Bearer ${authToken}`;

  useEffect(() => {
    if (!authToken) {
      setPermissions({});
      setLoading(false);
      return;
    }

    const api = axios.create({
      baseURL: API_URL,
      headers: { Authorization: authHeader }
    });

    let cancelled = false;

    async function fetchPermissions() {
      setLoading(true);
      setError(null);

      try {
        // Attempt ADMIN endpoint
        const res = await api.get(`/admin/permissions/${roleId}`);
        if (cancelled) return;

        const permMap = {};
        res.data.forEach(p => {
          permMap[p.field_name] = {
            can_edit: p.can_edit,
            can_view: p.can_view
          };
        });

        setPermissions(permMap);
      } catch (err) {
        // If admin endpoint blocked → use user-level permissions
        if (err.response?.status === 403 || err.response?.status === 401) {
          try {
            const r2 = await api.get(`/permissions/me`);
            if (cancelled) return;

            const permMap2 = {};
            r2.data.forEach(p => {
              permMap2[p.field_name] = {
                can_edit: p.can_edit,
                can_view: p.can_view
              };
            });

            setPermissions(permMap2);
          } catch (err2) {
            if (!cancelled) {
              setError(err2);
              setPermissions({});
            }
          }
        } else {
          if (!cancelled) {
            setError(err);
            setPermissions({});
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPermissions();
    return () => { cancelled = true; };
  }, [roleId, authToken]);

  return { loading, error, permissions };
}
