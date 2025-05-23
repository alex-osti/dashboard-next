// pages/dashboard.js
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { marked } from 'marked';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, ArcElement, Title, Tooltip, Legend, Filler, Colors // Keep Colors if using Chart.js v4+
} from 'chart.js';
import ClipLoader from "react-spinners/ClipLoader"; // Using ClipLoader from react-spinners

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement,
    ArcElement, Title, Tooltip, Legend, Filler, Colors // Keep Colors
);

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL;

// --- Helper Functions ---
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

const renderMarkdownForHTML = (markdownText) => {
    if (!markdownText) return { __html: '' };
    marked.setOptions({
        breaks: true,
        gfm: true,
    });
    const rawHtml = marked.parse(markdownText);
    const sanitizedHtml = rawHtml
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/on([a-z]+)=(['"]?)([^"'>\s]+)\2/gi, 'data-on$1=$2$3$2');
    return { __html: sanitizedHtml };
};

const getChartColorsFromCSSVariables = () => {
    if (typeof window === 'undefined') {
        return {
            primary: '#00ffcc', secondary: '#00bfff', pink: '#ff007f', purple: '#9f78ff',
            grid: 'rgba(160,160,184,0.1)', ticks: '#787e8f',
            tooltipBg: '#10151B', tooltipText: '#f0f0f5',
            fontFamily: 'Montserrat, sans-serif',
            accentGreenRgb: '0,255,204', accentBlueRgb: '0,191,255', accentPinkRgb: '255,0,127', accentPurpleRgb: '159,120,255'
        };
    }
    const rootStyles = getComputedStyle(document.documentElement);
    const safeGet = (prop, fb) => rootStyles.getPropertyValue(prop)?.trim() || fb;
    return {
        primary: safeGet('--accent-green', '#00ffcc'),
        secondary: safeGet('--accent-blue', '#00bfff'),
        pink: safeGet('--accent-pink', '#ff007f'),
        purple: safeGet('--accent-purple', '#9f78ff'),
        grid: `rgba(${safeGet('--text-rgb-secondary-raw', '160,160,184')}, 0.1)`,
        ticks: safeGet('--text-muted', '#787e8f'),
        tooltipBg: safeGet('--bg-dark-secondary', '#10151B'),
        tooltipText: safeGet('--text-light', '#f0f0f5'),
        fontFamily: safeGet('--font-primary', 'Montserrat, sans-serif').split(',')[0].trim(),
        accentGreenRgb: safeGet('--accent-green-rgb', '0,255,204'),
        accentBlueRgb: safeGet('--accent-blue-rgb', '0,191,255'),
        accentPinkRgb: safeGet('--accent-pink-rgb', '255,0,127'),
        accentPurpleRgb: safeGet('--accent-purple-rgb', '159,120,255'),
    };
};

const getChartJsDefaultOptions = (chartColors) => ({
    responsive: true, maintainAspectRatio: false,
    color: chartColors.ticks,
    scales: {
        y: { beginAtZero: true, grid: { color: chartColors.grid, borderColor: chartColors.grid }, ticks: { color: chartColors.ticks, font: { family: chartColors.fontFamily, size: 10 } } },
        x: { grid: { display: false, borderColor: chartColors.grid }, ticks: { color: chartColors.ticks, font: { family: chartColors.fontFamily, size: 10 } } }
    },
    plugins: {
        legend: { position: 'top', labels: { color: chartColors.ticks, font: { family: chartColors.fontFamily }, boxWidth: 12, padding: 15 } },
        tooltip: {
            enabled: true, backgroundColor: chartColors.tooltipBg, titleColor: chartColors.tooltipText, bodyColor: chartColors.tooltipText,
            titleFont: { family: chartColors.fontFamily, weight: '600' }, bodyFont: { family: chartColors.fontFamily },
            borderColor: chartColors.primary, borderWidth: 1, padding: 10, cornerRadius: 4,
            usePointStyle: true,
        },
        colors: { forceOverride: true }
    },
    animation: { duration: 700, easing: 'easeOutQuart' }
});

