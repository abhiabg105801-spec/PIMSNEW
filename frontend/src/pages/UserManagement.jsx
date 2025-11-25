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

  // Axios instance with token
  const api = axios.create({
    baseURL: "http://localhost:8080/api",
    headers: {
      Authorization: auth,  // MUST be "Bearer <token>"
    },
  });

  // Load roles + users
  useEffect(() => {
    api.get("/admin/roles")
      .then(res => setRoles(res.data))
      .catch(err => console.log(err));

    api.get("/admin/users")
      .then(res => setUsers(res.data))
      .catch(err => console.log(err));
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
  const handleResetPassword = (userId) => {
    const newPass = prompt("Enter new password:");
    if (!newPass) return;

    const fd = new FormData();
    fd.append("new_password", newPass);

    api.put(`/admin/users/${userId}/reset-password`, fd)
      .then(() => alert("Password reset successfully"))
      .catch(err => alert(err.response?.data?.detail || "Error resetting password"));
  };

  // Delete User
  const handleDeleteUser = (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    api.delete(`/admin/users/${userId}`)
      .then(() => {
        alert("User deleted");
        setUsers(users.filter(u => u.id !== userId));
      })
      .catch(err => alert(err.response?.data?.detail || "Error deleting user"));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">

      <h3 className="text-2xl font-semibold mb-4">Create New User</h3>

      <form
        onSubmit={createUser}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-100 p-4 rounded-lg shadow"
      >
        <input
          className="p-2 border rounded"
          placeholder="Username"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          required
        />

        <input
          className="p-2 border rounded"
          placeholder="Full Name"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />

        <input
          className="p-2 border rounded"
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />

        <select
          className="p-2 border rounded"
          value={form.role_id}
          onChange={(e) =>
            setForm({ ...form, role_id: Number(e.target.value) })
          }
          required
        >
          <option value="">Select Role</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        <button
          type="submit"
          className="col-span-full bg-orange-600 text-white p-2 rounded hover:bg-orange-700"
        >
          Create User
        </button>
      </form>

      {/* Users Table */}
      <h3 className="text-2xl font-semibold mt-10 mb-3">Existing Users</h3>

      <table className="w-full bg-white shadow rounded overflow-hidden">
        <thead>
          <tr className="bg-orange-200 text-left">
            <th className="p-2">ID</th>
            <th className="p-2">Username</th>
            <th className="p-2">Full Name</th>
            <th className="p-2">Role ID</th>
            <th className="p-2">Active</th>
            <th className="p-2">Actions</th>
          </tr>
        </thead>

        <tbody>
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-2">{u.id}</td>
              <td className="p-2">{u.username}</td>
              <td className="p-2">{u.full_name}</td>
              <td className="p-2">{u.role_id}</td>
              <td className="p-2">{u.is_active ? "Yes" : "No"}</td>

              <td className="p-2 flex gap-2">
                <button
                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                  onClick={() => handleResetPassword(u.id)}
                >
                  Reset Password
                </button>

                <button
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
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
  );
}
