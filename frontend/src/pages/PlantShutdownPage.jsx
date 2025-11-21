import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { format, subDays } from 'date-fns'; // For default dates

// Reusable Input Field (Compact Orange Theme)
const FormField = ({ label, id, type = "text", value, onChange, required = false, ...props }) => (
    <div>
        <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
            {label}{required && <span className="text-red-500">*</span>}
        </label>
        <input
            type={type}
            id={id}
            name={id} // Ensure name matches id for state updates
            value={value}
            onChange={onChange}
            required={required}
            className="block w-full border rounded-md p-1.5 border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm transition duration-150 read-only:bg-gray-100 read-only:text-gray-500"
            {...props}
        />
    </div>
);

// Reusable Select Field (Compact Orange Theme)
const SelectField = ({ label, id, value, onChange, required = false, children, ...props }) => (
     <div>
        <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
             {label}{required && <span className="text-red-500">*</span>}
        </label>
        <select
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            required={required}
            className="block w-full border rounded-md p-1.5 border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm transition duration-150"
            {...props}
        >
            {children}
        </select>
    </div>
);

// Reusable Textarea Field (Compact Orange Theme)
const TextAreaField = ({ label, id, value, onChange, required = false, rows = 3, ...props }) => (
     <div>
        <label htmlFor={id} className="block text-xs font-medium text-gray-700 mb-1">
             {label}{required && <span className="text-red-500">*</span>}
        </label>
        <textarea
            id={id}
            name={id}
            value={value}
            onChange={onChange}
            required={required}
            rows={rows}
            className="block w-full border rounded-md p-1.5 border-gray-300 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm transition duration-150"
            {...props}
        />
    </div>
);

// Initial State for the form
const initialShutdownState = {
    unit: '',
    datetime_from: '', 
    datetime_to: '',
    duration: '',
    reason: '',
    responsible_agency: '',
    notification_no: '',
};

