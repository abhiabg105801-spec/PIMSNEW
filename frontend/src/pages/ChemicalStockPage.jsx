// =======================================================
// CHEMICAL STOCK MANAGEMENT PAGE (Professional White/Grey/Orange Theme)
// =======================================================

import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  Plus,
  Minus,
  Edit2,
  Save,
  X,
  Trash2,
  Download,
  AlertTriangle,
  Zap,
  Package,
  Search,
} from "lucide-react";
import * as XLSX from "xlsx";

/* ================= API Setup ================= */
const api = axios.create({
  baseURL: "/api/chemical",
  headers: {
    Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
  },
});

/* ================= Shared UI Components ================= */

/**
 * Enhanced Modal Component - Clean White & Orange Theme
 */
const Modal = ({ open, title, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-zinc-900/60 z-50 flex items-center justify-center backdrop-blur-sm p-4 transition-opacity">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-100">
          <h3 className="text-lg font-bold text-zinc-800 tracking-tight">{title}</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-orange-600 transition duration-200"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>
        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar">{children}</div>
      </div>
    </div>
  );
};

/**
 * Styled Input Row - Orange Focus Rings
 */
const InputRow = ({ label, value, onChange, type = "text", placeholder = "", readOnly = false }) => (
  <div className="flex flex-col space-y-1.5 mb-3">
    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wide">{label}</label>
    <input
      type={type}
      value={value}
      onChange={readOnly ? null : (e) => onChange(e.target.value)}
      placeholder={placeholder}
      readOnly={readOnly}
      className={`
        w-full border border-zinc-300 rounded-lg px-4 py-2.5 text-sm text-zinc-900 
        focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all duration-200
        ${readOnly ? 'bg-zinc-50 text-zinc-500 cursor-not-allowed border-zinc-200' : 'bg-white shadow-sm'}
      `}
    />
  </div>
);

/**
 * Action Button Component
 */
const ActionButton = ({ icon: Icon, onClick, className, title }) => (
  <button
    onClick={onClick}
    className={`p-1.5 rounded-lg transition-all duration-200 ${className}`}
    title={title}
  >
    <Icon size={16} />
  </button>
);

