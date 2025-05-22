// pages/dashboard.js
import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import axios from 'axios';
import { marked } from 'marked'; // Ensure marked is imported
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
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}

export default function DashboardPage() {
    const router = useRouter();
    const { visitor_id: visitorIdFromUrl } = router.query;

    const [wpConfig, setWpConfig] = useState(null);
    const [visitorIdInput, setVisitorIdInput] = useState('');
    const [currentNocoRecord, setCurrentNocoRecord] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showNoDataMessage, setShowNoDataMessage] = useState(true);
    const [currentStatusMessage, setCurrentStatusMessage] = useState('Enter a Visitor ID to begin.');
    const [isAccordionOpen, setIsAccordionOpen] = useState(false); // For accordion

    const lastFetchedIdRef = useRef(null);
    const configFetchedRef = useRef(false);

    // Intersection Observer for card animations
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        // observer.unobserve(entry.target); // Optional: stop observing after first animation
                    } else {
                        // Optional: remove class if you want animation on every scroll-in
                        // entry.target.classList.remove('is-visible');
                    }
                });
            },
            { threshold: 0.1 } // Trigger when 10% of the element is visible
        );

        const cards = document.querySelectorAll('.dashboard-section.card');
        cards.forEach((card) => observer.observe(card));

        return () => cards.forEach((card) => observer.unobserve(card)); // Cleanup
    }, [currentNocoRecord]); // Re-observe if content changes, might need a more stable trigger


    const fetchVisitorDataViaProxy = useCallback(async (visitorId) => {
        if (!wpConfig || !wpConfig.ajax_url || !wpConfig.nonce) {
            throw new Error("WordPress configuration (ajax_url or nonce) is missing.");
        }
        const formData = new FormData();
        formData.append('action', 'fetch_dashboard_data_proxy');
        formData.append('nonce', wpConfig.nonce);
        formData.append('visitor_id', visitorId);
        try {
            const response = await axios.post(wpConfig.ajax_url, formData);
            if (response.data.success) {
                return response.data.data;
            } else {
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
                } else { errorMessage += "Please check server logs for more details." }
            } else if (err.request) {
                errorMessage = 'No response from WordPress server. Is it running and accessible?';
            } else { errorMessage = err.message || errorMessage; }
            throw new Error(errorMessage);
        }
    }, [wpConfig]);

    const fetchAndRenderDashboard = useCallback(async (visitorIdToFetch) => {
        if (!visitorIdToFetch) {
            setCurrentNocoRecord(null); setError(null); setShowNoDataMessage(true);
            setCurrentStatusMessage("Please enter a Visitor ID."); setIsLoading(false); lastFetchedIdRef.current = null;
            return;
        }
        setIsLoading(true); setError(null); setShowNoDataMessage(false);
        setCurrentStatusMessage(`Fetching personalized insights for ID: ${visitorIdToFetch}...`);
        try {
            if (!wpConfig || !wpConfig.useAjaxProxy) throw new Error("WordPress configuration error. Cannot fetch data.");
            const record = await fetchVisitorDataViaProxy(visitorIdToFetch);
            if (record && typeof record === 'object' && Object.keys(record).length > 0) {
                setCurrentNocoRecord(record);
                const dn = record.first_name || 'Valued Lead';
                const cn = record['organization/name'] || record.company_short || 'Your Company';
                setCurrentStatusMessage(`Showing personalized data for: ${dn} from ${cn}`);
                setShowNoDataMessage(false);
            } else {
                setError(`No data found for Visitor ID: ${visitorIdToFetch}. Please verify the ID.`);
                setCurrentNocoRecord(null); setShowNoDataMessage(true);
            }
        } catch (err) {
            setError(err.message || `An unexpected error occurred while loading data.`);
            setCurrentNocoRecord(null); setShowNoDataMessage(true);
        } finally {
            setIsLoading(false);
        }
    }, [wpConfig, fetchVisitorDataViaProxy]);

    useEffect(() => {
        if (!configFetchedRef.current && WP_API_URL) {
            configFetchedRef.current = true;
            const fetchWpConfig = async () => {
                try {
                    const response = await axios.get(`${WP_API_URL}/wp-json/personalized-dashboard/v1/config`);
                    if (response.data && response.data.success) {
                        setWpConfig(response.data.data);
                    } else { throw new Error(response.data?.data?.message || 'Failed to fetch valid WP configuration.'); }
                } catch (err) { console.error("PDS_NEXT_CLIENT: CRITICAL - Error fetching WP config:", err); setError(`Dashboard Error: Could not load configuration from server. ${err.message}`);}
            };
            fetchWpConfig();
        } else if (!WP_API_URL) { console.error("PDS_NEXT_CLIENT: CRITICAL - WP_API_URL not defined."); setError("Dashboard Error: API URL configuration is missing.");}
    }, []);

    useEffect(() => {
        if (wpConfig) {
            if (visitorIdFromUrl) {
                setVisitorIdInput(visitorIdFromUrl);
                if (!isLoading && visitorIdFromUrl !== lastFetchedIdRef.current) {
                    setCurrentNocoRecord(null); setError(null);
                    lastFetchedIdRef.current = visitorIdFromUrl;
                    fetchAndRenderDashboard(visitorIdFromUrl);
                }
            } else {
                setCurrentNocoRecord(null); setError(null); setShowNoDataMessage(true);
                setCurrentStatusMessage('Enter a Visitor ID to begin.'); setVisitorIdInput(''); lastFetchedIdRef.current = null;
            }
        }
    }, [visitorIdFromUrl, wpConfig, fetchAndRenderDashboard, isLoading]);

    const handleFetchButtonClick = () => {
        const newVisitorId = visitorIdInput.trim();
        if (newVisitorId) {
            if (newVisitorId !== lastFetchedIdRef.current || error || !currentNocoRecord) {
                 lastFetchedIdRef.current = null;
                 router.push(`/dashboard?visitor_id=${newVisitorId}`, undefined, { shallow: false });
            } else if (!isLoading) {
                lastFetchedIdRef.current = null;
                fetchAndRenderDashboard(newVisitorId);
            }
        } else {
            setError('Please enter a Visitor ID.'); setCurrentStatusMessage('Please enter a Visitor ID.');
            setShowNoDataMessage(true); setCurrentNocoRecord(null); lastFetchedIdRef.current = null;
            router.push(`/dashboard`, undefined, { shallow: false });
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
    else if (error) { personalizedGreetingHtml = `<p class="lead" style="color: var(--accent-secondary);">Attention Required</p><p>We encountered an issue loading your personalized data. Please double-check the Visitor ID or try again. If the problem persists, support may have been notified.</p>`;} // Using new color
    else { personalizedGreetingHtml = `<p class="lead">Welcome to Your Personalized Dashboard!</p><p>Please enter your unique Visitor ID above to unlock tailored insights.</p>`;}

    let companyAtAGlanceHtml = '';
    if (hasData) {
        const logoUrl = currentNocoRecord['organization/logo_url'];
        const usp = currentNocoRecord.extracted_company_profile_usp;
        const overview = currentNocoRecord.extracted_company_overview;
        const founderSummary = currentNocoRecord.extracted_founder_profile_summary;
        const companyWebsite = currentNocoRecord['organization/website_url'];

        if (logoUrl && logoUrl.startsWith('http')) {
            companyAtAGlanceHtml += `<div class="company-logo-wrapper">`; // Use class from CSS
            if (companyWebsite && companyWebsite.startsWith('http')) companyAtAGlanceHtml += `<a href="${escapeHtml(companyWebsite)}" target="_blank" rel="noopener noreferrer">`;
            companyAtAGlanceHtml += `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(companyName)} Logo" class="company-logo">`; // Use class
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
        { label: "Strategic Alignment", value: "High", target: "With MakerToo's Open-Source Focus", icon: "dashicons-admin-links", trend: "stable" },
        { label: "Innovation Potential", value: "Significant", target: "Via Custom AI/Automation", icon: "dashicons-lightbulb", trend: "up" },
        { label: "Data Control", value: "Total", target: "Through Private Infrastructure", icon: "dashicons-lock", trend: "up" },
        { label: "Future Scalability", value: "Assured", target: "With Flexible Tech Stacks", icon: "dashicons-backup", trend: "up" },
    ];
    if (hasData && currentNocoRecord.kpi_data) {
        try {
            const dynamicKpis = JSON.parse(currentNocoRecord.kpi_data);
            if (Array.isArray(dynamicKpis) && dynamicKpis.length > 0) kpisToShow = dynamicKpis;
        } catch (e) { /* console.warn for debug */ }
    }

    let fullDeepResearchHtml = "<p>Your comprehensive research report will be accessible here, providing in-depth analysis and strategic recommendations.</p>";
    if (hasData && currentNocoRecord.deep_reaserach) {
        try { fullDeepResearchHtml = marked.parse(currentNocoRecord.deep_reaserach); }
        catch (e) { fullDeepResearchHtml = `<pre><code>${escapeHtml(currentNocoRecord.deep_reaserach)}</code></pre>`;} // Wrap in code tags for pre
    }
    
    const displayDashboardContent = hasData;

    const getChartJsDefaultOptions = useCallback((customColors = {}) => {
        if (typeof window === 'undefined') return { scales: { y: {}, x: {} }, plugins: { legend: {}, tooltip: {} } };
        const rootStyles = getComputedStyle(document.documentElement);
        const safeGet = (prop, fb) => rootStyles.getPropertyValue(prop).trim() || fb;
        const chartColors = {
            primary: safeGet('--accent-primary', '#00f5d4'), // Using new color scheme
            secondary: safeGet('--accent-tertiary', '#7b00ff'), // Using new color scheme
            pink: safeGet('--accent-secondary', '#ff00e6'), // Using new color scheme
            grid: `rgba(${safeGet('--text-secondary-rgb', '176,184,217')}, 0.08)`, // Adjusted for new scheme
            ticks: safeGet('--text-muted', '#7881a6'),
            tooltipBg: safeGet('--bg-dark-secondary', '#13162f'),
            tooltipText: safeGet('--text-light', '#e8eaf6'),
            fontFamily: safeGet('--font-primary', 'Montserrat, sans-serif').split(',')[0].trim(),
        };
        return { responsive: true, maintainAspectRatio: false, color: chartColors.ticks,
            scales: { y: { beginAtZero: true, grid: { color: chartColors.grid, borderColor: chartColors.grid, drawBorder: false }, ticks: { color: chartColors.ticks, font: { family: chartColors.fontFamily }, padding: 10 } },
                      x: { grid: { display: false }, ticks: { color: chartColors.ticks, font: { family: chartColors.fontFamily }, padding: 10 } } },
            plugins: { legend: { position: 'bottom', labels: { color: chartColors.ticks, font: { family: chartColors.fontFamily }, padding: 20, usePointStyle: true, pointStyle: 'rectRounded' } },
                       tooltip: { enabled: true, backgroundColor: chartColors.tooltipBg, titleColor: chartColors.tooltipText, bodyColor: chartColors.tooltipText, titleFont: { family: chartColors.fontFamily, weight: '600' }, bodyFont: { family: chartColors.fontFamily }, borderColor: chartColors.primary, borderWidth: 1, padding: 10, cornerRadius: 4, usePointStyle: true, boxPadding: 5 } },
            animation: { duration: 700, easing: 'easeOutCubic' }
        };
    }, []);
    const defaultChartOptions = getChartJsDefaultOptions();
    const getRgbColor = useCallback((cssVar, fallbackRgb) => {
        if (typeof window === 'undefined') return fallbackRgb;
        return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || fallbackRgb;
    }, []);

    const illustrativeRevenueData = {
        labels: ['Q1', 'Q2', 'Q3', 'Q4', 'Next Q (Est.)'], datasets: [{ label: 'Potential Revenue Uplift', data: [50, 65, 80, 75, 95], borderColor: `rgb(${getRgbColor('--accent-primary-rgb', '0,245,212')})`, backgroundColor: `rgba(${getRgbColor('--accent-primary-rgb', '0,245,212')}, 0.1)`, tension: 0.4, fill: true, pointBackgroundColor: `rgb(${getRgbColor('--accent-primary-rgb', '0,245,212')})`, pointBorderColor: '#fff', pointHoverRadius: 7, pointHoverBackgroundColor: '#fff', pointHoverBorderColor: `rgb(${getRgbColor('--accent-primary-rgb', '0,245,212')})` }]
    };
    const illustrativeEfficiencyData = {
        labels: ['Current', 'Phase 1 Auto', 'Phase 2 AI Opt.'], datasets: [{ label: 'Process Efficiency Gain (%)', data: [0, 30, 65], backgroundColor: `rgba(${getRgbColor('--accent-tertiary-rgb', '123,0,255')}, 0.65)`, borderColor: `rgb(${getRgbColor('--accent-tertiary-rgb', '123,0,255')})`, borderWidth: 1, borderRadius: 6, barThickness: 'flex', maxBarThickness: 50 }]
    };
    const illustrativeProjectCompletionData = {
        labels: ['On Target', 'Accelerated', 'New Opportunities'], datasets: [{ label: 'Strategic Initiatives', data: [60, 25, 15], backgroundColor: [`rgb(${getRgbColor('--accent-primary-rgb', '0,245,212')})`, `rgb(${getRgbColor('--accent-tertiary-rgb', '123,0,255')})`, `rgb(${getRgbColor('--accent-secondary-rgb', '255,0,230')})`], hoverOffset: 8, borderColor: defaultChartOptions.plugins?.tooltip?.backgroundColor || '#13162f', borderWidth: 3, cutout: '65%' }]
    };
    const doughnutChartOptions = { ...defaultChartOptions, cutout: '65%', plugins: { ...defaultChartOptions.plugins, legend: { ...defaultChartOptions.plugins?.legend, position: 'right' } } };

    return (
        <>
            <Head>
                 <title>{`Dashboard - ${hasData ? `${firstName} @ ${companyName}` : (visitorIdFromUrl || visitorIdInput ? 'Loading...' : 'Welcome')}`}</title>
                <meta name="description" content={`Personalized dashboard insights ${hasData ? `for ${companyName}` : 'by MakerToo'}`} />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            {/* Particles will be here if you add react-tsparticles */}

            <main id="primary" className="site-main personalized-dashboard-page-area">
                <div className="personalized-dashboard-container">
                    <div className="dashboard-header">
                        <h1><span className="dashicons dashicons-admin-users"></span>Welcome, <span id="visitor-name-header">{firstName}{companyName !== 'Your Company' && companyName !== 'Company' && companyName ? ` from ${companyName}` : ''}</span>!</h1>
                        <div id="personalized-greeting" dangerouslySetInnerHTML={{ __html: personalizedGreetingHtml }}></div>
                    </div>

                    <div className="visitor-input-area">
                        <input type="text" id="visitorIdInput" placeholder="Enter Your Visitor ID" value={visitorIdInput} onChange={handleInputChange} onKeyPress={handleKeyPress} disabled={isLoading || !wpConfig} aria-label="Visitor ID Input"/>
                        <button id="fetchDataButton" className="button button-primary" onClick={handleFetchButtonClick} disabled={isLoading || !wpConfig}>
                            <span className="dashicons dashicons-arrow-right-alt2"></span>Unlock Insights
                        </button>
                        <p id="currentVisitorStatus" className="visitor-status-message">{currentStatusMessage}</p>
                    </div>

                    {isLoading && ( <div className="dashboard-message dashboard-loader-message"><div className="loader"></div><p>Crafting your personalized experience...</p></div> )}
                    {error && !isLoading && (<div className="dashboard-message error"><span className="dashicons dashicons-warning"></span>{error}</div>)}
                    {showNoDataMessage && !isLoading && !error && !hasData && (
                        <div className="dashboard-message info">
                            {!wpConfig ? <p><span className="dashicons dashicons-info"></span>Initializing services. Please wait...</p> : <p><span className="dashicons dashicons-info"></span>Enter your ID to access personalized insights.</p>}
                        </div>
                    )}

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
                                             <div className="kpi-label"><span className={`dashicons ${escapeHtml(kpi.icon || 'dashicons-star-filled')}`}></span>{escapeHtml(kpi.label)}</div>
                                             <div className="kpi-value">{escapeHtml(kpi.value)}{kpi.unit_suffix ? <span className="kpi-unit">{escapeHtml(kpi.unit_suffix)}</span> : ''}</div>
                                             <div className="kpi-target"><small>{escapeHtml(kpi.target)}</small></div>
                                             {kpi.trend && kpi.trend !== 'neutral' && <div className={`kpi-trend ${kpi.trend}`}><span className={`dashicons dashicons-arrow-${kpi.trend === 'up' ? 'up' : 'down'}-alt`}></span></div>}
                                         </div>
                                    ))}
                                </div>
                            </section>

                            <section id="analytics-overview" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-chart-area"></span>Illustrative Performance Projections</h2>
                                <p style={{textAlign: 'center', marginBottom: 'var(--space-xl)', color: 'var(--text-secondary)'}}>
                                    Visualizing the potential impact of MakerToo&quots solutions for {companyName}.
                                </p>
                                <div className="charts-grid">
                                    <div className="chart-container-wrapper">
                                        <h3 className="subsection-title" style={{textAlign:'center'}}><span className="dashicons dashicons-chart-line"></span>Revenue Trajectory</h3>
                                        <div className="chart-container"><Line options={defaultChartOptions} data={illustrativeRevenueData} /></div>
                                    </div>
                                    <div className="chart-container-wrapper">
                                        <h3 className="subsection-title" style={{textAlign:'center'}}><span className="dashicons dashicons-backup"></span>Operational Efficiency</h3> {/* Changed icon */}
                                        <div className="chart-container"><Bar options={defaultChartOptions} data={illustrativeEfficiencyData} /></div>
                                    </div>
                                </div>
                                <div className="chart-container-wrapper" style={{ marginTop: 'var(--space-xl)' }}>
                                    <h3 className="subsection-title" style={{textAlign:'center'}}><span className="dashicons dashicons-yes-alt"></span>Strategic Initiative Focus</h3>
                                    <div className="chart-container" style={{ height: '320px', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}> {/* Slightly larger doughnut */}
                                        <Doughnut options={doughnutChartOptions} data={illustrativeProjectCompletionData} />
                                    </div>
                                </div>
                            </section>

                            <section id="full-research-section" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-book-alt"></span>Full Research for <span id="visitor-company-report-title">{companyName}</span></h2>
                                <p>The following is the detailed research report compiled to understand unique positions and opportunities.</p>
                                <div id="deep-research-accordion" className="accordion">
                                    <div className={`accordion-item ${isAccordionOpen ? 'is-open' : ''}`}> {/* Add is-open class */}
                                        <button className="accordion-header" aria-expanded={isAccordionOpen} 
                                                aria-controls="full-deep-research-content-panel" /* Link to content panel */
                                                id="accordion-header-research" /* ID for aria-labelledby */
                                                onClick={() => setIsAccordionOpen(!isAccordionOpen)}>
                                            View Full Research Report
                                            <span className={`accordion-icon dashicons ${isAccordionOpen ? 'dashicons-arrow-up-alt2' : 'dashicons-arrow-down-alt2'}`}></span>
                                        </button>
                                        <div id="full-deep-research-content-panel" className="accordion-content" role="region" aria-labelledby="accordion-header-research">
                                            <div id="full-deep-research-content" dangerouslySetInnerHTML={{ __html: fullDeepResearchHtml }}></div>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <section id="booking-section" className="dashboard-section card">
                                <h2 className="section-title"><span className="dashicons dashicons-calendar-alt"></span>Ready to Implement, <span id="visitor-name-cta">{firstName}</span>?</h2>
                                <p>Let&quots discuss how MakerToo can architect and implement these AI & Automation strategies for <span id="visitor-company-cta">{companyName}</span>.</p>
                                <div id="booking-widget-container" className="booking-widget">
                                    {wpConfig && wpConfig.bookingLink && !wpConfig.bookingLink.includes("YOUR_") ? (
                                        <iframe src={wpConfig.bookingLink} title="Schedule a Consultation" loading="lazy" 
                                                style={{ width: '100%', height: '550px', border: 'none', borderRadius: 'var(--border-radius-md)' }}/>
                                    ) : (
                                        <div className="booking-placeholder">
                                            <span className="dashicons dashicons-clock"></span>
                                            <p>Booking options are being configured. Please check back or contact us directly.</p>
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