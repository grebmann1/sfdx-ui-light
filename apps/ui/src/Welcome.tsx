import { useEffect, useMemo, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import screenshotOverlay from './assets/screenshot-overlay.png';
import { FakeBrowser, SiteShell } from './SiteChrome';

const DEFAULT_WORKBENCH_APP_URL =
    'chrome-extension://dncmipbpdapfjancbhmbodlhllapmagf/views/app.html';

function resolveWorkbenchAppUrl(): string {
    if (typeof window === 'undefined') return DEFAULT_WORKBENCH_APP_URL;
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('redirect_url');
        if (!raw) return DEFAULT_WORKBENCH_APP_URL;
        const candidate = new URL(raw);
        if (candidate.protocol !== 'chrome-extension:') return DEFAULT_WORKBENCH_APP_URL;
        return candidate.toString();
    } catch {
        return DEFAULT_WORKBENCH_APP_URL;
    }
}

function useInView<T extends Element>(threshold = 0.1) {
    const ref = useRef<T>(null);
    const [inView, setInView] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
            setInView(true);
            return;
        }
        const obs = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) setInView(true);
            },
            { threshold }
        );
        obs.observe(el);
        return () => obs.disconnect();
    }, [threshold]);
    return [ref, inView] as const;
}

function PuzzleIcon({ className, size = 18 }: { className?: string; size?: number }) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 122.88 116.67"
            fill="currentColor"
            aria-hidden="true"
        >
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M84.55,116.66c2.49,0,4.53-1.99,4.53-4.41V88.08c1.55-13.03,7.27-9.16,14-5.13 c16.27,9.74,27.08-15.88,13.93-23.78c-10.32-6.2-14.79,4.46-22.35,3.36c-2.92-0.43-4.95-3.5-5.59-8.17V36.9 c0-2.43-2.04-4.41-4.53-4.41H63.73c-17.18-2.12-1.93-11.37-1.93-19.98C61.81,5.6,55.38,0,47.45,0c-7.92,0-15.19,5.6-15.19,12.51 c0,8.12,15.78,17.86-1.64,19.98H4.53C2.04,32.49,0,34.47,0,36.9v17.42c1.33,7.43,6.49,9.15,13.1,4.25 c2.23-1.66,5.99-3.59,8.71-3.59c7.09,0,12.85,6.25,12.85,13.96S28.91,84.6,21.81,84.6c-2.53,0-4.89-0.8-6.89-2.19 c0,0.59-12.4-10.85-14.92,3.15v26.71c0,2.43,2.04,4.41,4.53,4.41c13.97,0,27.92,0,41.88-0.01c0.55-2.55-1.24-5.47-2.92-8 c-13.22-19.93,38.21-21.92,24.99,0.62c-0.65,1.11-1.3,2.19-1.8,3.24c-0.63,1.31-1.05,2.91-0.96,4.14L84.55,116.66L84.55,116.66z"
            />
        </svg>
    );
}

