const featureCards = [
    {
        title: 'Org Exploration',
        description: 'Inspect org metadata, objects, records, and platform configuration quickly.',
    },
    {
        title: 'Data Operations',
        description: 'Run SOQL, compare data, import/export records, and validate payloads in one place.',
    },
    {
        title: 'API and Events',
        description: 'Test REST APIs, inspect schemas, and work with platform events from one toolkit.',
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
                    <a href="/docs">Docs</a>
                    <a href="/app">Open App</a>
                    <a className="button button-small" href="/install">
                        Download
                    </a>
                </nav>
            </header>

            <main>
                <section className="hero">
                    <p className="eyebrow">Salesforce Administration Toolkit</p>
                    <h1>Ship admin workflows faster with SF Toolkit</h1>
                    <p className="hero-text">
                        A focused toolbox for org exploration, data operations, metadata workflows,
                        API testing, and productivity automation.
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
                </section>

                <section className="features" aria-label="Feature highlights">
                    {featureCards.map(card => (
                        <article key={card.title} className="card">
                            <h2>{card.title}</h2>
                            <p>{card.description}</p>
                        </article>
                    ))}
                </section>

                <section className="download">
                    <h2>Get started in minutes</h2>
                    <p>
                        Install the extension, connect your org, and start working with data,
                        metadata, and APIs from one interface.
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
