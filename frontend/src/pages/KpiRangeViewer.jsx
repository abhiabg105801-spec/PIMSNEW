import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import Select, { components } from 'react-select';
import { format, subDays, parseISO } from 'date-fns';
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

// --- KPI Options ---
const unitKpiOptions = [
  { value: 'generation_mu', label: 'Generation (MU)' },
  { value: 'plf_percent', label: 'PLF (%)' },
  { value: 'running_hour', label: 'Running Hour' },
  { value: 'plant_availability_percent', label: 'Plant Availability (%)' },
  { value: 'coal_consumption_t', label: 'Coal Consumption (T)' },
  { value: 'sp_coal_consumption_kg_kwh', label: 'Sp. Coal (kg/kWh)' },
  { value: 'heat_rate', label: 'Heat Rate (kcal/kWh)' },
  { value: 'aux_power_percent', label: '% Aux. Power' },
  { value: 'planned_outage_hour', label: 'Planned Outage (Hr)' },
  { value: 'forced_outage_hour', label: 'Forced Outage (Hr)' },
  { value: 'avg_gcv_coal_kcal_kg', label: 'Avg. GCV Coal (kcal/kg)' },
];

const stationKpiOptions = [
  { value: 'avg_raw_water_used_cu_m_hr', label: 'Avg. Raw Water (Cu. M/Hr)' },
  { value: 'total_raw_water_used_cu_m', label: 'Total Raw Water (Cu. M)' },
  { value: 'sp_raw_water_used_ltr_kwh', label: 'Sp. Raw Water (Ltr/Kwh)' },
];

const allKpiOptions = [
  { label: 'Unit KPIs', options: unitKpiOptions },
  { label: 'Station KPIs', options: stationKpiOptions },
];

const levelOptions = [
  { value: 'Unit-1', label: 'Unit-1' },
  { value: 'Unit-2', label: 'Unit-2' },
  { value: 'Station', label: 'Station' },
];

const formatNum = (num, places = 2, def = '-') => {
  if (num === null || num === undefined || isNaN(num)) return def;
  return Number(num).toFixed(places);
};

const compactSelectStyles = {
  control: base => ({ ...base, minHeight: '34px', height: '34px' }),
  valueContainer: base => ({ ...base, padding: '0 6px' }),
  indicatorsContainer: base => ({ ...base, height: '34px' }),
  dropdownIndicator: base => ({ ...base, padding: '4px' }),
};

const defaultKpis = [
  unitKpiOptions.find(k => k.value === 'generation_mu'),
  unitKpiOptions.find(k => k.value === 'plf_percent'),
  unitKpiOptions.find(k => k.value === 'heat_rate'),
];

const CustomValueContainer = props => {
  const { getValue, hasValue, selectProps } = props;
  const selectedValues = getValue();
  const numValues = selectedValues.length;
  const children = React.Children.toArray(props.children);
  const inputChild = children.find(child => child.type === components.Input);

  if (!hasValue) {
    return (
      <components.ValueContainer {...props}>
        <components.Placeholder {...props} isFocused={props.isFocused}>
          {selectProps.placeholder}
        </components.Placeholder>
        {inputChild}
      </components.ValueContainer>
    );
  }

  if (numValues > 2) {
    return (
      <components.ValueContainer {...props}>
        <components.Placeholder {...props} isFocused={props.isFocused}>
          {`${numValues} KPIs selected`}
        </components.Placeholder>
        {inputChild}
      </components.ValueContainer>
    );
  }

  return <components.ValueContainer {...props}>{props.children}</components.ValueContainer>;
};

