// pages/dashboard.js
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { marked } from 'marked';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement,
    ArcElement, Title, Tooltip, Legend, Filler
);

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL;

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        if (unsafe === null || unsafe === undefined) return '';
        try { unsafe = String(unsafe); } catch (e) { return ''; }
    }
    return unsafe
        .replace(/&/g, "&")
        .replace(/</g, "<")
        .replace(/>/g, ">")
        .replace(/"/g, """)
        .replace(/'/g, "'"); // Single semicolon
}

export default function DashboardPage() {
    const router = useRouter();
    const { visitor_id: visitorIdFromUrl } = router.query;

    const [wpConfig, setWpConfig] = useState(null);
    const [visitorIdInput, setVisitorIdInput] = useState('');
    const [currentNocoRecord, setCurrentNocoRecord] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showNoDataMessage, setShowNoDataMessage] = useState(true); // Default to true
    const [currentStatusMessage, setCurrentStatusMessage] = useState('Enter a Visitor ID to begin.');
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    const lastFetchedIdRef = useRef(null);
    const configFetchedRef = useRef(false);

    const fetchVisitorDataViaProxy = useCallback(async (visitorId) => {
        if (!wpConfig || !wpConfig.ajax_url || !wpConfig.nonce) {
            throw new Error("WordPress configuration (ajax_url or nonce) is missing.");
        }
        // console.log("PDS_NEXT_CLIENT: Fetching data for visitorId:", visitorId, "using Nonce:", wpConfig.nonce);
        const formData = new FormData();
        formData.append('action', 'fetch_dashboard_data_proxy');
        formData.append('nonce', wpConfig.nonce);
        formData.append('visitor_id', visitorId); // This will be the random 'identifier_link' value
        try {
            const response = await axios.post(wpConfig.ajax_url, formData);
            if (response.data.success) {
                // console.log("PDS_NEXT_CLIENT: Proxy fetch success. Record:", response.data.data);
                return response.data.data;
            } else {
                // console.error("PDS_NEXT_CLIENT: Proxy fetch error (success:false):", response.data.data);
                throw new Error(response.data.data?.message || 'Failed to fetch data (server indicated failure).');
            }
        } catch (err) {
            console.error('PDS_NEXT_CLIENT: Proxy fetch EXCEPTION:', err);
            let errorMessage = 'An error occurred while fetching data.';
            if (err.response) {
                errorMessage = `Server error (${err.response.status}). `;
                if (err.response.data && err.response.data.data && err.response.data.data.message) {
                    errorMessage += err.response.data.data.message;
                } else if (typeof err.response.data === 'string' && err.response.data.includes("Nonce")) {
                     errorMessage += "Security check failed. Please try refreshing or contact support if this persists.";
                } else {
                    errorMessage += "Please check server logs for more details."
                }
            } else if (err.request) {
                errorMessage = 'No response from WordPress server. Is it running and accessible?';
            } else {
                errorMessage = err.message || errorMessage;
            }
            throw new Error(errorMessage);
        }
    }, [wpConfig]);

    const fetchAndRenderDashboard = useCallback(async (visitorIdToFetch) => {
        if (!visitorIdToFetch) {
            // console.log("PDS_NEXT_CLIENT: fetchAndRenderDashboard - no visitorIdToFetch. Resetting UI.");
            setCurrentNocoRecord(null); setError(null); setShowNoDataMessage(true);
            setCurrentStatusMessage("Please enter a Visitor ID."); setIsLoading(false); lastFetchedIdRef.current = null;
            return;
        }
        // console.log("PDS_NEXT_CLIENT: fetchAndRenderDashboard - Attempting fetch for visitorId:", visitorIdToFetch);
        setIsLoading(true); setError(null); setShowNoDataMessage(false);
        setCurrentStatusMessage(`Fetching personalized insights for ID: ${visitorIdToFetch}...`);
        try {
            if (!wpConfig || !wpConfig.useAjaxProxy) throw new Error("WordPress configuration error. Cannot fetch data.");
            const record = await fetchVisitorDataViaProxy(visitorIdToFetch);
            if (record && typeof record === 'object' && Object.keys(record).length > 0) {
                // console.log("PDS_NEXT_CLIENT: Record successfully fetched for ID", visitorIdToFetch, ":", record);
                setCurrentNocoRecord(record);
                const dn = record.first_name || 'Valued Lead';
                const cn = record['organization/name'] || record.company_short || 'Your Company';
                setCurrentStatusMessage(`Showing personalized data for: ${dn} from ${cn}`);
                setShowNoDataMessage(false);
            } else {
                // console.warn("PDS_NEXT_CLIENT: No data returned or empty record for ID:", visitorIdToFetch);
                setError(`No data found for Visitor ID: ${visitorIdToFetch}. Please verify the ID.`);
                setCurrentNocoRecord(null); setShowNoDataMessage(true);
            }
        } catch (err) {
            console.error('PDS_NEXT_CLIENT: Error in fetchAndRenderDashboard for ID', visitorIdToFetch, ':', err);
            setError(err.message || `An unexpected error occurred while loading data.`);
            setCurrentNocoRecord(null); setShowNoDataMessage(true);
        } finally {
            setIsLoading(false);
        }
    }, [wpConfig, fetchVisitorDataViaProxy]);

    useEffect(() => { // Config Fetch Effect
        // console.log("PDS_NEXT_CLIENT: Config fetch EFFECT. Fetched flag:", configFetchedRef.current);
        if (!configFetchedRef.current && WP_API_URL) {
            configFetchedRef.current = true; // Set flag immediately to prevent re-fetch
            const fetchWpConfig = async () => {
                // console.log("PDS_NEXT_CLIENT: Attempting to fetch WP Config from:", `${WP_API_URL}/wp-json/personalized-dashboard/v1/config`);
                try {
                    const response = await axios.get(`${WP_API_URL}/wp-json/personalized-dashboard/v1/config`);
                    if (response.data && response.data.success) {
                        setWpConfig(response.data.data);
                        // console.log("PDS_NEXT_CLIENT: WP Config fetched successfully:", response.data.data);
                    } else { throw new Error(response.data?.data?.message || 'Failed to fetch valid WP configuration.'); }
                } catch (err) { console.error("PDS_NEXT_CLIENT: CRITICAL - Error fetching WP config:", err); setError(`Dashboard Error: Could not load configuration from server. ${err.message}`);}
            };
            fetchWpConfig();
        } else if (!WP_API_URL) { console.error("PDS_NEXT_CLIENT: CRITICAL - WP_API_URL (NEXT_PUBLIC_WP_API_URL) not defined."); setError("Dashboard Error: API URL configuration is missing.");}
    }, []); // Runs once on mount

    useEffect(() => { // Data Fetch Trigger Effect based on URL and Config
        // console.log("PDS_NEXT_CLIENT: Data fetch trigger EFFECT. visitorIdFromUrl:", visitorIdFromUrl, "wpConfig:", !!wpConfig, "isLoading:", isLoading, "lastFetchedId:", lastFetchedIdRef.current);
        if (wpConfig) { // Only proceed if config is loaded
            if (visitorIdFromUrl) {
                setVisitorIdInput(visitorIdFromUrl); // Sync input field with URL
                if (!isLoading && visitorIdFromUrl !== lastFetchedIdRef.current) {
                    // console.log("PDS_NEXT_CLIENT: Data fetch EFFECT - Conditions met. Fetching for new URL ID:", visitorIdFromUrl);
                    setCurrentNocoRecord(null); setError(null); // Reset before new fetch
                    lastFetchedIdRef.current = visitorIdFromUrl; // Update ref before async call
                    fetchAndRenderDashboard(visitorIdFromUrl);
                }
            } else { // No visitorIdFromUrl, reset to initial state
                // console.log("PDS_NEXT_CLIENT: Data fetch EFFECT - No visitorIdFromUrl. Resetting UI state.");
                setCurrentNocoRecord(null); setError(null); setShowNoDataMessage(true);
                setCurrentStatusMessage('Enter a Visitor ID to begin.'); setVisitorIdInput(''); lastFetchedIdRef.current = null;
            }
        }
    }, [visitorIdFromUrl, wpConfig, fetchAndRenderDashboard, isLoading]); // isLoading added to dependencies

    const handleFetchButtonClick = () => {
        const newVisitorId = visitorIdInput.trim();
        if (newVisitorId) {
            // console.log("PDS_NEXT_CLIENT: Fetch Button CLICKED for ID:", newVisitorId);
            // Always trigger a URL change to ensure useEffect handles the fetch,
            // which simplifies state management and prevents duplicate fetch logic.
            // shallow: false will re-run getServerSideProps/getStaticProps on page if defined,
            // but for client-side routing like this, it mainly ensures data fetching effects re-run.
            if (newVisitorId !== lastFetchedIdRef.current || error || !currentNocoRecord) {
                 lastFetchedIdRef.current = null; // Reset to allow re-fetch by useEffect
                 router.push(`/dashboard?visitor_id=${newVisitorId}`, undefined, { shallow: false });
            } else {
                // console.log("PDS_NEXT_CLIENT: Fetch button clicked for already loaded ID and no error. Re-initiating fetch for:", newVisitorId);
                lastFetchedIdRef.current = null; // Allow re-fetch by useEffect
                fetchAndRenderDashboard(newVisitorId); // Or let router.push trigger it
            }
        } else {
            setError('Please enter a Visitor ID.'); setCurrentStatusMessage('Please enter a Visitor ID.');
            setShowNoDataMessage(true); setCurrentNocoRecord(null); lastFetchedIdRef.current = null;
            router.push(`/dashboard`, undefined, { shallow: false }); // Clear URL param
        }
    };
    const handleInputChange = (e) => { setVisitorIdInput(e.target.value); };
    const handleKeyPress = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchButtonClick(); } };

    const hasData = currentNocoRecord && typeof currentNocoRecord === 'object' && Object.keys(currentNocoRecord).length > 0 && !isLoading && !error;
    
    const firstName = hasData ? (currentNocoRecord.first_name || 'Valued Lead') : 'Visitor';
    const companyNameFromAPI = hasData ? (currentNocoRecord['organization/name'] || currentNocoRecord.company_short) : null;
    const companyName = companyNameFromAPI || (hasData ? 'Company' : 'Your Company');

    let personalizedGreetingHtml = '';
    if (!wpConfig && !isLoading && !error) { personalizedGreetingHtml = `<p class="lead" style="color: var(--text-muted);">Initializing dashboard...</p>`; }
    else if (hasData) {
        const fromAbstractText = currentNocoRecord.from_abstract;
        const companyNameForGreeting = currentNocoRecord['organization/name'] || 'your organization';
        personalizedGreetingHtml = `<p class="lead">Hi ${escapeHtml(firstName)}, this dashboard highlights how MakerToo can assist ${escapeHtml(companyNameForGreeting)} in <strong>${escapeHtml(fromAbstractText || 'achieving key strategic objectives')}</strong>.</p>`;
        personalizedGreetingHtml += `<p>Explore below for tailored insights and our detailed research.</p>`;
    } else if (isLoading) { personalizedGreetingHtml = `<p class="lead" style="color: var(--text-secondary);">Loading personalized insights for ID: ${visitorIdInput || visitorIdFromUrl || '...'} </p>`;}
    else if (error) { personalizedGreetingHtml = `<p class="lead" style="color: var(--accent-pink);">Attention Required</p><p>We encountered an issue loading your personalized data. Please double-check the Visitor ID or try again. If the problem persists, support has been notified.</p>`;}
    else { personalizedGreetingHtml = `<p class="lead">Welcome to Your Personalized Dashboard!</p><p>Please enter your unique Visitor ID above to unlock tailored insights.</p>`;}

    let companyAtAGlanceHtml = '';
    if (hasData) {
        const logoUrl = currentNocoRecord['organization/logo_url'];
        const usp = currentNocoRecord.extracted_company_profile_usp;
        const overview = currentNocoRecord.extracted_company_overview;
        const founderSummary = currentNocoRecord.extracted_founder_profile_summary;
        const companyWebsite = currentNocoRecord['organization/website_url'];

        if (logoUrl && logoUrl.startsWith('http')) {
            companyAtAGlanceHtml += `<div style="text-align:center; margin-bottom: 20px;">`;
            if (companyWebsite && companyWebsite.startsWith('http')) companyAtAGlanceHtml += `<a href="${escapeHtml(companyWebsite)}" target="_blank" rel="noopener noreferrer">`;
            companyAtAGlanceHtml += `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)} Logo" style="max-height: 70px; max-width: 180px; display: inline-block; border-radius: var(--border-radius-sm); background-color: #fff; padding: 5px; box-shadow: var(--shadow-soft);">`;
            if (companyWebsite && companyWebsite.startsWith('http')) companyAtAGlanceHtml += `</a>`;
            companyAtAGlanceHtml += `</div>`;
        }
        companyAtAGlanceHtml += `<h3>About ${escapeHtml(companyName)}:</h3>`;
        if (usp) companyAtAGlanceHtml += `<p><strong>Unique Selling Proposition:</strong> ${escapeHtml(usp)}</p>`;
        if (overview) companyAtAGlanceHtml += `<p><strong>Overview:</strong> ${escapeHtml(overview)}</p>`;
        if (founderSummary) companyAtAGlanceHtml += `<p><strong>Key Leadership Insights:</strong> ${escapeHtml(founderSummary)}</p>`;
        if (!usp && !overview && !founderSummary) companyAtAGlanceHtml += `<p>Detailed company information for ${escapeHtml(companyName)} will be presented here.</p>`;
    } else if (!isLoading && !error && showNoDataMessage) { companyAtAGlanceHtml += `<h3>About Your Company:</h3><p>Insights will appear once data is loaded.</p>`; }


    let growthOpportunitiesHtml = '';
    if (hasData && currentNocoRecord.structured_core_services) {
        try {
            const servicesArray = JSON.parse(currentNocoRecord.structured_core_services);
            if (Array.isArray(servicesArray) && servicesArray.length > 0) {
                growthOpportunitiesHtml = `<ul><li>Leveraging your strengths in <strong>${servicesArray.map(s => escapeHtml(s)).join(', ')}</strong>, MakerToo can help:</li><li><strong>Amplify Impact:</strong> Custom AI & automation to scale your core offerings.</li><li><strong>Boost Efficiency:</strong> Streamline workflows with n8n and open-source backends.</li><li><strong>Ensure Data Sovereignty:</strong> Full control with private databases & CRMs.</li></ul>`;
            } else { growthOpportunitiesHtml = "<p>Analysis of core services to identify specific growth opportunities is in progress.</p>"; }
        } catch (e) { growthOpportunitiesHtml = "<p>Unable to display specific growth opportunities at this time.</p>";}
    } else if (!isLoading && !error && showNoDataMessage) { growthOpportunitiesHtml = "<p>Tailored growth opportunities will be highlighted here.</p>";}

    let kpisToShow = [
        { label: "Strategic Alignment", value: "High", target: "With MakerToo's Open-Source Focus", icon: "dashicons-admin-links" },
        { label: "Innovation Potential", value: "Significant", target: "Via Custom AI/Automation", icon: "dashicons-lightbulb" },
        { label: "Data Control", value: "Total", target: "Through Private Infrastructure", icon: "dashicons-lock" },
        { label: "Future Scalability", value: "Assured", target: "With Flexible Tech Stacks", icon: "dashicons-backup" },
    ];
    if (hasData && currentNocoRecord.kpi_data) {
        try {
            const dynamicKpis = JSON.parse(currentNocoRecord.kpi_data);
            if (Array.isArray(dynamicKpis) && dynamicKpis.length > 0) kpisToShow = dynamicKpis;
        } catch (e) { /* console.warn("PDS_NEXT_CLIENT: Could not parse kpi_data from NocoDB.", e); */ }
    }

    let fullDeepResearchHtml = "<p>Your comprehensive research report will be accessible here, providing in-depth analysis and strategic recommendations.</p>";
    if (hasData && currentNocoRecord.deep_reaserach) { // Match CSV typo 'deep_reaserach'
        try { fullDeepResearchHtml = marked.parse(currentNocoRecord.deep_reaserach); }
        catch (e) { fullDeepResearchHtml = `<pre>${escapeHtml(currentNocoRecord.deep_reaserach)}</pre>`;}
    }
    
    const displayDashboardContent = hasData; // Main condition to show content sections

    const getChartJsDefaultOptions = useCallback((customColors = {}) => {
        if (typeof window === 'undefined') return { scales: { y: {}, x: {} }, plugins: { legend: {}, tooltip: {} } };
        const rootStyles = getComputedStyle(document.documentElement);
        const safeGet = (prop, fb) => rootStyles.getPropertyValue(prop).trim() || fb;
        const chartColors = { /* ... same as your previous getChartJsDefaultOptions ... */
            primary: safeGet('--accent-green', '#00ffcc'), secondary: safeGet('--accent-blue', '#00bfff'), pink: safeGet('--accent-pink', '#ff007f'),
            grid: `rgba(${safeGet('--text-rgb-secondary', '192,192,208')}, 0.1)`, ticks: safeGet('--text-muted', '#888e9f'),
            tooltipBg: safeGet('--bg-dark-secondary', '#10151B'), tooltipText: safeGet('--text-light', '#f0f0f5'),
            fontFamily: safeGet('--font-primary', 'Montserrat, sans-serif').split(',')[0].trim(),
        };
        return { responsive: true, maintainAspectRatio: false, color: chartColors.ticks,
            scales: { y: { beginAtZero: true, grid: { color: chartColors.grid, borderColor: chartColors.grid }, ticks: { color: chartColors.ticks, font: { family: chartColors.fontFamily } } },
                      x: { grid: { display: false, borderColor: chartColors.grid }, ticks: { color: chartColors.ticks, font: { family: chartColors.fontFamily } } } },
            plugins: { legend: { position: 'top', labels: { color: chartColors.ticks, font: { family: chartColors.fontFamily } } },
                       tooltip: { backgroundColor: chartColors.tooltipBg, titleColor: chartColors.tooltipText, bodyColor: chartColors.tooltipText, titleFont: { family: chartColors.fontFamily }, bodyFont: { family: chartColors.fontFamily }, borderColor: chartColors.primary, borderWidth: 1 } },
            animation: { duration: 600, easing: 'easeOutQuart' }
        };
    }, []);
    const defaultChartOptions = getChartJsDefaultOptions();
    const getRgbColor = useCallback((cssVar, fallbackRgb) => {
        if (typeof window === 'undefined') return fallbackRgb;
        return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || fallbackRgb;
    }, []);

    const illustrativeRevenueData = { /* ... same illustrative data ... */
        labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Next Q (Proj.)'], datasets: [{ label: 'Potential Revenue Growth', data: [50, 65, 80, 75, 95], borderColor: defaultChartOptions.plugins?.tooltip?.borderColor || '#00ffcc', backgroundColor: `rgba(${getRgbColor('--accent-green-rgb', '0,255,204')}, 0.15)`, tension: 0.3, fill: true,}]
    };
    const illustrativeEfficiencyData = { /* ... same illustrative data ... */
        labels: ['Manual', 'Phase 1 Auto.', 'Phase 2 AI Opt.'], datasets: [{ label: 'Task Processing Time (Hours)', data: [100, 60, 30], backgroundColor: `rgba(${getRgbColor('--accent-blue-rgb', '0,191,255')}, 0.7)`, borderColor: `rgb(${getRgbColor('--accent-blue-rgb', '0,191,255')})`, borderWidth: 1, borderRadius: 4,}]
    };
    const illustrativeProjectCompletionData = { /* ... same illustrative data ... */
        labels: ['On Track', 'At Risk (Mitigated)', 'New Initiatives'], datasets: [{ label: 'Project Status Distribution', data: [70, 15, 15], backgroundColor: [`rgb(${getRgbColor('--accent-green-rgb', '0,255,204')})`, `rgba(${getRgbColor('--accent-blue-rgb', '0,191,255')}, 0.7)`, `rgba(${getRgbColor('--accent-pink-rgb', '255,0,127')}, 0.6)`], hoverOffset: 6, borderColor: defaultChartOptions.plugins?.tooltip?.backgroundColor || '#10151B', borderWidth: 2 }]
    };
    const doughnutChartOptions = { ...defaultChartOptions, cutout: '60%', plugins: { ...defaultChartOptions.plugins, legend: { ...defaultChartOptions.plugins?.legend, position: 'bottom' } } };


    return (
        <>
            <Head>
                 <title>{`Dashboard - ${hasData ? `${firstName} @ ${companyName}` : (visitorIdFromUrl || visitorIdInput ? 'Loading...' : 'Welcome')}`}</title>
                <meta name="description" content={`Personalized dashboard insights ${hasData ? `for ${companyName}` : 'by MakerToo'}`} />
                <link rel="icon" href="/favicon.ico" /> {/* Make sure you have a favicon.ico in your /public folder */}
            </Head>

            <main id="primary" className="site-main personalized-dashboard-page-area">
                <div className="personalized-dashboard-container">
                    {/* Header Section */}
                    <div className="dashboard-header">
                        <h1>
                            <span className="dashicons dashicons-admin-users" style={{ marginRight: '10px', verticalAlign: 'middle' }}></span>
                            Welcome, <span id="visitor-name-header">{firstName}{companyName !== 'Your Company' && companyName !== 'Company' && companyName ? ` from ${companyName}` : ''}</span>!
                        </h1>
                        <div id="personalized-greeting" dangerouslySetInnerHTML={{ __html: personalizedGreetingHtml }}></div>
                    </div>

                    {/* Visitor Input Area */}
                    <div className="visitor-input-area">
                        <input type="text" id="visitorIdInput" placeholder="Enter Your Visitor ID" value={visitorIdInput} onChange={handleInputChange} onKeyPress={handleKeyPress} disabled={isLoading || !wpConfig} aria-label="Visitor ID Input"/>
                        <button id="fetchDataButton" className="button button-primary" onClick={handleFetchButtonClick} disabled={isLoading || !wpConfig}>
                            <span className="dashicons dashicons-search" style={{ marginRight: '5px', verticalAlign: 'text-bottom' }}></span>Unlock Insights
                        </button>
                        <p id="currentVisitorStatus" className="visitor-status-message">{currentStatusMessage}</p>
                    </div>

                    {/* Loading, Error, No Data Messages */}
                    {isLoading && (
                        <div className="dashboard-section card" style={{ textAlign: 'center', padding: '30px 20px', margin: '20px 0' }}>
                            <div className="loader" style={{ margin: '0 auto 15px auto', border: '5px solid var(--border-color)', borderTop: '5px solid var(--accent-green)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
                            <p style={{ fontSize: '1.1em', color: 'var(--text-secondary)' }}>Crafting your personalized experience...</p>
                        </div>
                    )}
                    {error && !isLoading && (<div className="dashboard-message error" style={{margin: '20px 0'}}><span className="dashicons dashicons-warning" style={{marginRight: '8px'}}></span>{error}</div>)}
                    {showNoDataMessage && !isLoading && !error && !hasData && (
                        <div className="dashboard-message info" style={{margin: '20px 0'}}>
                            {!wpConfig ? <p><span className="dashicons dashicons-info" style={{marginRight:'8px'}}></span>Initializing dashboard services. Please wait a moment...</p> : <p><span className="dashicons dashicons-info" style={{marginRight:'8px'}}></span>Please enter your unique Visitor ID to access your personalized insights.</p>}
                        </div>
                    )}

                    {/* Main Dashboard Content Sections - Rendered only if hasData */}
                    {displayDashboardContent && (
                        <div id="dashboard-content">
                            <section id="intro-insights-section" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-megaphone"></span>Your Personalized Briefing</h2>
                                <div id="company-at-a-glance" dangerouslySetInnerHTML={{ __html: companyAtAGlanceHtml }}></div>
                                <h3 className="subsection-title">Key Growth Opportunities with MakerToo:</h3>
                                <div id="growth-opportunities-list" dangerouslySetInnerHTML={{ __html: growthOpportunitiesHtml }}></div>
                            </section>

                            <section id="kpi-section" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-performance"></span>Projected Impact on Key Metrics</h2>
                                <div className="kpi-cards-container">
                                    {kpisToShow.map((kpi, index) => (
                                         <div className="kpi-card" key={index}>
                                             <div className="kpi-label"><span className={`dashicons ${escapeHtml(kpi.icon || 'dashicons-star-filled')}`} style={{ marginRight: '5px' }}></span>{escapeHtml(kpi.label)}</div>
                                             <div className="kpi-value">{escapeHtml(kpi.value)}{kpi.unit_suffix ? <span className="kpi-unit">{escapeHtml(kpi.unit_suffix)}</span> : ''}</div>
                                             <div className="kpi-target"><small>{escapeHtml(kpi.target)}</small></div>
                                             {kpi.trend && kpi.trend !== 'neutral' && <div className={`kpi-trend ${kpi.trend}`}><span className={`dashicons dashicons-arrow-${kpi.trend === 'up' ? 'up' : 'down'}-alt`}></span></div>}
                                         </div>
                                    ))}
                                </div>
                            </section>

                            <section id="analytics-overview" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-chart-area"></span>Illustrative Performance Projections</h2>
                                <p style={{textAlign: 'center', marginBottom: '30px', color: 'var(--text-secondary)'}}>
                                    Visualizing the potential impact of MakerToo&#39;s solutions for {companyName}.
                                </p>
                                <div className="charts-grid" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '25px'}}>
                                    <div className="chart-container-wrapper">
                                        <h3 className="subsection-title" style={{textAlign:'center'}}><span className="dashicons dashicons-chart-line" style={{ marginRight: '5px' }}></span>Revenue Trajectory</h3>
                                        <div className="chart-container" style={{ height: '300px' }}><Line options={defaultChartOptions} data={illustrativeRevenueData} /></div>
                                    </div>
                                    <div className="chart-container-wrapper">
                                        <h3 className="subsection-title" style={{textAlign:'center'}}><span className="dashicons dashicons-performance" style={{ marginRight: '5px' }}></span>Operational Efficiency</h3>
                                        <div className="chart-container" style={{ height: '300px' }}><Bar options={defaultChartOptions} data={illustrativeEfficiencyData} /></div>
                                    </div>
                                </div>
                                <div className="chart-container-wrapper" style={{ marginTop: '40px' }}>
                                    <h3 className="subsection-title" style={{textAlign:'center'}}><span className="dashicons dashicons-yes-alt" style={{ marginRight: '5px' }}></span>Strategic Initiative Focus</h3>
                                    <div className="chart-container" style={{ height: '300px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                                        <Doughnut options={doughnutChartOptions} data={illustrativeProjectCompletionData} />
                                    </div>
                                </div>
                            </section>

                            <section id="full-research-section" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-book-alt"></span>Dive Deeper: Full Research for <span id="visitor-company-report-title">{companyName}</span></h2>
                                <p>The following is the detailed research report compiled to understand unique positions and opportunities.</p>
                                <div id="deep-research-accordion" className="accordion">
                                    <div className="accordion-item">
                                        <button className="accordion-header" aria-expanded={isAccordionOpen} onClick={() => setIsAccordionOpen(!isAccordionOpen)}>
                                            View Full Research Report
                                            <span className={`accordion-icon dashicons ${isAccordionOpen ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'}`}></span>
                                        </button>
                                        {isAccordionOpen && (
                                            <div className="accordion-content" role="region" aria-labelledby="accordion-header-research"> {/* Ensure button has id="accordion-header-research" */}
                                                <div id="full-deep-research-content" dangerouslySetInnerHTML={{ __html: fullDeepResearchHtml }}></div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>

                            <section id="booking-section" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-calendar-alt"></span>Ready to Implement, <span id="visitor-name-cta">{firstName}</span>?</h2>
                                <p>Let&#39;s discuss how MakerToo can architect and implement these AI & Automation strategies for <span id="visitor-company-cta">{companyName}</span>.</p>
                                <div id="booking-widget-container" className="booking-widget">
                                    {wpConfig && wpConfig.bookingLink && !wpConfig.bookingLink.includes("YOUR_") ? (
                                        <iframe src={wpConfig.bookingLink} title="Schedule a Consultation" loading="lazy" 
                                                style={{ width: '100%', height: '550px', border: 'none', borderRadius: 'var(--border-radius-md)' }}/>
                                    ) : (
                                        <div className="booking-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', textAlign: 'center' }}>
                                            <span className="dashicons dashicons-clock" style={{ fontSize: '3em', marginBottom: '10px' }}></span>
                                            <p>Booking options are being configured. Please check back or contact us directly.</p>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )} {/* End #dashboard-content conditional rendering */}
                </div> {/* End .personalized-dashboard-container */}
            </main>
        </>
    );
}