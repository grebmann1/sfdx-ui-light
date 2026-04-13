const featureCards = [
    {
        title: 'Org Exploration',
        description: 'Inspect metadata, objects, records, and org setup details without context switching.',
    },
    {
        title: 'Data Operations',
        description: 'Run SOQL, compare records, and import/export data through one focused workflow.',
    },
    {
        title: 'API and Events',
        description: 'Test REST endpoints, inspect schemas, and validate event-driven integrations quickly.',
    },
];

export default function App() {
    return (
        <div className="page">
            <header className="header">
                <a className="brand" href="/welcome">
                    SF Toolkit
                </a>
                <nav className="header-nav">
                    <a className="header-link" href="/docs">
                        Docs
                    </a>
                    <a className="header-link" href="/app">
                        Open App
                    </a>
                    <a className="button button-small" href="/install">
                        Download
                    </a>
                </nav>
            </header>

            <main>
                <section className="hero" aria-labelledby="welcome-title">
                    <div className="hero-content">
                        <p className="eyebrow">Salesforce Administration Toolkit</p>
                        <h1 id="welcome-title">Move from org questions to answers in minutes</h1>
                        <p className="hero-text">
                            SF Toolkit gives admins one clear place to explore orgs, run data workflows,
                            validate APIs, and keep delivery moving.
                        </p>
                        <div className="hero-actions">
                            <a className="button" href="/install">
                                Download Extension
                            </a>
                            <a className="button button-ghost" href="/app">
                                Launch Web App
                            </a>
                            <a className="button button-ghost" href="/docs">
                                Read Documentation
                            </a>
                        </div>
                    </div>
                    <aside className="hero-surface" aria-label="Included workflows">
                        <h2>Everything in one focused workspace</h2>
                        <ul className="hero-points">
                            <li>Explore metadata and records with full context.</li>
                            <li>Run SOQL and data validation workflows faster.</li>
                            <li>Test APIs and events before promoting changes.</li>
                        </ul>
                    </aside>
                </section>

                <section className="features-section" aria-labelledby="features-title">
                    <div className="section-heading">
                        <p className="section-kicker">Built for daily admin work</p>
                        <h2 id="features-title">Core capabilities</h2>
                    </div>
                    <div className="features" aria-label="Feature highlights">
                        {featureCards.map(card => (
                            <article key={card.title} className="card">
                                <h3>{card.title}</h3>
                                <p>{card.description}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="download" aria-labelledby="download-title">
                    <h2 id="download-title">Get started in minutes</h2>
                    <p>
                        Install the extension, connect your org, and start shipping data,
                        metadata, and API workflows from one interface.
                    </p>
                    <div className="hero-actions">
                        <a className="button" href="/install">
                            Install Now
                        </a>
                        <a className="button button-ghost" href="/docs/getting-started/installation">
                            Installation Guide
                        </a>
                    </div>
                </section>
            </main>

            <footer className="footer">
                <span>SF Toolkit</span>
                <a href="/docs">Documentation</a>
                <a href="/app">Application</a>
            </footer>
        </div>
    );
}