function CloudIcon({ className, size = 14 }: { className?: string; size?: number }) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 122.88 79.13"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M86.35,29.93c-0.75,0.37-1.51,0.78-2.26,1.21c-2.25,1.32-4.47,2.93-6.74,4.78l-4.84-5.54c1.67-1.55,3.48-2.96,5.4-4.21 c1.53-1,3.13-1.89,4.78-2.65c0.66-0.33,1.32-0.64,2-0.93c-3.19-5.65-7.78-9.7-12.98-12.2c-5.2-2.49-11.02-3.45-16.69-2.9 c-5.63,0.54-11.1,2.59-15.62,6.1c-5.23,4.05-9.2,10.11-10.73,18.14l-0.48,2.51l-2.5,0.44c-2.45,0.43-4.64,1.02-6.56,1.77 c-1.86,0.72-3.52,1.61-4.97,2.66c-1.16,0.84-2.16,1.78-3.01,2.8c-2.63,3.15-3.85,7.1-3.82,11.1c0.03,4.06,1.35,8.16,3.79,11.53 c0.91,1.25,1.96,2.4,3.16,3.4c1.22,1.01,2.59,1.85,4.13,2.48c1.53,0.63,3.22,1.08,5.09,1.34l72.55,0c3.53-0.85,6.65-2,9.3-3.48 c2.63-1.47,4.78-3.26,6.39-5.41c2.5-3.33,3.73-8.04,3.78-12.87c0.06-5.07-1.18-10.16-3.59-13.86c-0.69-1.07-1.45-2.03-2.25-2.89 c-3.61-3.89-8.19-5.59-12.95-5.62C93.3,27.6,89.73,28.43,86.35,29.93L86.35,29.93L86.35,29.93z M91.99,20.65 c1.6-0.25,3.2-0.38,4.79-0.36c6.72,0.05,13.2,2.45,18.3,7.95c1.07,1.15,2.08,2.45,3.03,3.9c3.2,4.92,4.84,11.49,4.77,17.92 c-0.07,6.31-1.77,12.59-5.25,17.21c-2.27,3.01-5.18,5.47-8.67,7.42c-3.36,1.88-7.28,3.31-11.68,4.33l-0.82,0.1l-73.08,0l-0.46-0.04 c-2.67-0.34-5.09-0.97-7.29-1.88c-2.27-0.94-4.28-2.15-6.05-3.63c-1.68-1.4-3.15-2.99-4.4-4.72C1.84,64.25,0.04,58.63,0,53.03 c-0.04-5.66,1.72-11.29,5.52-15.85c1.23-1.48,2.68-2.84,4.34-4.04c1.93-1.4,4.14-2.58,6.64-3.55c1.72-0.67,3.56-1.23,5.5-1.68 c2.2-8.74,6.89-15.47,12.92-20.14c5.64-4.37,12.43-6.92,19.42-7.59c6.96-0.67,14.12,0.51,20.55,3.6 C81.9,7.15,88.02,12.76,91.99,20.65L91.99,20.65L91.99,20.65z" />
        </svg>
    );
}

function PinIcon({ className, size = 16 }: { className?: string; size?: number }) {
    return (
        <svg
            className={className}
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 17v5" />
            <path d="M9 10.76V6l-1-2h8l-1 2v4.76l3 4.24H6z" />
        </svg>
    );
}

function FakeToolbar() {
    const { t } = useTranslation();
    return (
        <div className="pin-toolbar" aria-hidden="true">
            <div className="pin-toolbar-row">
                <span className="pin-toolbar-icon pin-toolbar-icon--muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                    </svg>
                </span>
                <span className="pin-toolbar-icon pin-toolbar-icon--muted">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                    </svg>
                </span>
                <span className="pin-toolbar-icon pin-toolbar-icon--highlight">
                    <PuzzleIcon size={15} />
                </span>
            </div>
            <div className="pin-toolbar-popover">
                <div className="pin-toolbar-popover-title">{t('welcome.toolbar.extensions')}</div>
                <div className="pin-toolbar-popover-row pin-toolbar-popover-row--target">
                    <span className="pin-toolbar-brand">
                        <CloudIcon size={14} />
                    </span>
                    <span className="pin-toolbar-name">{t('welcome.toolbar.workbench')}</span>
                    <span className="pin-toolbar-pin">
                        <PinIcon size={14} />
                    </span>
                </div>
                <div className="pin-toolbar-popover-row">
                    <span className="pin-toolbar-brand pin-toolbar-brand--muted" />
                    <span className="pin-toolbar-name pin-toolbar-name--muted">{t('welcome.toolbar.otherExtension')}</span>
                    <span className="pin-toolbar-pin pin-toolbar-pin--muted">
                        <PinIcon size={14} />
                    </span>
                </div>
            </div>
        </div>
    );
}

