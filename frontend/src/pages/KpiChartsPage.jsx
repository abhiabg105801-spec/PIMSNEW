import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Select from 'react-select';
// Import Bar from Chart.js
import { Bar } from 'react-chartjs-2';
// Import ECharts
import ReactECharts from 'echarts-for-react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, TimeScale
} from 'chart.js';
import 'chartjs-adapter-date-fns'; // Import date adapter
import { format, subDays, parseISO, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';

// Register Chart.js components (only for Bar chart)
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, TimeScale);

// --- KPI Options ---
const kpiOptions = [
    { value: 'generation_mu', label: 'Generation (MU)' },
    { value: 'plf_percent', label: 'PLF (%)' },
    { value: 'running_hour', label: 'Running Hour' },
    { value: 'plant_availability_percent', label: 'Plant Availability (%)' },
    { value: 'coal_consumption_t', label: 'Coal Consumption (T)' },
    { value: 'sp_coal_consumption_kg_kwh', label: 'Sp. Coal (kg/kWh)' },
    { value: 'heat_rate', label: 'Heat Rate (kcal/kWh)' },
    { value: 'aux_power_percent', label: '% Aux. Power' },
    { value: 'planned_outage_hour', label: 'Planned Outage (Hr)' },
    { value: 'planned_outage_percent', label: 'Planned Outage (%)' },
    { value: 'forced_outage_hour', label: 'Forced Outage (Hr)' },
    { value: 'forced_outage_percent', label: 'Forced Outage (%)' },
    { value: 'strategic_outage_hour', label: 'Strategic Outage (Hr)' },
    { value: 'avg_gcv_coal_kcal_kg', label: 'Avg. GCV Coal (kcal/kg)' },
    { value: 'ldo_hsd_consumption_kl', label: 'LDO/HSD (KL)' },
    { value: 'sp_oil_consumption_ml_kwh', label: 'Sp. Oil (ml/kWh)' },
    { value: 'aux_power_consumption_mu', label: 'Aux. Power (MU)' },
    { value: 'dm_water_consumption_cu_m', label: 'DM Water (Cu. M)' },
    { value: 'sp_dm_water_consumption_percent', label: 'Sp. DM Water (%)' },
    { value: 'steam_gen_t', label: 'Steam Gen (T)' },
    { value: 'sp_steam_consumption_kg_kwh', label: 'Sp. Steam (kg/kWh)' },
    { value: 'stack_emission_spm_mg_nm3', label: 'Stack Emission (mg/Nm3)' },
];

// Options for the chart type dropdown
const chartTypeOptions = [
    { value: 'bar', label: 'Day-wise Bar Chart' },
    { value: 'trend', label: 'Daily Trend Line' }
];

// Chart Colors
const chartColors = ['#3b82f6', '#ef4444', '#22c55e', '#f97316', '#a855f7', '#f59e0b', '#14b8a6', '#6b7280'];

// Helper to format numbers
const formatNum = (num, places = 2, defaultVal = "-") => {
  if (num === null || num === undefined || isNaN(num)) return defaultVal;
  const factor = Math.pow(10, places);
  const rounded = Math.round(num * factor) / factor;
  return rounded.toFixed(places);
};

// Define default KPIs
const defaultKpis = [
    kpiOptions.find(kpi => kpi.value === 'plf_percent'),
    kpiOptions.find(kpi => kpi.value === 'aux_power_percent')
].filter(Boolean);

// Helper function to find min/max stats
const findStat = (reports, kpi, findType) => {
    let bestVal = (findType === 'min') ? Infinity : -Infinity;
    let bestDate = null;

    for (const r of reports) {
        const val = r[kpi];
        if (val === null || val === undefined || (findType === 'min' && val <= 0)) {
            continue;
        }
        if ((findType === 'min' && val < bestVal) || (findType === 'max' && val > bestVal)) {
            bestVal = val;
            bestDate = r.report_date;
        }
    }
    
    return {
        value: (bestVal === Infinity || bestVal === -Infinity) ? null : bestVal,
        date: bestDate ? format(parseISO(bestDate.split('T')[0]), 'MMM d') : null
    };
};


