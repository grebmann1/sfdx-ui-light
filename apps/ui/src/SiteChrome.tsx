import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from './i18n';

export const DOCS_URL = import.meta.env.VITE_DOCS_URL || '/docs';
export const GITHUB_URL = 'https://github.com/grebmann1/sfdx-ui-light';
export const CHROME_STORE_URL =
    'https://chromewebstore.google.com/detail/salesforce-toolkit/konbmllgicfccombdckckakhnmejjoei?hl=en';

function LanguageSwitcher() {
    const { i18n } = useTranslation();
    return (
        <div className="lang-switcher" role="group" aria-label="Language">
            {SUPPORTED_LANGUAGES.map(lang => (
                <button
                    key={lang.code}
                    className={`lang-switcher-btn${i18n.resolvedLanguage === lang.code ? ' lang-switcher-btn--active' : ''}`}
                    onClick={() => i18n.changeLanguage(lang.code)}
                    aria-label={lang.name}
                    aria-pressed={i18n.resolvedLanguage === lang.code}
                >
                    {lang.label}
                </button>
            ))}
        </div>
    );
}

export function AnnounceBar() {
    const { t } = useTranslation();
    return (
        <div className="announce-bar" role="note">
            <span className="announce-dot" aria-hidden="true" />
            <Trans t={t} i18nKey="chrome.announce" components={{ bold: <strong /> }} />
        </div>
    );
}

export function SiteHeader({ showInstall = true }: { showInstall?: boolean }) {
    const { t } = useTranslation();
    return (
        <header className="header">
            <a className="brand" href="/">
                <span className="brand-icon" aria-hidden="true">
                    <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    >
                        <rect x="3" y="3" width="7" height="7" rx="1.2" />
                        <rect x="14" y="3" width="7" height="7" rx="1.2" />
                        <rect x="3" y="14" width="7" height="7" rx="1.2" />
                        <rect x="14" y="14" width="7" height="7" rx="1.2" />
                    </svg>
                </span>
                Workbench
            </a>
            <nav className="header-nav">
                <LanguageSwitcher />
                <a
                    className="header-link"
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    {t('chrome.nav.github')}
                </a>
                <a className="header-link" href={DOCS_URL}>
                    {t('chrome.nav.docs')}
                </a>
                {showInstall && (
                    <a
                        className="button button-small"
                        href={CHROME_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        {t('chrome.nav.install')}
                    </a>
                )}
            </nav>
        </header>
    );
}

export function SiteFooter() {
    const { t } = useTranslation();
    return (
        <footer className="footer">
            <span className="footer-brand">Workbench</span>
            <div className="footer-links">
                <a href={DOCS_URL}>{t('chrome.footer.documentation')}</a>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                    {t('chrome.footer.github')}
                </a>
            </div>
            <span className="footer-copy">
                {t('chrome.footer.copyright', { year: new Date().getFullYear() })}
            </span>
        </footer>
    );
}

export function FakeBrowser({ url = 'app.workbench.io', screenshot }: { url?: string; screenshot?: string }) {
    const { t } = useTranslation();
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
                        <span>{t('chrome.screenshotComingSoon')}</span>
                    </div>
                )}
            </div>
        </div>
    );
}

export function SiteShell({
    children,
    showAnnounce = true,
    showInstall = true,
    showHeader = true,
}: {
    children: ReactNode;
    showAnnounce?: boolean;
    showInstall?: boolean;
    showHeader?: boolean;
}) {
    return (
        <div className="page">
            {showAnnounce && <AnnounceBar />}
            {showHeader && <SiteHeader showInstall={showInstall} />}
            <main>{children}</main>
            <SiteFooter />
        </div>
    );
}
