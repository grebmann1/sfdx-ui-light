import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    base: process.env.UI_BASE_PATH || '/',
    server: {
        host: '0.0.0.0',
        port: 27100,
    },
    plugins: [react()],
    build: {
        outDir: '../../dist/ui',
        emptyOutDir: true,
        assetsDir: 'ui-assets',
    },
});
