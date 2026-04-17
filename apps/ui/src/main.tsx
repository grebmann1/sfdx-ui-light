import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import Welcome from './Welcome';
import './styles.css';

const isWelcomePath = window.location.pathname.startsWith('/welcome');
const Root = isWelcomePath ? Welcome : App;

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Root />
    </StrictMode>
);
