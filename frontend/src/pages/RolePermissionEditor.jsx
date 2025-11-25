import React, { useEffect, useState } from "react";
import axios from "axios";

const FIELDS = [
  "totalizer_mu","generation_mu", "plf_percent", "running_hour", "plant_availability_percent",
  "planned_outage_hour", "planned_outage_percent", "forced_outage_hour",
  "forced_outage_percent", "strategic_outage_hour", "coal_consumption_t",
  "sp_coal_consumption_kg_kwh", "avg_gcv_coal_kcal_kg", "heat_rate",
  "ldo_hsd_consumption_kl", "sp_oil_consumption_ml_kwh",
  "aux_power_consumption_mu", "aux_power_percent",
  "dm_water_consumption_cu_m", "sp_dm_water_consumption_percent",
  "steam_gen_t", "sp_steam_consumption_kg_kwh", "stack_emission_spm_mg_nm3"
];

export default function RolePermissionEditor({ auth }) {
  const [roles, setRoles] = useState([]);
  const [roleId, setRoleId] = useState("");
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    axios.get("/api/admin/roles", { headers: { Authorization: auth } })
      .then(res => setRoles(res.data));
  }, []);

  const loadPermissions = (rid) => {
    setRoleId(rid);
    axios.get(`/api/admin/permissions/${rid}`, { headers: { Authorization: auth } })
      .then(res => {
        const map = {};
        res.data.forEach(p => map[p.field_name] = p);
        setPermissions(map);
      });
  };

  const updatePerm = (field, type, value) => {
    const newPerms = { ...permissions };
    if (!newPerms[field]) {
      newPerms[field] = { field_name: field, can_edit: false, can_view: true };
    }
    newPerms[field][type] = value;
    setPermissions(newPerms);
  };

  const savePermission = (field) => {
    const p = permissions[field];
    const form = new FormData();
    form.append("role_id", roleId);
    form.append("field_name", field);
    form.append("can_edit", p.can_edit);
    form.append("can_view", p.can_view);

    axios.post("/api/admin/permissions", form, { headers: { Authorization: auth } })
      .then(() => alert("Saved!"))
      .catch(err => alert(err.response?.data?.detail || "Error saving permission"));
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-3">Role Permissions</h3>

      <select
        className="p-2 border rounded mb-4"
        onChange={(e) => loadPermissions(e.target.value)}
      >
        <option>Select Role</option>
        {roles.map(r => (
          <option key={r.id} value={r.id}>{r.name}</option>
        ))}
      </select>

      {roleId && (
        <table className="w-full bg-white shadow-md rounded">
          <thead className="bg-orange-200">
            <tr>
              <th className="p-2">Field</th>
              <th className="p-2">Can View</th>
              <th className="p-2">Can Edit</th>
              <th className="p-2">Save</th>
            </tr>
          </thead>

          <tbody>
            {FIELDS.map(f => (
              <tr key={f} className="border-t">
                <td className="p-2">{f}</td>

                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={permissions[f]?.can_view ?? true}
                    onChange={e => updatePerm(f, "can_view", e.target.checked)}
                  />
                </td>

                <td className="p-2 text-center">
                  <input
                    type="checkbox"
                    checked={permissions[f]?.can_edit ?? false}
                    onChange={e => updatePerm(f, "can_edit", e.target.checked)}
                  />
                </td>

                <td className="p-2 text-center">
                  <button className="bg-orange-600 text-white px-3 py-1 rounded"
                    onClick={() => savePermission(f)}
                  >
                    Save
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
