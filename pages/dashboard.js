// pages/dashboard.js
import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { marked } from 'marked'; // Correct import
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler, // For area fill in line charts
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    ArcElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

// Helper to get base URL for WordPress API
const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL;

// Helper to escape HTML (same as your JS)
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        if (unsafe === null || unsafe === undefined) return '';
        try { unsafe = String(unsafe); } catch (e) { return ''; }
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


export default function DashboardPage() {
    const router = useRouter();
    const { visitor_id: visitorIdFromUrl } = router.query;

    // --- State Variables ---
    const [wpConfig, setWpConfig] = useState(null);
    const [visitorIdInput, setVisitorIdInput] = useState('');
    const [currentNocoRecord, setCurrentNocoRecord] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showNoDataMessage, setShowNoDataMessage] = useState(false);
    const [currentStatusMessage, setCurrentStatusMessage] = useState('Enter a Visitor ID to begin.');
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    // Chart instances refs (optional if react-chartjs-2 handles updates well)
    // Not strictly needed for react-chartjs-2 as it re-renders on prop change
    const revenueChartRef = useRef(null);
    const userSignupsChartRef = useRef(null);
    const taskCompletionChartRef = useRef(null);


    // --- Effects ---
    // Fetch WordPress config on mount
    useEffect(() => {
        const fetchWpConfig = async () => {
            try {
                const response = await axios.get(`${WP_API_URL}/wp-json/personalized-dashboard/v1/config`);
                if (response.data && response.data.success) {
                    setWpConfig(response.data.data);
                    console.log("PDS_NEXT_DEBUG: WP Config fetched:", response.data.data);
                } else {
                    throw new Error('Failed to fetch WP configuration.');
                }
            } catch (err) {
                console.error("PDS_NEXT_DEBUG: CRITICAL - Error fetching WP config:", err);
                setError(`Dashboard Error: Could not load critical configuration from WordPress. ${err.message}`);
                // Potentially disable form if config is essential
            }
        };
        fetchWpConfig();
    }, []);

    // Auto-fetch if visitor_id in URL and config is loaded
    useEffect(() => {
        if (visitorIdFromUrl && wpConfig) {
            setVisitorIdInput(visitorIdFromUrl);
            setCurrentStatusMessage(`Auto-fetching data for: ${visitorIdFromUrl}...`);
            fetchAndRenderDashboard(visitorIdFromUrl);
        } else if (!visitorIdFromUrl && wpConfig) {
            setShowNoDataMessage(true); // Show "enter ID" if no ID in URL
            setCurrentStatusMessage('Enter a Visitor ID to begin.');
            renderPlaceholderCharts();
        }
    }, [visitorIdFromUrl, wpConfig]); // Re-run if visitorIdFromUrl or wpConfig changes

    // --- Data Fetching Logic (Proxy) ---
    const fetchVisitorDataViaProxy = async (visitorId) => {
        if (!wpConfig || !wpConfig.ajax_url || !wpConfig.nonce) {
            throw new Error("WordPress configuration (ajax_url or nonce) is missing.");
        }
        console.log("PDS_NEXT_DEBUG: fetchVisitorDataViaProxy - visitorId:", visitorId);

        const formData = new FormData();
        formData.append('action', 'fetch_dashboard_data_proxy'); // Matches PHP action hook
        formData.append('nonce', wpConfig.nonce); // Use nonce from fetched config
        formData.append('visitor_id', visitorId);

        try {
            const response = await axios.post(wpConfig.ajax_url, formData, {
                headers: {
                    // Axios usually sets Content-Type for FormData correctly,
                    // but you can be explicit if needed.
                    // 'Content-Type': 'multipart/form-data',
                }
            });

            // The PHP proxy sends JSON, so axios should parse it.
            if (response.data.success) {
                console.log("PDS_NEXT_DEBUG: Proxy fetch success. Record:", response.data.data);
                // Refresh nonce for next potential request
                setWpConfig(prevConfig => ({...prevConfig, nonce: response.headers['x-wp-nonce'] || prevConfig.nonce }));
                return response.data.data;
            } else {
                console.error("PDS_NEXT_DEBUG: Proxy fetch error from server (result.success is false):", response.data.data);
                throw new Error(response.data.data.message || response.data.data || 'Failed to fetch data via proxy.');
            }
        } catch (err) {
            console.error('PDS_NEXT_DEBUG: Proxy fetch EXCEPTION:', err);
            if (err.response) { // Error from server (e.g. 403, 500 from PHP)
                console.error('PDS_NEXT_DEBUG: Proxy error response data:', err.response.data);
                console.error('PDS_NEXT_DEBUG: Proxy error response status:', err.response.status);
                let message = `Server error (${err.response.status}).`;
                if (err.response.data && err.response.data.data && err.response.data.data.message) {
                    message = err.response.data.data.message;
                } else if (typeof err.response.data === 'string' && err.response.data.includes("Security check failed (Nonce)")) {
                     message = "Security check failed. The session might have expired. Please try again.";
                     // Attempt to refresh nonce by fetching config again
                     const configResponse = await axios.get(`${WP_API_URL}/wp-json/personalized-dashboard/v1/config`);
                     if (configResponse.data && configResponse.data.success) {
                        setWpConfig(configResponse.data.data);
                        console.log("PDS_NEXT_DEBUG: Nonce refreshed after error.");
                     }
                }
                throw new Error(message);
            } else if (err.request) { // Request made but no response
                throw new Error('No response from server. Check network or WordPress backend.');
            } else { // Setup error
                throw err;
            }
        }
    };

    const fetchAndRenderDashboard = async (visitorIdToFetch) => {
        setIsLoading(true);
        setError(null);
        setShowNoDataMessage(false);
        setCurrentNocoRecord(null); // Clear old data
        setCurrentStatusMessage(`Fetching data for ID: ${visitorIdToFetch}...`);

        try {
            if (!wpConfig || !wpConfig.useAjaxProxy) {
                console.error("PDS_NEXT_DEBUG: Direct client-side fetch is disabled or WP config missing.");
                throw new Error("Configuration error: Data fetching method is not enabled. Contact support.");
            }

            console.log("PDS_NEXT_DEBUG: Using AJAX Proxy to fetch data.");
            const record = await fetchVisitorDataViaProxy(visitorIdToFetch);

            if (record && typeof record === 'object' && Object.keys(record).length > 0) {
                console.log("PDS_NEXT_DEBUG: Record fetched via proxy:", record);
                setCurrentNocoRecord(record);
                setCurrentStatusMessage(`Showing data for: ${record.first_name || 'Lead'} from ${record['organization/name'] || 'Company'}`);
            } else {
                console.warn("PDS_NEXT_DEBUG: No data or empty record returned from proxy for visitor ID:", visitorIdToFetch);
                setError(`No data found for Visitor ID: ${visitorIdToFetch}. Please check the ID and try again.`);
                setCurrentNocoRecord(null); // Ensure it's null
                renderPlaceholderCharts();
            }
        } catch (err) {
            console.error('PDS_NEXT_DEBUG: Error in fetchAndRenderDashboard:', err);
            setError(err.message || `An error occurred while loading data for ${visitorIdToFetch}.`);
            setCurrentNocoRecord(null);
            renderPlaceholderCharts();
        } finally {
            setIsLoading(false);
        }
    };

    const handleFetchButtonClick = () => {
        const newVisitorId = visitorIdInput.trim();
        if (newVisitorId) {
            // Update URL without full page reload (optional, good for bookmarking)
            router.push(`/dashboard?visitor_id=${newVisitorId}`, undefined, { shallow: true });
            fetchAndRenderDashboard(newVisitorId);
        } else {
            setError('Please enter a Visitor ID.');
            setCurrentStatusMessage('');
        }
    };

    // --- UI Update/Helper Functions (Simplified as React handles rendering) ---
    const renderPlaceholderCharts = () => {
        // For react-chartjs-2, just ensure the data prop for charts reflects placeholder state
        // This might involve setting chartData states to empty/placeholder values
        console.log("PDS_NEXT_DEBUG: Rendering placeholder charts (data will be empty/default).");
    };


    // --- Chart Data and Options ---
    // (This logic will be similar to your existing JS, adapted for react-chartjs-2)
    const getChartJsDefaultOptions = (customColors = {}) => {
        // If running client-side, document will be available. Guard for SSR if necessary.
        if (typeof window === 'undefined') return {}; // Or default server-side options

        const rootStyles = getComputedStyle(document.documentElement);
        const chartColors = {
            primary: customColors.primary || rootStyles.getPropertyValue('--accent-green').trim() || '#00ffcc',
            secondary: customColors.secondary || rootStyles.getPropertyValue('--accent-blue').trim() || '#00bfff',
            pink: customColors.pink || rootStyles.getPropertyValue('--accent-pink').trim() || '#ff007f',
            grid: `rgba(${rootStyles.getPropertyValue('--text-rgb-secondary') ? rootStyles.getPropertyValue('--text-rgb-secondary').trim() : '192,192,208'}, 0.1)`,
            ticks: rootStyles.getPropertyValue('--text-muted').trim() || '#888e9f',
            tooltipBg: rootStyles.getPropertyValue('--bg-dark-secondary').trim() || '#10151B',
            tooltipText: rootStyles.getPropertyValue('--text-light').trim() || '#f0f0f5',
            fontFamily: rootStyles.getPropertyValue('--font-primary').trim() || 'Montserrat, sans-serif'
        };

        return {
            responsive: true,
            maintainAspectRatio: false,
            color: chartColors.ticks,
            scales: {
                y: { beginAtZero: true, grid: { color: chartColors.grid, borderColor: chartColors.grid }, ticks: { color: chartColors.ticks, font: { family: chartColors.fontFamily } } },
                x: { grid: { display: false, borderColor: chartColors.grid }, ticks: { color: chartColors.ticks, font: { family: chartColors.fontFamily } } }
            },
            plugins: {
                legend: { labels: { color: chartColors.ticks, font: { family: chartColors.fontFamily } } },
                tooltip: { backgroundColor: chartColors.tooltipBg, titleColor: chartColors.tooltipText, bodyColor: chartColors.tooltipText, titleFont: { family: chartColors.fontFamily }, bodyFont: { family: chartColors.fontFamily }, borderColor: chartColors.primary, borderWidth: 1 }
            },
            animation: { duration: 800, easing: 'easeInOutQuart' }
        };
    };

    // Default/Placeholder Chart Data
    const placeholderLineBarData = { labels: ['No Data'], datasets: [{ label: 'Data', data: [0], borderColor: '#888e9f', backgroundColor: 'rgba(136, 142, 159, 0.1)' }] };
    const placeholderDoughnutData = { labels: ['N/A'], datasets: [{ label: 'Status', data: [1], backgroundColor: ['#888e9f'], hoverOffset: 4 }] };

    // Revenue Chart
    const revenueChartData = currentNocoRecord?.revenue_data_series
        ? JSON.parse(currentNocoRecord.revenue_data_series)
        : { labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'], values: [12, 19, 3, 5, 2, 3] }; // Default
    const finalRevenueData = {
        labels: revenueChartData.labels,
        datasets: [{
            label: 'Revenue Trend', data: revenueChartData.values,
            borderColor: typeof window !== 'undefined' ? (getComputedStyle(document.documentElement).getPropertyValue('--accent-green').trim() || '#00ffcc') : '#00ffcc',
            backgroundColor: typeof window !== 'undefined' ? `rgba(${getComputedStyle(document.documentElement).getPropertyValue('--accent-green-rgb').trim() || '0,255,204'}, 0.15)` : 'rgba(0,255,204,0.15)',
            tension: 0.4, fill: true,
        }]
    };

    // User Signups Chart
    const signupsData = currentNocoRecord?.signups_data_series
        ? JSON.parse(currentNocoRecord.signups_data_series)
        : { labels: ['W1', 'W2', 'W3', 'W4', 'W5'], values: [65, 59, 80, 81, 56] };
    const finalSignupsData = {
        labels: signupsData.labels,
        datasets: [{
            label: 'New User Signups', data: signupsData.values,
            backgroundColor: typeof window !== 'undefined' ? `rgba(${getComputedStyle(document.documentElement).getPropertyValue('--accent-blue-rgb').trim() || '0,191,255'}, 0.7)`: 'rgba(0,191,255,0.7)',
            borderColor: typeof window !== 'undefined' ? `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--accent-blue-rgb').trim() || '0,191,255'})` : 'rgb(0,191,255)',
            borderWidth: 1, borderRadius: 4,
        }]
    };

    // Task Completion Chart
    const taskData = currentNocoRecord?.task_completion_data
        ? JSON.parse(currentNocoRecord.task_completion_data)
        : { labels: ['Completed', 'Pending', 'Overdue'], values: [120, 40, 15] };
    const finalTaskData = {
        labels: taskData.labels,
        datasets: [{
            label: 'Task Status', data: taskData.values,
            backgroundColor: typeof window !== 'undefined' ? [
                `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--accent-green-rgb').trim() || '0,255,204'})`,
                `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--accent-blue-rgb').trim() || '0,191,255'})`,
                `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--accent-pink-rgb').trim() || '255,0,127'})`
            ] : ['#00ffcc', '#00bfff', '#ff007f'],
            hoverOffset: 8,
            borderColor: typeof window !== 'undefined' ? (getComputedStyle(document.documentElement).getPropertyValue('--bg-dark-secondary').trim() || '#10151B') : '#10151B',
            borderWidth: 3
        }]
    };
    const doughnutOptions = { ...getChartJsDefaultOptions(), cutout: '60%', plugins: { ...getChartJsDefaultOptions().plugins, legend: { ...getChartJsDefaultOptions().plugins?.legend, position: 'bottom' } } };


    // --- Rendered Content Variables ---
    const hasData = currentNocoRecord && typeof currentNocoRecord === 'object' && Object.keys(currentNocoRecord).length > 0;
    const firstName = hasData ? (currentNocoRecord.first_name || 'Valued Lead') : 'Visitor';
    const companyName = hasData ? (currentNocoRecord['organization/name'] || 'Your Company') : 'Company';

    let personalizedGreetingHtml = '';
    if (hasData && currentNocoRecord.icebreaker) {
        personalizedGreetingHtml += `<p class="lead">${escapeHtml(currentNocoRecord.icebreaker)}</p>`;
    }
    if (hasData && currentNocoRecord.from_abstract) {
        personalizedGreetingHtml += `<p>We've prepared this brief because we believe MakerToo's unique approach to AI, automation, and open-source tech can specifically help ${escapeHtml(companyName)} achieve ${escapeHtml(currentNocoRecord.from_abstract)}.</p>`;
    } else if (!hasData && !visitorIdFromUrl && !isLoading && !error) {
         personalizedGreetingHtml = `<p class="lead">Welcome to your personalized dashboard!</p><p>Enter your Visitor ID above to see tailored insights and opportunities.</p>`;
    }

    let companyAtAGlanceHtml = `<h3>About ${escapeHtml(companyName)}:</h3>`;
    if (hasData) {
        if (currentNocoRecord.extracted_company_profile_usp) companyAtAGlanceHtml += `<p><strong>Unique Selling Proposition:</strong> ${escapeHtml(currentNocoRecord.extracted_company_profile_usp)}</p>`;
        if (currentNocoRecord.extracted_company_overview) companyAtAGlanceHtml += `<p><strong>Overview:</strong> ${escapeHtml(currentNocoRecord.extracted_company_overview)}</p>`;
        if (currentNocoRecord.extracted_founder_profile_summary) companyAtAGlanceHtml += `<p><strong>Key Leadership:</strong> ${escapeHtml(currentNocoRecord.extracted_founder_profile_summary)}</p>`;
        if (!currentNocoRecord.extracted_company_profile_usp && !currentNocoRecord.extracted_company_overview && !currentNocoRecord.extracted_founder_profile_summary) {
            companyAtAGlanceHtml += `<p>Detailed company insights will appear here once data is loaded.</p>`;
        }
    } else {
        companyAtAGlanceHtml += `<p>Company information will be displayed here.</p>`;
    }

    let growthOpportunitiesHtml = '';
    if (hasData && currentNocoRecord.structured_core_services) {
        try {
            const servicesArray = JSON.parse(currentNocoRecord.structured_core_services);
            if (Array.isArray(servicesArray) && servicesArray.length > 0) {
                growthOpportunitiesHtml = `<ul>`;
                growthOpportunitiesHtml += `<li>Based on your focus on services like <strong>${servicesArray.map(s => escapeHtml(s)).join(', ')}</strong>, we see several ways MakerToo can help:</li>`;
                growthOpportunitiesHtml += `<li><strong>Streamline Operations:</strong> Automate repetitive tasks related to your core services using our n8n and custom AI workflows.</li>`;
                growthOpportunitiesHtml += `<li><strong>Enhance Client Value:</strong> Develop custom data analytics dashboards and reporting systems for greater transparency and insight.</li>`;
                growthOpportunitiesHtml += `<li><strong>Scale Your Impact:</strong> Build robust, open-source backends that grow with your agency, ensuring data sovereignty.</li></ul>`;
            } else { growthOpportunitiesHtml = "<p>Detailed service analysis pending.</p>"; }
        } catch (e) {
            console.error("PDS_NEXT_DEBUG: Error parsing structured_core_services", e);
            growthOpportunitiesHtml = "<p>Could not display service-specific opportunities.</p>";
        }
    } else {
        growthOpportunitiesHtml = "<p>Specific growth opportunities tailored to your business will be highlighted here.</p>";
    }

    let kpisToShow = [
        { label: "Potential ROI Boost", value: "10-20%", unit_suffix: "%", trend: "up", target: "Through Automation & Data Insights", icon: "dashicons-chart-line" },
        { label: "Operational Efficiency", value: "15-30%", unit_suffix: "%", trend: "up", target: "Via Process Streamlining", icon: "dashicons-admin-generic" },
        { label: "Data Control", value: "Full", unit_suffix: "", trend: "stable", target: "With Open-Source Systems", icon: "dashicons-lock" },
        { label: "Scalability Factor", value: "High", unit_suffix: "", trend: "up", target: "Future-Proof Tech Stack", icon: "dashicons-backup" }
    ];
    if (hasData && currentNocoRecord && currentNocoRecord.kpi_data) {
        try {
            const dynamicKpis = JSON.parse(currentNocoRecord.kpi_data);
            if (Array.isArray(dynamicKpis) && dynamicKpis.length > 0) {
                kpisToShow = dynamicKpis.map(kpi => ({
                    label: kpi.label || "KPI Metric", value: kpi.value || "N/A", unit_suffix: kpi.unit || "",
                    trend: kpi.trend || "neutral", target: kpi.target || "Specific target details", icon: kpi.icon || "dashicons-star-filled"
                }));
            }
        } catch (e) { console.warn("PDS_NEXT_DEBUG: Could not parse kpi_data. Using default KPIs.", e); }
    }

    let fullDeepResearchHtml = "<p>The full research report will be available here. This section provides an in-depth analysis of market positioning, competitive landscape, and strategic recommendations.</p>";
    if (hasData && currentNocoRecord.deep_research) {
        fullDeepResearchHtml = marked.parse(currentNocoRecord.deep_research);
    }


    return (
        <>
            <Head>
                <title>Personalized Dashboard - {companyName === 'Company' && firstName === 'Visitor' ? 'Welcome' : `${firstName} @ ${companyName}`}</title>
                <meta name="description" content={`Personalized insights and growth opportunities for ${companyName}`} />
                {/* Add other meta tags, favicons, etc. */}
            </Head>

            {/* This is where your HTML structure from template-personalized-dashboard.php goes, converted to JSX */}
            <main id="primary" className="site-main personalized-dashboard-page-area">
                <div className="personalized-dashboard-container">
                    <div className="dashboard-header">
                        <h1>
                            <span className="dashicons dashicons-admin-users" style={{ marginRight: '10px', verticalAlign: 'middle' }}></span>
                            Welcome, <span id="visitor-name-header">{firstName}{companyName !== 'Your Company' && companyName !== 'Company' ? ` from ${companyName}` : ''}</span>!
                        </h1>
                        <div id="personalized-greeting" dangerouslySetInnerHTML={{ __html: personalizedGreetingHtml }}></div>
                    </div>

                    <div className="visitor-input-area">
                        <label htmlFor="visitorIdInput" className="screen-reader-text">Enter Visitor ID:</label>
                        <input
                            type="text"
                            id="visitorIdInput"
                            placeholder="Enter Visitor ID (e.g., XYZ123)"
                            value={visitorIdInput}
                            onChange={(e) => setVisitorIdInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleFetchButtonClick()}
                            disabled={isLoading || !wpConfig} // Disable if loading or no WP config
                        />
                        <button
                            id="fetchDataButton"
                            className="button button-primary"
                            onClick={handleFetchButtonClick}
                            disabled={isLoading || !wpConfig}
                        >
                            <span className="dashicons dashicons-search" style={{ marginRight: '5px', verticalAlign: 'text-bottom' }}></span>
                            Fetch Data
                        </button>
                        <p id="currentVisitorStatus" className="visitor-status-message">{currentStatusMessage}</p>
                    </div>

                    {isLoading && (
                        <div id="loading-indicator" className="dashboard-section card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                            <div className="loader" style={{ margin: '0 auto 15px auto', border: '5px solid var(--border-color)', borderTop: '5px solid var(--accent-green)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
                            <p style={{ fontSize: '1.1em', color: 'var(--text-secondary)' }}>Loading personalized insights, please wait...</p>
                            {/* Add @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } to your global CSS for .loader */}
                        </div>
                    )}

                    {error && (
                         <div id="error-message" className="dashboard-message error">
                            <span className="dashicons dashicons-warning" style={{ marginRight: '8px', color: 'var(--accent-pink)' }}></span>
                            {error}
                        </div>
                    )}

                    {showNoDataMessage && !isLoading && !error && !hasData && (
                        <div id="no-data-message" className="dashboard-message info">
                            <p>Please enter a valid Visitor ID to view your personalized dashboard.</p>
                            <p><small>If you believe this is an error, please contact support.</small></p>
                        </div>
                    )}


                    {/* Main Dashboard Content - only show if not loading, no error, and data is present OR if no data has been fetched yet but no error */}
                    {((hasData && !isLoading && !error) || (!visitorIdFromUrl && !isLoading && !error && !hasData)) && (
                         <div id="dashboard-content" style={{ display: (isLoading || error || (showNoDataMessage && !hasData) ) ? 'none' : 'block' }}>
                            <section id="intro-insights-section" className="dashboard-section card">
                                <h2 className="section-title">
                                    <span className="dashicons dashicons-megaphone"></span>
                                    Your Personalized Briefing
                                </h2>
                                <div id="company-at-a-glance" dangerouslySetInnerHTML={{ __html: companyAtAGlanceHtml }}></div>
                                <h3 className="subsection-title">Key Growth Opportunities with MakerToo:</h3>
                                <div id="growth-opportunities-list" dangerouslySetInnerHTML={{ __html: growthOpportunitiesHtml }}></div>
                            </section>

                            <section id="kpi-section" className="dashboard-section card">
                                <h2 className="section-title">
                                    <span className="dashicons dashicons-performance"></span>
                                    How We Can Impact Your Key Metrics
                                </h2>
                                <div className="kpi-cards-container">
                                    {kpisToShow.map((kpi, index) => {
                                        let trendIcon = 'dashicons-minus';
                                        if (kpi.trend === 'up') trendIcon = 'dashicons-arrow-up-alt';
                                        if (kpi.trend === 'down') trendIcon = 'dashicons-arrow-down-alt';
                                        if (kpi.trend === 'stable') trendIcon = 'dashicons-arrow-right-alt';
                                        return (
                                            <div className="kpi-card" key={index}>
                                                <div className="kpi-label"><span className={`dashicons ${escapeHtml(kpi.icon || 'dashicons-star-filled')}`} style={{ marginRight: '5px' }}></span>{escapeHtml(kpi.label)}</div>
                                                <div className="kpi-value">{escapeHtml(kpi.value)}{kpi.unit_suffix ? <span className="kpi-unit">{escapeHtml(kpi.unit_suffix)}</span> : ''}</div>
                                                <div className="kpi-target"><small>{escapeHtml(kpi.target)}</small></div>
                                                {kpi.trend && kpi.trend !== 'neutral' ? <div className={`kpi-trend ${kpi.trend}`}><span className={`dashicons ${trendIcon}`}></span></div> : ''}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>

                            <section id="analytics-overview" className="dashboard-section card">
                                <h2 className="section-title">
                                    <span className="dashicons dashicons-chart-area"></span>
                                    Analytics Overview
                                </h2>
                                <div className="charts-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px'}}> {/* Add simple grid */}
                                    <div className="chart-container-wrapper">
                                        <h3 className="subsection-title"><span className="dashicons dashicons-chart-line" style={{ marginRight: '5px' }}></span>Monthly Revenue</h3>
                                        <div className="chart-container" style={{ height: '320px' }}>
                                            <Line ref={revenueChartRef} options={getChartJsDefaultOptions()} data={hasData ? finalRevenueData : placeholderLineBarData} />
                                        </div>
                                    </div>
                                    <div className="chart-container-wrapper">
                                        <h3 className="subsection-title"><span className="dashicons dashicons-groups" style={{ marginRight: '5px' }}></span>User Signups</h3>
                                        <div className="chart-container" style={{ height: '320px' }}>
                                            <Bar ref={userSignupsChartRef} options={getChartJsDefaultOptions()} data={hasData ? finalSignupsData : placeholderLineBarData} />
                                        </div>
                                    </div>
                                </div>
                                <div className="chart-container-wrapper" style={{ marginTop: '30px' }}>
                                    <h3 className="subsection-title"><span className="dashicons dashicons-yes-alt" style={{ marginRight: '5px' }}></span>Task Completion Rate</h3>
                                    <div className="chart-container" style={{ height: '280px', maxWidth: '450px', marginLeft: 'auto', marginRight: 'auto' }}>
                                        <Doughnut ref={taskCompletionChartRef} options={doughnutOptions} data={hasData ? finalTaskData : placeholderDoughnutData} />
                                    </div>
                                </div>
                            </section>

                            <section id="full-research-section" className="dashboard-section card">
                                <h2 className="section-title">
                                    <span className="dashicons dashicons-book-alt"></span>
                                    Dive Deeper: Our Full Research on <span id="visitor-company-report-title">{companyName}</span>
                                </h2>
                                <p>The following is the detailed research report we've compiled to understand your unique position and opportunities.</p>
                                <div id="deep-research-accordion" className="accordion">
                                    <div className="accordion-item">
                                        <button
                                            className="accordion-header"
                                            aria-expanded={isAccordionOpen}
                                            aria-controls="full-deep-research-content-panel"
                                            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
                                        >
                                            View Full Research Report
                                            <span className={`accordion-icon dashicons ${isAccordionOpen ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'}`}></span>
                                        </button>
                                        {isAccordionOpen && (
                                            <div id="full-deep-research-content-panel" className="accordion-content" role="region">
                                                <div id="full-deep-research-content" dangerouslySetInnerHTML={{ __html: fullDeepResearchHtml }}></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section id="booking-section" className="dashboard-section card">
                                <h2 className="section-title">
                                    <span className="dashicons dashicons-calendar-alt"></span>
                                    Ready to Build Your AI Growth Engine, <span id="visitor-name-cta">{firstName}</span>?
                                </h2>
                                <p>Let's discuss how MakerToo can help <span id="visitor-company-cta">{companyName}</span> implement these strategies and achieve undeniable, measurable results. Schedule a no-obligation strategy session:</p>
                                <div id="booking-widget-container" className="booking-widget">
                                    {wpConfig && wpConfig.bookingLink && !wpConfig.bookingLink.includes("YOUR_") ? (
                                        <iframe
                                            src={wpConfig.bookingLink}
                                            title="Schedule a Consultation"
                                            loading="lazy"
                                            style={{ width: '100%', height: '680px', border: 'none', borderRadius: 'var(--border-radius-md)' }}
                                        />
                                    ) : (
                                        <div className="booking-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', textAlign: 'center' }}>
                                            <span className="dashicons dashicons-clock" style={{ fontSize: '3em', marginBottom: '10px' }}></span>
                                            <p>Booking system is currently being configured or is unavailable.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}