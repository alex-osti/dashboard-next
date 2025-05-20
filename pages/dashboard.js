// pages/dashboard.js (Simplified - No Charts, Adjusted Field Names & Booking Height)
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { marked } from 'marked'; // For rendering markdown

// Helper to get base URL for WordPress API (ensure .env.local has NEXT_PUBLIC_WP_API_URL)
const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL;

// Helper to escape HTML
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

// --- Main Dashboard Component ---
export default function DashboardPage() {
    const router = useRouter();
    const { visitor_id: visitorIdFromUrl } = router.query;

    // --- State Variables ---
    const [wpConfig, setWpConfig] = useState(null);
    const [visitorIdInput, setVisitorIdInput] = useState('');
    const [currentNocoRecord, setCurrentNocoRecord] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showNoDataMessage, setShowNoDataMessage] = useState(true);
    const [currentStatusMessage, setCurrentStatusMessage] = useState('Enter a Visitor ID to begin.');
    const [isAccordionOpen, setIsAccordionOpen] = useState(false);

    const lastFetchedIdRef = useRef(null);
    const configFetchedRef = useRef(false);

    // --- Data Fetching Logic ---
    const fetchVisitorDataViaProxy = useCallback(async (visitorId) => {
        if (!wpConfig || !wpConfig.ajax_url || !wpConfig.nonce) {
            throw new Error("WordPress configuration (ajax_url or nonce) is missing.");
        }
        console.log("PDS_NEXT_DEBUG: fetchVisitorDataViaProxy - visitorId:", visitorId, "Nonce:", wpConfig.nonce);
        const formData = new FormData();
        formData.append('action', 'fetch_dashboard_data_proxy');
        formData.append('nonce', wpConfig.nonce);
        formData.append('visitor_id', visitorId);
        try {
            const response = await axios.post(wpConfig.ajax_url, formData);
            if (response.data.success) {
                console.log("PDS_NEXT_DEBUG: Proxy fetch success. Record:", response.data.data);
                return response.data.data;
            } else {
                console.error("PDS_NEXT_DEBUG: Proxy fetch error (success:false):", response.data.data);
                throw new Error(response.data.data?.message || 'Failed to fetch data via proxy (server indicated failure).');
            }
        } catch (err) { /* ... (keep existing detailed error handling for fetchVisitorDataViaProxy) ... */ 
            console.error('PDS_NEXT_DEBUG: Proxy fetch EXCEPTION:', err);
            let errorMessage = 'An error occurred while fetching data.';
            if (err.response) {
                errorMessage = `Server error (${err.response.status}). `;
                if (err.response.data && err.response.data.data && err.response.data.data.message) {
                    errorMessage += err.response.data.data.message;
                } else if (typeof err.response.data === 'string' && err.response.data.includes("Nonce verification failed")) {
                     errorMessage += "Security check failed (Nonce). Please try again.";
                }
            } else if (err.request) {
                errorMessage = 'No response from server. Check network or WordPress backend connectivity.';
            } else {
                errorMessage = err.message || errorMessage;
            }
            throw new Error(errorMessage);
        }
    }, [wpConfig]);

    const fetchAndRenderDashboard = useCallback(async (visitorIdToFetch) => {
        if (!visitorIdToFetch) {
            console.log("PDS_NEXT_DEBUG: fetchAndRenderDashboard called with no visitorIdToFetch. Aborting.");
            setCurrentNocoRecord(null); setError(null); setShowNoDataMessage(true);
            setCurrentStatusMessage("Please enter a Visitor ID."); setIsLoading(false); lastFetchedIdRef.current = null;
            return;
        }
        console.log("PDS_NEXT_DEBUG: fetchAndRenderDashboard CALLED for visitorId:", visitorIdToFetch);
        setIsLoading(true); setError(null); setShowNoDataMessage(false);
        setCurrentStatusMessage(`Fetching data for ID: ${visitorIdToFetch}...`);
        try {
            if (!wpConfig || !wpConfig.useAjaxProxy) throw new Error("WordPress configuration error.");
            const record = await fetchVisitorDataViaProxy(visitorIdToFetch);
            if (record && typeof record === 'object' && Object.keys(record).length > 0) {
                console.log("PDS_NEXT_DEBUG: Record fetched for ID", visitorIdToFetch, ":", record);
                setCurrentNocoRecord(record);
                // Use exact field names from NocoDB/CSV for display names
                const dn = record.first_name || 'Valued Lead'; // from CSV
                const cn = record['organization/name'] || 'Your Company'; // from CSV, use bracket for slash
                setCurrentStatusMessage(`Showing data for: ${dn} from ${cn}`);
                setShowNoDataMessage(false);
            } else {
                console.warn("PDS_NEXT_DEBUG: No data for ID:", visitorIdToFetch);
                setError(`No data found for Visitor ID: ${visitorIdToFetch}.`);
                setCurrentNocoRecord(null); setShowNoDataMessage(true);
            }
        } catch (err) {
            console.error('PDS_NEXT_DEBUG: Error in fetchAndRenderDashboard for ID', visitorIdToFetch, ':', err);
            setError(err.message || `Error loading data.`);
            setCurrentNocoRecord(null); setShowNoDataMessage(true);
        } finally {
            setIsLoading(false);
        }
    }, [wpConfig, fetchVisitorDataViaProxy]);

    // --- Effects ---
    useEffect(() => { // Config Fetch Effect
        console.log("PDS_NEXT_DEBUG: Config fetch EFFECT. Fetched flag:", configFetchedRef.current);
        if (!configFetchedRef.current && WP_API_URL) {
            configFetchedRef.current = true;
            const fetchWpConfig = async () => {
                console.log("PDS_NEXT_DEBUG: Attempting to fetch WP Config from:", `${WP_API_URL}/wp-json/personalized-dashboard/v1/config`);
                try {
                    const response = await axios.get(`${WP_API_URL}/wp-json/personalized-dashboard/v1/config`);
                    if (response.data && response.data.success) {
                        setWpConfig(response.data.data);
                        console.log("PDS_NEXT_DEBUG: WP Config fetched successfully:", response.data.data);
                    } else { throw new Error(response.data?.data?.message || 'Failed to fetch WP configuration.'); }
                } catch (err) { console.error("PDS_NEXT_DEBUG: CRITICAL - Error fetching WP config:", err); setError(`Dashboard Error: No config. ${err.message}`);}
            };
            fetchWpConfig();
        } else if (!WP_API_URL) { console.error("PDS_NEXT_DEBUG: CRITICAL - WP_API_URL not defined."); setError("Dashboard Error: API URL missing.");}
    }, []);

    useEffect(() => { // Data Fetch Trigger Effect
        console.log("PDS_NEXT_DEBUG: Data fetch trigger EFFECT. visitorIdFromUrl:", visitorIdFromUrl, "wpConfig:", !!wpConfig, "isLoading:", isLoading, "lastFetchedId:", lastFetchedIdRef.current);
        if (wpConfig) {
            if (visitorIdFromUrl) {
                setVisitorIdInput(visitorIdFromUrl);
                if (!isLoading && visitorIdFromUrl !== lastFetchedIdRef.current) {
                    console.log("PDS_NEXT_DEBUG: Data fetch EFFECT - Fetching for new URL ID:", visitorIdFromUrl);
                    setCurrentNocoRecord(null); setError(null); lastFetchedIdRef.current = visitorIdFromUrl;
                    fetchAndRenderDashboard(visitorIdFromUrl);
                } else if (isLoading) { console.log("PDS_NEXT_DEBUG: Data fetch EFFECT - Currently loading. Skipping."); }
                else if (visitorIdFromUrl === lastFetchedIdRef.current) {
                    console.log("PDS_NEXT_DEBUG: Data fetch EFFECT - ID", visitorIdFromUrl, "is same. Updating UI status.");
                    if (currentNocoRecord && currentNocoRecord.Id === parseInt(visitorIdFromUrl, 10)) {
                        const dn = currentNocoRecord.first_name || 'Valued Lead'; // from CSV
                        const cn = currentNocoRecord['organization/name'] || 'Your Company'; // from CSV
                        setCurrentStatusMessage(`Showing data for: ${dn} from ${cn}`); setShowNoDataMessage(false);
                    } else if (error) { setCurrentStatusMessage(`Error loading data for ID: ${visitorIdFromUrl}.`); setShowNoDataMessage(true); }
                    else if (!currentNocoRecord) { setCurrentStatusMessage(`No data found for ID: ${visitorIdFromUrl}.`); setShowNoDataMessage(true); }
                }
            } else { // No visitorIdFromUrl
                console.log("PDS_NEXT_DEBUG: Data fetch EFFECT - No visitorIdFromUrl. Resetting.");
                setCurrentNocoRecord(null); setError(null); setShowNoDataMessage(true);
                setCurrentStatusMessage('Enter a Visitor ID to begin.'); setVisitorIdInput(''); lastFetchedIdRef.current = null;
            }
        }
    }, [visitorIdFromUrl, wpConfig, fetchAndRenderDashboard, isLoading, currentNocoRecord, error]);

    // --- Event Handlers ---
    const handleFetchButtonClick = () => {
        const newVisitorId = visitorIdInput.trim();
        if (newVisitorId) {
            console.log("PDS_NEXT_DEBUG: Fetch Button CLICKED for ID:", newVisitorId);
            if (newVisitorId !== visitorIdFromUrl || !currentNocoRecord || (currentNocoRecord && currentNocoRecord.Id !== parseInt(newVisitorId,10)) ) {
                lastFetchedIdRef.current = null; // Force fetch by useEffect if URL changes or allow direct fetch
                router.push(`/dashboard?visitor_id=${newVisitorId}`, undefined, { shallow: false });
            } else if (!isLoading) { // Same ID, not loading, allow re-fetch
                console.log("PDS_NEXT_DEBUG: Re-fetching same ID via button:", newVisitorId);
                lastFetchedIdRef.current = null;
                fetchAndRenderDashboard(newVisitorId);
            }
        } else { setError('Please enter a Visitor ID.'); setCurrentStatusMessage('Please enter a Visitor ID.'); setShowNoDataMessage(true); setCurrentNocoRecord(null); }
    };
    const handleInputChange = (e) => { setVisitorIdInput(e.target.value); };
    const handleKeyPress = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchButtonClick(); } };

    // --- Rendered Content Variables for JSX ---
    const hasData = currentNocoRecord && typeof currentNocoRecord === 'object' && Object.keys(currentNocoRecord).length > 0 && !isLoading && !error;
    
    // USE EXACT FIELD NAMES FROM YOUR NOCODB/CSV HERE
    const firstName = hasData ? (currentNocoRecord.first_name || 'Valued Lead') : 'Visitor';
    const companyNameFromAPI = hasData ? (currentNocoRecord['organization/name'] || currentNocoRecord.company_short) : null; // Try 'organization/name' then 'company_short'
    const companyName = companyNameFromAPI || (hasData ? 'Company' : 'Your Company');

    let personalizedGreetingHtml = '';
    if (!wpConfig && !error && !isLoading) { personalizedGreetingHtml = `<p>Loading configuration...</p>`; }
    else if (hasData) {
        const icebreakerText = currentNocoRecord.icebraker; // Match CSV typo
        const fromAbstractText = currentNocoRecord.from_abstract; // Match CSV
        if (icebreakerText) personalizedGreetingHtml += `<p class="lead">${escapeHtml(icebreakerText)}</p>`;
        if (fromAbstractText) personalizedGreetingHtml += `<p>We've prepared this brief because we believe MakerToo's unique approach can specifically help ${escapeHtml(companyName)} achieve ${escapeHtml(fromAbstractText)}.</p>`;
        if (!personalizedGreetingHtml && firstName !== 'Visitor') personalizedGreetingHtml = `<p>Personalized insights for ${escapeHtml(firstName)} from ${escapeHtml(companyName)}.</p>`;
        else if (!personalizedGreetingHtml) personalizedGreetingHtml = `<p>Welcome to your personalized dashboard.</p>`;
    } else if (isLoading) { personalizedGreetingHtml = `<p>Loading personalized insights for ID: ${visitorIdInput || visitorIdFromUrl || ''}...</p>`;}
    else if (error) { personalizedGreetingHtml = `<p>Could not load personalized greeting.</p>`;}
    else { personalizedGreetingHtml = `<p class="lead">Welcome!</p><p>Enter your Visitor ID.</p>`;}

    let companyAtAGlanceHtml = `<h3>About ${escapeHtml(companyName)}:</h3>`;
    if (hasData) {
        const usp = currentNocoRecord.extracted_company_profile_usp;
        const overview = currentNocoRecord.extracted_company_overview;
        const founderSummary = currentNocoRecord.extracted_founder_profile_summary;
        if (usp) companyAtAGlanceHtml += `<p><strong>Unique Selling Proposition:</strong> ${escapeHtml(usp)}</p>`;
        if (overview) companyAtAGlanceHtml += `<p><strong>Overview:</strong> ${escapeHtml(overview)}</p>`;
        if (founderSummary) companyAtAGlanceHtml += `<p><strong>Key Leadership:</strong> ${escapeHtml(founderSummary)}</p>`;
        if (!usp && !overview && !founderSummary) companyAtAGlanceHtml += `<p>Detailed company insights for ${escapeHtml(companyName)} will appear here.</p>`;
    } else if (!isLoading && !error) { companyAtAGlanceHtml += `<p>Company information will be displayed here.</p>`; }

    let growthOpportunitiesHtml = '';
    if (hasData && currentNocoRecord.structured_core_services) {
        try {
            const servicesArray = JSON.parse(currentNocoRecord.structured_core_services);
            if (Array.isArray(servicesArray) && servicesArray.length > 0) {
                growthOpportunitiesHtml = `<ul><li>Based on your focus on <strong>${servicesArray.map(s => escapeHtml(s)).join(', ')}</strong>, we see ways MakerToo can help:</li><li>Streamline Operations</li><li>Enhance Client Value</li><li>Scale Your Impact</li></ul>`;
            } else { growthOpportunitiesHtml = "<p>Core services analysis pending.</p>"; }
        } catch (e) { console.error("PDS_NEXT_DEBUG: Error parsing structured_core_services:", e); growthOpportunitiesHtml = "<p>Could not display opportunities.</p>";}
    } else if (!isLoading && !error) { growthOpportunitiesHtml = "<p>Specific growth opportunities will be highlighted.</p>";}

    let kpisToShow = [ /* Default KPIs */
        { label: "Potential ROI Boost", value: "XX%", target: "Through Automation", icon: "dashicons-chart-line" },
        { label: "Efficiency Gain", value: "XX%", target: "Via Streamlining", icon: "dashicons-admin-generic" },
    ];
    if (hasData && currentNocoRecord.kpi_data) { // Assuming kpi_data is a field in NocoDB
        try {
            const dynamicKpis = JSON.parse(currentNocoRecord.kpi_data);
            if (Array.isArray(dynamicKpis) && dynamicKpis.length > 0) kpisToShow = dynamicKpis;
        } catch (e) { console.warn("PDS_NEXT_DEBUG: Could not parse kpi_data.", e); }
    }

    let fullDeepResearchHtml = "<p>The full research report will be available here.</p>";
    if (hasData && currentNocoRecord.deep_reaserach) { // Match CSV typo 'deep_reaserach'
        try { fullDeepResearchHtml = marked.parse(currentNocoRecord.deep_reaserach); }
        catch (e) { console.error("PDS_NEXT_DEBUG: Error parsing markdown:", e); fullDeepResearchHtml = `<pre>${escapeHtml(currentNocoRecord.deep_reaserach)}</pre>`;}
    }
    
    const displayDashboardContent = hasData;

    // --- JSX ---
    return (
        <>
            <Head>
                 <title>{`Dashboard - ${hasData ? `${firstName} @ ${companyName}` : 'Welcome'}`}</title>
                <meta name="description" content={`Personalized insights for ${hasData ? companyName : 'visitors'}`} />
            </Head>

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
                        <input type="text" id="visitorIdInput" placeholder="Enter Visitor ID (e.g., 1)" value={visitorIdInput} onChange={handleInputChange} onKeyPress={handleKeyPress} disabled={isLoading || !wpConfig}/>
                        <button id="fetchDataButton" className="button button-primary" onClick={handleFetchButtonClick} disabled={isLoading || !wpConfig}>
                            <span className="dashicons dashicons-search" style={{ marginRight: '5px', verticalAlign: 'text-bottom' }}></span>Fetch Data
                        </button>
                        <p id="currentVisitorStatus" className="visitor-status-message">{currentStatusMessage}</p>
                    </div>

                    {isLoading && (
                        <div className="dashboard-section card" style={{ textAlign: 'center', padding: '30px 20px' }}>
                            <div className="loader" style={{ margin: '0 auto 15px auto', border: '5px solid var(--border-color)', borderTop: '5px solid var(--accent-green)', borderRadius: '50%', width: '40px', height: '40px', animation: 'spin 1s linear infinite' }}></div>
                            <p style={{ fontSize: '1.1em', color: 'var(--text-secondary)' }}>Loading insights...</p>
                        </div>
                    )}
                    {error && !isLoading && (<div className="dashboard-message error"><span className="dashicons dashicons-warning" style={{marginRight: '8px'}}></span>{error}</div>)}
                    {showNoDataMessage && !isLoading && !error && !hasData && (
                        <div className="dashboard-message info">
                            {!wpConfig ? <p>Loading configuration...</p> : <p>Please enter a valid Visitor ID.</p>}
                        </div>
                    )}

                    <div id="dashboard-content" style={{ display: displayDashboardContent ? 'block' : 'none' }}>
                        <section id="intro-insights-section" className="dashboard-section card">
                            <h2 className="section-title"><span className="dashicons dashicons-megaphone"></span>Your Personalized Briefing</h2>
                            <div id="company-at-a-glance" dangerouslySetInnerHTML={{ __html: companyAtAGlanceHtml }}></div>
                            <h3 className="subsection-title">Key Growth Opportunities with MakerToo:</h3>
                            <div id="growth-opportunities-list" dangerouslySetInnerHTML={{ __html: growthOpportunitiesHtml }}></div>
                        </section>

                        <section id="kpi-section" className="dashboard-section card">
                            <h2 className="section-title"><span className="dashicons dashicons-performance"></span>How We Can Impact Your Key Metrics</h2>
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
                            <h2 className="section-title"><span className="dashicons dashicons-chart-area"></span>Analytics Overview (Charts will be here)</h2>
                            <p>Chart data and visualizations will be added in a later step.</p>
                        </section>

                        <section id="full-research-section" className="dashboard-section card">
                            <h2 className="section-title"><span className="dashicons dashicons-book-alt"></span>Dive Deeper: Our Full Research on <span id="visitor-company-report-title">{companyName}</span></h2>
                            <p>The following is the detailed research report.</p>
                            <div id="deep-research-accordion" className="accordion">
                                <div className="accordion-item">
                                    <button className="accordion-header" aria-expanded={isAccordionOpen} onClick={() => setIsAccordionOpen(!isAccordionOpen)}>
                                        View Full Research Report
                                        <span className={`accordion-icon dashicons ${isAccordionOpen ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'}`}></span>
                                    </button>
                                    {isAccordionOpen && (
                                        <div className="accordion-content" role="region">
                                            <div id="full-deep-research-content" dangerouslySetInnerHTML={{ __html: fullDeepResearchHtml }}></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </section>

                        <section id="booking-section" className="dashboard-section card">
                            <h2 className="section-title"><span className="dashicons dashicons-calendar-alt"></span>Ready, <span id="visitor-name-cta">{firstName}</span>?</h2>
                            <p>Let&#39; discuss how MakerToo can help <span id="visitor-company-cta">{companyName}</span>.</p>
                            <div id="booking-widget-container" className="booking-widget">
                                {wpConfig && wpConfig.bookingLink && !wpConfig.bookingLink.includes("YOUR_") ? (
                                    <iframe src={wpConfig.bookingLink} title="Schedule a Consultation" loading="lazy" 
                                            style={{ width: '100%', height: '550px', /* Reduced height */ border: 'none', borderRadius: 'var(--border-radius-md)' }}/>
                                ) : (
                                    <div className="booking-placeholder" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', textAlign: 'center' }}>
                                        <span className="dashicons dashicons-clock" style={{ fontSize: '3em', marginBottom: '10px' }}></span>
                                        <p>Booking system unavailable.</p>
                                    </div>
                                )}
                            </div>
                        </section>
                    </div> {/* End #dashboard-content */}
                </div> {/* End .personalized-dashboard-container */}
            </main>
        </>
    );
}