// Helper function to format datetime strings for the table
const formatDateTimeForTable = (datetimeString) => {
    if (!datetimeString) return "";
    try {
        const d = new Date(datetimeString);
        return d.toLocaleString('en-GB', {
            year: '2-digit',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
    } catch (e) {
        return datetimeString; // Fallback
    }
};

export default function PlantShutdownPage({ auth }) {
    const [formData, setFormData] = useState(initialShutdownState);
    const [rcaFile, setRcaFile] = useState(null);
    const [message, setMessage] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const fileInputRef = useRef(null);

    const [shutdownLogs, setShutdownLogs] = useState([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [logError, setLogError] = useState("");
    
    const [editingId, setEditingId] = useState(null);

    const today = new Date();
    const [startDate, setStartDate] = useState(format(subDays(today, 6), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(today, 'yyyy-MM-dd'));
    const [unitFilter, setUnitFilter] = useState('');

    const API_URL = "http://localhost:8080/api";
    const headers = { Authorization: auth };

    // Function to fetch shutdown logs
    const fetchShutdownLogs = async () => {
        setLoadingLogs(true);
        setLogError("");
        
        const params = {
            start_date: startDate,
            end_date: endDate,
        };
        if (unitFilter) {
            params.unit = unitFilter;
        }

        try {
            const res = await axios.get(`${API_URL}/shutdowns/`, { headers, params });
            setShutdownLogs(res.data);
        } catch (err) {
            setShutdownLogs([]);
            if (err.response?.status !== 404) {
                setLogError("Failed to fetch shutdown logs.");
            }
        } finally {
            setLoadingLogs(false);
        }
    };

    // useEffect to fetch logs when filters change
    useEffect(() => {
        if (startDate && endDate) {
            fetchShutdownLogs();
        }
    }, [startDate, endDate, unitFilter]);

    // --- Effect to auto-calculate duration ---
    useEffect(() => {
        const { datetime_from, datetime_to } = formData;
        
        let calculatedDuration = "";

        if (datetime_from && datetime_to) {
            try {
                const startDateTime = new Date(datetime_from);
                const endDateTime = new Date(datetime_to);

                if (endDateTime > startDateTime) {
                    const diffMs = endDateTime.getTime() - startDateTime.getTime();
                    const totalMinutes = diffMs / (1000 * 60);
                    
                    const days = Math.floor(totalMinutes / (60 * 24));
                    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
                    const minutes = Math.round(totalMinutes % 60);
                    
                    if (days > 0) {
                        calculatedDuration += `${days}d `;
                    }
                    if (hours > 0) {
                        calculatedDuration += `${hours}h `;
                    }
                    if (minutes > 0 || (days === 0 && hours === 0)) {
                         calculatedDuration += `${minutes}m`;
                    }
                    calculatedDuration = calculatedDuration.trim();

                } else if (endDateTime < startDateTime) {
                    calculatedDuration = "Invalid"; // 'To' time is before 'From'
                }
            } catch (error) {
                console.error("Error calculating duration:", error);
                calculatedDuration = "";
            }
        }
        
        setFormData(prev => {
            if (prev.duration !== calculatedDuration) {
                return { ...prev, duration: calculatedDuration };
            }
            return prev;
        });

    }, [formData.datetime_from, formData.datetime_to]);


    // --- Form Handlers ---
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setRcaFile(e.target.files[0]);
        } else {
            setRcaFile(null);
        }
    };

    const handleStartEdit = (log) => {
        setEditingId(log.id);
        setFormData({
            unit: log.unit,
            datetime_from: log.datetime_from || '',
            datetime_to: log.datetime_to || '',
            duration: log.duration || '',
            reason: log.reason || '',
            responsible_agency: log.responsible_agency || '',
            notification_no: log.notification_no || '',
        });
        setMessage("");
        setRcaFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setFormData(initialShutdownState);
        setRcaFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
        setMessage("");
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setMessage("");

        const submissionData = new FormData();
        Object.entries(formData).forEach(([key, value]) => {
            submissionData.append(key, value);
        });

        if (rcaFile) {
            submissionData.append("rca_file", rcaFile);
        }

        const isUpdating = editingId !== null;
        const url = isUpdating ? `${API_URL}/shutdowns/${editingId}` : `${API_URL}/shutdowns/`;
        const method = isUpdating ? 'put' : 'post';

        try {
            await axios({
                method: method,
                url: url,
                data: submissionData,
                headers: {
                    Authorization: auth,
                },
            });

            setMessage(isUpdating ? "✅ Shutdown record updated successfully!" : "✅ Shutdown record saved successfully!");
            handleCancelEdit();
            fetchShutdownLogs();
            
        } catch (err) {
            let errorDetail = err.response?.data?.detail || (isUpdating ? "Error updating shutdown record." : "Error saving shutdown record.");
            if (Array.isArray(errorDetail)) {
                errorDetail = errorDetail.map(d => `${d.loc.slice(-1)[0]} - ${d.msg}`).join('; ');
            }
            setMessage(`❌ ${errorDetail}`);
        } finally {
            setSubmitting(false);
        }
    };

    // --- PDF Download Handler ---
    const handleDownloadPDF = async () => {
        setLogError("");
        setMessage("Generating PDF...");
        
        const params = {
            start_date: startDate,
            end_date: endDate,
        };
        if (unitFilter) {
            params.unit = unitFilter;
        }
        
        try {
            const response = await axios.get(`${API_URL}/shutdowns/export/pdf`, {
                headers,
                params: params,
                responseType: "blob",
            });
            
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const link = document.createElement("a");
            link.href = window.URL.createObjectURL(blob);
            link.download = `Shutdown_Log_${startDate}_to_${endDate}.pdf`;
            link.click();
            window.URL.revokeObjectURL(link.href);
            setMessage("");
        } catch (err) {
            console.error("PDF Download failed:", err);
            setMessage(`❌ PDF Download Failed: ${err.response?.data?.detail || "No data found."}`);
        }
    };

    return (
        // ✅ Changed layout: Removed grid, added space-y-6
        <div className="max-w-7xl mx-auto my-4 p-4 bg-orange-50 rounded-lg shadow-md border border-orange-200 space-y-6">
            
            {/* --- Top Section: Shutdown Entry Form --- */}
            {/* ✅ Removed col-span and sticky classes */}
            <div className="p-4 bg-white rounded-lg shadow-lg border border-orange-200 h-fit">
                <h2 className="text-xl font-semibold mb-4 text-center text-orange-800">
                    {editingId ? "Update Shutdown Event" : "Log Plant Shutdown Event"}
                </h2>
                
                {message && ( <div className={`p-3 mb-3 text-sm text-center rounded-md shadow-sm ${ message.startsWith("❌") ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-orange-100 border border-orange-200 text-orange-700' }`} > {message} </div> )}
                
                {/* ✅ Form layout changed to be wider. Grid-cols-4 for main fields */}
                <form onSubmit={handleSubmit} className="space-y-3">
                    
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <FormField label="From (Date & Time)" id="datetime_from" type="datetime-local" value={formData.datetime_from} onChange={handleChange} required />
                        <FormField label="To (Date & Time)" id="datetime_to" type="datetime-local" value={formData.datetime_to} onChange={handleChange} />
                        <SelectField label="Unit" id="unit" value={formData.unit} onChange={handleChange} required>
                            <option value="">Select Unit</option>
                            <option value="Unit-1">Unit-1</option>
                            <option value="Unit-2">Unit-2</option>
                        </SelectField>
                        <FormField label="Duration" id="duration" type="text" value={formData.duration} readOnly />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <TextAreaField label="Reason for Shutdown" id="reason" value={formData.reason} onChange={handleChange} />
                        <FormField label="Responsible Agency" id="responsible_agency" value={formData.responsible_agency} onChange={handleChange} />
                        <FormField label="Breakdown Notification No." id="notification_no" value={formData.notification_no} onChange={handleChange} />
                    </div>
                    
                    
                    <div>
                        <label htmlFor="rca_file" className="block text-xs font-medium text-gray-700 mb-1"> Upload RCA File (Optional) </label>
                        <input type="file" id="rca_file" name="rca_file" ref={fileInputRef} onChange={handleFileChange} className="block w-full text-sm text-gray-500 border border-gray-300 rounded-md cursor-pointer file:mr-4 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100" />
                        {rcaFile && ( <p className="mt-1 text-xs text-gray-500">Selected: {rcaFile.name}</p> )}
                    </div>
                    
                    <div className="flex gap-3 items-center pt-2">
                         <button 
                            type="submit" 
                            className={`w-full py-2 px-4 rounded-md text-white font-semibold shadow-md transition duration-150 ease-in-out ${ submitting ? "bg-gray-400 cursor-not-allowed" : (editingId ? "bg-yellow-500 hover:bg-yellow-600 focus:ring-yellow-400" : "bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-600 hover:to-amber-500") } focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-70`} 
                            disabled={submitting} 
                        >
                            {submitting ? "Saving..." : (editingId ? "Update Record" : "Save Record")}
                        </button>
                        
                        {editingId && (
                            <button 
                                type="button" 
                                onClick={handleCancelEdit}
                                className="flex-shrink-0 py-2 px-4 rounded-md text-gray-700 font-semibold bg-gray-100 hover:bg-gray-200 border border-gray-300 shadow-sm transition duration-150"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                        )}
                    </div>

                </form>
            </div>

            {/* --- Bottom Section: Shutdown Log List --- */}
            {/* ✅ Removed col-span class */}
            <div className="p-4 bg-white rounded-lg shadow-lg border border-orange-200">
                <h2 className="text-xl font-semibold mb-4 text-center text-orange-800">
                    Shutdown Log History
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4 p-3 border border-orange-100 rounded-md bg-orange-50 items-end">
                    <div>
                        <label htmlFor="start_date_filter" className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            id="start_date_filter"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full border rounded-md p-1.5 border-gray-300 shadow-sm sm:text-sm"
                        />
                    </div>
                     <div>
                        <label htmlFor="end_date_filter" className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
                        <input
                            type="date"
                            id="end_date_filter"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            min={startDate}
                            className="w-full border rounded-md p-1.5 border-gray-300 shadow-sm sm:text-sm"
                        />
                    </div>
                    <div>
                        <label htmlFor="unit_filter" className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                        <select
                            id="unit_filter"
                            value={unitFilter}
                            onChange={(e) => setUnitFilter(e.target.value)}
                            className="w-full border rounded-md p-1.5 border-gray-300 shadow-sm sm:text-sm"
                        >
                            <option value="">All Units</option>
                            <option value="Unit-1">Unit-1</option>
                            <option value="Unit-2">Unit-2</option>
                        </select>
                    </div>
                    <button
                        onClick={handleDownloadPDF}
                        disabled={loadingLogs}
                        className="w-full bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition disabled:bg-gray-400"
                    >
                        ⬇ Download PDF
                    </button>
                </div>

                <div className="overflow-x-auto border border-orange-200 rounded-lg">
                    {loadingLogs && <p className="p-4 text-center text-orange-600">Loading logs...</p>}
                    {logError && <p className="p-4 text-center text-red-500">{logError}</p>}
                    {!loadingLogs && !logError && shutdownLogs.length === 0 && (
                        <p className="p-4 text-center text-orange-600">No shutdown records found for the selected date range.</p>
                    )}
                    {!loadingLogs && !logError && shutdownLogs.length > 0 && (
                        <table className="w-full text-sm text-left border-collapse">
                            <thead className="bg-orange-400 text-white uppercase text-xs">
                                <tr>
                                    <th className="p-2.5 border-r border-white">From</th>
                                    <th className="p-2.5 border-r border-white">To</th>
                                    <th className="p-2.5 border-r border-white">Unit</th>
                                    <th className="p-2.5 border-r border-white">Duration</th>
                                    <th className="p-2.5 border-r border-white">Reason</th>
                                    <th className="p-2.5 border-r border-white">Agency</th>
                                    <th className="p-2.5 border-r border-white">Notif. No.</th>
                                    <th className="p-2.5 border-r border-white">RCA</th>
                                    <th className="p-2.5">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-orange-100">
                                {shutdownLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-orange-50">
                                        <td className="p-2.5 border-r border-orange-200 whitespace-nowrap">{formatDateTimeForTable(log.datetime_from)}</td>
                                        <td className="p-2.5 border-r border-orange-200 whitespace-nowrap">{formatDateTimeForTable(log.datetime_to)}</td>
                                        <td className="p-2.5 border-r border-orange-200">{log.unit}</td>
                                        <td className="p-2.5 border-r border-orange-200">{log.duration}</td>
                                        <td className="p-2.5 border-r border-orange-200 min-w-[150px] max-w-[200px] truncate" title={log.reason}>{log.reason}</td>
                                        <td className="p-2.5 border-r border-orange-200">{log.responsible_agency}</td>
                                        <td className="p-2.5 border-r border-orange-200">{log.notification_no}</td>
                                        <td className="p-2.5 border-r border-orange-200 text-center">
                                            {log.rca_file_path ? (
                                                <a href={`http://143.143.1.5:8080/${log.rca_file_path}`} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">View</a>
                                            ) : (
                                                "No"
                                            )}
                                        </td>
                                        <td className="p-2.5 text-center">
                                            <button
                                                onClick={() => handleStartEdit(log)}
                                                className="text-orange-600 hover:text-orange-800 hover:underline text-xs font-medium"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

        </div>
    );
}