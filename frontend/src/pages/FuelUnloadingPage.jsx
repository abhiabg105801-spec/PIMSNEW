import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Save,
  RefreshCw,
  Truck,
  Database,
  Edit,
  Droplet,
} from "lucide-react";

/* =============================
   SMALL ROW INPUT
============================= */
const RowInput = ({ label, value, onChange, type = "text" }) => (
  <div className="flex border-b border-zinc-200">
    <div className="w-56 bg-zinc-50 px-3 py-2 text-[11px] font-bold uppercase text-zinc-600">
      {label}
    </div>
    <input
      type={type}
      value={value ?? ""}
      onChange={onChange}
      className="flex-1 px-3 py-2 text-sm outline-none
                 focus:bg-orange-50 transition-colors"
    />
  </div>
);

/* =============================
   MAIN PAGE
============================= */
export default function FuelUnloadingPage({ auth }) {
  /* ========== API (SAME AS UNIVERSAL PIMS PAGE) ========== */
  const api = useMemo(
    () =>
      axios.create({
        baseURL: "/api/oil-unloading",
        headers: {
          Authorization:
            auth || localStorage.getItem("authToken")
              ? `Bearer ${localStorage.getItem("authToken")}`
              : "",
        },
      }),
    [auth]
  );

  const today = new Date().toISOString().slice(0, 10);

  /* =============================
     FORM STATE (ALL FIELDS)
  ============================= */
  const emptyForm = {
    plant: "JSLO",
    area: "2x125 MW CPP",
    oil_type: "LDO",

    oil_company: "",
    oil_depot: "",
    vehicle_no: "",
    transporter: "",

    gross_wt: "",
    tare_wt: "",
    net_wt: "",
    net_kl: "",

    density: "",
    temperature: "15",
    density_15: "",

    dip1: "",
    dip2: "",
    dip3: "",
    dip4: "",

    vehicle_capacity: "25",

    tank1_initial: "",
    tank1_final: "",
    tank2_initial: "",
    tank2_final: "",

    boiler_consumption: "",
    receipt_kl: "",

    receiving_date: today,
    receiving_time: "00:00",
    releasing_date: today,
    releasing_time: "00:00",

    delay_reason: "",
    remarks: "",
  };

  const [form, setForm] = useState(emptyForm);
  const [history, setHistory] = useState([]);
  const [editId, setEditId] = useState(null);

  /* =============================
     TANK STOCK (LIVE WIDGET)
  ============================= */
  const [tankStock, setTankStock] = useState([]);

  /* =============================
     COMPARTMENTS
  ============================= */
  const [compartments, setCompartments] = useState([
    { no: 1, dip: "", kl: "" },
    { no: 2, dip: "", kl: "" },
    { no: 3, dip: "", kl: "" },
    { no: 4, dip: "", kl: "" },
  ]);

  /* =============================
     INIT
  ============================= */
  useEffect(() => {
    fetchHistory();
    fetchTankStock();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    fetchTankStock();
    // eslint-disable-next-line
  }, [form.plant, form.oil_type]);

  /* =============================
     HELPERS
  ============================= */
  const clean = (v) => (v === "" ? null : v);

  const fetchHistory = async () => {
    const res = await api.get("/");
    setHistory(res.data || []);
  };

  const fetchTankStock = async () => {
    const res = await api.get("/tanks", {
      params: { plant: form.plant, oil_type: form.oil_type },
    });
    setTankStock(res.data || []);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditId(null);
    setCompartments([
      { no: 1, dip: "", kl: "" },
      { no: 2, dip: "", kl: "" },
      { no: 3, dip: "", kl: "" },
      { no: 4, dip: "", kl: "" },
    ]);
  };

  /* =============================
     DIP → KL (PLACEHOLDER LOGIC)
     🔴 Replace with real dip chart later
  ============================= */
  const updateDip = (idx, dipVal) => {
    const dip = Number(dipVal || 0);
    const kl = (dip * 0.01).toFixed(2); // dummy logic

    const updated = [...compartments];
    updated[idx] = { ...updated[idx], dip: dipVal, kl };
    setCompartments(updated);

    const totalKL = updated.reduce(
      (s, c) => s + Number(c.kl || 0),
      0
    );

    setForm((f) => ({ ...f, receipt_kl: totalKL.toFixed(2) }));
  };

  /* =============================
     SAVE / UPDATE
  ============================= */
  const saveEntry = async () => {
    const payload = {};
    Object.keys(form).forEach((k) => (payload[k] = clean(form[k])));

    payload.dip1 = compartments[0].dip || null;
    payload.dip2 = compartments[1].dip || null;
    payload.dip3 = compartments[2].dip || null;
    payload.dip4 = compartments[3].dip || null;

    await api.post("/", payload);

    alert(editId ? "Fuel Unloading Updated" : "Fuel Unloading Saved");
    fetchHistory();
    fetchTankStock();
    resetForm();
  };

  /* =============================
     LOAD ROW FOR EDIT
  ============================= */
  const loadRow = (r) => {
    setEditId(r.id);
    setForm({ ...emptyForm, ...r });

    setCompartments([
      { no: 1, dip: r.dip1 ?? "", kl: "" },
      { no: 2, dip: r.dip2 ?? "", kl: "" },
      { no: 3, dip: r.dip3 ?? "", kl: "" },
      { no: 4, dip: r.dip4 ?? "", kl: "" },
    ]);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* =============================
     RENDER
  ============================= */
  return (
    <div className="p-4 space-y-6 bg-zinc-50">

      {/* ================= HEADER + LIVE TANK STOCK ================= */}
      <div className="flex items-center justify-between bg-white border border-zinc-200 rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-600 text-white rounded-lg shadow">
            <Truck size={18} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-zinc-800">
              Fuel Unloading – 125 MW CPP
            </h1>
            <p className="text-xs text-zinc-500">
              {editId ? "Edit Mode" : "New Entry"}
            </p>
          </div>
        </div>

        {/* LIVE TANK STOCK */}
        <div className="flex gap-3">
          {tankStock.map((t) => (
            <div
              key={t.tank_name}
              className="flex items-center gap-2 px-3 py-2
                         bg-zinc-50 border border-zinc-200 rounded shadow-sm"
            >
              <Droplet className="text-orange-600" size={14} />
              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-zinc-500">
                  {t.tank_name}
                </div>
                <div className="text-sm font-bold text-zinc-800">
                  {t.current_kl.toFixed(2)} KL
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= FORM SECTIONS ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: DETAILS */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-zinc-100 border-b text-xs font-bold">
            Location & Tanker Details
          </div>

          <RowInput label="Plant" value={form.plant} onChange={(e)=>setForm({...form,plant:e.target.value})}/>
          <RowInput label="Area" value={form.area} onChange={(e)=>setForm({...form,area:e.target.value})}/>
          <RowInput label="Oil Type (LDO/HSD)" value={form.oil_type} onChange={(e)=>setForm({...form,oil_type:e.target.value})}/>
          <RowInput label="Oil Company" value={form.oil_company} onChange={(e)=>setForm({...form,oil_company:e.target.value})}/>
          <RowInput label="Oil Depot" value={form.oil_depot} onChange={(e)=>setForm({...form,oil_depot:e.target.value})}/>
          <RowInput label="Vehicle No" value={form.vehicle_no} onChange={(e)=>setForm({...form,vehicle_no:e.target.value})}/>
          <RowInput label="Transporter" value={form.transporter} onChange={(e)=>setForm({...form,transporter:e.target.value})}/>
        </div>

        {/* RIGHT: WEIGHT & DENSITY */}
        <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
          <div className="px-4 py-2 bg-zinc-100 border-b text-xs font-bold">
            Weight & Density
          </div>

          <RowInput label="Gross Weight (T)" value={form.gross_wt} onChange={(e)=>setForm({...form,gross_wt:e.target.value})}/>
          <RowInput label="Tare Weight (T)" value={form.tare_wt} onChange={(e)=>setForm({...form,tare_wt:e.target.value})}/>
          <RowInput label="Net Weight (T)" value={form.net_wt} onChange={(e)=>setForm({...form,net_wt:e.target.value})}/>
          <RowInput label="Net KL" value={form.net_kl} onChange={(e)=>setForm({...form,net_kl:e.target.value})}/>
          <RowInput label="Density (gm/cc)" value={form.density} onChange={(e)=>setForm({...form,density:e.target.value})}/>
          <RowInput label="Temperature (°C)" value={form.temperature} onChange={(e)=>setForm({...form,temperature:e.target.value})}/>
          <RowInput label="Density @15°C" value={form.density_15} onChange={(e)=>setForm({...form,density_15:e.target.value})}/>
        </div>
      </div>

      {/* ================= COMPARTMENTS ================= */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-zinc-100 border-b text-xs font-bold">
          Tanker Compartment Measurement
        </div>

        <table className="w-full text-xs">
          <thead className="bg-zinc-200">
            <tr>
              <th className="p-2 border">Compartment</th>
              <th className="p-2 border">Dip (mm)</th>
              <th className="p-2 border">KL</th>
            </tr>
          </thead>
          <tbody>
            {compartments.map((c, idx) => (
              <tr key={c.no} className="hover:bg-orange-50">
                <td className="p-2 border text-center font-bold">{c.no}</td>
                <td className="p-2 border">
                  <input
                    value={c.dip}
                    onChange={(e) => updateDip(idx, e.target.value)}
                    className="w-full px-2 py-1 border rounded focus:bg-orange-50"
                  />
                </td>
                <td className="p-2 border text-center font-mono">
                  {c.kl || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="px-4 py-2 text-right text-xs font-bold text-orange-700">
          Total Receipt KL : {form.receipt_kl || "0.00"}
        </div>
      </div>

      {/* ================= STORAGE TANK & REMARKS ================= */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-zinc-100 border-b text-xs font-bold">
          Storage Tank / Remarks
        </div>

        <RowInput label="Tank-1 Initial (KL)" value={form.tank1_initial} onChange={(e)=>setForm({...form,tank1_initial:e.target.value})}/>
        <RowInput label="Tank-1 Final (KL)" value={form.tank1_final} onChange={(e)=>setForm({...form,tank1_final:e.target.value})}/>
        <RowInput label="Tank-2 Initial (KL)" value={form.tank2_initial} onChange={(e)=>setForm({...form,tank2_initial:e.target.value})}/>
        <RowInput label="Tank-2 Final (KL)" value={form.tank2_final} onChange={(e)=>setForm({...form,tank2_final:e.target.value})}/>
        <RowInput label="Oil Consumed During Unloading (KL)" value={form.boiler_consumption} onChange={(e)=>setForm({...form,boiler_consumption:e.target.value})}/>
        <RowInput label="Delay Reason" value={form.delay_reason} onChange={(e)=>setForm({...form,delay_reason:e.target.value})}/>
        <RowInput label="Remarks" value={form.remarks} onChange={(e)=>setForm({...form,remarks:e.target.value})}/>
      </div>

      {/* ================= ACTION ================= */}
      <div className="flex justify-end gap-2">
        <button
          onClick={resetForm}
          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold
                     bg-zinc-100 hover:bg-zinc-200 border border-zinc-300 rounded"
        >
          <RefreshCw size={14} /> Reset
        </button>
        <button
          onClick={saveEntry}
          className={`flex items-center gap-1 px-5 py-1.5 text-xs font-bold
                      text-white rounded shadow
                      ${editId ? "bg-blue-600 hover:bg-blue-700" : "bg-orange-600 hover:bg-orange-700"}`}
        >
          <Save size={14} /> {editId ? "Update" : "Save"}
        </button>
      </div>

      {/* ================= HISTORY ================= */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-2 bg-zinc-100 border-b flex items-center gap-2 text-xs font-bold">
          <Database size={14} /> Fuel Unloading History
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-max w-full text-xs">
            <thead className="bg-zinc-200">
              <tr>
                <th className="p-2 border">Edit</th>
                <th className="p-2 border">Date</th>
                <th className="p-2 border">Vehicle</th>
                <th className="p-2 border">Fuel</th>
                <th className="p-2 border">Receipt KL</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => (
                <tr key={r.id} className="hover:bg-orange-50">
                  <td className="p-2 border text-center">
                    <button onClick={() => loadRow(r)}>
                      <Edit size={14} className="text-orange-600" />
                    </button>
                  </td>
                  <td className="p-2 border text-center">{r.receiving_date}</td>
                  <td className="p-2 border text-center">{r.vehicle_no}</td>
                  <td className="p-2 border text-center">{r.oil_type}</td>
                  <td className="p-2 border text-center font-bold">
                    {r.receipt_kl}
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