/* ================= Main Component ================= */
export default function ChemicalStockPage() {
  const today = new Date().toISOString().slice(0, 10);

  // --- State Hooks ---
  const [masters, setMasters] = useState([]);
  const [txns, setTxns] = useState([]);

  /* ===== Filters ===== */
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [filterChemical, setFilterChemical] = useState("");
  const [filterType, setFilterType] = useState("");

  /* ===== Master Edit ===== */
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  /* ===== Transaction Modal ===== */
  const [txnModal, setTxnModal] = useState(false);
  const [txnType, setTxnType] = useState("IN"); 
  const [selectedChemical, setSelectedChemical] = useState(null);
  const [txnData, setTxnData] = useState({
    date: today,
    time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    quantity: "",
    feed_point: "",
    feeding_rate: "",
    reason: "",
    remarks: "",
  });

  /* ===== Add Chemical Modal ===== */
  const [showAddModal, setShowAddModal] = useState(false);
  const [newChemical, setNewChemical] = useState({
    chemical_name: "",
    minimum_stock: "",
    unit_cost: "",
  });

  const lowStockAlertShown = useRef(false);

  // --- Data Loaders ---
  const loadMasters = async () => {
    try {
      // Mock data for display if API fails (Remove in production)
      // const res = await api.get("/master");
      // Use logic below for real API
       const res = await api.get("/master"); 
      const data = res.data.map(c => ({
        ...c,
        minimum_stock: Number(c.minimum_stock || 0),
        available_qty: Number(c.available_qty || 0),
        unit_cost: Number(c.unit_cost || 0),
      }));
      setMasters(data);

      if (!lowStockAlertShown.current) {
        const low = data.filter((c) => c.available_qty < c.minimum_stock);
        if (low.length) console.warn(`Low Stock: ${low.map((c) => c.chemical_name).join(", ")}`);
        lowStockAlertShown.current = true;
      }
    } catch (error) {
      console.error("Failed to load masters:", error);
    }
  };

  const loadTxns = async () => {
    try {
      const res = await api.get("/txn", {
        params: { start: fromDate, end: toDate },
      });
      setTxns(res.data);
    } catch (error) {
      console.error("Failed to load transactions:", error);
    }
  };

  useEffect(() => {
    loadMasters();
  }, []);

  useEffect(() => {
    loadTxns();
  }, [fromDate, toDate]);

  // --- Handlers ---
  const saveMaster = async (id) => {
    try {
      await api.put(`/master/${id}`, {
        ...editValues,
        minimum_stock: Number(editValues.minimum_stock),
        unit_cost: Number(editValues.unit_cost),
      });
      setEditingId(null);
      setEditValues({});
      loadMasters();
    } catch (error) {
      console.error("Error saving master", error);
    }
  };

  const handleAddChemical = async () => {
    if (!newChemical.chemical_name) return alert("Name required");
    try {
      await api.post("/master", {
        chemical_name: newChemical.chemical_name,
        minimum_stock: Number(newChemical.minimum_stock || 0),
        unit_cost: Number(newChemical.unit_cost || 0),
      });
      setShowAddModal(false);
      setNewChemical({ chemical_name: "", minimum_stock: "", unit_cost: "" });
      loadMasters();
    } catch (error) {
      console.error("Error adding chemical", error);
    }
  };

  const saveTxn = async () => {
    if (!txnData.date || !txnData.quantity || !selectedChemical) return alert("Missing fields");
    
    const quantity = Number(txnData.quantity);
    if (txnType === "OUT" && quantity > selectedChemical.available_qty) {
        return alert(`Insufficient stock. Available: ${selectedChemical.available_qty}`);
    }

    try {
        await api.post("/txn", {
            chemical_id: selectedChemical.id,
            txn_type: txnType,
            txn_date: txnData.date,
            txn_time: txnData.time,
            quantity: quantity,
            feed_point: txnData.feed_point || null,
            feeding_rate: txnData.feeding_rate ? Number(txnData.feeding_rate) : null,
            reason: txnData.reason || null,
            remarks: txnData.remarks || null,
        });
        setTxnModal(false);
        setSelectedChemical(null);
        setTxnData({ ...txnData, quantity: "", feed_point: "", feeding_rate: "", reason: "", remarks: "" });
        loadMasters();
        loadTxns();
    } catch(error) {
        console.error("Txn Error", error);
    }
  };

  const deleteTxn = async (id) => {
    if (!window.confirm("Delete transaction?")) return;
    try {
      await api.delete(`/txn/${id}`);
      loadMasters();
      loadTxns();
    } catch (error) { console.error(error); }
  };

  // --- Calculations ---
  const filteredTxns = useMemo(() => {
    let data = txns.filter(t => 
        (!filterChemical || t.chemical_id === Number(filterChemical)) &&
        (!filterType || t.txn_type === filterType)
    ).sort((a, b) => new Date(`${a.txn_date}T${a.txn_time || '00:00'}`) - new Date(`${b.txn_date}T${b.txn_time || '00:00'}`));

    return data.map(t => ({
        ...t,
        chemical_name: masters.find(c=>c.id===t.chemical_id)?.chemical_name || 'N/A'
    }));
  }, [txns, masters, filterChemical, filterType]);

  const monthlyCost = useMemo(() => {
    return txns.filter((t) => t.txn_type === "OUT").reduce((sum, t) => {
        const chem = masters.find((c) => c.id === t.chemical_id);
        return sum + (chem?.unit_cost || 0) * t.quantity;
      }, 0);
  }, [txns, masters]);

  const exportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredTxns);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Log");
    XLSX.writeFile(wb, `Stock_Log_${fromDate}_${toDate}.xlsx`);
  };

  // --- Render Sections ---

  const renderMasterTable = () => (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
      <div className="flex justify-between items-center px-6 py-4 border-b border-zinc-100 bg-white">
        <h2 className="text-lg font-bold text-zinc-800 flex items-center tracking-tight">
            <div className="p-2 bg-orange-100 rounded-lg mr-3">
                <Package size={20} className="text-orange-600" />
            </div>
            Inventory Master
        </h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 text-sm rounded-lg flex items-center font-semibold shadow-sm transition-all"
        >
          <Plus size={16} className="mr-2" />
          Add Chemical
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-bold text-zinc-500 uppercase tracking-wider">Chemical Name</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Available</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Min Stock</th>
              <th className="px-6 py-3 text-right text-xs font-bold text-zinc-500 uppercase tracking-wider">Unit Cost</th>
              <th className="px-6 py-3 text-center text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {masters.map((c) => {
              const isLowStock = c.available_qty < c.minimum_stock;
              const isEditing = editingId === c.id;
              return (
                <tr key={c.id} className="hover:bg-orange-50/30 transition duration-150 group">
                  <td className="px-6 py-4 font-semibold text-zinc-800">
                    {c.chemical_name}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        isLowStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
                    }`}>
                        {isLowStock && <AlertTriangle size={12} className="mr-1" />}
                        {c.available_qty.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-zinc-600">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.minimum_stock}
                        onChange={(e) => setEditValues({ ...editValues, minimum_stock: e.target.value })}
                        className="border border-orange-300 rounded px-2 py-1 w-20 text-right text-sm focus:ring-2 focus:ring-orange-500/20 outline-none"
                      />
                    ) : c.minimum_stock.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right text-zinc-600 font-mono">
                    {isEditing ? (
                      <input
                        type="number"
                        value={editValues.unit_cost}
                        onChange={(e) => setEditValues({ ...editValues, unit_cost: e.target.value })}
                        className="border border-orange-300 rounded px-2 py-1 w-20 text-right text-sm focus:ring-2 focus:ring-orange-500/20 outline-none"
                      />
                    ) : `Rs${c.unit_cost.toFixed(2)}`}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex justify-center items-center space-x-1">
                        {isEditing ? (
                        <>
                            <ActionButton icon={Save} onClick={() => saveMaster(c.id)} className="bg-green-100 text-green-700 hover:bg-green-200" title="Save" />
                            <ActionButton icon={X} onClick={() => setEditingId(null)} className="bg-zinc-100 text-zinc-600 hover:bg-zinc-200" title="Cancel" />
                        </>
                        ) : (
                        <ActionButton 
                            icon={Edit2} 
                            onClick={() => { setEditingId(c.id); setEditValues({ minimum_stock: c.minimum_stock, unit_cost: c.unit_cost }); }} 
                            className="text-zinc-400 hover:text-orange-600 hover:bg-orange-50" 
                            title="Edit" 
                        />
                        )}
                        <div className="w-px h-4 bg-zinc-200 mx-2"></div>
                        <ActionButton 
                            icon={Plus} 
                            onClick={() => { setSelectedChemical(c); setTxnType("IN"); setTxnModal(true); }} 
                            className="text-zinc-400 hover:text-green-600 hover:bg-green-50" 
                            title="Stock IN" 
                        />
                        <ActionButton 
                            icon={Minus} 
                            onClick={() => { setSelectedChemical(c); setTxnType("OUT"); setTxnModal(true); }} 
                            className="text-zinc-400 hover:text-red-600 hover:bg-red-50" 
                            title="Stock OUT" 
                        />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderTxnLog = () => (
    <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden mt-8">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center px-6 py-4 border-b border-zinc-100 bg-white gap-4">
        <h2 className="text-lg font-bold text-zinc-800 flex items-center tracking-tight">
            <div className="p-2 bg-zinc-100 rounded-lg mr-3">
                <Zap size={20} className="text-zinc-600" />
            </div>
            Transaction Log
        </h2>
        
        <div className="flex items-center gap-4">
            <div className="px-4 py-2 bg-zinc-50 rounded-lg border border-zinc-100 text-sm">
                <span className="text-zinc-500 mr-2">Est. Cost:</span>
                <span className="font-bold text-zinc-800">Rs{monthlyCost.toFixed(2)}</span>
            </div>
            <button
                onClick={exportExcel}
                className="bg-zinc-800 hover:bg-zinc-900 text-white px-4 py-2 text-sm rounded-lg flex items-center font-medium shadow-sm transition-all"
            >
                <Download size={16} className="mr-2" />
                Export
            </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-zinc-50 border-b border-zinc-100">
        <div className="relative">
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
            <span className="absolute -top-2 left-2 bg-zinc-50 px-1 text-[10px] font-semibold text-zinc-500">FROM</span>
        </div>
        <div className="relative">
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none" />
            <span className="absolute -top-2 left-2 bg-zinc-50 px-1 text-[10px] font-semibold text-zinc-500">TO</span>
        </div>
        <div className="relative">
             <select value={filterChemical} onChange={(e) => setFilterChemical(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white">
                <option value="">All Chemicals</option>
                {masters.map((c) => <option key={c.id} value={c.id}>{c.chemical_name}</option>)}
            </select>
        </div>
        <div className="relative">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="w-full border border-zinc-300 rounded-md px-3 py-2 text-sm focus:ring-1 focus:ring-orange-500 outline-none bg-white">
                <option value="">All Types</option>
                <option value="IN">Stock IN</option>
                <option value="OUT">Stock OUT</option>
            </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="bg-zinc-50 border-b border-zinc-200">
            <tr>
              <th className="px-6 py-3 text-left font-bold text-zinc-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left font-bold text-zinc-500 uppercase">Chemical</th>
              <th className="px-6 py-3 text-center font-bold text-zinc-500 uppercase">Type</th>
              <th className="px-6 py-3 text-right font-bold text-zinc-500 uppercase">Qty</th>
              <th className="px-6 py-3 text-left font-bold text-zinc-500 uppercase">Details</th>
              <th className="px-6 py-3 text-center font-bold text-zinc-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filteredTxns.length > 0 ? filteredTxns.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50 transition">
                <td className="px-6 py-3 text-zinc-600">
                  <div className="font-medium text-zinc-800">{t.txn_date}</div>
                  <div className="text-[10px] text-zinc-400 font-mono">{t.txn_time?.slice(0, 5)}</div>
                </td>
                <td className="px-6 py-3 font-medium text-zinc-800">{t.chemical_name}</td>
                <td className="px-6 py-3 text-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-bold ${t.txn_type === "IN" ? "bg-green-50 text-green-700" : "bg-orange-50 text-orange-700"}`}>
                        {t.txn_type}
                    </span>
                </td>
                <td className="px-6 py-3 text-right font-mono text-zinc-700 font-bold">{Number(t.quantity).toFixed(2)}</td>
                <td className="px-6 py-3 text-zinc-500 max-w-xs truncate">
                    {t.feed_point && <span className="block text-[10px] uppercase text-zinc-400">Point: {t.feed_point}</span>}
                    {t.reason || t.remarks || '-'}
                </td>
                <td className="px-6 py-3 text-center">
                  <button onClick={() => deleteTxn(t.id)} className="text-zinc-400 hover:text-red-600 transition">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            )) : (
                <tr><td colSpan="6" className="p-8 text-center text-zinc-400 italic">No transactions found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-8 bg-zinc-50 min-h-screen font-sans text-zinc-900 selection:bg-orange-100 selection:text-orange-900">
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold text-zinc-900 tracking-tight flex items-center">
            <span className="w-2 h-8 bg-orange-500 rounded-sm mr-4"></span>
            Chemical Inventory
        </h1>
        <p className="text-zinc-500 text-sm mt-1 ml-6">
            System Date: <span className="font-semibold text-zinc-700">{today}</span>
        </p>
      </header>

      <div className="max-w-7xl mx-auto space-y-6">
        {renderMasterTable()}
        {renderTxnLog()}
      </div>

      {/* Transaction Modal */}
      <Modal open={txnModal} title={`${txnType === 'IN' ? 'Stock Receiving' : 'Stock Issuance'}`} onClose={() => setTxnModal(false)}>
        <div className="space-y-1">
            <div className="bg-zinc-50 p-3 rounded-lg border border-zinc-200 mb-4 flex justify-between items-center">
                <span className="text-xs font-bold text-zinc-500 uppercase">Selected Chemical</span>
                <span className="text-sm font-bold text-zinc-900">{selectedChemical?.chemical_name}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
                <InputRow label="Date" type="date" value={txnData.date} onChange={(v)=>setTxnData({...txnData,date:v})}/>
                <InputRow label="Time" type="time" value={txnData.time} onChange={(v)=>setTxnData({...txnData,time:v})}/>
            </div>
            
            <InputRow label="Quantity" type="number" value={txnData.quantity} onChange={(v)=>setTxnData({...txnData,quantity:v})} placeholder="0.00" />
            
            {txnType === 'OUT' ? (
                <>
                    <InputRow label="Feeding Point" value={txnData.feed_point} onChange={(v)=>setTxnData({...txnData,feed_point:v})} />
                    <InputRow label="Reason / Batch" value={txnData.reason} onChange={(v)=>setTxnData({...txnData,reason:v})} />
                </>
            ) : (
                <InputRow label="PO Number / Supplier" value={txnData.reason} onChange={(v)=>setTxnData({...txnData,reason:v})} />
            )}
            
            <InputRow label="Remarks" value={txnData.remarks} onChange={(v)=>setTxnData({...txnData,remarks:v})} />

            <button 
                onClick={saveTxn} 
                className="w-full mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 rounded-lg shadow-md hover:shadow-lg transition-all transform active:scale-[0.98]"
            >
                Confirm {txnType === 'IN' ? 'Receiving' : 'Issuance'}
            </button>
        </div>
      </Modal>

      {/* Add Chemical Modal */}
      <Modal open={showAddModal} title="Add New Chemical" onClose={()=>setShowAddModal(false)}>
        <div className="space-y-4">
            <InputRow label="Name" value={newChemical.chemical_name} onChange={(v)=>setNewChemical({...newChemical,chemical_name:v})} placeholder="e.g. Sulfuric Acid" />
            <div className="grid grid-cols-2 gap-4">
                <InputRow label="Min Stock Level" type="number" value={newChemical.minimum_stock} onChange={(v)=>setNewChemical({...newChemical,minimum_stock:v})} placeholder="0" />
                <InputRow label="Unit Cost ($)" type="number" value={newChemical.unit_cost} onChange={(v)=>setNewChemical({...newChemical,unit_cost:v})} placeholder="0.00" />
            </div>
            <button 
                onClick={handleAddChemical} 
                className="w-full mt-4 bg-zinc-800 hover:bg-zinc-900 text-white font-bold py-3 rounded-lg shadow-md transition-all"
            >
                Create Record
            </button>
        </div>
      </Modal>
    </div>
  );
}