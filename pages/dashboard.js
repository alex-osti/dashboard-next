// pages/dashboard.js
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import axios from 'axios';
import { marked } from 'marked';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
    BarElement, ArcElement, Title, Tooltip, Legend, Filler, Colors
} from 'chart.js';
import ClipLoader from "react-spinners/ClipLoader";

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement,
    ArcElement, Title, Tooltip, Legend, Filler, Colors
);

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL;
const LOG_PREFIX = "MAKERTOO_PAP_CLIENT: ";

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
    marked.setOptions({ breaks: true, gfm: true });
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
    console.log(LOG_PREFIX, "DashboardPage component rendering/re-rendering.");
    const router = useRouter();
    const { visitor_id: visitorIdFromUrl } = router.query;
    console.log(LOG_PREFIX, "Router query visitor_idFromUrl:", visitorIdFromUrl);

    const [wpConfig, setWpConfig] = useState(null);
    const [visitorIdInput, setVisitorIdInput] = useState('');
    const [nocoData, setNocoData] = useState(null);
    const [appState, setAppState] = useState('initializing');
    const [errorMessage, setErrorMessage] = useState('');
    const [isResearchAccordionOpen, setIsResearchAccordionOpen] = useState(false);

    const lastFetchedIdRef = useRef(null);
    const configFetchedRef = useRef(false);
    const chartColorsRef = useRef(null);

    useEffect(() => {
        console.log(LOG_PREFIX, "Setting chart colors from CSS variables.");
        chartColorsRef.current = getChartColorsFromCSSVariables();
    }, []);

    const fetchWpConfig = useCallback(async () => {
        console.log(LOG_PREFIX, "Attempting to fetch WP Config.");
        if (!WP_API_URL) {
            console.error(LOG_PREFIX, "CRITICAL - NEXT_PUBLIC_WP_API_URL not defined.");
            setErrorMessage("Dashboard Error: API URL configuration is missing. Please contact support.");
            setAppState('error'); return null;
        }
        setAppState('initializing_config');
        try {
            const configUrl = `${WP_API_URL}/wp-json/personalized-dashboard/v1/config`;
            console.log(LOG_PREFIX, "Fetching WP Config from:", configUrl);
            const response = await axios.get(configUrl);
            console.log(LOG_PREFIX, "WP Config response status:", response.status);
            console.log(LOG_PREFIX, "WP Config response data:", response.data);
            if (response.data && response.data.success && response.data.data) {
                console.log(LOG_PREFIX, "WP Config fetched successfully:", response.data.data);
                return response.data.data;
            }
            console.error(LOG_PREFIX, "Failed to fetch valid WP configuration. Response success was not true or data missing.", response.data);
            throw new Error(response.data?.data?.message || 'Failed to fetch valid WP configuration from server.');
        } catch (err) {
            console.error(LOG_PREFIX, "CRITICAL - Error during WP config fetch:", err.message);
            if (err.response) {
                console.error(LOG_PREFIX, "WP Config fetch error response data:", err.response.data);
                console.error(LOG_PREFIX, "WP Config fetch error response status:", err.response.status);
                console.error(LOG_PREFIX, "WP Config fetch error response headers:", err.response.headers);
            } else if (err.request) {
                console.error(LOG_PREFIX, "WP Config fetch error: No response received, request was:", err.request);
            }
            setErrorMessage(`Dashboard Error: Could not load configuration. ${err.message}`);
            setAppState('error'); return null;
        }
    }, []);

    const fetchVisitorData = useCallback(async (visitorId, currentWpConfig) => {
        console.log(LOG_PREFIX, "Attempting to fetch visitor data for ID:", visitorId);
        if (!currentWpConfig || !currentWpConfig.ajax_url || !currentWpConfig.nonce) {
            console.error(LOG_PREFIX, "Cannot fetch visitor data: WordPress ajax_url or nonce missing from wpConfig.", currentWpConfig);
            throw new Error("WordPress configuration for data fetching is missing from client.");
        }
        const formData = new FormData();
        formData.append('action', 'fetch_dashboard_data_proxy');
        formData.append('nonce', currentWpConfig.nonce);
        formData.append('visitor_id', visitorId);
        console.log(LOG_PREFIX, "Fetching NocoDB data via proxy:", currentWpConfig.ajax_url, "with nonce:", currentWpConfig.nonce);
        try {
            const response = await axios.post(currentWpConfig.ajax_url, formData);
            console.log(LOG_PREFIX, "NocoDB proxy response status:", response.status);
            console.log(LOG_PREFIX, "NocoDB proxy response data:", response.data);
            if (response.data && response.data.success) {
                console.log(LOG_PREFIX, "NocoDB data fetched successfully for ID:", visitorId, response.data.data);
                return response.data.data;
            }
            console.error(LOG_PREFIX, "NocoDB proxy fetch error (success not true or data missing):", response.data);
            throw new Error(response.data.data?.message || 'Failed to fetch NocoDB data (server indicated failure).');
        } catch (err) {
            console.error(LOG_PREFIX, "NocoDB proxy fetch EXCEPTION for ID:", visitorId, err.message);
             if (err.response) {
                console.error(LOG_PREFIX, "NocoDB proxy error response data:", err.response.data);
                console.error(LOG_PREFIX, "NocoDB proxy error response status:", err.response.status);
            }
            let specificMessage = 'An error occurred while fetching your personalized data.';
            if (err.response && err.response.data && err.response.data.data && err.response.data.data.message) {
                specificMessage = err.response.data.data.message;
            } else if (err.message) {
                specificMessage = err.message;
            }
            throw new Error(specificMessage);
        }
    }, []);

    const loadDashboardForId = useCallback(async (idToFetch, currentWpConfig) => {
        console.log(LOG_PREFIX, "loadDashboardForId called for ID:", idToFetch, "with wpConfig present:", !!currentWpConfig);
        if (!idToFetch) {
            setNocoData(null); setAppState('ready');
            console.log(LOG_PREFIX, "No ID to fetch, appState set to ready.");
            return;
        }
        if (!currentWpConfig) {
            console.warn(LOG_PREFIX, "loadDashboardForId called without wpConfig. Setting state to initializing_config.");
            setAppState('initializing_config'); // This state will show the loader
            setErrorMessage('Configuration loading... Please wait.'); // Informative message
            return;
        }
        setAppState('loading'); setErrorMessage('');
        console.log(LOG_PREFIX, "appState set to loading for ID:", idToFetch);
        try {
            const record = await fetchVisitorData(idToFetch, currentWpConfig);
            if (record && typeof record === 'object' && Object.keys(record).length > 0) {
                setNocoData(record); setAppState('data_loaded');
                console.log(LOG_PREFIX, "Data loaded for ID:", idToFetch, "appState set to data_loaded.");
            } else {
                setNocoData(null); setAppState('no_data_for_id');
                const msg = `No personalized insights found for Visitor ID: ${escapeHtml(idToFetch)}. Please verify the ID or contact us if this ID should be active.`;
                setErrorMessage(msg);
                console.log(LOG_PREFIX, msg, "appState set to no_data_for_id.");
            }
        } catch (err) {
            setNocoData(null); setAppState('error');
            setErrorMessage(err.message || `An unexpected error occurred while loading data.`);
            console.error(LOG_PREFIX, "Error in loadDashboardForId:", err.message, "appState set to error.");
        }
    }, [fetchVisitorData]);
    
    useEffect(() => {
        console.log(LOG_PREFIX, "Config Fetch Effect. Already fetched:", configFetchedRef.current, "WP_API_URL:", WP_API_URL);
        if (!configFetchedRef.current && WP_API_URL) {
            configFetchedRef.current = true;
            fetchWpConfig().then(loadedConfig => {
                if (loadedConfig) {
                    console.log(LOG_PREFIX, "WP Config successfully loaded in effect, now available.");
                    setWpConfig(loadedConfig);
                    if (visitorIdFromUrl && visitorIdFromUrl !== lastFetchedIdRef.current) {
                        console.log(LOG_PREFIX, "Config loaded, visitorIdFromUrl present and new. Fetching data for:", visitorIdFromUrl);
                        setVisitorIdInput(visitorIdFromUrl);
                        lastFetchedIdRef.current = visitorIdFromUrl;
                        loadDashboardForId(visitorIdFromUrl, loadedConfig);
                    } else if (!visitorIdFromUrl) {
                         console.log(LOG_PREFIX, "Config loaded, no visitorIdFromUrl. App ready.");
                        setAppState('ready');
                    }
                } else {
                    console.error(LOG_PREFIX, "fetchWpConfig in effect resolved but loadedConfig is null/false. App state should reflect error from fetchWpConfig.");
                }
            });
        } else if (!WP_API_URL && !configFetchedRef.current) { // Only run this check once if WP_API_URL is missing
            configFetchedRef.current = true; // Prevent re-running this specific error set
            console.error(LOG_PREFIX, "CRITICAL - NEXT_PUBLIC_WP_API_URL not defined on initial load.");
            setErrorMessage("Dashboard Error: API URL configuration is missing. Please contact support.");
            setAppState('error');
        }
    }, [fetchWpConfig, loadDashboardForId, visitorIdFromUrl]);

    useEffect(() => {
        console.log(LOG_PREFIX, "URL/wpConfig Change Effect. visitorIdFromUrl:", visitorIdFromUrl, "wpConfig ready:", !!wpConfig, "lastFetchedId:", lastFetchedIdRef.current);
        if (wpConfig && visitorIdFromUrl && visitorIdFromUrl !== lastFetchedIdRef.current) {
            console.log(LOG_PREFIX, "New visitorIdFromUrl detected with wpConfig. Fetching data for:", visitorIdFromUrl);
            setVisitorIdInput(visitorIdFromUrl);
            lastFetchedIdRef.current = visitorIdFromUrl;
            loadDashboardForId(visitorIdFromUrl, wpConfig);
        } else if (wpConfig && !visitorIdFromUrl && nocoData !== null) { 
            console.log(LOG_PREFIX, "visitorIdFromUrl removed. Resetting data and state.");
            setNocoData(null); setAppState('ready'); setVisitorIdInput('');
            lastFetchedIdRef.current = null;
        }
    }, [visitorIdFromUrl, wpConfig, loadDashboardForId, nocoData]);

    const handleFetchButtonClick = () => {
        const newVisitorId = visitorIdInput.trim();
        if (!wpConfig) {
            setErrorMessage("Dashboard is still initializing configuration. Please wait a moment or refresh.");
            // Consider setting appState to 'error' or a specific config error state if wpConfig isn't available
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
    
    let statusMessage = 'Enter a Visitor ID to begin.';
    if (appState === 'initializing' || appState === 'initializing_config') statusMessage = 'Initializing dashboard services...';
    else if (appState === 'loading') statusMessage = `Fetching personalized insights for ID: ${escapeHtml(visitorIdInput) || '...'} `;
    else if (appState === 'error') statusMessage = errorMessage;
    else if (appState === 'no_data_for_id') statusMessage = errorMessage;
    else if (appState === 'data_loaded' && nocoData) {
        const currentFirstName = nocoData.first_name || 'Valued Lead';
        const currentCompanyName = nocoData.organization_name || 'Your Company';
        statusMessage = `Showing personalized data for: ${escapeHtml(currentFirstName)} from ${escapeHtml(currentCompanyName)}`;
    }

    const pageTitle = `MakerToo Dashboard - ${ (appState === 'data_loaded' && nocoData) ? `${escapeHtml(nocoData.first_name || 'Lead')} @ ${escapeHtml(nocoData.organization_name || 'Company')}` : (visitorIdInput || visitorIdFromUrl ? 'Loading...' : 'Welcome')}`;
    const pageDescription = `Personalized dashboard insights ${ (appState === 'data_loaded' && nocoData) ? `for ${escapeHtml(nocoData.organization_name || 'Company')}` : 'by MakerToo'}.`;

    const chartOptions = chartColorsRef.current ? getChartJsDefaultOptions(chartColorsRef.current) : {};
    const doughnutChartOptions = chartColorsRef.current ? { ...chartOptions, cutout: '60%', plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins?.legend, position: 'bottom' } } } : {};
    const illustrativeRevenueData = chartColorsRef.current ? { labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Proj.'], datasets: [{ label: 'Revenue Growth', data: [50,65,80,75,95], borderColor: chartColorsRef.current.primary, backgroundColor: `rgba(${chartColorsRef.current.accentGreenRgb},0.15)`, fill: true, pointBackgroundColor: chartColorsRef.current.primary }] } : {labels:[], datasets:[]};
    const illustrativeEfficiencyData = chartColorsRef.current ? { labels: ['Manual', 'Auto.', 'AI Opt.'], datasets: [{ label: 'Task Time (Hrs)', data: [100,60,30], backgroundColor: `rgba(${chartColorsRef.current.accentBlueRgb},0.7)` }] } : {labels:[], datasets:[]};
    const illustrativeProjectCompletionData = chartColorsRef.current ? { labels: ['On Track', 'Mitigated', 'New'], datasets: [{ data: [70,15,15], backgroundColor: [`rgb(${chartColorsRef.current.accentGreenRgb})`, `rgba(${chartColorsRef.current.accentBlueRgb},0.7)`, `rgba(${chartColorsRef.current.accentPinkRgb},0.6)`], hoverOffset: 8, borderColor: chartColorsRef.current.tooltipBg || '#10151B' }] } : {labels:[], datasets:[]};

    return (
        <>
            <Head>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDescription} />
                <meta name="robots" content="noindex, nofollow" />
                <link rel="icon" href="/favicon.ico" /> {/* ACTION: Update to your actual favicon path in /public */}
            </Head>

            <main id="primary" className="site-main personalized-dashboard-page-area">
                <div className="personalized-dashboard-container">
                    <header className="dashboard-header">
                        {(() => {
                            if (appState === 'data_loaded' && nocoData) {
                                const headerFirstName = nocoData.first_name || 'Valued Lead';
                                const headerCompanyName = nocoData.organization_name;
                                const headerCompanyForGreeting = headerCompanyName || 'your company';
                                const headerFromAbstract = nocoData.from_abstract || 'achieving key strategic objectives';
                                return (
                                    <>
                                        <h1><span className="dashicons dashicons-admin-users"></span>Welcome {escapeHtml(headerFirstName)}{headerCompanyName ? ` from ${escapeHtml(headerCompanyName)}` : ''}!</h1>
                                        <p className="lead">This dashboard highlights how MakerToo can assist {escapeHtml(headerCompanyForGreeting)} in <strong>{escapeHtml(headerFromAbstract)}</strong>.</p>
                                        <p>Explore below for tailored insights and our detailed research.</p>
                                    </>
                                );
                            } else if (appState === 'loading' || appState === 'initializing' || appState === 'initializing_config') {
                                return <><h1><span className="dashicons dashicons-update"></span>Loading Dashboard...</h1><p className="lead" style={{ color: 'var(--text-secondary)' }}>{appState === 'initializing_config' ? 'Initializing dashboard services...' : 'Crafting your personalized experience...'}</p></>;
                            } else if (appState === 'error' || appState === 'no_data_for_id') {
                                return <><h1><span className="dashicons dashicons-warning" style={{color: 'var(--accent-pink)'}}></span>Attention Required</h1><p>{errorMessage || "An issue occurred."}</p><p>Please double-check the Visitor ID or try refreshing.</p></>;
                            } else { // Ready
                                return <><h1><span className="dashicons dashicons-admin-home"></span>Welcome to Your Personalized Dashboard!</h1><p className="lead">Please enter your unique Visitor ID above to unlock tailored insights.</p></>;
                            }
                        })()}
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
                                <ClipLoader color={"var(--accent-green)"} loading={true} size={50} aria-label="Loading Spinner" data-testid="loader" />
                            </div>
                            <p style={{ fontSize: '1.1em', color: 'var(--text-secondary)' }}>
                                {appState === 'initializing_config' ? 'Initializing dashboard services...' : 'Crafting your personalized experience...'}
                            </p>
                        </div>
                    )}

                    {appState === 'data_loaded' && nocoData && (
                        (() => {
                            const currentFirstName = nocoData.first_name || 'Valued Lead';
                            const currentCompanyName = nocoData.organization_name || 'Company';
                            const currentCompanyLogo = nocoData.organization_logo_url;
                            const currentCompanyWebsite = nocoData['organization/website_url']; // Uses bracket for slash
                            const currentUsp = nocoData.company_usp;
                            const currentOverviewShort = nocoData.company_overview_short;
                            const currentFounderBio = nocoData.founder_bio_snippet;
                            const currentKeyChallengeOpportunity = nocoData.key_challenge_or_opportunity;
                            const currentCoreServicesListString = nocoData.core_services_list;
                            const currentDeepResearchMd = nocoData.deep_reaserach;
                            const currentDynamicKpisString = nocoData.kpi_data;

                            let currentCoreServices = [];
                            if (currentCoreServicesListString) { try { currentCoreServices = JSON.parse(currentCoreServicesListString); } catch (e) { console.warn("Could not parse core services list:", e); } }
                            
                            let currentKpisToShow = [
                                { label: "Strategic Alignment", value: "High", target: "With MakerToo's Open-Source Focus", icon: "dashicons-admin-links", color: "var(--accent-purple)" },
                                { label: "Innovation Potential", value: "Significant", target: "Via Custom AI/Automation", icon: "dashicons-lightbulb", color: "var(--accent-blue)" },
                                { label: "Data Control", value: "Total", target: "Through Private Infrastructure", icon: "dashicons-lock", color: "var(--accent-green)" },
                                { label: "Future Scalability", value: "Assured", target: "With Flexible Tech Stacks", icon: "dashicons-backup", color: "var(--accent-pink)" },
                            ];
                            if (currentDynamicKpisString) { try { const parsed = JSON.parse(currentDynamicKpisString); if(Array.isArray(parsed) && parsed.length > 0) currentKpisToShow = parsed; } catch(e) { console.warn("Could not parse KPI data:", e); } }

                            return (
                                <div id="dashboard-content-wrapper" className="fade-in-content">
                                    <section id="briefing-section" className="dashboard-section card">
                                        <h2 className="section-title"><span className="dashicons dashicons-testimonial"></span>Understanding {escapeHtml(currentCompanyName)}</h2>
                                        {currentCompanyLogo && currentCompanyLogo.startsWith('http') && (
                                            <div className="company-logo-wrapper">
                                               <a href={currentCompanyWebsite && typeof currentCompanyWebsite === 'string' && currentCompanyWebsite.startsWith('http') ? escapeHtml(currentCompanyWebsite) : '#'} target="_blank" rel="noopener noreferrer" title={`${escapeHtml(currentCompanyName)} Website`} style={{ display: 'inline-block' }}>
                                                    <Image src={escapeHtml(currentCompanyLogo)} alt={`${escapeHtml(currentCompanyName)} Logo`} width={180} height={70} style={{ objectFit: 'contain', maxWidth: '180px', maxHeight: '70px', width: 'auto', height: 'auto', backgroundColor: '#ffffff', padding: '5px', borderRadius: 'var(--border-radius-sm)', boxShadow: 'var(--shadow-soft)' }}/>
                                                </a>
                                            </div>
                                        )}
                                        {currentOverviewShort && <><h3 className="subsection-title">Company Snapshot</h3><p>{escapeHtml(currentOverviewShort)}</p></>}
                                        {currentUsp && <><h3 className="subsection-title">Unique Selling Proposition</h3><p>{escapeHtml(currentUsp)}</p></>}
                                        {currentFounderBio && <><h3 className="subsection-title">About the Leadership</h3><p>{escapeHtml(currentFounderBio)}</p></>}
                                    </section>

                                    {currentKeyChallengeOpportunity && ( <section id="key-focus-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-admin-generic"></span>Strategic Focus for {escapeHtml(currentCompanyName)}</h2> <h3 className="subsection-title">Identified Key Area:</h3> <p style={{fontSize: "1.05em", fontWeight: "500", color: "var(--text-primary)"}}>{escapeHtml(currentKeyChallengeOpportunity)}</p> <h3 className="subsection-title">How MakerToo Addresses This:</h3> <p>MakerToo specializes... help {escapeHtml(currentCompanyName)} by:</p> <ul className="styled-list"><li>Developing tailored automation...</li><li>Implementing AI-driven insights...</li><li>Building robust... backends...</li></ul> </section> )}
                                    {currentCoreServices && currentCoreServices.length > 0 && ( <section id="growth-opportunities-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-awards"></span>Leveraging Your Strengths</h2> <p>Based on {escapeHtml(currentCompanyName)}'s core services in <strong>{currentCoreServices.map(s => escapeHtml(s)).join(', ')}</strong>, MakerToo can partner with you to:</p> <ul className="styled-list"><li><strong>Amplify Service Impact:</strong>...</li><li><strong>Boost Operational Efficiency:</strong>...</li><li><strong>Unlock New Service Potential:</strong>...</li></ul> </section> )}
                                    <section id="kpi-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-performance"></span>Projected Impact with MakerToo</h2> <div className="kpi-cards-container"> {currentKpisToShow.map((kpi, index) => ( <div key={index} className="kpi-card" style={kpi.color ? {borderLeftColor: kpi.color} : {}}> <div className="kpi-label"> {kpi.icon && <span className={`dashicons ${escapeHtml(kpi.icon)}`} style={kpi.color ? {color: kpi.color} : {}}></span>} {escapeHtml(kpi.label)} </div> <div className="kpi-value" style={kpi.color ? {color: kpi.color} : {}}>{escapeHtml(kpi.value)}{kpi.unit_suffix ? <span className="kpi-unit">{escapeHtml(kpi.unit_suffix)}</span> : ''}</div> {kpi.target && <div className="kpi-target"><small>{escapeHtml(kpi.target)}</small></div>} </div> ))} </div> </section>
                                    <section id="analytics-overview" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-chart-area"></span>Illustrative Performance Projections</h2> <p style={{textAlign: 'center', marginBottom: '30px', color: 'var(--text-secondary)'}}>Visualizing the potential impact ... for {escapeHtml(currentCompanyName)}.</p> <div className="charts-grid"> <div className="chart-container-wrapper"> <h3 className="subsection-title chart-title"><span className="dashicons dashicons-chart-line"></span>Accelerated Revenue Trajectory</h3> <div className="chart-container" style={{ height: '300px' }}>{chartColorsRef.current && <Line options={chartOptions} data={illustrativeRevenueData} />}</div> </div> <div className="chart-container-wrapper"> <h3 className="subsection-title chart-title"><span className="dashicons dashicons-controls-fastforward"></span>Enhanced Operational Efficiency</h3> <div className="chart-container" style={{ height: '300px' }}>{chartColorsRef.current && <Bar options={chartOptions} data={illustrativeEfficiencyData} />}</div> </div> </div> <div className="chart-container-wrapper" style={{ marginTop: '40px' }}> <h3 className="subsection-title chart-title"><span className="dashicons dashicons-filter"></span>Strategic Initiative Focus</h3> <div className="chart-container" style={{ height: '320px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}> {chartColorsRef.current && <Doughnut options={doughnutChartOptions} data={illustrativeProjectCompletionData} />}</div></div></section>
                                    {currentDeepResearchMd && ( <section id="full-research-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-book-alt"></span>Dive Deeper: Full Research for {escapeHtml(currentCompanyName)}</h2> <p>The following is the detailed research report...</p> <div id="deep-research-accordion" className="accordion"><div className="accordion-item"><button className="accordion-button" onClick={() => setIsResearchAccordionOpen(!isResearchAccordionOpen)} aria-expanded={isResearchAccordionOpen} aria-controls="deep-research-content-panel">{isResearchAccordionOpen ? 'Hide Full Research Report' : 'View Full Research Report'}<span className={`dashicons ${isResearchAccordionOpen ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'}`}></span></button><div id="deep-research-content-panel" className={`accordion-content ${isResearchAccordionOpen ? 'open' : ''}`} dangerouslySetInnerHTML={renderMarkdownForHTML(currentDeepResearchMd)}></div></div></div> </section> )}
                                    <section id="booking-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-calendar-alt"></span>Ready to Elevate {escapeHtml(currentCompanyName)}, {escapeHtml(currentFirstName)}?</h2> <p>Let's schedule a complimentary strategy session...</p> <div id="booking-widget-container" className="booking-widget">{ (wpConfig && wpConfig.bookingLink && !wpConfig.bookingLink.includes("YOUR_") && !wpConfig.bookingLink.includes("page-slug") && !wpConfig.bookingLink.includes("calendar-embed")) ? ( <iframe src={wpConfig.bookingLink} title={`Schedule a Consultation with MakerToo for ${escapeHtml(currentCompanyName)}`} loading="lazy" style={{ width: '100%', height: '700px', border: 'none', borderRadius: 'var(--border-radius-md)' }}/> ) : ( <div className="booking-placeholder"> <span className="dashicons dashicons-clock"></span> <p>Booking options are currently being finalized...</p> <p>Alternatively, ... contact us at <a href="mailto:hello@makertoo.com">hello@makertoo.com</a>.</p> { (wpConfig?.bookingLink && (wpConfig.bookingLink.includes("YOUR_") || wpConfig.bookingLink.includes("page-slug") || wpConfig.bookingLink.includes("calendar-embed")) ) && <p style={{fontSize: '0.8em', marginTop: '10px', color: 'var(--accent-pink)'}}>Admin Note: Booking link requires configuration.</p>} </div> )} </div> </section>
                                </div>
                            );
                        })() 
                    )}
                </div>
            </main>
        </>
    );
}