const STEPS_META = [
    {
        id: 'openSalesforce',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
                <path d="M3.6 9h16.8" />
                <path d="M3.6 15h16.8" />
                <path d="M11.5 3a17 17 0 0 0 0 18" />
                <path d="M12.5 3a17 17 0 0 1 0 18" />
            </svg>
        ),
    },
    {
        id: 'launchWorkbench',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 3v18" />
            </svg>
        ),
    },
    {
        id: 'tryAgent',
        icon: (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2v4" />
                <rect x="4" y="6" width="16" height="12" rx="2" />
                <circle cx="9" cy="12" r="1" />
                <circle cx="15" cy="12" r="1" />
                <path d="M8 18v2" />
                <path d="M16 18v2" />
            </svg>
        ),
    },
] as const;

export default function Welcome() {
    const { t } = useTranslation();
    const [heroRef, heroInView] = useInView<HTMLElement>(0.05);
    const [stepsRef, stepsInView] = useInView<HTMLElement>(0.12);
    const workbenchAppUrl = useMemo(resolveWorkbenchAppUrl, []);

    return (
        <SiteShell showAnnounce={false} showInstall={false} showHeader={false}>
            <section
                ref={heroRef}
                className={`welcome-hero${heroInView ? ' is-visible' : ''}`}
                aria-labelledby="welcome-hero-title"
            >
                <p className="eyebrow">{t('welcome.hero.eyebrow')}</p>
                <h1 id="welcome-hero-title">{t('welcome.hero.title')}</h1>
                <p className="hero-text">{t('welcome.hero.body')}</p>
            </section>

            <section className="pin-callout" aria-labelledby="pin-title">
                <div className="pin-callout-inner">
                    <div className="pin-callout-body">
                        <p className="section-kicker">{t('welcome.pin.kicker')}</p>
                        <h2 id="pin-title">{t('welcome.pin.title')}</h2>
                        <p className="pin-callout-text">
                            <Trans
                                t={t}
                                i18nKey="welcome.pin.instructions"
                                components={{
                                    puzzle: <PuzzleIcon className="pin-inline-icon" size={16} />,
                                    pin: <PinIcon className="pin-inline-icon" size={14} />,
                                    strong: <strong />,
                                }}
                            />
                        </p>
                        <p className="pin-callout-hint">{t('welcome.pin.hint')}</p>
                    </div>
                    <div className="pin-callout-visual">
                        <FakeToolbar />
                    </div>
                </div>
            </section>

            <section className="overlay-callout" aria-labelledby="overlay-title">
                <div className="overlay-callout-inner">
                    <div className="overlay-callout-visual">
                        <FakeBrowser url="yourorg.salesforce.com" screenshot={screenshotOverlay} />
                    </div>
                    <div className="overlay-callout-body">
                        <p className="section-kicker">{t('welcome.overlay.kicker')}</p>
                        <h2 id="overlay-title">{t('welcome.overlay.title')}</h2>
                        <p className="overlay-callout-text">{t('welcome.overlay.body')}</p>
                    </div>
                </div>
            </section>

            <section
                ref={stepsRef}
                className={`welcome-steps${stepsInView ? ' is-visible' : ''}`}
                aria-labelledby="steps-title"
            >
                <div className="section-heading">
                    <p className="section-kicker">{t('welcome.steps.kicker')}</p>
                    <h2 id="steps-title">{t('welcome.steps.title')}</h2>
                </div>
                <div className="steps-grid">
                    {STEPS_META.map((step, i) => (
                        <article key={step.id} className="step-card">
                            <div className="step-card-header">
                                <span className="step-badge">{i + 3}</span>
                                <span className="step-icon">{step.icon}</span>
                            </div>
                            <h3>{t(`welcome.steps.${step.id}.title`)}</h3>
                            <p>{t(`welcome.steps.${step.id}.description`)}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section className="welcome-cta" aria-labelledby="welcome-cta-title">
                <h2 id="welcome-cta-title">{t('welcome.cta.title')}</h2>
                <p>{t('welcome.cta.body')}</p>
                <div className="hero-actions">
                    <a className="button" href={workbenchAppUrl}>
                        {t('welcome.cta.button')}
                    </a>
                </div>
            </section>
        </SiteShell>
    );
}
