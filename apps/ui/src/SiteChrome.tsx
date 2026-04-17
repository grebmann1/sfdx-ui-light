import type { ReactNode } from 'react';

export const APP_URL = import.meta.env.VITE_APP_URL || 'https://app.sf-toolkit.com';
export const DOCS_URL = import.meta.env.VITE_DOCS_URL || '/docs';
export const GITHUB_URL = 'https://github.com/grebmann1/sfdx-ui-light';
export const CHROME_STORE_URL =
    'https://chromewebstore.google.com/detail/salesforce-toolkit/konbmllgicfccombdckckakhnmejjoei?hl=en';

export function AnnounceBar() {
    return (
        <div className="announce-bar" role="note">
            <span className="announce-dot" aria-hidden="true" />
            The modern replacement for <strong>Salesforce Workbench</strong> and{' '}
            <strong>Benchpress</strong>
        </div>
    );
}

export function SiteHeader({ showInstall = true }: { showInstall?: boolean }) {
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
                <a
                    className="header-link"
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                >
                    GitHub
                </a>
                <a className="header-link" href={DOCS_URL}>
                    Docs
                </a>
                <a className="header-link" href={APP_URL}>
                    Open App
                </a>
                {showInstall && (
                    <a
                        className="button button-small"
                        href={CHROME_STORE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Install
                    </a>
                )}
            </nav>
        </header>
    );
}

export function SiteFooter() {
    return (
        <footer className="footer">
            <span className="footer-brand">Workbench</span>
            <div className="footer-links">
                <a href={DOCS_URL}>Documentation</a>
                <a href={APP_URL}>Application</a>
                <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
                    GitHub
                </a>
            </div>
            <span className="footer-copy">© {new Date().getFullYear()} Workbench</span>
        </footer>
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