// ##################################################################
// ### 🚀 SUMMARY BOX COMPONENT (FOR HIGHLIGHTS TAB) ###
// ##################################################################

const StatDisplay = ({ label, emoji, data, unit }) => {
    const { value, date } = data || {};
    return (
        // ✅ Use themed border
        <div className="flex-1 min-w-[150px] p-3 bg-white rounded shadow-sm border border-orange-200">
            <div className="text-xs font-semibold text-gray-500">{label}</div>
            <div className="flex items-baseline space-x-2 mt-1">
                {/* ✅ Use themed text color for value */}
                <span className="text-2xl font-bold text-orange-700">{formatNum(value, 2, '-')}</span>
                <span className="text-sm text-gray-600">{unit}</span>
            </div>
            <div className="text-xs text-gray-500 mt-1">
                {emoji} {date || 'N/A'}
            </div>
        </div>
    );
};

const processUnitSummary = (reports, unit) => {
    const unitReports = reports.filter(r => r.unit === unit);
    return {
        plf: findStat(unitReports, 'plf_percent', 'max'),
        aux: findStat(unitReports, 'aux_power_percent', 'min'),
        heatRate: findStat(unitReports, 'heat_rate', 'min'),
    };
};

const KpiSummaryBox = ({ auth }) => {
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const API_URL = "http://localhost:8080/api";

    useEffect(() => {
        const fetchSummaryData = async () => {
            if (!auth) return;
            setLoading(true);
            setError(null);

            const today = new Date();
            const monthStart = format(startOfMonth(today), 'yyyy-MM-dd');
            const monthEnd = format(endOfMonth(today), 'yyyy-MM-dd');
            const yearStart = format(startOfYear(today), 'yyyy-MM-dd');
            const yearEnd = format(endOfYear(today), 'yyyy-MM-dd');
            
            const kpis = 'plf_percent,aux_power_percent,heat_rate';
            const units = 'Unit-1,Unit-2';
            const headers = { Authorization: auth };

            try {
                const [monthRes, yearRes] = await Promise.all([
                    axios.get(`${API_URL}/reports/range`, { 
                        headers, 
                        params: { start_date: monthStart, end_date: monthEnd, units, kpis } 
                    }),
                    axios.get(`${API_URL}/reports/range`, { 
                        headers, 
                        params: { start_date: yearStart, end_date: yearEnd, units, kpis } 
                    })
                ]);
                
                const monthReports = monthRes.data || [];
                const yearReports = yearRes.data || [];

                setSummaryData({
                    month: {
                        unit1: processUnitSummary(monthReports, 'Unit-1'),
                        unit2: processUnitSummary(monthReports, 'Unit-2'),
                    },
                    year: {
                        unit1: processUnitSummary(yearReports, 'Unit-1'),
                        unit2: processUnitSummary(yearReports, 'Unit-2'),
                    }
                });

            } catch (err) {
                console.error("Failed to fetch summary data:", err);
                setError("Failed to load summary stats.");
            } finally {
                setLoading(false);
            }
        };

        fetchSummaryData();
    }, [auth]); 

    if (loading) {
        // ✅ Use themed loading text
        return <div className="text-center p-4 text-orange-600">Loading Summary Stats...</div>;
    }

    if (error) {
        return <div className="p-3 text-sm text-center rounded-md bg-red-50 border border-red-200 text-red-700 shadow-sm"><p>{error}</p></div>;
    }
    
    if (!summaryData) {
        return null; 
    }

    const SummaryCard = ({ title, data }) => (
        // ✅ Use themed border
        <div className="flex-1 p-4 bg-white rounded-lg shadow-sm border border-orange-200 min-w-[320px]">
            <h4 className="text-lg font-semibold text-gray-700 mb-3">{title}</h4>
            <div className="space-y-4">
                <div>
                    <h5 className="font-semibold text-sky-800 mb-2">Unit-1</h5>
                    <div className="flex flex-wrap gap-3">
                        <StatDisplay label="Highest PLF" emoji="📈" data={data.unit1.plf} unit="%" />
                        <StatDisplay label="Lowest Aux Power" emoji="⚡️" data={data.unit1.aux} unit="%" />
                        <StatDisplay label="Lowest Heat Rate" emoji="🔥" data={data.unit1.heatRate} unit="kcal/kWh" />
                    </div>
                </div>
                <div>
                    <h5 className="font-semibold text-red-800 mb-2">Unit-2</h5>
                    <div className="flex flex-wrap gap-3">
                        <StatDisplay label="Highest PLF" emoji="📈" data={data.unit2.plf} unit="%" />
                        <StatDisplay label="Lowest Aux Power" emoji="⚡️" data={data.unit2.aux} unit="%" />
                        <StatDisplay label="Lowest Heat Rate" emoji="🔥" data={data.unit2.heatRate} unit="kcal/kWh" />
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        // ✅ Use themed background, border, and title text
        <div className="p-4 bg-orange-50 rounded-lg border border-orange-200 shadow-inner">
            <h3 className="text-xl font-semibold mb-4 text-center bg-orange-500 text-white">Performance Highlights</h3>
            <div className="flex flex-col md:flex-row gap-6">
                <SummaryCard title="This Month" data={summaryData.month} />
                <SummaryCard title="This Year" data={summaryData.year} />
            </div>
        </div>
    );
};
// ##################################################################
// ### END OF SUMMARY BOX COMPONENT ###
// ##################################################################