export default function DashboardPage() {
    const router = useRouter();
    const { visitor_id: visitorIdFromUrl } = router.query;

    const [wpConfig, setWpConfig] = useState(null);
    const [visitorIdInput, setVisitorIdInput] = useState('');
    // Renamed currentNocoRecord to nocoData for consistency with later parts of the code
    const [nocoData, setNocoData] = useState(null); 
    // Consolidated loading/error/message states into appState
    const [appState, setAppState] = useState('initializing'); // initializing, ready, loading, error, no_data_for_id, data_loaded, initializing_config
    const [errorMessage, setErrorMessage] = useState('');
    const [isResearchAccordionOpen, setIsResearchAccordionOpen] = useState(false);

    const lastFetchedIdRef = useRef(null);
    const configFetchedRef = useRef(false);
    const chartColorsRef = useRef(null);

    useEffect(() => {
        chartColorsRef.current = getChartColorsFromCSSVariables();
    }, []);

    const fetchWpConfig = useCallback(async () => {
        if (!WP_API_URL) {
            console.error("MAKERTOO_PAP_CLIENT: CRITICAL - NEXT_PUBLIC_WP_API_URL not defined.");
            setErrorMessage("Dashboard Error: API URL configuration is missing.");
            setAppState('error'); return null;
        }
        setAppState('initializing_config');
        try {
            const response = await axios.get(`${WP_API_URL}/wp-json/personalized-dashboard/v1/config`);
            if (response.data && response.data.success) return response.data.data;
            throw new Error(response.data?.data?.message || 'Failed to fetch valid WP configuration.');
        } catch (err) {
            console.error("MAKERTOO_PAP_CLIENT: CRITICAL - Error fetching WP config:", err);
            setErrorMessage(`Dashboard Error: Could not load configuration. ${err.message}`);
            setAppState('error'); return null;
        }
    }, []);

    const fetchVisitorData = useCallback(async (visitorId, currentWpConfig) => {
        if (!currentWpConfig || !currentWpConfig.ajax_url || !currentWpConfig.nonce) {
            throw new Error("WordPress configuration for data fetching is missing.");
        }
        const formData = new FormData();
        formData.append('action', 'fetch_dashboard_data_proxy');
        formData.append('nonce', currentWpConfig.nonce);
        formData.append('visitor_id', visitorId);
        try {
            const response = await axios.post(currentWpConfig.ajax_url, formData);
            if (response.data.success) return response.data.data;
            throw new Error(response.data.data?.message || 'Failed to fetch data (server indicated failure).');
        } catch (err) {
            let specificMessage = 'An error occurred while fetching your personalized data.';
            if (err.response) {
                specificMessage = `Server error (${err.response.status}). `;
                if (err.response.data && err.response.data.data && err.response.data.data.message) {
                    specificMessage += err.response.data.data.message;
                } else if (typeof err.response.data === 'string' && err.response.data.toLowerCase().includes("nonce")) {
                     specificMessage += "Security check failed. Please try refreshing.";
                } else { specificMessage += "Please try again or contact support." }
            } else if (err.request) {
                specificMessage = 'No response from WordPress server. Please check connectivity.';
            } else { specificMessage = err.message || specificMessage; }
            throw new Error(specificMessage);
        }
    }, []);

    const loadDashboardForId = useCallback(async (idToFetch, currentWpConfig) => {
        if (!idToFetch) {
            setNocoData(null); setAppState('ready'); return;
        }
        if (!currentWpConfig) {
            setAppState('initializing_config');
            setErrorMessage('Configuration not yet loaded. Please wait.');
            return;
        }
        setAppState('loading'); setErrorMessage('');
        try {
            const record = await fetchVisitorData(idToFetch, currentWpConfig);
            if (record && typeof record === 'object' && Object.keys(record).length > 0) {
                setNocoData(record); setAppState('data_loaded');
            } else {
                setNocoData(null); setAppState('no_data_for_id');
                setErrorMessage(`No personalized insights found for Visitor ID: ${escapeHtml(idToFetch)}. Please verify the ID or contact us if this ID should be active.`);
            }
        } catch (err) {
            setNocoData(null); setAppState('error');
            setErrorMessage(err.message || `An unexpected error occurred. Please try again.`);
        }
    }, [fetchVisitorData]);

    useEffect(() => { // Initial Config Fetch & Potential Data Load
        if (!configFetchedRef.current) {
            configFetchedRef.current = true;
            fetchWpConfig().then(loadedConfig => {
                if (loadedConfig) {
                    setWpConfig(loadedConfig);
                    if (visitorIdFromUrl && visitorIdFromUrl !== lastFetchedIdRef.current) {
                        setVisitorIdInput(visitorIdFromUrl);
                        lastFetchedIdRef.current = visitorIdFromUrl;
                        loadDashboardForId(visitorIdFromUrl, loadedConfig);
                    } else if (!visitorIdFromUrl) {
                        setAppState('ready');
                    }
                }
            });
        }
    }, [fetchWpConfig, loadDashboardForId, visitorIdFromUrl]);

    useEffect(() => { // Subsequent fetches based on URL change
        if (wpConfig && visitorIdFromUrl && visitorIdFromUrl !== lastFetchedIdRef.current) {
            setVisitorIdInput(visitorIdFromUrl);
            lastFetchedIdRef.current = visitorIdFromUrl;
            loadDashboardForId(visitorIdFromUrl, wpConfig);
        } else if (wpConfig && !visitorIdFromUrl && lastFetchedIdRef.current !== null) {
            setNocoData(null); setAppState('ready'); setVisitorIdInput('');
            lastFetchedIdRef.current = null;
        }
    }, [visitorIdFromUrl, wpConfig, loadDashboardForId]);

    const handleFetchButtonClick = () => {
        const newVisitorId = visitorIdInput.trim();
        if (!wpConfig) {
            setErrorMessage("Dashboard is still initializing configuration. Please wait a moment or refresh.");
            return;
        }
        if (newVisitorId) {
            if (newVisitorId !== lastFetchedIdRef.current || appState === 'error' || appState === 'no_data_for_id') {
                router.push(`/dashboard?visitor_id=${newVisitorId}`, undefined, { shallow: false });
            }
        } else {
            setErrorMessage('Please enter a Visitor ID.');
            if (visitorIdFromUrl) {
                router.push(`/dashboard`, undefined, { shallow: false });
            } else {
                setNocoData(null); setAppState('ready'); lastFetchedIdRef.current = null;
            }
        }
    };
    const handleInputChange = (e) => { setVisitorIdInput(e.target.value); };
    const handleKeyPress = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchButtonClick(); }};

    // --- Derived Data for Rendering (from nocoData) ---
    const firstName = nocoData?.first_name || 'Valued Lead';
    const companyName = nocoData?.company_short || 'Your Company';
    const companyLogo = nocoData?.logo_url;
    const companyWebsite = nocoData?.website_url;
    const fromAbstract = nocoData?.from_abstract || 'achieving key strategic objectives';
    const usp = nocoData?.company_usp;
    const overviewShort = nocoData?.company_overview_short;
    const founderBio = nocoData?.founder_bio_snippet;
    const keyChallengeOpportunity = nocoData?.key_challenge_or_opportunity;
    const coreServicesListString = nocoData?.core_services_list;
    const deepResearchMd = nocoData?.deep_reaserach; // Ensure this name matches NocoDB field
    const dynamicKpisString = nocoData?.kpi_data;

    let coreServices = [];
    if (coreServicesListString) { try { coreServices = JSON.parse(coreServicesListString); } catch (e) { console.warn("Could not parse core services list:", e); } }

    let kpisToShow = [
        { label: "Strategic Alignment", value: "High", target: "With MakerToo's Open-Source Focus", icon: "dashicons-admin-links", color: "var(--accent-purple)" },
        { label: "Innovation Potential", value: "Significant", target: "Via Custom AI/Automation", icon: "dashicons-lightbulb", color: "var(--accent-blue)" },
        { label: "Data Control", value: "Total", target: "Through Private Infrastructure", icon: "dashicons-lock", color: "var(--accent-green)" },
        { label: "Future Scalability", value: "Assured", target: "With Flexible Tech Stacks", icon: "dashicons-backup", color: "var(--accent-pink)" },
    ];
    if (dynamicKpisString) { try { const parsed = JSON.parse(dynamicKpisString); if(Array.isArray(parsed) && parsed.length > 0) kpisToShow = parsed; } catch(e) { console.warn("Could not parse KPI data:", e); } }

    const chartOptions = chartColorsRef.current ? getChartJsDefaultOptions(chartColorsRef.current) : {};
    const doughnutChartOptions = chartColorsRef.current ? { ...chartOptions, cutout: '60%', plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins?.legend, position: 'bottom' } } } : {};
    const illustrativeRevenueData = chartColorsRef.current ? { labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Next Q (Proj.)'], datasets: [{ label: 'Potential Revenue Growth', data: [50, 65, 80, 75, 95], borderColor: chartColorsRef.current.primary, backgroundColor: `rgba(${chartColorsRef.current.accentGreenRgb}, 0.15)`, tension: 0.3, fill: true, pointBackgroundColor: chartColorsRef.current.primary, pointBorderColor: chartColorsRef.current.tooltipText, pointHoverBackgroundColor: chartColorsRef.current.tooltipText, pointHoverBorderColor: chartColorsRef.current.primary }] } : {labels:[], datasets:[]};
    const illustrativeEfficiencyData = chartColorsRef.current ? { labels: ['Manual', 'Phase 1 Auto.', 'Phase 2 AI Opt.'], datasets: [{ label: 'Task Processing Time (Hours)', data: [100, 60, 30], backgroundColor: `rgba(${chartColorsRef.current.accentBlueRgb}, 0.7)`, borderColor: `rgb(${chartColorsRef.current.accentBlueRgb})`, borderWidth: 1, borderRadius: 4,}] } : {labels:[], datasets:[]};
    const illustrativeProjectCompletionData = chartColorsRef.current ? { labels: ['On Track', 'At Risk (Mitigated)', 'New Initiatives'], datasets: [{ label: 'Project Status Distribution', data: [70, 15, 15], backgroundColor: [`rgb(${chartColorsRef.current.accentGreenRgb})`, `rgba(${chartColorsRef.current.accentBlueRgb}, 0.7)`, `rgba(${chartColorsRef.current.accentPinkRrgb}, 0.6)`], hoverOffset: 8, borderColor: chartColorsRef.current.tooltipBg || '#10151B', borderWidth: 2 }] } : {labels:[], datasets:[]};

    let statusMessage = 'Enter a Visitor ID to begin.';
    if (appState === 'initializing' || appState === 'initializing_config') statusMessage = 'Initializing dashboard services...';
    else if (appState === 'loading') statusMessage = `Fetching personalized insights for ID: ${escapeHtml(visitorIdInput) || '...'} `;
    else if (appState === 'error') statusMessage = errorMessage;
    else if (appState === 'no_data_for_id') statusMessage = errorMessage;
    else if (appState === 'data_loaded' && nocoData) statusMessage = `Showing personalized data for: ${escapeHtml(firstName)} from ${escapeHtml(companyName)}`;

    return (
        <>
            <Head>
                <title>{`MakerToo Dashboard - ${appState === 'data_loaded' && nocoData ? `${escapeHtml(firstName)} @ ${escapeHtml(companyName)}` : (visitorIdInput ? 'Loading...' : 'Welcome')}`}</title>
                <meta name="description" content={`Personalized dashboard insights ${appState === 'data_loaded' && nocoData ? `for ${escapeHtml(companyName)}` : 'by MakerToo'}. Unlock your AI and Automation advantage.`} />
                <meta name="robots" content="noindex, nofollow" />
                <link rel="icon" href="/favicon.ico" /> {/* ACTION: Update to your actual favicon path in /public */}
            </Head>

            <main id="primary" className="site-main personalized-dashboard-page-area">
                <div className="personalized-dashboard-container">
                    <header className="dashboard-header">
                         {appState === 'data_loaded' && nocoData ? (
                             <>
                                <h1>
                                    <span className="dashicons dashicons-admin-users"></span>
                                    Welcome, <span>{escapeHtml(firstName)}{companyName !== 'Your Company' ? ` from ${escapeHtml(companyName)}` : ''}</span>!
                                </h1>
                                <p className="lead">This dashboard highlights how MakerToo can assist {escapeHtml(companyName)} in <strong>{escapeHtml(fromAbstract)}</strong>.</p>
                                <p>Explore below for tailored insights and our detailed research.</p>
                            </>
                        ) : (appState === 'loading' || appState === 'initializing' || appState === 'initializing_config') ? (
                            <><h1><span className="dashicons dashicons-update"></span>Loading Dashboard...</h1><p className="lead" style={{ color: 'var(--text-secondary)' }}>Crafting your personalized experience...</p></>
                        ) : (appState === 'error' || appState === 'no_data_for_id') ? (
                             <>
                                <h1><span className="dashicons dashicons-warning" style={{color: 'var(--accent-pink)'}}></span>Attention Required</h1>
                                <p>{errorMessage || "An issue occurred preventing data load."}</p>
                                <p>Please double-check the Visitor ID or try refreshing. If the problem persists, the link may be invalid or you can contact support.</p>
                            </>
                        ) : ( // Ready state
                            <>
                                <h1><span className="dashicons dashicons-admin-home"></span>Welcome to Your Personalized Dashboard!</h1>
                                <p className="lead">Please enter your unique Visitor ID above to unlock tailored insights.</p>
                            </>
                        )}
                    </header>

                    <section className="visitor-input-area">
                        <input type="text" id="visitorIdInput" placeholder="Enter Your Visitor ID" value={visitorIdInput} onChange={handleInputChange} onKeyPress={handleKeyPress} disabled={appState === 'loading' || appState === 'initializing' || appState === 'initializing_config' || !wpConfig} aria-label="Visitor ID Input"/>
                        <button id="fetchDataButton" className="button button-primary" onClick={handleFetchButtonClick} disabled={appState === 'loading' || appState === 'initializing' || appState === 'initializing_config' || !wpConfig}>
                            <span className="dashicons dashicons-unlock"></span>Unlock Insights
                        </button>
                        <p id="currentVisitorStatus" className="visitor-status-message">{statusMessage}</p>
                    </section>

                    {(appState === 'loading' || appState === 'initializing_config') && (
                        <div className="dashboard-section card" style={{ textAlign: 'center', padding: '40px 20px', margin: '20px 0' }}>
                            <div style={{display: 'flex', justifyContent: 'center', marginBottom: '20px'}}>
                                <ClipLoader
                                    color={"var(--accent-green)"}
                                    loading={true}
                                    size={50}
                                    aria-label="Loading Spinner"
                                    data-testid="loader"
                                />
                            </div>
                            <p style={{ fontSize: '1.1em', color: 'var(--text-secondary)' }}>
                                {appState === 'initializing_config' ? 'Initializing dashboard services...' : 'Crafting your personalized experience...'}
                            </p>
                        </div>
                    )}

                    {appState === 'data_loaded' && nocoData && (
                        <div id="dashboard-content-wrapper" className="fade-in-content">
                            <section id="briefing-section" className="dashboard-section card">
                                <h2 className="section-title">
                                    <span className="dashicons dashicons-testimonial"></span> {/* Icon color purple from CSS */}
                                    Understanding {escapeHtml(companyName)}
                                </h2>
                                {companyLogo && companyLogo.startsWith('http') && (
                                    <div className="company-logo-container">
                                       <a href={companyWebsite && companyWebsite.startsWith('http') ? escapeHtml(companyWebsite) : '#'} target="_blank" rel="noopener noreferrer" title={`${escapeHtml(companyName)} Website`}>
                                            <img src={escapeHtml(companyLogo)} alt={`${escapeHtml(companyName)} Logo`} className="company-logo" />
                                        </a>
                                    </div>
                                )}
                                {overviewShort && <><h3 className="subsection-title">Company Snapshot</h3><p>{escapeHtml(overviewShort)}</p></>}
                                {usp && <><h3 className="subsection-title">Unique Selling Proposition</h3><p>{escapeHtml(usp)}</p></>}
                                {founderBio && <><h3 className="subsection-title">About the Leadership</h3><p>{escapeHtml(founderBio)}</p></>}
                            </section>

                            {keyChallengeOpportunity && (
                                <section id="key-focus-section" className="dashboard-section card">
                                    <h2 className="section-title">
                                        <span className="dashicons dashicons-admin-generic"></span> {/* Icon color green from CSS */}
                                        Strategic Focus for {escapeHtml(companyName)}
                                    </h2>
                                    <h3 className="subsection-title">Identified Key Area:</h3>
                                    <p style={{fontSize: "1.05em", fontWeight: "500", color: "var(--text-primary)"}}>{escapeHtml(keyChallengeOpportunity)}</p>
                                    <h3 className="subsection-title">How MakerToo Addresses This:</h3>
                                    <p>MakerToo specializes in crafting bespoke AI and automation solutions, leveraging open-source technology to provide data sovereignty and drive measurable results. We can help {escapeHtml(companyName)} directly tackle this key area by:</p>
                                    <ul className="styled-list">
                                        <li>Developing tailored automation to streamline relevant processes, freeing up resources for strategic growth.</li>
                                        <li>Implementing AI-driven insights to inform strategy and enhance decision-making around this specific challenge or opportunity.</li>
                                        <li>Building robust, scalable open-source backends that give you full control over the data crucial to capitalizing on this area.</li>
                                    </ul>
                                </section>
                            )}

                            {coreServices && coreServices.length > 0 && (
                                <section id="growth-opportunities-section" className="dashboard-section card">
                                    <h2 className="section-title">
                                        <span className="dashicons dashicons-awards"></span> {/* Icon color blue from CSS */}
                                        Leveraging Your Strengths
                                    </h2>
                                    <p>Based on {escapeHtml(companyName)}'s core services in <strong>{coreServices.map(s => escapeHtml(s)).join(', ')}</strong>, MakerToo can partner with you to:</p>
                                    <ul className="styled-list">
                                        <li><strong>Amplify Service Impact:</strong> Integrate custom AI tools to enhance the delivery and effectiveness of your core offerings.</li>
                                        <li><strong>Boost Operational Efficiency:</strong> Streamline backend workflows related to these services using n8n automation and efficient open-source databases.</li>
                                        <li><strong>Unlock New Service Potential:</strong> Utilize your existing data (with full data sovereignty) to identify and develop new, AI-augmented service lines.</li>
                                    </ul>
                                </section>
                            )}
                            
                             <section id="kpi-section" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-performance"></span>Projected Impact with MakerToo</h2>
                                <div className="kpi-cards-container">
                                    {kpisToShow.map((kpi, index) => (
                                       <div key={index} className="kpi-card" style={kpi.color ? {borderLeftColor: kpi.color} : {}}>
                                           <div className="kpi-label">
                                                {kpi.icon && <span className={`dashicons ${escapeHtml(kpi.icon)}`} style={kpi.color ? {color: kpi.color} : {}}></span>}
                                                {escapeHtml(kpi.label)}
                                            </div>
                                           <div className="kpi-value" style={kpi.color ? {color: kpi.color} : {}}>{escapeHtml(kpi.value)}{kpi.unit_suffix ? <span className="kpi-unit">{escapeHtml(kpi.unit_suffix)}</span> : ''}</div>
                                           {kpi.target && <div className="kpi-target"><small>{escapeHtml(kpi.target)}</small></div>}
                                       </div>
                                   ))}
                                </div>
                            </section>

                            <section id="analytics-overview" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-chart-area"></span>Illustrative Performance Projections</h2>
                                <p style={{textAlign: 'center', marginBottom: '30px', color: 'var(--text-secondary)'}}>Visualizing the potential impact of MakerToo's solutions for {escapeHtml(companyName)}. These are illustrative projections based on common outcomes.</p>
                                <div className="charts-grid">
                                    <div className="chart-container-wrapper">
                                        <h3 className="subsection-title chart-title"><span className="dashicons dashicons-chart-line"></span>Accelerated Revenue Trajectory</h3>
                                        <div className="chart-container" style={{ height: '300px' }}>{chartColorsRef.current && <Line options={chartOptions} data={illustrativeRevenueData} />}</div>
                                    </div>
                                    <div className="chart-container-wrapper">
                                        <h3 className="subsection-title chart-title"><span className="dashicons dashicons-controls-fastforward"></span>Enhanced Operational Efficiency</h3>
                                        <div className="chart-container" style={{ height: '300px' }}>{chartColorsRef.current && <Bar options={chartOptions} data={illustrativeEfficiencyData} />}</div>
                                    </div>
                                </div>
                                <div className="chart-container-wrapper" style={{ marginTop: '40px' }}>
                                    <h3 className="subsection-title chart-title"><span className="dashicons dashicons-filter"></span>Strategic Initiative Focus</h3>
                                    <div className="chart-container" style={{ height: '320px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>
                                        {chartColorsRef.current && <Doughnut options={doughnutChartOptions} data={illustrativeProjectCompletionData} />}
                                    </div>
                                </div>
                            </section>

                            {deepResearchMd && (
                                <section id="full-research-section" className="dashboard-section card">
                                    <h2 className="section-title"><span className="dashicons dashicons-book-alt"></span>Dive Deeper: Full Research for {escapeHtml(companyName)}</h2>
                                    <p>The following is the detailed research report compiled to understand {escapeHtml(companyName)}'s unique market position and opportunities. This research underpins the strategies we propose.</p>
                                    <div id="deep-research-accordion" className="accordion">
                                        <div className="accordion-item">
                                            <button
                                               className="accordion-button"
                                               onClick={() => setIsResearchAccordionOpen(!isResearchAccordionOpen)}
                                               aria-expanded={isResearchAccordionOpen}
                                               aria-controls="deep-research-content-panel"
                                            >
                                               {isResearchAccordionOpen ? 'Hide Full Research Report' : 'View Full Research Report'}
                                               <span className={`dashicons ${isResearchAccordionOpen ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'}`}></span>
                                            </button>
                                            <div
                                               id="deep-research-content-panel"
                                               className={`accordion-content ${isResearchAccordionOpen ? 'open' : ''}`}
                                               dangerouslySetInnerHTML={renderMarkdownForHTML(deepResearchMd)}
                                            ></div>
                                       </div>
                                   </div>
                                </section>
                            )}

                             <section id="booking-section" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-calendar-alt"></span>Ready to Elevate {escapeHtml(companyName)}, {escapeHtml(firstName)}?</h2>
                                <p>Let's schedule a complimentary strategy session to discuss how MakerToo can architect and implement these AI & Automation solutions, tailored specifically for your goals.</p>
                                <div id="booking-widget-container" className="booking-widget">
                                    {wpConfig && wpConfig.bookingLink && !wpConfig.bookingLink.includes("YOUR_") && !wpConfig.bookingLink.includes("page-slug") && !wpConfig.bookingLink.includes("calendar-embed") ? (
                                        <iframe
                                            src={wpConfig.bookingLink}
                                            title={`Schedule a Consultation with MakerToo for ${escapeHtml(companyName)}`}
                                            loading="lazy"
                                            style={{ width: '100%', height: '700px', border: 'none', borderRadius: 'var(--border-radius-md)' }}/>
                                    ) : (
                                       <div className="booking-placeholder">
                                           <span className="dashicons dashicons-clock"></span>
                                           <p>Booking options are currently being finalized. Please check back shortly.</p>
                                           {/* ACTION: Replace with your actual contact email */}
                                           <p>Alternatively, please reply to the email you received, or contact us directly at <a href="mailto:hello@makertoo.com">hello@makertoo.com</a>.</p>
                                           { (wpConfig?.bookingLink && (wpConfig.bookingLink.includes("YOUR_") || wpConfig.bookingLink.includes("page-slug") || wpConfig.bookingLink.includes("calendar-embed")) ) && <p style={{fontSize: '0.8em', marginTop: '10px', color: 'var(--accent-pink)'}}>Admin Note: Booking link requires configuration.</p>}
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