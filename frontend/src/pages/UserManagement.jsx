import React, { useEffect, useState } from "react";
import axios from "axios";

export default function UserManagement({ auth }) {
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);

  const [form, setForm] = useState({
    username: "",
    password: "",
    full_name: "",
    role_id: ""
  });

  const api = axios.create({
    baseURL: "http://localhost:8080/api",
    headers: { Authorization: auth },
  });

  // Load roles and users
  useEffect(() => {
    api.get("/admin/roles").then(res => setRoles(res.data)).catch(() => {});
    api.get("/admin/users").then(res => setUsers(res.data)).catch(() => {});
  }, []);

  // Create User
  const createUser = (e) => {
    e.preventDefault();

    api.post("/admin/users", form)
      .then(() => {
        alert("User created!");
        window.location.reload();
      })
      .catch(err => alert(err.response?.data?.detail || "Error creating user"));
  };

  // Reset Password
  const handleResetPassword = (id) => {
    const newPass = prompt("Enter new password:");
    if (!newPass) return;
    const fd = new FormData();
    fd.append("new_password", newPass);

    api.put(`/admin/users/${id}/reset-password`, fd)
      .then(() => alert("Password updated"))
      .catch(err => alert(err.response?.data?.detail || "Error resetting password"));
  };

  // Delete User
  const handleDeleteUser = (id) => {
    if (!window.confirm("Are you sure?")) return;

    api.delete(`/admin/users/${id}`)
      .then(() => {
        alert("User deleted");
        setUsers(users.filter(u => u.id !== id));
      })
      .catch(err => alert(err.response?.data?.detail || "Error deleting user"));
  };

  return (
    <div className="max-w-6xl mx-auto my-4 p-4 bg-orange-50 rounded-lg shadow-md border border-orange-200 space-y-6">

      {/* ---------- PAGE TITLE ---------- */}
      <h2 className="text-2xl font-semibold text-center text-orange-800">
        User Management — Admin Panel
      </h2>

      {/* ---------- CREATE USER CARD ---------- */}
      <div className="p-4 bg-white border border-orange-200 rounded-lg shadow">

        <h3 className="text-xl font-semibold mb-4 text-orange-700 text-center">
          Create New User
        </h3>

        <form
          onSubmit={createUser}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div>
            <label className="text-xs text-gray-700">Username</label>
            <input
              className="w-full p-2 border rounded-md focus:ring-orange-500 focus:border-orange-500 bg-white"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-700">Full Name</label>
            <input
              className="w-full p-2 border rounded-md focus:ring-orange-500 focus:border-orange-500"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>

          <div>
            <label className="text-xs text-gray-700">Password</label>
            <input
              type="password"
              className="w-full p-2 border rounded-md focus:ring-orange-500 focus:border-orange-500"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="text-xs text-gray-700">Role</label>
            <select
              className="w-full p-2 border rounded-md bg-white focus:ring-orange-500 focus:border-orange-500"
              value={form.role_id}
              onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
              required
            >
              <option value="">Select Role</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            className="col-span-full bg-gradient-to-r from-orange-500 to-amber-400 text-white p-2 rounded-md mt-2 font-semibold shadow hover:from-orange-600 hover:to-amber-500"
          >
            Create User
          </button>
        </form>
      </div>

      {/* ---------- USERS LIST CARD ---------- */}
      <div className="p-4 bg-white border border-orange-200 rounded-lg shadow">

        <h3 className="text-xl font-semibold mb-4 text-orange-700 text-center">
          Existing Users
        </h3>

        <div className="overflow-x-auto border border-orange-200 rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-orange-400 text-white text-xs uppercase">
              <tr>
                <th className="p-2 border-r border-orange-200">ID</th>
                <th className="p-2 border-r border-orange-200">Username</th>
                <th className="p-2 border-r border-orange-200">Full Name</th>
                <th className="p-2 border-r border-orange-200">Role</th>
                <th className="p-2 border-r border-orange-200">Active</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-orange-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-orange-50">
                  <td className="p-2 border-r border-orange-100">{u.id}</td>
                  <td className="p-2 border-r border-orange-100">{u.username}</td>
                  <td className="p-2 border-r border-orange-100">{u.full_name}</td>
                  <td className="p-2 border-r border-orange-100">{u.role_id}</td>
                  <td className="p-2 border-r border-orange-100">
                    {u.is_active ? "Yes" : "No"}
                  </td>

                  <td className="p-2 flex gap-2 justify-center">

                    <button
                      className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded shadow"
                      onClick={() => handleResetPassword(u.id)}
                    >
                      Reset
                    </button>

                    <button
                      className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded shadow"
                      onClick={() => handleDeleteUser(u.id)}
                    >
                      Delete
                    </button>

                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      </div>

    </div>
  );
}