// ##################################################################
// ### 🌟 DYNAMIC RANGE SUMMARY COMPONENT (RE-DESIGNED) ###
// ##################################################################

// Map to decide whether to find the min or max for a KPI
const kpiFindTypeMap = {
  'aux_power_percent': 'min',
  'heat_rate': 'min',
  'sp_coal_consumption_kg_kwh': 'min',
  'sp_oil_consumption_ml_kwh': 'min',
  'sp_dm_water_consumption_percent': 'min',
  'sp_steam_consumption_kg_kwh': 'min',
  'stack_emission_spm_mg_nm3': 'min',
  // All other KPIs will default to 'max'
};

// This function processes stats for one unit
const processUnitStats = (reports, selectedKPIs) => {
    return selectedKPIs.map(kpi => {
        const findType = kpiFindTypeMap[kpi.value] || 'max'; // Default to max
        const stat = findStat(reports, kpi.value, findType);
        const label = findType === 'min' ? 'Lowest' : 'Highest';
        const emoji = findType === 'min' ? '📉' : '📈';
        
        return {
            key: kpi.value,
            label: `${label} ${kpi.label}`,
            value: formatNum(stat.value, 2, '-'),
            date: stat.date ? `(${emoji} ${stat.date})` : '',
        };
    });
};

// This is the new, compact summary component
const DynamicKpiSummary = ({ reports, selectedKPIs, startDate, endDate }) => {
    if (!reports || reports.length === 0 || !selectedKPIs || selectedKPIs.length === 0) {
        return null; // Don't render if there's no data
    }

    const unit1Reports = reports.filter(r => r.unit === 'Unit-1');
    const unit2Reports = reports.filter(r => r.unit === 'Unit-2');

    const unit1Stats = processUnitStats(unit1Reports, selectedKPIs);
    const unit2Stats = processUnitStats(unit2Reports, selectedKPIs);

    return (
        // ✅ Use themed background, border, and title
        <div className="p-2 bg-orange-100 border-orange-200 rounded-lg border shadow-inner space-y-2">
            <h4 className="text-sm font-semibold text-center text-orange-800">
                Range Summary ({format(parseISO(startDate), 'MMM d')} - {format(parseISO(endDate), 'MMM d')})
            </h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* --- Unit 1 Stats --- */}
                {/* ✅ Use themed border */}
                <div className="p-2 bg-white rounded border border-orange-200">
                    <h5 className="text-base font-semibold text-sky-800 mb-2 pb-1 border-b border-sky-100">Unit-1</h5>
                    <ul className="space-y-1">
                        {unit1Stats.map(stat => (
                            <li key={stat.key} className="text-xs flex justify-between">
                                <span className="text-gray-600">{stat.label}:</span>
                                <span className="font-bold text-gray-800">
                                    {stat.value} <span className="text-gray-500 font-normal ml-1">{stat.date}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
                
                {/* --- Unit 2 Stats --- */}
                {/* ✅ Use themed border */}
                <div className="p-2 bg-white rounded border border-orange-200">
                    <h5 className="text-base font-semibold text-red-800 mb-2 pb-1 border-b border-red-100">Unit-2</h5>
                    <ul className="space-y-1">
                        {unit2Stats.map(stat => (
                             <li key={stat.key} className="text-xs flex justify-between">
                                <span className="text-gray-600">{stat.label}:</span>
                                <span className="font-bold text-gray-800">
                                    {stat.value} <span className="text-gray-500 font-normal ml-1">{stat.date}</span>
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};
// ##################################################################
// ### END OF DYNAMIC SUMMARY COMPONENT ###
// ##################################################################


// ##################################################################
// ### 📊 MAIN PAGE COMPONENT WITH TABS ###
// ##################################################################

// Styles to make react-select component smaller
const compactSelectStyles = {
    control: (base) => ({ 
      ...base, 
      minHeight: '34px', 
      height: '34px' 
    }),
    valueContainer: (base) => ({ 
      ...base, 
      padding: '0 6px' 
    }),
    input: (base) => ({ 
      ...base, 
      margin: '0', 
      padding: '0' 
    }),
    indicatorsContainer: (base) => ({ 
      ...base, 
      height: '34px' 
    }),
    dropdownIndicator: (base) => ({ 
        ...base, 
        padding: '4px' 
    }),
  };

export default function KpiChartsPage({ auth }) {
    // --- State ---
    const today = new Date();
    const [startDate, setStartDate] = useState(format(subDays(today, 30), 'yyyy-MM-dd'));
    const [endDate, setEndDate] = useState(format(today, 'yyyy-MM-dd'));
    
    const [selectedKPIs, setSelectedKPIs] = useState(defaultKpis);
    const [chartType, setChartType] = useState(chartTypeOptions[0]); 

    const [activeTab, setActiveTab] = useState('highlights'); 

    // State to hold the raw reports for the dynamic summary
    const [chartReports, setChartReports] = useState([]);

    // Chart Data States
    const [trendChartData, setTrendChartData] = useState({ labels: [], datasets: [] });
    const [barChartDataUnit1, setBarChartDataUnit1] = useState({ labels: [], datasets: [] });
    const [barChartDataUnit2, setBarChartDataUnit2] = useState({ labels: [], datasets: [] });

    // Loading/Error States
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const API_URL = "http://localhost:8080/api";
    const headers = { Authorization: auth };

    // --- Fetch Data ---
    const fetchChartData = async (start, end, kpis) => {
        if (!start || !end || kpis.length === 0) {
            setBarChartDataUnit1({ labels: [], datasets: [] });
            setBarChartDataUnit2({ labels: [], datasets: [] });
            setTrendChartData({ labels: [], datasets: [] });
            setChartReports([]); 
            return;
        }
        setLoading(true);
        setError('');

        const kpiValues = kpis.map(kpi => kpi.value).join(',');
        const units = 'Unit-1,Unit-2';

        try {
            console.log(`Fetching data: ${start} to ${end}, KPIs: ${kpiValues}`);
            const response = await axios.get(`${API_URL}/reports/range`, {
                headers,
                params: { 
                    start_date: start, 
                    end_date: end, 
                    units: units, 
                    kpis: kpiValues
                }
            });
            const reports = response.data;
            setChartReports(reports || []); 

            if (!reports || reports.length === 0) {
                setBarChartDataUnit1({ labels: [], datasets: [] });
                setBarChartDataUnit2({ labels: [], datasets: [] });
                setTrendChartData({ labels: [], datasets: [] });
                setError('No data found for the selected criteria.');
                return;
            }

            reports.sort((a, b) => new Date(a.report_date) - new Date(b.report_date));
            
            const unit1Reports = reports.filter(r => r.unit === 'Unit-1');
            const unit2Reports = reports.filter(r => r.unit === 'Unit-2');

            const datasetsUnit1Bar = [];
            const datasetsUnit2Bar = [];
            const datasetsTrend = [];
            
            const allDates = [...new Set(reports.map(r => r.report_date.split('T')[0]))];
            allDates.sort(); 
            const sortedLabels = allDates.map(dateStr => format(parseISO(dateStr), 'MMM d'));

            kpis.forEach((kpi, index) => {
                const colorIndex = index % chartColors.length;
                const color = chartColors[colorIndex];
                
                const dataPoints1 = sortedLabels.map(labelDate => {
                    const report = unit1Reports.find(r => format(parseISO(r.report_date.split('T')[0]), 'MMM d') === labelDate);
                    return report ? report[kpi.value] : null;
                });
                const dataPoints2 = sortedLabels.map(labelDate => {
                    const report = unit2Reports.find(r => format(parseISO(r.report_date.split('T')[0]), 'MMM d') === labelDate);
                    return report ? report[kpi.value] : null;
                });

                datasetsUnit1Bar.push({
                    label: kpi.label, data: dataPoints1, backgroundColor: `${color}B3`, borderColor: color, borderWidth: 1,
                });
                datasetsUnit2Bar.push({
                    label: kpi.label, data: dataPoints2, backgroundColor: `${color}B3`, borderColor: color, borderWidth: 1,
                });

                datasetsTrend.push({
                    label: `Unit-1 - ${kpi.label}`, data: dataPoints1, borderColor: color, backgroundColor: `${color}80`, borderDash: false,
                });
                datasetsTrend.push({
                    label: `Unit-2 - ${kpi.label}`, data: dataPoints2, borderColor: color, backgroundColor: `${color}80`, borderDash: true, 
                });
            });

            setBarChartDataUnit1({ labels: sortedLabels, datasets: datasetsUnit1Bar });
            setBarChartDataUnit2({ labels: sortedLabels, datasets: datasetsUnit2Bar });
            setTrendChartData({ labels: sortedLabels, datasets: datasetsTrend });

        } catch (err) {
            console.error("Error fetching chart data:", err);
            setError(`Failed to fetch chart data. ${err.response?.data?.detail || err.message}`);
            setBarChartDataUnit1({ labels: [], datasets: [] });
            setBarChartDataUnit2({ labels: [], datasets: [] });
            setTrendChartData({ labels: [], datasets: [] });
            setChartReports([]); 
        } finally {
            setLoading(false);
        }
    };

    // --- Effect to trigger fetches ---
    useEffect(() => {
        if (!startDate || !endDate || selectedKPIs.length === 0) {
            setBarChartDataUnit1({ labels: [], datasets: [] });
            setBarChartDataUnit2({ labels: [], datasets: [] });
            setTrendChartData({ labels: [], datasets: [] });
            setChartReports([]); 
            setError("");
            return;
        }
        fetchChartData(startDate, endDate, selectedKPIs);
    }, [startDate, endDate, selectedKPIs]);

    
    // --- Chart Options ---

    // ECharts Trend Option Builder
    const getEChartsTrendOption = (chartData, start, end) => {
        if (!chartData || chartData.labels.length === 0) {
          return {};
        }
  
        const series = chartData.datasets.map(dataset => ({
          name: dataset.label,
          type: 'line',
          smooth: 0.1, 
          connectNulls: true, 
          data: dataset.data,
          lineStyle: {
            type: dataset.borderDash ? 'dashed' : 'solid',
          },
          color: dataset.borderColor, 
          emphasis: {
            focus: 'series'
          },
        }));
  
        return {
          title: {
            text: `Daily Trends (${start} to ${end})`,
            left: 'center',
          },
          tooltip: {
            trigger: 'axis',
            axisPointer: {
              type: 'cross'
            },
            formatter: (params) => {
                let tooltip = `${params[0].axisValue}<br />`;
                params.forEach(param => {
                    const value = formatNum(param.value, 2, 'N/A');
                    tooltip += `${param.marker} ${param.seriesName}: ${value}<br />`;
                });
                return tooltip;
            }
          },
          legend: {
            top: 'bottom',
            data: chartData.datasets.map(d => d.label)
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '10%', 
            containLabel: true
          },
          xAxis: {
            type: 'category',
            boundaryGap: false,
            data: chartData.labels,
          },
          yAxis: {
            type: 'value',
            name: 'Value',
            axisLabel: {
              formatter: '{value}'
            },
            min: 0, 
            max: null 
          },
          series: series,
          dataZoom: [
            {
              type: 'inside',
              start: 0,
              end: 100
            },
            {
              start: 0,
              end: 100,
            }
          ],
        };
      };
     
    // Chart.js Bar Chart Options
    const barOptions = (unitName) => ({
        responsive: true, maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top' },
            title: { display: true, text: `${unitName} Daily Values (${startDate} to ${endDate})` },
            tooltip: {
                mode: 'index', intersect: false,
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) { label += ': '; }
                        if (context.parsed.y !== null) { label += formatNum(context.parsed.y, 2); }
                        return label;
                    }
                }
            }
        },
        scales: {
            x: { title: { display: true, text: 'Date' } }, 
            y: { beginAtZero: true, title: { display: true, text: 'Value' } }
        },
    });
    
    // --- Tab Button Styling ---
    // ✅ Use themed colors
    const getTabClass = (tabName) => {
        return `py-1.5 px-3 font-medium text-sm rounded-t-lg cursor-pointer ${
            activeTab === tabName 
                ? 'bg-white border-b-0 border border-orange-200 text-orange-700' 
                : 'bg-orange-50 text-gray-600 hover:bg-orange-100'
        }`;
    };


    return (
        // ✅ Use themed background and border
        <div className="p-3 bg-orange-50 rounded-lg shadow-md border border-orange-200 space-y-4">
            {/* ✅ Use themed title */}
            <h2 className="text-xl font-semibold mb-2 text-center text-orange-800">KPI Daily Analysis</h2>

            {/* --- TABS --- */}
            {/* ✅ Use themed border */}
            <div className="flex border-b border-orange-200">
                <div 
                    className={getTabClass('highlights')}
                    onClick={() => setActiveTab('highlights')}
                >
                    🚀 Performance Highlights
                </div>
                <div 
                    className={getTabClass('charts')}
                    onClick={() => setActiveTab('charts')}
                >
                    📊 Charts Analysis
                </div>
            </div>

            {/* --- TAB CONTENT --- */}
            <div className="pt-2">
                {/* --- Highlights Tab --- */}
                {activeTab === 'highlights' && (
                    <KpiSummaryBox auth={auth} />
                )}

                {/* --- Charts Tab --- */}
                {activeTab === 'charts' && (
                    <div className="space-y-4">
                        {/* --- Controls Area (COMPACT) --- */}
                        {/* ✅ Use themed border */}
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 p-2 border rounded bg-white items-end shadow-sm border-orange-200">
                            {/* Date Pickers */}
                            <div>
                                <label htmlFor="startDatePicker" className="block text-xs font-medium text-gray-700">Start Date</label>
                                <input 
                                    type="date"
                                    id="startDatePicker"
                                    value={startDate}
                                    onChange={e => setStartDate(e.target.value)}
                                    className="w-full border rounded p-1.5 text-sm"
                                />
                            </div>
                            <div>
                                <label htmlFor="endDatePicker" className="block text-xs font-medium text-gray-700">End Date</label>
                                <input 
                                    type="date"
                                    id="endDatePicker"
                                    value={endDate}
                                    onChange={e => setEndDate(e.target.value)}
                                    className="w-full border rounded p-1.5 text-sm"
                                />
                            </div>

                            {/* KPI Selector */}
                            <div className="md:col-span-2">
                                <label htmlFor="kpiSelect" className="block text-xs font-medium text-gray-700">Select KPIs</label>
                                <Select
                                    id="kpiSelect"
                                    options={kpiOptions}
                                    value={selectedKPIs}
                                    onChange={setSelectedKPIs}
                                    isMulti
                                    closeMenuOnSelect={false}
                                    className="text-sm"
                                    placeholder="Select KPIs to plot..."
                                    styles={compactSelectStyles}
                                />
                            </div>

                            {/* Chart Type Dropdown */}
                            <div>
                                <label htmlFor="chartTypeSelect" className="block text-xs font-medium text-gray-700">Chart Type</label>
                                <Select
                                    id="chartTypeSelect"
                                    options={chartTypeOptions}
                                    value={chartType}
                                    onChange={setChartType}
                                    className="text-sm"
                                    styles={compactSelectStyles}
                                />
                            </div>
                        </div>

                        {/* ✅ Use themed loading text */}
                        {loading && <div className="text-center p-4 text-orange-600"><p>Loading Chart Data...</p></div>}
                        {error && <div className="p-3 text-sm text-center rounded-md bg-red-50 border border-red-200 text-red-700 shadow-sm"><p>{error}</p></div>}

                        {/* --- Dynamic Summary & Charts Section --- */}
                        {!loading && selectedKPIs.length > 0 && !error && (
                            <div className="space-y-4">
                                
                                {/* --- Charts --- */}
                                {chartType.value === 'bar' ? (
                                    // --- BAR CHARTS (Chart.js) ---
                                    <div className="space-y-8">
                                        <div>
                                            {/* ✅ Use themed title */}
                                            <h3 className="text-lg font-semibold mb-2 text-orange-800">Unit-1 Daily Values</h3>
                                            {/* ✅ Use themed border */}
                                            <div className="h-96 relative border border-orange-200 rounded p-2 bg-white shadow-sm">
                                                {barChartDataUnit1.datasets.length > 0 && barChartDataUnit1.datasets.some(ds => ds.data.some(d => d !== null)) ? (
                                                    <Bar options={barOptions('Unit-1')} data={barChartDataUnit1} />
                                                ) : (
                                                    // ✅ Use themed placeholder text
                                                    <div className="absolute inset-0 flex items-center justify-center"><p className="text-orange-600">No data to display for Unit-1.</p></div>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            {/* ✅ Use themed title */}
                                            <h3 className="text-lg font-semibold mb-2 text-orange-800">Unit-2 Daily Values</h3>
                                            {/* ✅ Use themed border */}
                                            <div className="h-96 relative border border-orange-200 rounded p-2 bg-white shadow-sm">
                                                {barChartDataUnit2.datasets.length > 0 && barChartDataUnit2.datasets.some(ds => ds.data.some(d => d !== null)) ? (
                                                    <Bar options={barOptions('Unit-2')} data={barChartDataUnit2} />
                                                ) : (
                                                    // ✅ Use themed placeholder text
                                                    <div className="absolute inset-0 flex items-center justify-center"><p className="text-orange-600">No data to display for Unit-2.</p></div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    // --- TREND CHART (ECharts) ---
                                    <div>
                                        {/* ✅ Use themed title */}
                                        <h3 className="text-lg font-semibold mb-2 text-orange-800">Daily Trends (Unit-1 vs Unit-2)</h3>
                                        {/* ✅ Use themed border */}
                                        <div className="h-[500px] relative border border-orange-200 rounded p-2 bg-white shadow-sm">
                                            {trendChartData.datasets.length > 0 && trendChartData.datasets.some(ds => ds.data.some(d => d !== null)) ? (
                                                <ReactECharts
                                                    option={getEChartsTrendOption(trendChartData, startDate, endDate)}
                                                    style={{ height: '100%', width: '100%' }}
                                                    notMerge={true}
                                                    lazyUpdate={true}
                                                />
                                            ) : (
                                                // ✅ Use themed placeholder text
                                                <div className="absolute inset-0 flex items-center justify-center"><p className="text-orange-600">No trend data to display.</p></div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <DynamicKpiSummary 
                                    reports={chartReports} 
                                    selectedKPIs={selectedKPIs}
                                    startDate={startDate}
                                    endDate={endDate}
                                />

                            </div>
                        )}

                        {/* ✅ Use themed placeholder text */}
                        {selectedKPIs.length === 0 && !error && (
                            <div className="text-center p-4 text-orange-600">Select a date range and KPIs to view charts.</div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}