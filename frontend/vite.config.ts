/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * Fills the Content-Security-Policy in index.html with the API origin, so the page can only
 * talk to its own backend.
 */
function contentSecurityPolicy(apiUrl: string): Plugin {
  let apiOrigin = '';
  try {
    apiOrigin = new URL(apiUrl).origin;
  } catch {
    apiOrigin = '';
  }
  let serving = false;
  return {
    name: 'pdf-insight-csp',
    configResolved(config) {
      serving = config.command === 'serve';
    },
    transformIndexHtml(html) {
      // The dev server injects inline scripts (React Refresh), so the policy is build-only.
      if (serving)
        return html.replace(/\s*<meta\s+http-equiv="Content-Security-Policy"[^>]*\/>/, '');
      return html.replace('%API_ORIGIN%', apiOrigin);
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:8000';

  return {
    // GitHub Pages serves the app from https://<user>.github.io/<repo>/, so the workflow sets
    // VITE_BASE_PATH=/<repo>/. Locally the app is served from the root.
    base: env.VITE_BASE_PATH || '/',
    plugins: [react(), contentSecurityPolicy(apiUrl)],
    build: { sourcemap: false },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
