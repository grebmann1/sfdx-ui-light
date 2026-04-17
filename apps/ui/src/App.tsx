import { useEffect, useRef, useState } from 'react';
import screenshotWelcome from './assets/screenshot-welcome.png';
import screenshotOverlay from './assets/screenshot-overlay.png';
import screenshotEditor from './assets/screenshot-editor.png';
import screenshotSoql from './assets/screenshot-soql.gif';
import screenshotMetadata from './assets/screenshot-metadata.gif';
import screenshotAgent from './assets/screenshot-agent.gif';
import {
    APP_URL,
    CHROME_STORE_URL,
    DOCS_URL,
    SiteShell,
} from './SiteChrome';

function useInView<T extends Element>(threshold = 0.1) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        // If already in viewport on mount, mark visible immediately
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            setInView(true);
            return;
        }
        const obs = new IntersectionObserver(
            ([entry]) => { if (entry.isIntersecting) setInView(true); },
            { threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, inView] as const;
}

function FakeBrowser({ url = 'app.workbench.io', screenshot }: { url?: string; screenshot?: string }) {
    return (
        <div className="fake-browser">
            <div className="fake-browser-bar">
                <div className="fake-browser-dots">
                    <span className="dot dot-red" />
                    <span className="dot dot-yellow" />
                    <span className="dot dot-green" />
                </div>
                <div className="fake-browser-nav">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="15 18 9 12 15 6" />
                    </svg>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="9 18 15 12 9 6" />
                    </svg>
                </div>
                <div className="fake-browser-url">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <span>{url}</span>
                </div>
            </div>
            <div className={`fake-browser-content${screenshot ? ' fake-browser-content--screenshot' : ''}`}>
                {screenshot ? (
                    <img src={screenshot} alt="" className="fake-browser-screenshot" />
                ) : (
                    <div className="fake-browser-placeholder">
                        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="3" y="3" width="18" height="18" rx="2" />
                            <path d="M3 9h18" />
                            <path d="M9 21V9" />
                        </svg>
                        <span>Screenshot coming soon</span>
                    </div>
                )}
            </div>
        </div>
    );
}

const featureSections = [
    {
        id: 'overlay',
        kicker: 'Always at hand',
        title: 'Overlay embedded in your Salesforce pages',
        description: 'A non-intrusive panel appears on every Salesforce page, giving you instant access to tools, logs, and org data without ever leaving your current context.',
        url: 'chrome - Workbench App',
        align: 'right' as const,
        screenshot: screenshotOverlay,
    },
    {
        id: 'editor',
        kicker: 'Code without context switching',
        title: 'VS Code editor running in your local browser',
        description: 'A full-featured code editor opens directly inside your browser, powered by the same engine as VS Code. Write, run, and debug Apex without switching windows.',
        url: 'chrome - Workbench Editor',
        align: 'left' as const,
        screenshot: screenshotEditor,
    },
    {
        id: 'workbench',
        kicker: 'Full visibility into your org',
        title: 'Full workbench to interact and explore metadata',
        description: 'Browse every object, field, permission set, and metadata component. Run SOQL, compare records, push changes, and manage your org from one focused interface.',
        url: 'chrome - Metadata Explorer',
        align: 'right' as const,
        screenshot: screenshotMetadata,
    },
    {
        id: 'soql',
        kicker: 'Query with confidence',
        title: 'Modern SOQL editor built for Salesforce',
        description: 'Browse every SObject, write SOQL with autocomplete, and see results instantly. A focused query interface designed to replace the old Workbench query tool.',
        url: 'chrome - SOQL Explorer',
        align: 'left' as const,
        screenshot: screenshotSoql,
    },
    {
        id: 'agent',
        kicker: 'AI that actually does work',
        title: 'Powerful AI agent capable of controlling your browser',
        description: "The AI agent doesn't just answer questions — it takes actions. Navigate Salesforce pages, fill forms, run queries, and complete multi-step org tasks autonomously.",
        url: 'chrome - AI Agent',
        align: 'right' as const,
        screenshot: screenshotAgent,
    },
];

