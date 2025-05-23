// pages/dashboard.js (DRASTICALLY SIMPLIFIED FOR DEBUGGING)
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
// Not importing Image, marked, charts, or ClipLoader for now to minimize variables

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL;
const LOG_PREFIX = "MAKERTOO_PAP_DEBUG: ";

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
    console.log(LOG_PREFIX, "DashboardPage component rendering/re-rendering.");
    const router = useRouter();
    const { visitor_id: visitorIdFromUrl } = router.query;
    console.log(LOG_PREFIX, "Router query visitor_idFromUrl:", visitorIdFromUrl);

    const [wpConfig, setWpConfig] = useState(null);
    const [visitorIdInput, setVisitorIdInput] = useState('');
    const [nocoData, setNocoData] = useState(null);
    const [appState, setAppState] = useState('initializing'); // 'initializing', 'initializing_config', 'ready', 'loading', 'data_loaded', 'no_data_for_id', 'error'
    const [errorMessage, setErrorMessage] = useState('');

    const lastFetchedIdRef = useRef(null);
    const configFetchedRef = useRef(false);

    const fetchWpConfig = useCallback(async () => {
        console.log(LOG_PREFIX, "Attempting to fetch WP Config.");
        if (!WP_API_URL) {
            console.error(LOG_PREFIX, "CRITICAL - NEXT_PUBLIC_WP_API_URL not defined.");
            setErrorMessage("Dashboard Error: API URL configuration is missing.");
            setAppState('error'); return null;
        }
        setAppState('initializing_config');
        try {
            const configUrl = `${WP_API_URL}/wp-json/personalized-dashboard/v1/config`;
            console.log(LOG_PREFIX, "Fetching WP Config from:", configUrl);
            const response = await axios.get(configUrl);
            console.log(LOG_PREFIX, "WP Config response status:", response.status, "data:", response.data);
            if (response.data && response.data.success && response.data.data) {
                console.log(LOG_PREFIX, "WP Config fetched successfully.");
                return response.data.data;
            }
            console.error(LOG_PREFIX, "Failed to fetch valid WP configuration.", response.data);
            throw new Error(response.data?.data?.message || 'Failed to fetch valid WP config from server.');
        } catch (err) {
            console.error(LOG_PREFIX, "CRITICAL - Error during WP config fetch:", err.message, err.response || err.request || err);
            setErrorMessage(`Dashboard Error: Could not load configuration. ${err.message}`);
            setAppState('error'); return null;
        }
    }, []);

    const fetchVisitorData = useCallback(async (visitorId, currentWpConfig) => {
        console.log(LOG_PREFIX, "Attempting to fetch visitor data for ID:", visitorId);
        if (!currentWpConfig || !currentWpConfig.ajax_url || !currentWpConfig.nonce) {
            console.error(LOG_PREFIX, "Cannot fetch visitor data: WordPress ajax_url or nonce missing.", currentWpConfig);
            throw new Error("WordPress configuration for data fetching is missing from client.");
        }
        const formData = new FormData();
        formData.append('action', 'fetch_dashboard_data_proxy');
        formData.append('nonce', currentWpConfig.nonce);
        formData.append('visitor_id', visitorId);
        console.log(LOG_PREFIX, "Fetching NocoDB data via proxy:", currentWpConfig.ajax_url);
        try {
            const response = await axios.post(currentWpConfig.ajax_url, formData);
            console.log(LOG_PREFIX, "NocoDB proxy response status:", response.status, "data:", response.data);
            if (response.data && response.data.success) {
                console.log(LOG_PREFIX, "NocoDB data fetched successfully for ID:", visitorId);
                return response.data.data;
            }
            console.error(LOG_PREFIX, "NocoDB proxy fetch error (success not true or data missing):", response.data);
            throw new Error(response.data.data?.message || 'Failed to fetch NocoDB data (server indicated failure).');
        } catch (err) {
            console.error(LOG_PREFIX, "NocoDB proxy fetch EXCEPTION for ID:", visitorId, err.message, err.response || err.request || err);
            let specificMessage = 'An error occurred while fetching your personalized data.'; /* ... error refinement ... */
            throw new Error(specificMessage);
        }
    }, []);

    const loadDashboardForId = useCallback(async (idToFetch, currentWpConfig) => {
        console.log(LOG_PREFIX, "loadDashboardForId called for ID:", idToFetch, "with wpConfig present:", !!currentWpConfig);
        if (!idToFetch) { setNocoData(null); setAppState('ready'); console.log(LOG_PREFIX, "No ID, appState ready."); return; }
        if (!currentWpConfig) { setAppState('initializing_config'); setErrorMessage('Config loading...'); console.warn(LOG_PREFIX, "loadDashboardForId: no wpConfig."); return; }
        setAppState('loading'); setErrorMessage(''); console.log(LOG_PREFIX, "appState loading for ID:", idToFetch);
        try {
            const record = await fetchVisitorData(idToFetch, currentWpConfig);
            if (record && typeof record === 'object' && Object.keys(record).length > 0) {
                setNocoData(record); setAppState('data_loaded'); console.log(LOG_PREFIX, "Data loaded for ID:", idToFetch);
            } else {
                setNocoData(null); setAppState('no_data_for_id');
                const msg = `No insights found for Visitor ID: ${escapeHtml(idToFetch)}. Verify ID.`;
                setErrorMessage(msg); console.log(LOG_PREFIX, msg);
            }
        } catch (err) {
            setNocoData(null); setAppState('error');
            setErrorMessage(err.message || `Unexpected error loading data.`);
            console.error(LOG_PREFIX, "Error in loadDashboardForId:", err.message);
        }
    }, [fetchVisitorData]);
    
    useEffect(() => {
        console.log(LOG_PREFIX, "Config Fetch Effect. Fetched:", configFetchedRef.current, "API URL:", WP_API_URL);
        if (!configFetchedRef.current && WP_API_URL) {
            configFetchedRef.current = true;
            fetchWpConfig().then(loadedConfig => {
                if (loadedConfig) {
                    console.log(LOG_PREFIX, "WP Config loaded successfully in effect.");
                    setWpConfig(loadedConfig);
                    if (visitorIdFromUrl && visitorIdFromUrl !== lastFetchedIdRef.current) {
                        console.log(LOG_PREFIX, "Config loaded, new visitorIdFromUrl. Fetching data for:", visitorIdFromUrl);
                        setVisitorIdInput(visitorIdFromUrl);
                        lastFetchedIdRef.current = visitorIdFromUrl;
                        loadDashboardForId(visitorIdFromUrl, loadedConfig);
                    } else if (!visitorIdFromUrl) {
                        console.log(LOG_PREFIX, "Config loaded, no visitorIdFromUrl. App ready.");
                        setAppState('ready');
                    }
                } else { console.error(LOG_PREFIX, "fetchWpConfig resolved but no loadedConfig."); }
            });
        } else if (!WP_API_URL && !configFetchedRef.current) {
            configFetchedRef.current = true; console.error(LOG_PREFIX, "CRITICAL - WP_API_URL missing on mount.");
            setErrorMessage("Dashboard Error: API URL configuration missing."); setAppState('error');
        }
    }, [fetchWpConfig, loadDashboardForId, visitorIdFromUrl]);

    useEffect(() => {
        console.log(LOG_PREFIX, "URL/wpConfig Change Effect. visitorId:", visitorIdFromUrl, "wpConfig:", !!wpConfig, "lastFetchedId:", lastFetchedIdRef.current);
        if (wpConfig && visitorIdFromUrl && visitorIdFromUrl !== lastFetchedIdRef.current) {
            console.log(LOG_PREFIX, "New visitorIdFromUrl with wpConfig. Fetching data for:", visitorIdFromUrl);
            setVisitorIdInput(visitorIdFromUrl);
            lastFetchedIdRef.current = visitorIdFromUrl;
            loadDashboardForId(visitorIdFromUrl, wpConfig);
        } else if (wpConfig && !visitorIdFromUrl && nocoData !== null) {
            console.log(LOG_PREFIX, "visitorIdFromUrl removed. Resetting UI.");
            setNocoData(null); setAppState('ready'); setVisitorIdInput(''); lastFetchedIdRef.current = null;
        }
    }, [visitorIdFromUrl, wpConfig, loadDashboardForId, nocoData]);

    const handleFetchButtonClick = () => {
        const newVisitorId = visitorIdInput.trim();
        if (!wpConfig) { setErrorMessage("Dashboard initializing. Please wait."); return; }
        if (newVisitorId) {
            if (newVisitorId !== lastFetchedIdRef.current || appState === 'error' || appState === 'no_data_for_id') {
                router.push(`/dashboard?visitor_id=${newVisitorId}`, undefined, { shallow: false });
            }
        } else {
            setErrorMessage('Please enter a Visitor ID.');
            if (visitorIdFromUrl) { router.push(`/dashboard`, undefined, { shallow: false }); }
            else { setNocoData(null); setAppState('ready'); lastFetchedIdRef.current = null; }
        }
    };
    const handleInputChange = (e) => { setVisitorIdInput(e.target.value); };
    const handleKeyPress = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchButtonClick(); }};
    
    // Simplified status message logic
    let currentDisplayStatus = 'Enter a Visitor ID to begin.';
    if (appState === 'initializing' || appState === 'initializing_config') {
        currentDisplayStatus = 'Initializing dashboard services...';
    } else if (appState === 'loading') {
        currentDisplayStatus = `Fetching personalized insights for ID: ${escapeHtml(visitorIdInput) || '...'} `;
    } else if (appState === 'error') {
        currentDisplayStatus = errorMessage;
    } else if (appState === 'no_data_for_id') {
        currentDisplayStatus = errorMessage;
    } else if (appState === 'data_loaded' && nocoData) {
        const fName = nocoData.first_name || 'Valued Lead';
        const cName = nocoData.company_short || nocoData.organization_name || 'Your Company';
        currentDisplayStatus = `Showing personalized data for: ${escapeHtml(fName)} from ${escapeHtml(cName)}`;
    }

    return (
        <>
            <Head>
                <title>
                    {`MakerToo Dashboard - ${ (appState === 'data_loaded' && nocoData) ? 
                        `${escapeHtml(nocoData.first_name || 'Lead')} @ ${escapeHtml(nocoData.company_short || nocoData.organization_name || 'Company')}` : 
                        ( (visitorIdInput || visitorIdFromUrl) && (appState === 'loading' || appState === 'initializing_config') ? 'Loading...' : 'Welcome')}`}
                </title>
                <meta name="description" content={`Personalized dashboard insights by MakerToo.`} />
                <meta name="robots" content="noindex, nofollow" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main id="primary" className="site-main personalized-dashboard-page-area">
                <div className="personalized-dashboard-container">
                    <header className="dashboard-header">
                        {(() => {
                            if (appState === 'data_loaded' && nocoData) {
                                const headerFirstName = nocoData.first_name || 'Valued Lead';
                                const headerDisplayCompanyName = nocoData.company_short || nocoData.organization_name;
                                const headerCompanyForGreeting = headerDisplayCompanyName || 'your company';
                                const headerFromAbstract = nocoData.from_abstract || 'achieving key strategic objectives';
                                return (
                                    <>
                                        <h1>
                                            <span className="dashicons dashicons-admin-users"></span>
                                            Welcome {escapeHtml(headerFirstName)}
                                            {headerDisplayCompanyName ? ` from ${escapeHtml(headerDisplayCompanyName)}` : ''}!
                                        </h1>
                                        <p className="lead">This dashboard highlights how MakerToo can assist {escapeHtml(headerCompanyForGreeting)} in <strong>{escapeHtml(headerFromAbstract)}</strong>.</p>
                                        <p>Explore below for tailored insights.</p>
                                    </>
                                );
                            } else if (appState === 'loading' || appState === 'initializing' || appState === 'initializing_config') {
                                return <><h1><span className="dashicons dashicons-update"></span>Loading Dashboard...</h1><p className="lead" style={{ color: 'var(--text-secondary)' }}>{appState === 'initializing_config' ? 'Initializing dashboard services...' : 'Crafting your personalized experience...'}</p></>;
                            } else if (appState === 'error') { // Specific error display
                                return <><h1><span className="dashicons dashicons-warning" style={{color: 'var(--accent-pink)'}}></span>Dashboard Error</h1><p className="lead" style={{color: 'var(--accent-pink)'}}>{errorMessage || "Could not load configuration from server."}</p><p>Please try again later or contact support.</p></>;
                            } else if (appState === 'no_data_for_id') {
                                 return <><h1><span className="dashicons dashicons-info-outline" style={{color: 'var(--accent-blue)'}}></span>Insights Not Found</h1><p className="lead">{errorMessage}</p><p>Please verify the Visitor ID.</p></>;
                            }
                             else { // Ready state
                                return <><h1><span className="dashicons dashicons-admin-home"></span>Welcome to Your Personalized Dashboard!</h1><p className="lead">Please enter your unique Visitor ID above to unlock tailored insights.</p></>;
                            }
                        })()}
                    </header>

                    <section className="visitor-input-area">
                        <input type="text" id="visitorIdInput" placeholder="Enter Your Visitor ID" value={visitorIdInput} onChange={handleInputChange} onKeyPress={handleKeyPress} disabled={appState === 'loading' || appState === 'initializing' || appState === 'initializing_config' || !wpConfig} aria-label="Visitor ID Input"/>
                        <button id="fetchDataButton" className="button button-primary" onClick={handleFetchButtonClick} disabled={appState === 'loading' || appState === 'initializing' || appState === 'initializing_config' || !wpConfig}>
                            <span className="dashicons dashicons-unlock"></span>Unlock Insights
                        </button>
                        <p id="currentVisitorStatus" className="visitor-status-message">{currentDisplayStatus}</p>
                    </section>

                    {(appState === 'loading' || appState === 'initializing_config') && (
                        <div className="dashboard-section card" style={{ textAlign: 'center', padding: '40px 20px', margin: '20px 0' }}>
                            <div style={{display: 'flex', justifyContent: 'center', marginBottom: '20px'}}>
                                <ClipLoader color={"var(--accent-green)"} loading={true} size={50} aria-label="Loading Spinner" data-testid="loader" />
                            </div>
                            <p style={{ fontSize: '1.1em', color: 'var(--text-secondary)' }}>
                                {statusMessage} {/* Use the centrally managed statusMessage */}
                            </p>
                        </div>
                    )}

                    {appState === 'data_loaded' && nocoData && (
                        <div id="dashboard-content-wrapper" className="fade-in-content">
                            <section className="dashboard-section card">
                                <h2 className="section-title">
                                    <span className="dashicons dashicons-testimonial"></span>
                                    Understanding {escapeHtml(nocoData.company_short || nocoData.organization_name || 'Company')}
                                </h2>
                                <p><strong>Company USP:</strong> {escapeHtml(nocoData.company_usp || 'Not available.')}</p>
                                <p><strong>Overview:</strong> {escapeHtml(nocoData.company_overview_short || 'Not available.')}</p>
                                {/* Add more simple text displays here later if this works */}
                            </section>
                            
                            <section className="dashboard-section card">
                                <h2 className="section-title">Raw Data (Debug)</h2>
                                <pre style={{whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxHeight: '300px', overflowY: 'auto', background: '#000', padding: '10px', borderRadius: '5px'}}>
                                    {JSON.stringify(nocoData, null, 2)}
                                </pre>
                            </section>
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}