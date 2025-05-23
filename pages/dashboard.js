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
const LOG_PREFIX = "MAKERTOO_PAP_CLIENT_V_FINAL: ";

// --- Helper Functions ---
function escapeHtml(unsafe) { /* ... (Keep your working escapeHtml function) ... */ }
const renderMarkdownForHTML = (markdownText) => { /* ... (Keep your working renderMarkdownForHTML function) ... */ };
const getChartColorsFromCSSVariables = () => { /* ... (Keep your working getChartColorsFromCSSVariables function) ... */ };
const getChartJsDefaultOptions = (chartColors) => { /* ... (Keep your working getChartJsDefaultOptions function) ... */ };

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

    useEffect(() => { chartColorsRef.current = getChartColorsFromCSSVariables(); }, []);

    const fetchWpConfig = useCallback(async () => { /* ... (Keep your working fetchWpConfig) ... */ }, []);
    const fetchVisitorData = useCallback(async (visitorId, currentWpConfig) => { /* ... (Keep your working fetchVisitorData) ... */ }, []);
    const loadDashboardForId = useCallback(async (idToFetch, currentWpConfig) => { /* ... (Keep your working loadDashboardForId) ... */ }, [fetchVisitorData]);
    
    useEffect(() => { /* ... Initial Config Fetch Effect (Keep working version) ... */ }, [fetchWpConfig, loadDashboardForId, visitorIdFromUrl]);
    useEffect(() => { /* ... Subsequent Data Fetch Effect (Keep working version) ... */ }, [visitorIdFromUrl, wpConfig, loadDashboardForId, nocoData]);

    const handleFetchButtonClick = () => { /* ... (Keep your working handleFetchButtonClick) ... */ };
    const handleInputChange = (e) => { setVisitorIdInput(e.target.value); };
    const handleKeyPress = (e) => { if (e.key === 'Enter') { e.preventDefault(); handleFetchButtonClick(); }};
    
    let statusMessage = 'Enter a Visitor ID to begin.';
    // ... (Keep your working statusMessage logic based on appState and nocoData) ...
    // Ensure this part uses nocoData.company_short if nocoData.organization_name is too long for this specific message
     if (appState === 'data_loaded' && nocoData) {
        const currentFirstName = nocoData.first_name || 'Valued Lead';
        // PRIORITIZE company_short for display if available, else organization_name
        const currentDisplayableCompanyName = nocoData.company_short || nocoData.organization_name || 'Your Company';
        statusMessage = `Showing personalized data for: ${escapeHtml(currentFirstName)} from ${escapeHtml(currentDisplayableCompanyName)}`;
    }


    const chartOptions = chartColorsRef.current ? getChartJsDefaultOptions(chartColorsRef.current) : {};
    const doughnutChartOptions = chartColorsRef.current ? { ...chartOptions, cutout: '60%', plugins: { ...chartOptions.plugins, legend: { ...chartOptions.plugins?.legend, position: 'bottom' } } } : {};
    const illustrativeRevenueData = chartColorsRef.current ? { /* ... same illustrative data ... */ } : {labels:[], datasets:[]};
    const illustrativeEfficiencyData = chartColorsRef.current ? { /* ... same illustrative data ... */ } : {labels:[], datasets:[]};
    const illustrativeProjectCompletionData = chartColorsRef.current ? { /* ... same illustrative data ... */ } : {labels:[], datasets:[]};

    const pageTitle = `MakerToo Dashboard - ${ (appState === 'data_loaded' && nocoData) ? `${escapeHtml(nocoData.first_name || 'Lead')} @ ${escapeHtml(nocoData.company_short || nocoData.organization_name || 'Company')}` : (visitorIdInput || visitorIdFromUrl ? 'Loading...' : 'Welcome')}`;
    const pageDescription = `Personalized dashboard insights ${ (appState === 'data_loaded' && nocoData) ? `for ${escapeHtml(nocoData.company_short || nocoData.organization_name || 'Company')}` : 'by MakerToo'}.`;

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
                        {(() => {
                            if (appState === 'data_loaded' && nocoData) {
                                const headerFirstName = nocoData.first_name || 'Valued Lead';
                                const headerDisplayCompanyName = nocoData.company_short || nocoData.organization_name; // Prioritize company_short
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
                         <div className="dashboard-section card" style={{ textAlign: 'center', padding: '40px 20px', margin: '20px 0' }}> <div style={{display: 'flex', justifyContent: 'center', marginBottom: '20px'}}> <ClipLoader color={"var(--accent-green)"} loading={true} size={50} aria-label="Loading Spinner" data-testid="loader" /> </div> <p style={{ fontSize: '1.1em', color: 'var(--text-secondary)' }}> {appState === 'initializing_config' ? 'Initializing dashboard services...' : 'Crafting your personalized experience...'} </p> </div>
                    )}

                    {appState === 'data_loaded' && nocoData && (
                        (() => {
                            const currentFirstName = nocoData.first_name || 'Valued Lead';
                            // PRIORITIZE company_short for display, fallback to organization_name
                            const currentCompanyNameForDisplay = nocoData.company_short || nocoData.organization_name || 'Company';
                            const currentCompanyLogo = nocoData.organization_logo_url;
                            const currentCompanyWebsite = nocoData['organization/website_url'];
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
                                        <h2 className="section-title">
                                            <span className="dashicons dashicons-testimonial"></span>
                                            Understanding {escapeHtml(currentCompanyNameForDisplay)}
                                        </h2>
                                        {currentCompanyLogo && currentCompanyLogo.startsWith('http') && (
                                            <div className="company-logo-wrapper">
                                               <a href={currentCompanyWebsite && typeof currentCompanyWebsite === 'string' && currentCompanyWebsite.startsWith('http') ? escapeHtml(currentCompanyWebsite) : '#'} target="_blank" rel="noopener noreferrer" title={`${escapeHtml(currentCompanyNameForDisplay)} Website`} style={{ display: 'inline-block' }}>
                                                    <Image src={escapeHtml(currentCompanyLogo)} alt={`${escapeHtml(currentCompanyNameForDisplay)} Logo`} width={180} height={70} style={{ objectFit: 'contain', maxWidth: '180px', maxHeight: '70px', width: 'auto', height: 'auto', backgroundColor: '#ffffff', padding: '5px', borderRadius: 'var(--border-radius-sm)', boxShadow: 'var(--shadow-soft)' }}/>
                                                </a>
                                            </div>
                                        )}
                                        {currentOverviewShort && <><h3 className="subsection-title">Company Snapshot</h3><p>{escapeHtml(currentOverviewShort)}</p></>}
                                        {currentUsp && <><h3 className="subsection-title">Unique Selling Proposition</h3><p>{escapeHtml(currentUsp)}</p></>}
                                        {currentFounderBio && <><h3 className="subsection-title">About the Leadership</h3><p>{escapeHtml(currentFounderBio)}</p></>}
                                    </section>

                                    {currentKeyChallengeOpportunity && (
                                        <section id="key-focus-section" className="dashboard-section card">
                                            <h2 className="section-title"><span className="dashicons dashicons-admin-generic"></span>Strategic Focus for {escapeHtml(currentCompanyNameForDisplay)}</h2>
                                            <h3 className="subsection-title">Identified Key Area:</h3>
                                            <p style={{fontSize: "1.05em", fontWeight: "500", color: "var(--text-primary)"}}>{escapeHtml(currentKeyChallengeOpportunity)}</p>
                                            <h3 className="subsection-title">How MakerToo Addresses This:</h3>
                                            <p>MakerToo specializes in crafting bespoke AI and automation solutions, leveraging open-source technology to provide data sovereignty and drive measurable results. We can help {escapeHtml(currentCompanyNameForDisplay)} directly tackle this key area by:</p>
                                            <ul className="styled-list">
                                                <li>Developing tailored automation to streamline relevant processes, freeing up resources for strategic growth.</li>
                                                <li>Implementing AI-driven insights to inform strategy and enhance decision-making around this specific challenge or opportunity.</li>
                                                <li>Building robust, scalable open-source backends that give you full control over the data crucial to capitalizing on this area.</li>
                                            </ul>
                                        </section>
                                    )}

                                    {currentCoreServices && currentCoreServices.length > 0 && (
                                        <section id="growth-opportunities-section" className="dashboard-section card">
                                            <h2 className="section-title"><span className="dashicons dashicons-awards"></span>Leveraging Your Strengths</h2>
                                            <p>Based on {escapeHtml(currentCompanyNameForDisplay)}'s core services in <strong>{currentCoreServices.map(s => escapeHtml(s)).join(', ')}</strong>, MakerToo can partner with you to:</p>
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
                                            {currentKpisToShow.map((kpi, index) => (
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
                                        <p style={{textAlign: 'center', marginBottom: '30px', color: 'var(--text-secondary)'}}>Visualizing the potential impact of MakerToo's solutions for {escapeHtml(currentCompanyNameForDisplay)}. These are illustrative projections based on common outcomes.</p>
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

                                    {currentDeepResearchMd && (
                                        <section id="full-research-section" className="dashboard-section card">
                                            <h2 className="section-title"><span className="dashicons dashicons-book-alt"></span>Dive Deeper: Full Research for {escapeHtml(currentCompanyNameForDisplay)}</h2>
                                            <p>The following is the detailed research report compiled to understand {escapeHtml(currentCompanyNameForDisplay)}'s unique market position and opportunities. This research underpins the strategies we propose.</p>
                                            <div id="deep-research-accordion" className="accordion">
                                                <div className="accordion-item">
                                                    <button className="accordion-button" onClick={() => setIsResearchAccordionOpen(!isResearchAccordionOpen)} aria-expanded={isResearchAccordionOpen} aria-controls="deep-research-content-panel">
                                                       {isResearchAccordionOpen ? 'Hide Full Research Report' : 'View Full Research Report'}
                                                       <span className={`dashicons ${isResearchAccordionOpen ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'}`}></span>
                                                    </button>
                                                    <div id="deep-research-content-panel" className={`accordion-content ${isResearchAccordionOpen ? 'open' : ''}`} dangerouslySetInnerHTML={renderMarkdownForHTML(currentDeepResearchMd)}></div>
                                               </div>
                                           </div>
                                        </section>
                                    )}

                                     <section id="booking-section" className="dashboard-section card">
                                        <h2 className="section-title"><span className="dashicons dashicons-calendar-alt"></span>Ready to Elevate {escapeHtml(currentCompanyNameForDisplay)}, {escapeHtml(currentFirstName)}?</h2>
                                        <p>Let's schedule a complimentary strategy session to discuss how MakerToo can architect and implement these AI & Automation solutions, tailored specifically for your goals.</p>
                                        <div id="booking-widget-container" className="booking-widget">
                                            {wpConfig && wpConfig.bookingLink && !wpConfig.bookingLink.includes("YOUR_") && !wpConfig.bookingLink.includes("page-slug") && !wpConfig.bookingLink.includes("calendar-embed") ? (
                                                <iframe src={wpConfig.bookingLink} title={`Schedule a Consultation with MakerToo for ${escapeHtml(currentCompanyNameForDisplay)}`} loading="lazy" style={{ width: '100%', height: '700px', border: 'none', borderRadius: 'var(--border-radius-md)' }}/>
                                            ) : ( <div className="booking-placeholder"> <span className="dashicons dashicons-clock"></span> <p>Booking options are currently being finalized. Please check back shortly.</p> <p>Alternatively, please reply to the email you received, or contact us directly at <a href="mailto:hello@makertoo.com">hello@makertoo.com</a>.</p> { (wpConfig?.bookingLink && (wpConfig.bookingLink.includes("YOUR_") || wpConfig.bookingLink.includes("page-slug") || wpConfig.bookingLink.includes("calendar-embed")) ) && <p style={{fontSize: '0.8em', marginTop: '10px', color: 'var(--accent-pink)'}}>Admin Note: Booking link requires configuration.</p>} </div> )}
                                        </div>
                                    </section>
                                </div>
                            );
                        })() 
                    )}
                </div>
            </main>
        </>
    );
}