import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './i18n';
import App from './App';
import Welcome from './Welcome';
import './styles.css';

const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
if (gaId) {
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    document.head.appendChild(script);
    // @ts-expect-error — gtag global injected at runtime
    window.dataLayer = window.dataLayer || [];
    // @ts-expect-error — gtag global injected at runtime
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
    // @ts-expect-error — gtag global injected at runtime
    window.gtag('js', new Date());
    // @ts-expect-error — gtag global injected at runtime
    window.gtag('config', gaId);
}

const isWelcomePath = window.location.pathname.startsWith('/welcome');
const Root = isWelcomePath ? Welcome : App;

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Root />
    </StrictMode>
);
