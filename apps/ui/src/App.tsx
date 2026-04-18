import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import screenshotWelcome from './assets/screenshot-welcome.png';
import screenshotOverlay from './assets/screenshot-overlay.png';
import screenshotEditor from './assets/screenshot-editor.png';
import screenshotSoql from './assets/screenshot-soql.gif';
import screenshotMetadata from './assets/screenshot-metadata.gif';
import screenshotAgent from './assets/screenshot-agent.gif';
import {
    CHROME_STORE_URL,
    FakeBrowser,
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

const FEATURE_SECTIONS = [
    { id: 'overlay', align: 'right' as const, screenshot: screenshotOverlay, url: 'chrome - Workbench App' },
    { id: 'editor', align: 'left' as const, screenshot: screenshotEditor, url: 'chrome - Workbench Editor' },
    { id: 'workbench', align: 'right' as const, screenshot: screenshotMetadata, url: 'chrome - Metadata Explorer' },
    { id: 'soql', align: 'left' as const, screenshot: screenshotSoql, url: 'chrome - SOQL Explorer' },
    { id: 'agent', align: 'right' as const, screenshot: screenshotAgent, url: 'chrome - AI Agent' },
] as const;

const PLATFORM_META = [
    {
        id: 'webExtension',
        href: CHROME_STORE_URL,
        badgeVariant: 'recommended' as const,
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <circle cx="12" cy="12" r="4" />
                <line x1="21.17" y1="8" x2="12" y2="8" />
                <line x1="3.95" y1="6.06" x2="8.54" y2="14" />
                <line x1="10.88" y1="21.94" x2="15.46" y2="14" />
            </svg>
        ),
    },
    {
        id: 'desktop',
        href: null as string | null,
        badgeVariant: 'wip' as const,
        icon: (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="2" y="3" width="20" height="14" rx="2" />
                <path d="M8 21h8" />
                <path d="M12 17v4" />
            </svg>
        ),
    },
] as const;

function FeatureSection({ section, index }: { section: typeof FEATURE_SECTIONS[number]; index: number }) {
    const { t } = useTranslation();
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
                    <p className="section-kicker">{t(`home.features.${section.id}.kicker`)}</p>
                    <h2 id={`ft-${section.id}`}>{t(`home.features.${section.id}.title`)}</h2>
                    <p className="feature-description">{t(`home.features.${section.id}.description`)}</p>
                </div>
                <div className="feature-browser">
                    <FakeBrowser url={section.url} screenshot={section.screenshot} />
                </div>
            </div>
        </section>
    );
}

export default function App() {
    const { t } = useTranslation();
    const [heroRef, heroInView] = useInView<HTMLElement>(0.05);

    return (
        <SiteShell>
                <section
                    ref={heroRef}
                    className={`hero-full${heroInView ? ' is-visible' : ''}`}
                    aria-labelledby="welcome-title"
                >
                    <div className="hero-full-content">
                        <p className="eyebrow">{t('home.hero.eyebrow')}</p>
                        <h1 id="welcome-title">{t('home.hero.title')}</h1>
                        <p className="hero-text">{t('home.hero.body')}</p>
                        <div className="hero-actions">
                            <a className="button" href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">
                                {t('home.hero.cta')}
                            </a>
                        </div>
                    </div>
                    <div className="hero-browser">
                        <FakeBrowser url="chrome - Workbench App" screenshot={screenshotWelcome} />
                    </div>
                </section>

                {FEATURE_SECTIONS.map((section, i) => (
                    <FeatureSection key={section.id} section={section} index={i} />
                ))}

                <section className="platforms-section" aria-labelledby="platforms-title">
                    <div className="section-heading">
                        <p className="section-kicker">{t('home.platforms.kicker')}</p>
                        <h2 id="platforms-title">{t('home.platforms.title')}</h2>
                    </div>
                    <div className="platforms" aria-label={t('home.platforms.title')}>
                        {PLATFORM_META.map(p => (
                            <article key={p.id} className="platform-card">
                                <div className="platform-header">
                                    <span className="platform-icon">{p.icon}</span>
                                    <span className={`platform-badge platform-badge--${p.badgeVariant}`}>
                                        {t(`home.platforms.${p.id}.badge`)}
                                    </span>
                                </div>
                                <div className="platform-body">
                                    <h3>{t(`home.platforms.${p.id}.name`)}</h3>
                                    <p>{t(`home.platforms.${p.id}.description`)}</p>
                                </div>
                                {p.href ? (
                                    <a className="button button-ghost button-small platform-cta" href={p.href}>
                                        {t(`home.platforms.${p.id}.cta`)}
                                    </a>
                                ) : (
                                    <span className="button button-ghost button-small platform-cta platform-cta--disabled" aria-disabled="true">
                                        {t(`home.platforms.${p.id}.cta`)}
                                    </span>
                                )}
                            </article>
                        ))}
                    </div>
                </section>

                <section className="download" aria-labelledby="download-title">
                    <h2 id="download-title">{t('home.download.title')}</h2>
                    <p>{t('home.download.body')}</p>
                    <div className="hero-actions">
                        <a className="button" href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">
                            {t('home.download.cta')}
                        </a>
                    </div>
                </section>
        </SiteShell>
    );
}