// --- Main Component ---
export default function KpiRangeViewer({ auth }) {
  const today = new Date();
  const [startDate, setStartDate] = useState(format(subDays(today, 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(today, 'yyyy-MM-dd'));
  const [selectedLevel, setSelectedLevel] = useState(levelOptions[0]);
  const [selectedKPIs, setSelectedKPIs] = useState(defaultKpis);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'report_date', direction: 'asc' });

  const API_URL = "http://localhost:8080/api";
  const headers = { Authorization: auth };

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      if (!startDate || !endDate || selectedKPIs.length === 0) return;
      setLoading(true);
      setError('');

      try {
        const kpiValues = selectedKPIs.map(k => k.value).join(',');
        const { data } = await axios.get(`${API_URL}/reports/range`, {
          headers,
          params: {
            start_date: startDate,
            end_date: endDate,
            units: selectedLevel.value,
            kpis: kpiValues,
          },
        });

        const sorted = (data || []).sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
        setReports(sorted);

        if (sorted.length === 0) setError('No data found for selected range.');
      } catch (err) {
        console.error(err);
        setError('Failed to fetch data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [startDate, endDate, selectedKPIs, selectedLevel, auth]);

  // ✅ Excel export using ExcelJS
  // Excel export (with ExcelJS)
const handleExcelExport = async () => {
  if (reports.length === 0) return;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('KPI Data');

  // --- Header Row ---
  const headers = ['Date', ...selectedKPIs.map(kpi => kpi.label)];
  worksheet.addRow(headers);

  // Style header
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFA500' }, // Orange header
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF804000' } },
      bottom: { style: 'thin', color: { argb: 'FF804000' } },
      left: { style: 'thin', color: { argb: 'FF804000' } },
      right: { style: 'thin', color: { argb: 'FF804000' } },
    };
  });

  // --- Data Rows ---
  reports.forEach(r => {
    const rowData = [
      format(parseISO(r.report_date), 'dd-MMM-yyyy'),
      ...selectedKPIs.map(kpi => formatNum(r[kpi.value], 2, null)),
    ];
    worksheet.addRow(rowData);
  });

  // Style all data cells
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    row.eachCell(cell => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD7B899' } },
        bottom: { style: 'thin', color: { argb: 'FFD7B899' } },
        left: { style: 'thin', color: { argb: 'FFD7B899' } },
        right: { style: 'thin', color: { argb: 'FFD7B899' } },
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
  });

  // Auto-fit column widths
  worksheet.columns.forEach(column => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, cell => {
      const len = cell.value ? cell.value.toString().length : 10;
      if (len > maxLength) maxLength = len;
    });
    column.width = maxLength + 2;
  });

  // Create and download file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  saveAs(blob, `KPI_Data_${startDate}_to_${endDate}.xlsx`);
};


  // Sorting logic
  const handleSort = key => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortedReports = useMemo(() => {
    const sorted = [...reports];
    if (!sortConfig.key) return sorted;
    sorted.sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;
      if (sortConfig.direction === 'asc') return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
    return sorted;
  }, [reports, sortConfig]);

  const getTrendIcon = (curr, prev) => {
    if (prev === undefined || prev === null || curr === null) return null;
    if (curr > prev)
      return <ArrowUp size={14} className="inline ml-1 text-green-600" title="Increased" />;
    if (curr < prev)
      return <ArrowDown size={14} className="inline ml-1 text-red-600" title="Decreased" />;
    return null;
  };

  const averages = useMemo(() => {
    if (reports.length === 0) return {};
    const avg = {};
    selectedKPIs.forEach(kpi => {
      const values = reports.map(r => Number(r[kpi.value]) || 0);
      avg[kpi.value] = values.reduce((a, b) => a + b, 0) / values.length;
    });
    return avg;
  }, [reports, selectedKPIs]);

  return (
    <div className="p-3 bg-orange-50 rounded-lg shadow-md border border-orange-200 space-y-4">
      <h2 className="text-xl font-semibold mb-2 text-center text-orange-800">📊 KPI Trend Viewer</h2>

      <div className="grid grid-cols-1 md:grid-cols-6 gap-2 p-2 border rounded bg-white items-end shadow-sm border-orange-200">
        <div>
          <label className="block text-xs font-medium text-gray-700">Level</label>
          <Select
            options={levelOptions}
            value={selectedLevel}
            onChange={setSelectedLevel}
            styles={compactSelectStyles}
            className="text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="w-full border rounded p-1.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="w-full border rounded p-1.5 text-sm"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-gray-700">Select KPIs</label>
          <Select
            options={allKpiOptions}
            value={selectedKPIs}
            onChange={setSelectedKPIs}
            isMulti
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            className="text-sm"
            styles={compactSelectStyles}
            components={{ ValueContainer: CustomValueContainer }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700">&nbsp;</label>
          <button
            onClick={handleExcelExport}
            disabled={loading || reports.length === 0}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-md text-sm font-medium disabled:bg-gray-400"
          >
            ⬇ Excel
          </button>
        </div>
      </div>

      {loading && <div className="text-center text-orange-600 p-3">Loading data...</div>}
      {error && (
        <div className="text-center p-3 bg-red-50 text-red-700 border border-red-200 rounded">
          {error}
        </div>
      )}

      {!loading && sortedReports.length > 0 && (
        <div className="overflow-x-auto border rounded-lg bg-white shadow-sm max-h-[70vh]">
          <table className="w-full text-xs text-center border-collapse">
            <thead className="bg-orange-600 text-white sticky top-0">
              <tr>
                <th
                  className="p-2 border border-orange-500 cursor-pointer"
                  onClick={() => handleSort('report_date')}
                >
                  Date
                  <ArrowUpDown size={14} className="inline ml-1" />
                </th>
                {selectedKPIs.map(kpi => (
                  <th
                    key={kpi.value}
                    className="p-2 border border-orange-500 cursor-pointer"
                    onClick={() => handleSort(kpi.value)}
                  >
                    {kpi.label}
                    <ArrowUpDown size={14} className="inline ml-1" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-orange-100">
              {sortedReports.map((report, i) => {
                const prev = sortedReports[i - 1];
                return (
                  <tr key={report._id || i} className="hover:bg-orange-50">
                    <td className="p-2 border-r border-l border-orange-200 font-medium">
                      {format(parseISO(report.report_date), 'dd-MMM-yyyy')}
                    </td>
                    {selectedKPIs.map(kpi => {
                      const currVal = report[kpi.value];
                      const prevVal = prev ? prev[kpi.value] : null;
                      return (
                        <td key={kpi.value} className="p-2 border-r border-orange-200">
                          {formatNum(currVal, 2)}
                          {getTrendIcon(currVal, prevVal)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-orange-100 font-semibold text-orange-800">
              <tr>
                <td className="p-2 border-t border-orange-300">Average</td>
                {selectedKPIs.map(kpi => (
                  <td key={kpi.value} className="p-2 border-t border-orange-300">
                    {formatNum(averages[kpi.value], 2)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {!loading && !error && reports.length === 0 && (
        <div className="text-center text-orange-700 p-3">Please select filters and KPIs.</div>
      )}
    </div>
  );
}
