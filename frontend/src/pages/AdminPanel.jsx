import React, { useState } from "react";
import UserManagement from "./UserManagement";
import RolePermissionEditor from "./RolePermissionEditor";

export default function AdminPanel({ auth }) {
  const [tab, setTab] = useState("users");

  return (
    <div className="bg-white shadow-md rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4 text-orange-600">Admin Panel</h2>

      <div className="flex gap-4 border-b mb-4">
        <button 
          onClick={() => setTab("users")}
          className={`px-4 py-2 ${tab === "users" ? "border-b-2 border-orange-600 text-orange-600" : ""}`}
        >
          User Management
        </button>

        <button 
          onClick={() => setTab("permissions")}
          className={`px-4 py-2 ${tab === "permissions" ? "border-b-2 border-orange-600 text-orange-600" : ""}`}
        >
          Role Permissions
        </button>
      </div>

      {tab === "users" && <UserManagement auth={auth} />}
      {tab === "permissions" && <RolePermissionEditor auth={auth} />}
    </div>
  );
}
