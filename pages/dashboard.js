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
import ClipLoader from "react-spinners/ClipLoader"; // This was correct

ChartJS.register(
    CategoryScale, LinearScale, PointElement, LineElement, BarElement,
    ArcElement, Title, Tooltip, Legend, Filler, Colors
);

const WP_API_URL = process.env.NEXT_PUBLIC_WP_API_URL;
const LOG_PREFIX = "MAKERTOO_PAP_V_FINAL_REFINED: ";

// --- Helper Functions --- (Keep your working versions of these)
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

const getChartColorsFromCSSVariables = () => { /* ... (Keep your working version that reads from CSS vars) ... */ };
const getChartJsDefaultOptions = (chartColors) => { /* ... (Keep your working version) ... */ };

export default function DashboardPage() {
    console.log(LOG_PREFIX, "DashboardPage rendering/re-rendering.");
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

    useEffect(() => { chartColorsRef.current = getChartColorsFromCSSVariables(); }, []);

    // --- Data Fetching Callbacks (Keep the robust versions with logging) ---
    const fetchWpConfig = useCallback(async () => { /* ... (Full implementation from previous "complete code with logging") ... */ }, []);
    const fetchVisitorData = useCallback(async (visitorId, currentWpConfig) => { /* ... (Full implementation from previous "complete code with logging") ... */ }, []);
    const loadDashboardForId = useCallback(async (idToFetch, currentWpConfig) => { /* ... (Full implementation from previous "complete code with logging") ... */ }, [fetchVisitorData]);
    
    useEffect(() => { /* ... Initial Config Fetch Effect (with logging) ... */ }, [fetchWpConfig, loadDashboardForId, visitorIdFromUrl]);
    useEffect(() => { /* ... Subsequent Data Fetch Effect (with logging) ... */ }, [visitorIdFromUrl, wpConfig, loadDashboardForId, nocoData]);

    const handleFetchButtonClick = () => { /* ... (Full implementation from previous "complete code with logging") ... */ };
    const handleInputChange = (e) => { setVisitorIdInput(e.target.value); };
    const handleKeyPress = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchButtonClick(); }};
    
    let statusMessage = 'Enter a Visitor ID to begin.';
    // ... (statusMessage logic based on appState, nocoData.first_name, nocoData.company_short, nocoData.organization_name) ...
    // (Use the version from the last "COMPLETE code with logging" which correctly prioritizes company_short for this message)

    const pageTitle = `MakerToo Dashboard - ${ (appState === 'data_loaded' && nocoData) ? `${escapeHtml(nocoData.first_name || 'Lead')} @ ${escapeHtml(nocoData.company_short || nocoData.organization_name || 'Company')}` : (visitorIdInput || visitorIdFromUrl ? 'Loading...' : 'Welcome')}`;
    const pageDescription = `Personalized dashboard insights ${ (appState === 'data_loaded' && nocoData) ? `for ${escapeHtml(nocoData.company_short || nocoData.organization_name || 'Company')}` : 'by MakerToo'}.`;

    const chartOptions = chartColorsRef.current ? getChartJsDefaultOptions(chartColorsRef.current) : {};
    const doughnutChartOptions = chartColorsRef.current ? { /* ... */ } : {};
    const illustrativeRevenueData = chartColorsRef.current ? { /* ... */ } : {labels:[], datasets:[]};
    const illustrativeEfficiencyData = chartColorsRef.current ? { /* ... */ } : {labels:[], datasets:[]};
    const illustrativeProjectCompletionData = chartColorsRef.current ? { /* ... */ } : {labels:[], datasets:[]};

    return (
        <>
            <Head>
                <title>{pageTitle}</title>
                <meta name="description" content={pageDescription} />
                <meta name="robots" content="noindex, nofollow" />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <main id="primary" className="site-main personalized-dashboard-page-area">
                <div className="personalized-dashboard-container">
                    <header className="dashboard-header">
                        {(() => { // IIFE for header content
                            if (appState === 'data_loaded' && nocoData) {
                                const headerFirstName = nocoData.first_name || 'Valued Lead';
                                // CORRECTED: Prioritize company_short for the main display name
                                const headerDisplayCompanyName = nocoData.company_short || nocoData.organization_name; 
                                const headerCompanyForGreetingParagraph = headerDisplayCompanyName || 'your company'; // Fallback for the paragraph
                                const headerFromAbstract = nocoData.from_abstract || 'achieving key strategic objectives';
                                return (
                                    <>
                                        <h1>
                                            <span className="dashicons dashicons-admin-users"></span>
                                            {/* CORRECTED GREETING: No comma after Welcome */}
                                            Welcome {escapeHtml(headerFirstName)}
                                            {headerDisplayCompanyName ? ` from ${escapeHtml(headerDisplayCompanyName)}` : ''}!
                                        </h1>
                                        <p className="lead">This dashboard highlights how MakerToo can assist {escapeHtml(headerCompanyForGreetingParagraph)} in <strong>{escapeHtml(headerFromAbstract)}</strong>.</p>
                                        <p>Explore below for tailored insights and our detailed research.</p>
                                    </>
                                );
                            } else if (appState === 'loading' || appState === 'initializing' || appState === 'initializing_config') {
                                return <><h1><span className="dashicons dashicons-update"></span>Loading Dashboard...</h1><p className="lead" style={{ color: 'var(--text-secondary)' }}>{appState === 'initializing_config' ? 'Initializing dashboard services...' : 'Crafting your personalized experience...'}</p></>;
                            } else if (appState === 'error' || appState === 'no_data_for_id') {
                                return <><h1><span className="dashicons dashicons-warning" style={{color: 'var(--accent-pink)'}}></span>Attention Required</h1><p className="lead" style={{color: 'var(--accent-pink)'}}>{errorMessage || "An issue occurred."}</p><p>Please double-check the Visitor ID or try refreshing.</p></>;
                            } else { // Ready state
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
                                {statusMessage}
                            </p>
                        </div>
                    )}

                    {appState === 'data_loaded' && nocoData && (
                        (() => {
                            // Define all 'current...' variables using nocoData here,
                            // PRIORITIZING company_short for display names.
                            const currentFirstName = nocoData.first_name || 'Valued Lead';
                            const currentCompanyNameForDisplay = nocoData.company_short || nocoData.organization_name || 'Company';
                            const currentCompanyLogo = nocoData.organization_logo_url;
                            const currentCompanyWebsite = nocoData['organization/website_url']; // Bracket for slash
                            const currentUsp = nocoData.company_usp;
                            const currentOverviewShort = nocoData.company_overview_short;
                            const currentFounderBio = nocoData.founder_bio_snippet;
                            const currentKeyChallengeOpportunity = nocoData.key_challenge_or_opportunity;
                            const currentCoreServicesListString = nocoData.core_services_list;
                            const currentDeepResearchMd = nocoData.deep_reaserach; 
                            const currentDynamicKpisString = nocoData.kpi_data;

                            let currentCoreServices = []; /* ... parsing ... */
                            let currentKpisToShow = [ /* ... defaults ... */ ]; /* ... parsing ... */
                             if (currentCoreServicesListString) { try { currentCoreServices = JSON.parse(currentCoreServicesListString); } catch (e) { console.warn("Could not parse core services list:", e); } }
                            if (currentDynamicKpisString) { try { const parsed = JSON.parse(currentDynamicKpisString); if(Array.isArray(parsed) && parsed.length > 0) currentKpisToShow = parsed; } catch(e) { console.warn("Could not parse KPI data:", e); } }


                            // --- PASTE THE FULL JSX FOR ALL SECTIONS BELOW ---
                            // (Briefing, Key Focus, Growth Opps, KPIs, Charts, Research, Booking)
                            // Ensure they use the `current...` variables defined above.
                            // This is the JSX from the response that starts "Okay, this is excellent! We're in the refinement stage..."
                            // Specifically, the large block within the final IIFE.
                            return (
                                <div id="dashboard-content-wrapper" className="fade-in-content">
                                    {/* Briefing Section (Uses currentCompanyNameForDisplay) */}
                                    <section id="briefing-section" className="dashboard-section card">
                                        <h2 className="section-title"><span className="dashicons dashicons-testimonial"></span>Understanding {escapeHtml(currentCompanyNameForDisplay)}</h2>
                                        {currentCompanyLogo && currentCompanyLogo.startsWith('http') && ( <div className="company-logo-wrapper"> <a href={currentCompanyWebsite && typeof currentCompanyWebsite === 'string' && currentCompanyWebsite.startsWith('http') ? escapeHtml(currentCompanyWebsite) : '#'} target="_blank" rel="noopener noreferrer" title={`${escapeHtml(currentCompanyNameForDisplay)} Website`} style={{ display: 'inline-block' }}> <Image src={escapeHtml(currentCompanyLogo)} alt={`${escapeHtml(currentCompanyNameForDisplay)} Logo`} width={180} height={70} style={{ objectFit: 'contain', maxWidth: '180px', maxHeight: '70px', width: 'auto', height: 'auto', backgroundColor: '#ffffff', padding: '5px', borderRadius: 'var(--border-radius-sm)', boxShadow: 'var(--shadow-soft)' }}/> </a> </div> )}
                                        {currentOverviewShort && <><h3 className="subsection-title">Company Snapshot</h3><p>{escapeHtml(currentOverviewShort)}</p></>}
                                        {currentUsp && <><h3 className="subsection-title">Unique Selling Proposition</h3><p>{escapeHtml(currentUsp)}</p></>}
                                        {currentFounderBio && <><h3 className="subsection-title">About the Leadership</h3><p>{escapeHtml(currentFounderBio)}</p></>}
                                    </section>

                                    {/* Key Focus Section (Uses currentCompanyNameForDisplay) */}
                                    {currentKeyChallengeOpportunity && ( <section id="key-focus-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-admin-generic"></span>Strategic Focus for {escapeHtml(currentCompanyNameForDisplay)}</h2> <h3 className="subsection-title">Identified Key Area:</h3> <p style={{fontSize: "1.05em", fontWeight: "500", color: "var(--text-primary)"}}>{escapeHtml(currentKeyChallengeOpportunity)}</p> <h3 className="subsection-title">How MakerToo Addresses This:</h3> <p>MakerToo specializes... help {escapeHtml(currentCompanyNameForDisplay)} by:</p> <ul className="styled-list"><li>Developing tailored automation...</li><li>Implementing AI-driven insights...</li><li>Building robust... backends...</li></ul> </section> )}
                                    
                                    {/* Growth Opportunities (Uses currentCompanyNameForDisplay) */}
                                    {currentCoreServices && currentCoreServices.length > 0 && ( <section id="growth-opportunities-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-awards"></span>Leveraging Your Strengths</h2> <p>Based on {escapeHtml(currentCompanyNameForDisplay)}'s core services in <strong>{currentCoreServices.map(s => escapeHtml(s)).join(', ')}</strong>, MakerToo can partner with you to:</p> <ul className="styled-list"><li><strong>Amplify Service Impact:</strong>...</li><li><strong>Boost Operational Efficiency:</strong>...</li><li><strong>Unlock New Service Potential:</strong>...</li></ul> </section> )}
                                    
                                    {/* KPIs Section */}
                                    <section id="kpi-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-performance"></span>Projected Impact with MakerToo</h2> <div className="kpi-cards-container"> {currentKpisToShow.map((kpi, index) => ( <div key={index} className="kpi-card" style={kpi.color ? {borderLeftColor: kpi.color} : {}}> <div className="kpi-label"> {kpi.icon && <span className={`dashicons ${escapeHtml(kpi.icon)}`} style={kpi.color ? {color: kpi.color} : {}}></span>} {escapeHtml(kpi.label)} </div> <div className="kpi-value" style={kpi.color ? {color: kpi.color} : {}}>{escapeHtml(kpi.value)}{kpi.unit_suffix ? <span className="kpi-unit">{escapeHtml(kpi.unit_suffix)}</span> : ''}</div> {kpi.target && <div className="kpi-target"><small>{escapeHtml(kpi.target)}</small></div>} </div> ))} </div> </section>
                                    
                                    {/* Analytics/Charts (Uses currentCompanyNameForDisplay) */}
                                    <section id="analytics-overview" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-chart-area"></span>Illustrative Performance Projections</h2> <p style={{textAlign: 'center', marginBottom: '30px', color: 'var(--text-secondary)'}}>Visualizing the potential impact ... for {escapeHtml(currentCompanyNameForDisplay)}.</p> <div className="charts-grid"> <div className="chart-container-wrapper"> <h3 className="subsection-title chart-title"><span className="dashicons dashicons-chart-line"></span>Accelerated Revenue Trajectory</h3> <div className="chart-container" style={{ height: '300px' }}>{chartColorsRef.current && <Line options={chartOptions} data={illustrativeRevenueData} />}</div> </div> <div className="chart-container-wrapper"> <h3 className="subsection-title chart-title"><span className="dashicons dashicons-controls-fastforward"></span>Enhanced Operational Efficiency</h3> <div className="chart-container" style={{ height: '300px' }}>{chartColorsRef.current && <Bar options={chartOptions} data={illustrativeEfficiencyData} />}</div> </div> </div> <div className="chart-container-wrapper" style={{ marginTop: '40px' }}> <h3 className="subsection-title chart-title"><span className="dashicons dashicons-filter"></span>Strategic Initiative Focus</h3> <div className="chart-container" style={{ height: '320px', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}> {chartColorsRef.current && <Doughnut options={doughnutChartOptions} data={illustrativeProjectCompletionData} />}</div></div></section>
                                    
                                    {/* Deep Research (Uses currentCompanyNameForDisplay) */}
                                    {currentDeepResearchMd && ( <section id="full-research-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-book-alt"></span>Dive Deeper: Full Research for {escapeHtml(currentCompanyNameForDisplay)}</h2> <p>The following is the detailed research report...</p> <div id="deep-research-accordion" className="accordion"><div className="accordion-item"><button className="accordion-button" onClick={() => setIsResearchAccordionOpen(!isResearchAccordionOpen)} aria-expanded={isResearchAccordionOpen} aria-controls="deep-research-content-panel">{isResearchAccordionOpen ? 'Hide Full Research Report' : 'View Full Research Report'}<span className={`dashicons ${isResearchAccordionOpen ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'}`}></span></button><div id="deep-research-content-panel" className={`accordion-content ${isResearchAccordionOpen ? 'open' : ''}`} dangerouslySetInnerHTML={renderMarkdownForHTML(currentDeepResearchMd)}></div></div></div> </section> )}
                                    
                                    {/* Booking (Uses currentCompanyNameForDisplay and currentFirstName) */}
                                    <section id="booking-section" className="dashboard-section card"> <h2 className="section-title"><span className="dashicons dashicons-calendar-alt"></span>Ready to Elevate {escapeHtml(currentCompanyNameForDisplay)}, {escapeHtml(currentFirstName)}?</h2> <p>Let's schedule a complimentary strategy session...</p> <div id="booking-widget-container" className="booking-widget">{ (wpConfig && wpConfig.bookingLink && !wpConfig.bookingLink.includes("YOUR_") && !wpConfig.bookingLink.includes("page-slug") && !wpConfig.bookingLink.includes("calendar-embed")) ? ( <iframe src={wpConfig.bookingLink} title={`Schedule a Consultation with MakerToo for ${escapeHtml(currentCompanyNameForDisplay)}`} loading="lazy" style={{ width: '100%', height: '700px', border: 'none', borderRadius: 'var(--border-radius-md)' }}/> ) : ( <div className="booking-placeholder"> <span className="dashicons dashicons-clock"></span> <p>Booking options are currently being finalized...</p> <p>Alternatively, ... contact us at <a href="mailto:hello@makertoo.com">hello@makertoo.com</a>.</p> { (wpConfig?.bookingLink && (wpConfig.bookingLink.includes("YOUR_") || wpConfig.bookingLink.includes("page-slug") || wpConfig.bookingLink.includes("calendar-embed")) ) && <p style={{fontSize: '0.8em', marginTop: '10px', color: 'var(--accent-pink)'}}>Admin Note: Booking link requires configuration.</p>} </div> )} </div> </section>
                                </div>
                            );
                        })() 
                    )}
                </div>
            </main>
        </>
    );
}