const platforms = [
    {
        name: 'Web Extension',
        description: 'Access all tools directly in your browser while working inside Salesforce.',
        badge: 'Recommended',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
                <line x1="21.17" y1="8" x2="12" y2="8" />
                <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
                <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
            </svg>
        ),
        href: CHROME_STORE_URL,
        cta: 'Add to Chrome',
    },
    {
        name: 'Web App',
        description: 'No installation needed. Open the app in any browser and connect your org.',
        badge: null,
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
                <path d="M3.6 9h16.8" />
                <path d="M3.6 15h16.8" />
                <path d="M11.5 3a17 17 0 0 0 0 18" />
                <path d="M12.5 3a17 17 0 0 1 0 18" />
            </svg>
        ),
        href: APP_URL,
        cta: 'Open Web App',
    },
    {
        name: 'Desktop',
        description: 'A native desktop app for macOS and Windows. Full toolkit without a browser.',
        badge: 'In development',
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
            </svg>
        ),
        href: null,
        cta: 'Coming Soon',
    },
];

function FeatureSection({ section, index }: { section: typeof featureSections[0]; index: number }) {
    const [ref, inView] = useInView<HTMLElement>(0.12);
    const isAlt = index % 2 !== 0;
    return (
        <section
            ref={ref}
            id={section.id}
            className={`feature-section${isAlt ? ' feature-section--alt' : ''}${inView ? ' is-visible' : ''}`}
            aria-labelledby={`ft-${section.id}`}
        >
            <div className={`feature-layout feature-layout--${section.align}`}>
                <div className="feature-text">
                    <p className="section-kicker">{section.kicker}</p>
                    <h2 id={`ft-${section.id}`}>{section.title}</h2>
                    <p className="feature-description">{section.description}</p>
                </div>
                <div className="feature-browser">
                    <FakeBrowser url={section.url} screenshot={section.screenshot} />
                </div>
            </div>
        </section>
    );
}

export default function App() {
    const [heroRef, heroInView] = useInView<HTMLElement>(0.05);

    return (
        <SiteShell>
                <section
                    ref={heroRef}
                    className={`hero-full${heroInView ? ' is-visible' : ''}`}
                    aria-labelledby="welcome-title"
                >
                    <div className="hero-full-content">
                        <p className="eyebrow">Salesforce Administration Toolkit</p>
                        <h1 id="welcome-title">The toolkit built<br />for Salesforce admins</h1>
                        <p className="hero-text">
                            Workbench embeds directly into Salesforce with a page overlay, brings a VS Code editor
                            to your browser, a full metadata explorer, and an AI agent that can control your browser
                            — all in one extension.
                        </p>
                        <div className="hero-actions">
                            <a className="button" href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">Add Web Extension</a>
                            <a className="button button-ghost" href={APP_URL}>Launch Web App</a>
                        </div>
                    </div>
                    <div className="hero-browser">
                        <FakeBrowser url="chrome - Workbench App" screenshot={screenshotWelcome} />
                    </div>
                </section>

                {featureSections.map((section, i) => (
                    <FeatureSection key={section.id} section={section} index={i} />
                ))}

                <section className="platforms-section" aria-labelledby="platforms-title">
                    <div className="section-heading">
                        <p className="section-kicker">Works where you work</p>
                        <h2 id="platforms-title">Available platforms</h2>
                    </div>
                    <div className="platforms" aria-label="Available platforms">
                        {platforms.map(p => (
                            <article key={p.name} className="platform-card">
                                <div className="platform-header">
                                    <span className="platform-icon">{p.icon}</span>
                                    {p.badge && (
                                        <span className={`platform-badge${p.badge === 'Recommended' ? ' platform-badge--recommended' : ' platform-badge--wip'}`}>
                                            {p.badge}
                                        </span>
                                    )}
                                </div>
                                <div className="platform-body">
                                    <h3>{p.name}</h3>
                                    <p>{p.description}</p>
                                </div>
                                {p.href ? (
                                    <a className="button button-ghost button-small platform-cta" href={p.href}>{p.cta}</a>
                                ) : (
                                    <span className="button button-ghost button-small platform-cta platform-cta--disabled" aria-disabled="true">{p.cta}</span>
                                )}
                            </article>
                        ))}
                    </div>
                </section>

                <section className="download" aria-labelledby="download-title">
                    <h2 id="download-title">Get started in minutes</h2>
                    <p>
                        Add the web extension, connect your org, and get an overlay, a VS Code editor,
                        metadata tools, and an AI agent — right inside your browser.
                    </p>
                    <div className="hero-actions">
                        <a className="button" href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">Add Web Extension</a>
                        <a className="button button-ghost" href={APP_URL}>Launch Web App</a>
                    </div>
                </section>
        </SiteShell>
    );
}
